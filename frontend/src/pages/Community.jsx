import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FiUsers, FiSend, FiX, FiLink, FiAward, FiImage, FiSearch, FiEye } from 'react-icons/fi';
import { communityService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { toast } from '../utils/toast';
import PostCard, { KIND_META, ACCENT } from '../components/PostCard';
import Markdown from '../components/Markdown';
import ImageLightbox from '../components/ImageLightbox';
import FlyIcon from '../components/FlyIcon';
import PublishTerminal from '../components/PublishTerminal';

const KIND_KEYS = ['idea', 'progress', 'question', 'showcase', 'code'];
const PLACEHOLDER = {
  idea: 'Share something that finally clicked…',
  progress: "What did you build or finish today?",
  question: 'What are you stuck on? Paste the code and the error.',
  showcase: 'Show what you made — add a link below.',
  code: 'Paste a snippet between ``` fences — share something useful.',
};

function Preview({ kind, body, images, tagList, link }) {
  const m = KIND_META[kind];
  const Icon = m.icon;
  const urls = useMemo(() => images.map((f) => URL.createObjectURL(f)), [images]);
  const [viewing, setViewing] = useState(-1);
  return (
    <div className="rounded-xl border border-cs-line/15 bg-cs-darkest/40 p-4">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border font-mono text-[10px] uppercase tracking-wide ${ACCENT[m.accent]}`}>
          <Icon className="text-[10px]" /> {m.label}
        </span>
        {tagList.map((t) => (
          <span key={t} className="font-mono text-[11px] text-cs-text-muted">#{t}</span>
        ))}
        {link && <span className="font-mono text-[11px] text-cs-primary truncate max-w-[180px]">{link}</span>}
        <span className="ml-auto font-mono text-[10px] text-cs-text-muted uppercase tracking-wide">preview</span>
      </div>
      {body.trim() ? (
        <Markdown>{body}</Markdown>
      ) : (
        <p className="text-sm text-cs-text-muted">Nothing to preview yet — write something first.</p>
      )}
      {urls.length === 1 && (
        <div onClick={() => setViewing(0)} className="mt-3 cursor-zoom-in">
          <div className="post-image-frame">
            <div className="p-3 sm:p-4 bg-cs-darkest/40 flex items-center justify-center min-h-[14rem]">
              <img src={urls[0]} alt="" className="max-w-full max-h-[26rem] object-contain rounded-md" />
            </div>
          </div>
        </div>
      )}
      {urls.length > 1 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
          {urls.map((src, i) => (
            <div
              key={i}
              onClick={() => setViewing(i)}
              className="aspect-square rounded-lg overflow-hidden bg-cs-darkest/50 border border-cs-line/10 cursor-zoom-in hover:border-cs-primary/40 transition-colors"
            >
              <img src={src} alt="" className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      )}
      {viewing >= 0 && (
        <ImageLightbox sources={urls} start={viewing} onClose={() => setViewing(-1)} />
      )}
    </div>
  );
}
const PAGE = 20;

function Composer({ onPosted, sendRef }) {
  const [kind, setKind] = useState('idea');
  const [body, setBody] = useState('');
  const [tags, setTags] = useState('');
  const [images, setImages] = useState([]);
  const [link, setLink] = useState('');
  const [showLink, setShowLink] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [posting, setPosting] = useState(false);
  const [viewing, setViewing] = useState(-1);
  const urls = useMemo(() => images.map((f) => URL.createObjectURL(f)), [images]);
  const dragDepth = useRef(0);
  const taRef = useRef(null);

  const autosize = useCallback(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 480)}px`;
  }, []);
  useEffect(() => { autosize(); }, [body, showPreview, autosize]);

  const MAX_IMAGES = 6;
  const tagList = tags.split(/[,\s]+/).map((t) => t.trim()).filter(Boolean).slice(0, 5);

  const addFiles = (files) => {
    const list = Array.from(files || []).filter((f) => f.type.startsWith('image/'));
    if (list.length) setImages((prev) => [...prev, ...list].slice(0, MAX_IMAGES));
  };

  const removeImage = (i) => setImages((prev) => prev.filter((_, idx) => idx !== i));

  const submit = async (e) => {
    e.preventDefault();
    if (posting || body.trim().length < 2) return;
    setPosting(true);
    try {
      const imageData = [];
      for (const f of images) {
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(f);
        });
        imageData.push(dataUrl);
      }
      const r = await communityService.createPost({
        kind,
        body: body.trim(),
        tags: tagList,
        images: imageData,
        link_url: link.trim() || null,
      });
      onPosted(r.data);
      setBody(''); setTags(''); setLink(''); setImages([]); setShowLink(false); setShowPreview(false); setKind('idea'); setViewing(-1);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not post.');
    } finally {
      setPosting(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className={`card mb-6 max-w-3xl transition-colors ${dragging ? 'border-cs-primary/60' : ''}`}
      onDragEnter={(e) => { e.preventDefault(); dragDepth.current++; setDragging(true); }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => { dragDepth.current = Math.max(0, dragDepth.current - 1); if (dragDepth.current === 0) setDragging(false); }}
      onDrop={(e) => { e.preventDefault(); dragDepth.current = 0; setDragging(false); addFiles(e.dataTransfer.files); }}
    >
      <div className="flex flex-wrap gap-1.5 mb-2">
        {KIND_KEYS.map((k) => {
          const km = KIND_META[k];
          const Icon = km.icon;
          const active = kind === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-mono text-[11px] uppercase tracking-wide transition-colors ${
                active ? ACCENT[km.accent] : 'border-cs-line/15 text-cs-text-muted hover:text-cs-text'
              }`}
            >
              <Icon className="text-[11px]" /> {km.label}
            </button>
          );
        })}
      </div>

      {showPreview ? (
        <Preview kind={kind} body={body} images={images} tagList={tagList} link={link.trim()} />
      ) : (
        <textarea
          ref={taRef}
          value={body}
          onChange={(e) => { setBody(e.target.value); autosize(); }}
          onInput={autosize}
          rows={2}
          maxLength={4000}
          placeholder={PLACEHOLDER[kind]}
          className="w-full rounded-lg bg-cs-darkest/70 border border-cs-line/15 px-3 py-2.5 text-sm font-mono outline-none focus:border-cs-primary/50 resize-none leading-relaxed overflow-y-auto min-h-[4.5rem] max-h-[30rem]"
        />
      )}

      {urls.length === 1 && (
        <div className="relative mt-3 group max-w-md">
          <div
            onClick={() => setViewing(0)}
            className="cursor-zoom-in rounded-lg overflow-hidden border border-cs-line/15 bg-cs-darkest"
          >
            <div className="flex items-center justify-center min-h-[7rem] p-3 sm:p-4">
              <img src={urls[0]} alt="" className="max-w-full max-h-80 object-contain rounded-md" />
            </div>
          </div>
          <button
            type="button"
            onClick={() => removeImage(0)}
            className="absolute top-2 right-2 p-1 rounded-full bg-cs-darkest/80 text-cs-text-muted hover:text-cs-red"
            title="Remove"
          >
            <FiX className="text-xs" />
          </button>
          <span className="pointer-events-none absolute inset-x-0 bottom-2 text-center font-mono text-[10px] text-cs-text-muted/70 opacity-0 group-hover:opacity-100 transition-opacity">
            click image to view full size
          </span>
        </div>
      )}
      {urls.length > 1 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
          {urls.map((src, i) => (
            <div
              key={i}
              onClick={() => setViewing(i)}
              className="relative group rounded-lg overflow-hidden border border-cs-line/15 bg-cs-darkest cursor-zoom-in hover:border-cs-primary/40 transition-colors"
            >
              <img src={src} alt="" className="w-full h-32 sm:h-40 object-cover group-hover:opacity-90 transition-opacity" />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeImage(i); }}
                className="absolute top-1.5 right-1.5 p-1 rounded-full bg-cs-darkest/80 text-cs-text-muted hover:text-cs-red"
                title="Remove"
              >
                <FiX className="text-xs" />
              </button>
            </div>
          ))}
        </div>
      )}
      {viewing >= 0 && (
        <ImageLightbox sources={urls} start={viewing} onClose={() => setViewing(-1)} />
      )}

      {dragging && (
        <div className="mt-3 rounded-xl border-2 border-dashed border-cs-primary/60 bg-cs-primary/5 p-6 text-center font-mono text-sm text-cs-primary">
          drop images to add them
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mt-3">
        <div className="flex flex-1 flex-wrap items-center gap-2 min-w-[200px]">
          <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-cs-line/25 text-cs-text-muted hover:text-cs-primary hover:border-cs-primary/40 text-xs font-mono cursor-pointer transition-colors">
            <FiImage /> {images.length ? `+ image (${images.length}/${MAX_IMAGES})` : 'add images · click or drop'}
            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          </label>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="tags: python, sql"
            className="flex-1 min-w-[140px] rounded-lg bg-cs-darkest/70 border border-cs-line/15 px-3 py-2 text-xs font-mono outline-none focus:border-cs-primary/50"
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
        </div>

        <div className="flex items-center gap-2 ml-auto shrink-0">
          <span className="font-mono text-[10px] text-cs-text-muted tabular-nums">{body.length}/4000</span>
          <button
            type="button"
            onClick={() => setShowPreview((p) => !p)}
            className={`btn btn-sm ${showPreview ? 'btn-secondary' : 'btn-ghost'}`}
          >
            <FiEye /> {showPreview ? 'Editor' : 'Preview'}
          </button>
          <button
            ref={sendRef}
            type="submit"
            disabled={posting || body.trim().length < 2}
            className="btn btn-primary btn-sm disabled:opacity-40"
          >
            <FiSend /> {posting ? 'Posting…' : 'Post'}
          </button>
        </div>
      </div>
    </form>
  );
}

function Community() {
  const { user: me } = useAuth();
  const [params, setParams] = useSearchParams();
  const tag = params.get('tag') || '';
  const [sort, setSort] = useState('new');
  const [kind, setKind] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const [posts, setPosts] = useState(null); // null = loading, false = error
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [fly, setFly] = useState(null);
  const [term, setTerm] = useState(null);
  const [landed, setLanded] = useState(null);
  const [pending, setPending] = useState(null);
  const sendRef = useRef(null);
  const feedRef = useRef(null);
  const offsetRef = useRef(0);

  const load = useCallback(async (reset) => {
    if (reset) { offsetRef.current = 0; setPosts(null); }
    try {
      const r = await communityService.posts({
        sort, tag: tag || undefined, kind: kind || undefined, search: search || undefined,
        limit: PAGE, offset: reset ? 0 : offsetRef.current,
      });
      setHasMore(r.data.has_more);
      offsetRef.current += r.data.posts.length;
      setPosts((prev) => (reset || !prev ? r.data.posts : [...prev, ...r.data.posts]));
    } catch {
      setPosts((prev) => prev || false);
      toast.error('Could not load the feed.');
    }
  }, [sort, tag, kind, search]);

  useEffect(() => { load(true); }, [load]);

  const more = async () => {
    setLoadingMore(true);
    await load(false);
    setLoadingMore(false);
  };

  const prepend = (p) => setPosts((prev) => [p, ...(prev || [])]);
  const drop = (id) => setPosts((prev) => (prev || []).filter((x) => x.id !== id));

  const onPost = (p) => {
    setComposerOpen(false);
    const fr = sendRef.current?.getBoundingClientRect();
    if (!fr) return;
    setPending(p);
    setTerm({ anchor: { x: fr.left + fr.width / 2, y: fr.top + fr.height / 2 }, id: p.id });
  };

  const termDone = () => {
    const t = term;
    setTerm(null);
    if (!t) return;
    const tr = feedRef.current?.getBoundingClientRect();
    if (!tr) return;
    setFly({ from: t.anchor, to: { x: tr.left + tr.width / 2, y: tr.top + 8 } });
  };

  const flyDone = () => {
    setFly(null);
    if (!pending) return;
    prepend(pending);
    setLanded(pending.id);
    window.setTimeout(() => setLanded((id) => (id === pending.id ? null : id)), 1600);
    setPending(null);
    toast.success('Posted to the community');
  };

  return (
    <main className="w-full px-6 lg:pl-10 lg:pr-16 xl:pr-24 py-8">
      <div className="sticky top-0 z-30 -mx-6 lg:-ml-10 lg:-mr-16 xl:-mr-24 px-6 lg:pl-10 lg:pr-16 xl:pr-24 -mt-8 pt-6 pb-4 mb-6 bg-cs-dark/90 backdrop-blur-xl border-b border-cs-line/[0.07]">
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <span className="font-mono text-xs text-cs-text-muted tracking-wide">~/community</span>
            <h1 className="text-2xl font-semibold mt-0.5 tracking-tight">Dev community</h1>
            <p className="text-sm text-cs-text-dim mt-1.5 max-w-[52ch]">
              Learn in public — share ideas, progress, questions and what you're building.
            </p>
          </div>
          <Link to="/leaderboard" className="btn btn-ghost btn-sm shrink-0 hidden sm:inline-flex">
            <FiAward /> Leaderboard
          </Link>
        </div>

        {/* Search */}
        <div className="mt-4 flex items-center justify-end gap-2">
          {searchOpen ? (
            <form
              onSubmit={(e) => { e.preventDefault(); setSearch(searchInput.trim()); }}
              className="flex items-center gap-2 flex-1 max-w-md"
            >
              <div className="relative flex-1 min-w-0">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-cs-text-muted text-sm" />
                <input
                  autoFocus
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onBlur={() => { if (!searchInput.trim() && !search) setSearchOpen(false); }}
                  placeholder="search users, devs or the feed…"
                  className="w-full rounded-lg bg-cs-darkest/70 border border-cs-line/15 pl-9 pr-3 py-1.5 text-sm font-mono outline-none focus:border-cs-primary/50 placeholder:text-cs-text-muted/60"
                />
              </div>
              <button type="submit" className="btn btn-primary btn-sm">Search</button>
              {search ? (
                <button
                  type="button"
                  onClick={() => { setSearch(''); setSearchInput(''); }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-cs-line/15 text-cs-text-muted hover:text-cs-text font-mono text-xs"
                >
                  clear <FiX />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => { setSearchInput(''); setSearchOpen(false); }}
                  aria-label="Close search"
                  className="p-2 rounded-lg text-cs-text-muted hover:text-cs-text hover:bg-cs-overlay/5"
                >
                  <FiX />
                </button>
              )}
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              title="Search feed"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-cs-line/15 text-cs-text-muted hover:text-cs-primary hover:border-cs-primary/40 font-mono text-xs transition-colors"
            >
              <FiSearch className="text-sm" />
              {search && <span className="text-cs-primary">#{search}</span>}
            </button>
          )}
        </div>
      </div>

      {composerOpen ? (
        <Composer onPosted={onPost} sendRef={sendRef} />
      ) : (
        <button
          type="button"
          onClick={() => setComposerOpen(true)}
          className="w-full max-w-3xl mb-6 flex items-center gap-3 rounded-2xl border border-cs-line/10 bg-cs-darker/40 px-4 py-3 text-left transition-colors hover:border-cs-primary/40 group"
        >
          <span className="w-9 h-9 rounded-xl bg-cs-darkest border border-cs-primary/25 flex items-center justify-center font-mono font-bold text-cs-primary overflow-hidden shrink-0">
            {me?.avatar
              ? <img src={me.avatar} alt="" className="w-full h-full object-cover" />
              : <span>{(me?.display_name || me?.username)?.charAt(0).toUpperCase() || '?'}</span>}
          </span>
          <span className="flex-1 font-mono text-sm text-cs-text-muted group-hover:text-cs-text transition-colors">
            Share progress, ask a question or show what you built…
          </span>
          <FiSend className="text-cs-text-muted group-hover:text-cs-primary transition-colors shrink-0" />
        </button>
      )}

      {term && (
        <PublishTerminal
          anchor={term.anchor}
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

      {/* Filter bar: kind pills + sort */}
      <div className="-mx-6 lg:-ml-10 lg:-mr-16 xl:-mr-24 px-6 lg:pl-10 lg:pr-16 xl:pr-24 mb-3 pb-2.5 border-b border-cs-line/[0.07]">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none" ref={feedRef}>
            {['', ...KIND_KEYS].map((k) => {
              const Meta = k ? KIND_META[k] : null;
              const Icon = Meta ? Meta.icon : FiUsers;
              const active = kind === k;
              return (
                <button
                  key={k || 'all'}
                  onClick={() => setKind(k)}
                  className={`tap inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border font-mono text-xs whitespace-nowrap ${
                    active
                      ? Meta ? ACCENT[Meta.accent] : 'bg-cs-primary/15 text-cs-primary border-cs-primary/40'
                      : 'border-cs-line/15 text-cs-text-muted hover:text-cs-text'
                  }`}
                >
                  <Icon className="text-[11px]" />
                  {k ? Meta.label : 'all'}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {tag && (
              <button
                onClick={() => setParams({})}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-cs-primary/40 bg-cs-primary/10 text-cs-primary font-mono text-xs"
              >
                #{tag} <FiX />
              </button>
            )}
            <div className="inline-flex rounded-full border border-cs-line/15 overflow-hidden font-mono text-xs">
              {['new', 'top'].map((s) => (
                <button
                  key={s}
                  onClick={() => setSort(s)}
                  className={`tap px-3 py-1.5 capitalize ${
                    sort === s ? 'bg-cs-primary/15 text-cs-primary' : 'text-cs-text-muted hover:text-cs-text'
                  } ${s === 'top' ? 'border-l border-cs-line/15' : ''}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
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
            {search
              ? `Nothing matches “${search}”.`
              : tag
                ? `Nothing tagged #${tag} yet.`
                : 'No posts yet — be the first to share what you’re learning.'}
          </p>
        </div>
      )}

      {Array.isArray(posts) && posts.length > 0 && (
        <div>
          <div className="divide-y divide-cs-line/10">
            {posts.map((p) => (
              <div key={p.id} className={landed === p.id ? 'animate-post-land' : ''}>
                <PostCard post={p} onDelete={drop} />
              </div>
            ))}
          </div>
          {hasMore && (
            <button
              onClick={more}
              disabled={loadingMore}
              className="btn btn-secondary btn-sm w-full justify-center mt-4"
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
