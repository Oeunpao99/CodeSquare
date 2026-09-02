import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiCornerUpLeft, FiSend, FiTrash2, FiHeart } from 'react-icons/fi';
import { communityService } from '../services/api';
import { toast } from '../utils/toast';
import PostCard, { Avatar, AuthorName, timeAgo } from '../components/PostCard';
import ConfirmDialog from '../components/ConfirmDialog';
import FlyIcon from '../components/FlyIcon';
import PublishTerminal from '../components/PublishTerminal';

function EditForm({ post, onSaved, onCancel }) {
  const [body, setBody] = useState(post.body);
  const [tags, setTags] = useState((post.tags || []).join(', '));
  const [link, setLink] = useState(post.link_url || '');
  const [saving, setSaving] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await communityService.updatePost(post.id, {
        body: body.trim(),
        tags: tags.split(/[,\s]+/).map((t) => t.trim()).filter(Boolean).slice(0, 5),
        link_url: link.trim() || null,
      });
      onSaved(r.data);
      toast.success('Post updated');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="card mb-4 border-cs-primary/30">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={5}
        maxLength={4000}
        className="w-full rounded-lg bg-cs-darkest/70 border border-cs-line/15 px-3 py-2.5 text-sm font-mono outline-none focus:border-cs-primary/50 resize-y leading-relaxed"
      />
      <div className="flex flex-wrap items-center gap-2 mt-2">
        <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="tags" className="flex-1 min-w-[140px] rounded-lg bg-cs-darkest/70 border border-cs-line/15 px-3 py-2 text-xs font-mono outline-none focus:border-cs-primary/50" />
        <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="link (optional)" className="flex-1 min-w-[160px] rounded-lg bg-cs-darkest/70 border border-cs-line/15 px-3 py-2 text-xs font-mono outline-none focus:border-cs-primary/50" />
        <button type="button" onClick={onCancel} className="btn btn-ghost btn-sm">Cancel</button>
        <button type="submit" disabled={saving} className="btn btn-primary btn-sm disabled:opacity-40">{saving ? 'Saving…' : 'Save'}</button>
      </div>
    </form>
  );
}

// Insert an added reply under its parent (any depth).
const insertReply = (comments, parentId, reply) =>
  comments.map((c) => {
    if (c.id === parentId) return { ...c, replies: [...(c.replies || []), reply] };
    if (c.replies && c.replies.length) return { ...c, replies: insertReply(c.replies, parentId, reply) };
    return c;
  });

const removeThread = (comments, cid) =>
  comments
    .filter((c) => c.id !== cid)
    .map((c) => (c.replies && c.replies.length ? { ...c, replies: removeThread(c.replies, cid) } : c));

const threadSize = (comments, cid) => {
  for (const c of comments) {
    if (c.id === cid) return 1 + (c.replies ? c.replies.length : 0);
    const n = threadSize(c.replies || [], cid);
    if (n) return n;
  }
  return 0;
};

const replaceComment = (comments, cid, next) =>
  comments.map((c) => {
    if (c.id === cid) return { ...c, ...next };
    if (c.replies && c.replies.length) return { ...c, replies: replaceComment(c.replies, cid, next) };
    return c;
  });

function CommunityPost() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null); // null loading, false not-found
  const [editing, setEditing] = useState(false);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [replySending, setReplySending] = useState(false);
  const [fly, setFly] = useState(null);
  const [term, setTerm] = useState(null);
  const [landed, setLanded] = useState(null);
  const [pending, setPending] = useState(null); // { data, parentId } awaiting reveal
  const [confirmDelete, setConfirmDelete] = useState(null);
  const commentRef = useRef(null);
  const commentSendRef = useRef(null);
  const commentListRef = useRef(null);
  const replyRef = useRef(null);
  const replySendRef = useRef(null);
  const commentEls = useRef({});

  const grow = (el) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };
  const growComment = () => grow(commentRef.current);
  const growReply = () => grow(replyRef.current);

  useEffect(() => {
    setPost(null);
    communityService.post(id)
      .then((r) => setPost(r.data))
      .catch(() => setPost(false));
  }, [id]);

  const onCardChange = (next) => {
    if (next._edit) { setEditing(true); return; }
    setPost((p) => ({ ...p, ...next }));
  };

  const launchReply = (pid) => {
    setReplyTo(replyTo === pid ? null : pid);
    if (replyTo !== pid) setReplyText('');
  };

  const termDone = () => {
    const t = term;
    setTerm(null);
    if (!t) return;
    let tr = null;
    if (t.kind === 'reply') {
      tr = commentEls.current[t.parentId]?.getBoundingClientRect();
    }
    if (!tr) {
      tr = commentListRef.current?.getBoundingClientRect();
    }
    if (!tr) return;
    setFly({ from: t.anchor, to: { x: tr.left + tr.width / 2, y: tr.top + 8 } });
  };

  const flyDone = () => {
    setFly(null);
    if (!pending) return;
    const d = pending;
    setPending(null);
    if (d.parentId) {
      setPost((p) => ({
        ...p,
        comments: insertReply(p.comments, d.parentId, d.data),
        comment_count: (p.comment_count || 0) + 1,
      }));
    } else {
      setPost((p) => ({ ...p, comments: [...p.comments, d.data], comment_count: (p.comment_count || 0) + 1 }));
    }
    setLanded(d.data.id);
    window.setTimeout(() => setLanded((cid) => (cid === d.data.id ? null : cid)), 1600);
  };

  const addComment = async (e) => {
    e.preventDefault();
    if (sending || !comment.trim()) return;
    setSending(true);
    try {
      const r = await communityService.addComment(id, comment.trim());
      setPending({ data: r.data, parentId: null });
      setComment('');
      const el = commentRef.current;
      if (el) el.style.height = 'auto';
      const fr = commentSendRef.current?.getBoundingClientRect();
      if (fr) {
        setTerm({ anchor: { x: fr.left + fr.width / 2, y: fr.top + fr.height / 2 }, kind: 'top', id: r.data.id, parentId: null });
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not comment.');
    } finally {
      setSending(false);
    }
  };

  const submitReply = async (e, parentId) => {
    e.preventDefault();
    if (replySending || !replyText.trim()) return;
    setReplySending(true);
    try {
      const r = await communityService.addComment(id, replyText.trim(), parentId);
      setPending({ data: r.data, parentId });
      const fr = replySendRef.current?.getBoundingClientRect();
      if (fr) {
        setTerm({ anchor: { x: fr.left + fr.width / 2, y: fr.top + fr.height / 2 }, kind: 'reply', id: r.data.id, parentId });
      }
      setReplyTo(null);
      setReplyText('');
      const el = replyRef.current;
      if (el) el.style.height = 'auto';
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not reply.');
    } finally {
      setReplySending(false);
    }
  };

  const removeComment = async (cid) => {
    setConfirmDelete(null);
    try {
      await communityService.deleteComment(cid);
      setPost((p) => ({
        ...p,
        comments: removeThread(p.comments, cid),
        comment_count: Math.max(0, (p.comment_count || 0) - threadSize(p.comments, cid)),
      }));
    } catch {
      toast.error('Could not delete.');
    }
  };

  const likeComment = async (c) => {
    const prev = { ...c };
    const next = { ...c, liked_by_me: !c.liked_by_me, like_count: (c.like_count || 0) + (c.liked_by_me ? -1 : 1) };
    setPost((p) => ({ ...p, comments: replaceComment(p.comments, c.id, next) }));
    try {
      const r = await communityService.likeComment(id, c.id);
      setPost((p) => ({
        ...p,
        comments: replaceComment(p.comments, c.id, {
          ...next, liked_by_me: r.data.liked, like_count: r.data.like_count,
        }),
      }));
    } catch {
      setPost((p) => ({ ...p, comments: replaceComment(p.comments, c.id, prev) }));
      toast.error('Could not like.');
    }
  };

  const renderThread = (c, depth) => (
    <div
      key={c.id}
      ref={(el) => {
        commentEls.current[c.id] = el;
      }}
      className={`rounded-xl border border-cs-line/10 bg-cs-darker/50 p-3.5 ${landed === c.id ? 'animate-post-land' : ''}`}
    >
      <div className="flex items-center gap-2.5 mb-1.5">
        <Avatar author={c.author} size="w-7 h-7" />
        <span className="flex items-center gap-1 font-mono text-sm font-semibold min-w-0">
          <AuthorName author={c.author} to={`/u/${c.author.username}`} className="text-sm font-semibold" />
          {c.is_mine && <span className="text-cs-primary font-normal whitespace-nowrap">· you</span>}
        </span>
        <span className="font-mono text-[10px] text-cs-text-muted">{timeAgo(c.created_at)}</span>
        <span className="flex-grow" />
        {c.can_delete && (
          <button onClick={() => setConfirmDelete(c.id)} className="text-cs-text-muted hover:text-cs-red p-1" title="Delete">
            <FiTrash2 className="text-xs" />
          </button>
        )}
      </div>
      <p className="text-sm text-cs-text-dim whitespace-pre-line pl-9">{c.body}</p>

      <div className="pl-9 mt-1.5 flex items-center gap-3">
        <button
          type="button"
          onClick={() => likeComment(c)}
          className={`inline-flex items-center gap-1 text-[11px] font-mono transition-colors ${
            c.liked_by_me
              ? 'text-cs-red'
              : 'text-cs-text-muted hover:text-cs-red'
          }`}
          title={c.liked_by_me ? 'Unlike' : 'Like'}
        >
          <FiHeart className={`text-xs ${c.liked_by_me ? 'fill-current' : ''}`} />
          {c.like_count ? c.like_count : ''}
        </button>
        <button
          type="button"
          onClick={() => launchReply(c.id)}
          className="inline-flex items-center gap-1 text-[11px] font-mono text-cs-text-muted hover:text-cs-primary transition-colors"
        >
          <FiCornerUpLeft className="text-xs" /> {replyTo === c.id ? 'Cancel reply' : 'Reply'}
        </button>
      </div>

      {replyTo === c.id && (
        <form onSubmit={(e) => submitReply(e, c.id)} className="mt-2 pl-9">
          <textarea
            ref={replyRef}
            value={replyText}
            onChange={(e) => { setReplyText(e.target.value); growReply(); }}
            rows={1}
            maxLength={1000}
            placeholder="Reply to this comment…"
            autoFocus
            className="w-full rounded-lg bg-cs-darkest/70 border border-cs-line/15 px-3 py-2 text-sm font-mono outline-none focus:border-cs-primary/50 resize-none overflow-hidden"
          />
          <div className="flex justify-end gap-2 mt-1.5">
            <button type="button" onClick={() => { setReplyTo(null); setReplyText(''); }} className="btn btn-ghost btn-sm">Cancel</button>
            <button ref={replySendRef} type="submit" disabled={replySending || !replyText.trim()} className="btn btn-primary btn-sm disabled:opacity-40">
              <FiSend /> {replySending ? 'Sending…' : 'Reply'}
            </button>
          </div>
        </form>
      )}

      {c.replies && c.replies.length > 0 && (
        <div className="mt-3 space-y-3 border-l border-cs-line/12 pl-3 ml-1">
          {c.replies.map((r) => renderThread(r, depth + 1))}
        </div>
      )}
    </div>
  );

  return (
    <main className="w-full px-6 lg:px-10 py-8">
      <div className="sticky top-0 z-30 -mx-6 lg:-mx-10 px-6 lg:px-10 pt-4 pb-4 -mt-8 mb-6 bg-cs-dark/85 backdrop-blur-xl border-b border-cs-line/[0.07]">
        <Link to="/community" className="inline-flex items-center gap-2 text-sm font-mono text-cs-text-dim hover:text-cs-primary">
          <FiArrowLeft /> ../community
        </Link>
      </div>

      {post === null && <p className="text-cs-text-muted font-mono text-sm">loading post…</p>}
      {post === false && (
        <div className="card text-center py-14 border-cs-orange/25">
          <p className="font-mono text-4xl mb-3 text-cs-text-muted select-none">404</p>
          <p className="text-cs-text-dim mb-6 font-mono text-sm">This post doesn’t exist or was removed.</p>
          <Link to="/community" className="btn btn-primary btn-sm">Back to the feed</Link>
        </div>
      )}

      {post && post !== false && (
        <div className="max-w-3xl">
          {editing ? (
            <EditForm
              post={post}
              onCancel={() => setEditing(false)}
              onSaved={(next) => { setPost((p) => ({ ...p, ...next })); setEditing(false); }}
            />
          ) : (
            <div className="border-b border-cs-line/10">
              <PostCard
                post={post}
                full
                onChange={onCardChange}
                onDelete={() => navigate('/community')}
              />
            </div>
          )}

          <section className="mt-6">
            <h2 className="font-mono text-sm text-cs-text-muted mb-3">
              {post.comment_count || 0} comment{post.comment_count === 1 ? '' : 's'}
            </h2>

            <form onSubmit={addComment} className="card mb-4">
              <textarea
                ref={commentRef}
                value={comment}
                onChange={(e) => { setComment(e.target.value); growComment(); }}
                rows={2}
                maxLength={1000}
                placeholder="Add a comment…"
                className="w-full rounded-lg bg-cs-darkest/70 border border-cs-line/15 px-3 py-2.5 text-sm font-mono outline-none focus:border-cs-primary/50 resize-none overflow-hidden"
              />
              <div className="flex justify-end mt-2">
                <button ref={commentSendRef} type="submit" disabled={sending || !comment.trim()} className="btn btn-primary btn-sm disabled:opacity-40">
                  <FiSend /> {sending ? 'Sending…' : 'Comment'}
                </button>
              </div>
            </form>

            {term && (
              <PublishTerminal
                anchor={term.anchor}
                verb="post"
                noun="comment"
                onDone={termDone}
              />
            )}

            {fly && (
              <FlyIcon from={fly.from} to={fly.to} onDone={flyDone}>
                <div className="w-8 h-8 rounded-full bg-cs-primary flex items-center justify-center text-cs-dark shadow-[0_4px_16px_rgba(45,212,191,.5)]">
                  <FiSend className="text-sm" />
                </div>
              </FlyIcon>
            )}

            <div ref={commentListRef} className="space-y-3">
              {post.comments.map((c) => renderThread(c, 0))}
              {post.comments.length === 0 && (
                <p className="text-cs-text-muted font-mono text-xs">No comments yet — start the thread.</p>
              )}
            </div>

            <ConfirmDialog
              open={confirmDelete != null}
              title="Delete comment"
              message="Delete this comment? If it has replies, they’ll be removed too."
              confirmLabel="Delete"
              confirmClass="btn-danger"
              onConfirm={() => removeComment(confirmDelete)}
              onCancel={() => setConfirmDelete(null)}
            />
          </section>
        </div>
      )}
    </main>
  );
}

export default CommunityPost;