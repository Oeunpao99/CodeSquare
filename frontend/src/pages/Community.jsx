import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FiUsers, FiSend, FiX, FiLink, FiAward } from 'react-icons/fi';
import { communityService } from '../services/api';
import { toast } from '../utils/toast';
import PostCard, { KIND_META } from '../components/PostCard';

const KIND_KEYS = ['idea', 'progress', 'question', 'showcase'];
const PLACEHOLDER = {
  idea: 'Share something that finally clicked…',
  progress: "What did you build or finish today?",
  question: 'What are you stuck on? Paste the code and the error.',
  showcase: 'Show what you made — add a link below.',
};
const PAGE = 20;

function Composer({ onPosted }) {
  const [kind, setKind] = useState('idea');
  const [body, setBody] = useState('');
  const [tags, setTags] = useState('');
  const [link, setLink] = useState('');
  const [showLink, setShowLink] = useState(false);
  const [posting, setPosting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (posting || body.trim().length < 2) return;
    setPosting(true);
    try {
      const r = await communityService.createPost({
        kind,
        body: body.trim(),
        tags: tags.split(/[,\s]+/).map((t) => t.trim()).filter(Boolean).slice(0, 5),
        link_url: link.trim() || null,
      });
      onPosted(r.data);
      setBody(''); setTags(''); setLink(''); setShowLink(false); setKind('idea');
      toast.success('Posted to the community');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not post.');
    } finally {
      setPosting(false);
    }
  };

  return (
    <form onSubmit={submit} className="card mb-6">
      <div className="flex flex-wrap gap-1.5 mb-3">
        {KIND_KEYS.map((k) => {
          const m = KIND_META[k];
          const Icon = m.icon;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-mono text-[11px] uppercase tracking-wide transition-colors ${
                kind === k ? m.cls : 'border-cs-line/15 text-cs-text-muted hover:text-cs-text'
              }`}
            >
              <Icon className="text-[11px]" /> {m.label}
            </button>
          );
        })}
      </div>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        maxLength={4000}
        placeholder={PLACEHOLDER[kind]}
        className="w-full rounded-lg bg-cs-darkest/70 border border-cs-line/15 px-3 py-2.5 text-sm font-mono outline-none focus:border-cs-primary/50 resize-y leading-relaxed"
      />

      <div className="flex flex-wrap items-center gap-2 mt-2">
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="tags: python, sql"
          className="flex-1 min-w-[160px] rounded-lg bg-cs-darkest/70 border border-cs-line/15 px-3 py-2 text-xs font-mono outline-none focus:border-cs-primary/50"
        />
        {!showLink ? (
          <button type="button" onClick={() => setShowLink(true)} className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-cs-line/15 text-cs-text-muted hover:text-cs-primary text-xs font-mono">
            <FiLink /> add link
          </button>
        ) : (
          <div className="flex items-center gap-1 flex-1 min-w-[200px]">
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://github.com/you/project"
              className="flex-1 rounded-lg bg-cs-darkest/70 border border-cs-line/15 px-3 py-2 text-xs font-mono outline-none focus:border-cs-primary/50"
            />
            <button type="button" onClick={() => { setShowLink(false); setLink(''); }} className="p-2 text-cs-text-muted hover:text-cs-red"><FiX /></button>
          </div>
        )}
        <span className="font-mono text-[10px] text-cs-text-muted">{body.length}/4000</span>
        <button
          type="submit"
          disabled={posting || body.trim().length < 2}
          className="btn btn-primary btn-sm disabled:opacity-40"
        >
          <FiSend /> {posting ? 'Posting…' : 'Post'}
        </button>
      </div>
    </form>
  );
}

function Community() {
  const [params, setParams] = useSearchParams();
  const tag = params.get('tag') || '';
  const [sort, setSort] = useState('new');
  const [posts, setPosts] = useState(null); // null = loading, false = error
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const offsetRef = useRef(0);

  const load = useCallback(async (reset) => {
    if (reset) { offsetRef.current = 0; setPosts(null); }
    try {
      const r = await communityService.posts({
        sort, tag: tag || undefined, limit: PAGE, offset: reset ? 0 : offsetRef.current,
      });
      setHasMore(r.data.has_more);
      offsetRef.current += r.data.posts.length;
      setPosts((prev) => (reset || !prev ? r.data.posts : [...prev, ...r.data.posts]));
    } catch {
      setPosts((prev) => prev || false);
      toast.error('Could not load the feed.');
    }
  }, [sort, tag]);

  useEffect(() => { load(true); }, [load]);

  const more = async () => {
    setLoadingMore(true);
    await load(false);
    setLoadingMore(false);
  };

  const prepend = (p) => setPosts((prev) => [p, ...(prev || [])]);
  const drop = (id) => setPosts((prev) => (prev || []).filter((x) => x.id !== id));

  return (
    <main className="w-full px-6 lg:px-10 py-8">
      <div className="sticky top-0 z-30 -mx-6 lg:-mx-10 px-6 lg:px-10 pt-4 pb-4 -mt-8 mb-6 bg-cs-dark/85 backdrop-blur-xl border-b border-cs-line/[0.07]">
        <div className="flex items-end justify-between gap-4 flex-wrap lg:pr-14">
          <div>
            <span className="mono-label text-cs-primary">// community</span>
            <h1 className="text-3xl font-bold mt-2 flex items-center gap-3">
              <FiUsers className="text-cs-primary" /> Dev Community
            </h1>
            <p className="text-sm text-cs-text-dim mt-1">
              Learn in public — share ideas, progress, questions and what you're building.
            </p>
          </div>
          <Link to="/leaderboard" className="btn btn-ghost btn-sm shrink-0">
            <FiAward /> Leaderboard
          </Link>
        </div>
      </div>

      <Composer onPosted={prepend} />

      <div className="flex items-center gap-2 mb-4">
        <div className="inline-flex rounded-lg border border-cs-line/15 overflow-hidden font-mono text-xs">
          {['new', 'top'].map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`px-3 py-1.5 capitalize transition-colors ${
                sort === s ? 'bg-cs-primary/15 text-cs-primary' : 'text-cs-text-muted hover:text-cs-text'
              } ${s === 'top' ? 'border-l border-cs-line/15' : ''}`}
            >
              {s}
            </button>
          ))}
        </div>
        {tag && (
          <button
            onClick={() => setParams({})}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-cs-primary/40 bg-cs-primary/10 text-cs-primary font-mono text-xs"
          >
            #{tag} <FiX />
          </button>
        )}
      </div>

      {posts === null && <p className="text-cs-text-muted font-mono text-sm">loading /community…</p>}
      {posts === false && (
        <div className="card text-center py-14 border-cs-red/20">
          <p className="text-cs-text-dim font-mono text-sm">Couldn't load the feed. Try again in a bit.</p>
        </div>
      )}
      {Array.isArray(posts) && posts.length === 0 && (
        <div className="card text-center py-14 border-cs-primary/20">
          <p className="text-4xl mb-3">👋</p>
          <p className="text-cs-text-dim font-mono text-sm max-w-sm mx-auto">
            {tag ? `Nothing tagged #${tag} yet.` : 'No posts yet — be the first to share what you’re learning.'}
          </p>
        </div>
      )}

      {Array.isArray(posts) && posts.length > 0 && (
        <div className="space-y-4">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} onDelete={drop} />
          ))}
          {hasMore && (
            <button
              onClick={more}
              disabled={loadingMore}
              className="btn btn-secondary btn-sm w-full justify-center"
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          )}
        </div>
      )}
    </main>
  );
}

export default Community;
