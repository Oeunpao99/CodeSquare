import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiSend, FiTrash2 } from 'react-icons/fi';
import { communityService } from '../services/api';
import { toast } from '../utils/toast';
import PostCard, { Avatar, AuthorName, timeAgo } from '../components/PostCard';

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

function CommunityPost() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null); // null loading, false not-found
  const [editing, setEditing] = useState(false);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);

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

  const addComment = async (e) => {
    e.preventDefault();
    if (sending || !comment.trim()) return;
    setSending(true);
    try {
      const r = await communityService.addComment(id, comment.trim());
      setPost((p) => ({ ...p, comments: [...p.comments, r.data], comment_count: (p.comment_count || 0) + 1 }));
      setComment('');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not comment.');
    } finally {
      setSending(false);
    }
  };

  const removeComment = async (cid) => {
    if (!confirm('Delete this comment?')) return;
    try {
      await communityService.deleteComment(cid);
      setPost((p) => ({
        ...p,
        comments: p.comments.filter((c) => c.id !== cid),
        comment_count: Math.max(0, (p.comment_count || 1) - 1),
      }));
    } catch {
      toast.error('Could not delete.');
    }
  };

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
        <>
          {editing ? (
            <EditForm
              post={post}
              onCancel={() => setEditing(false)}
              onSaved={(next) => { setPost((p) => ({ ...p, ...next })); setEditing(false); }}
            />
          ) : (
            <PostCard
              post={post}
              full
              onChange={onCardChange}
              onDelete={() => navigate('/community')}
            />
          )}

          <section className="mt-6">
            <h2 className="font-mono text-sm text-cs-text-muted mb-3">
              {post.comment_count || 0} comment{post.comment_count === 1 ? '' : 's'}
            </h2>

            <form onSubmit={addComment} className="card mb-4">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                maxLength={1000}
                placeholder="Add a comment…"
                className="w-full rounded-lg bg-cs-darkest/70 border border-cs-line/15 px-3 py-2.5 text-sm font-mono outline-none focus:border-cs-primary/50 resize-y"
              />
              <div className="flex justify-end mt-2">
                <button type="submit" disabled={sending || !comment.trim()} className="btn btn-primary btn-sm disabled:opacity-40">
                  <FiSend /> {sending ? 'Sending…' : 'Comment'}
                </button>
              </div>
            </form>

            <div className="space-y-3">
              {post.comments.map((c) => (
                <div key={c.id} className="rounded-xl border border-cs-line/10 bg-cs-darker/50 p-3.5">
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <Avatar author={c.author} size="w-7 h-7" />
                    <span className="flex items-center gap-1 font-mono text-sm font-semibold min-w-0">
                      <AuthorName author={c.author} to={`/u/${c.author.username}`} className="text-sm font-semibold" />
                      {c.is_mine && <span className="text-cs-primary font-normal whitespace-nowrap">· you</span>}
                    </span>
                    <span className="font-mono text-[10px] text-cs-text-muted">{timeAgo(c.created_at)}</span>
                    <span className="flex-grow" />
                    {c.can_delete && (
                      <button onClick={() => removeComment(c.id)} className="text-cs-text-muted hover:text-cs-red p-1" title="Delete">
                        <FiTrash2 className="text-xs" />
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-cs-text-dim whitespace-pre-line pl-9">{c.body}</p>
                </div>
              ))}
              {post.comments.length === 0 && (
                <p className="text-cs-text-muted font-mono text-xs">No comments yet — start the thread.</p>
              )}
            </div>
          </section>
        </>
      )}
    </main>
  );
}

export default CommunityPost;
