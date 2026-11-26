import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiUsers, FiSend, FiX, FiLink, FiAward, FiImage, FiSearch, FiEye, FiMessageSquare, FiPlus, FiChevronDown, FiCheck, FiHash, FiThumbsUp } from 'react-icons/fi';
import { communityService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { toast } from '../utils/toast';
import PostCard, { KIND_META, ACCENT } from '../components/PostCard';
import CommunityBanner from '../components/CommunityBanner';
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
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[0.625rem] uppercase tracking-wide ${ACCENT[m.accent]}`}>
          <Icon className="text-[0.625rem]" /> {m.label}
        </span>
        {tagList.map((t) => (
          <span key={t} className="text-[0.6875rem] text-cs-text-muted">#{t}</span>
        ))}
        {link && <span className="text-[0.6875rem] text-cs-primary truncate max-w-[11.25rem]">{link}</span>}
        <span className="ml-auto text-[0.625rem] text-cs-text-muted uppercase tracking-wide">preview</span>
      </div>
      {body.trim() ? (
        <Markdown text={body} />
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
// Remembers which post you opened, so coming back lands on it, not the top.
const RETURN_KEY = 'cs-feed-return';
const readReturn = () => { try { return JSON.parse(sessionStorage.getItem(RETURN_KEY) || 'null'); } catch { return null; } };

const MAX_FILE_BYTES = 50 * 1024 * 1024;   // what people may pick or drop
const SERVER_IMG_BYTES = 3.5 * 1024 * 1024;  // stay under the API's 4 MB per image

// Shrink big photos in the browser (max 2000px, JPEG) so a 50 MB picture
// uploads as a few hundred KB. Small images and GIFs are sent as they are.
async function imageToDataUrl(file) {
  const raw = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
  if (file.type === 'image/gif' || file.size <= SERVER_IMG_BYTES) return raw;
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = raw;
  });
  let scale = Math.min(1, 2000 / Math.max(img.width, img.height));
  for (let quality = 0.85; ; quality -= 0.15) {
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const out = c.toDataURL('image/jpeg', quality);
    if (out.length * 0.75 <= SERVER_IMG_BYTES || quality < 0.4) return out;
    scale *= 0.8;
  }
}

export function Composer({ onPosted, sendRef, split = false }) {
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
    const all = Array.from(files || []);
    const notImages = all.filter((f) => !f.type.startsWith('image/'));
    const tooBig = all.filter((f) => f.type.startsWith('image/') && f.size > MAX_FILE_BYTES);
    const ok = all.filter((f) => f.type.startsWith('image/') && f.size <= MAX_FILE_BYTES);
    if (notImages.length) toast.error('Only images can be attached (PNG, JPG, WebP, GIF).');
    if (tooBig.length) toast.error(`${tooBig.map((f) => f.name).join(', ')} is over 50 MB.`);
    if (images.length + ok.length > MAX_IMAGES) toast.error(`Up to ${MAX_IMAGES} images per post.`);
    if (ok.length) setImages((prev) => [...prev, ...ok].slice(0, MAX_IMAGES));
  };

  const removeImage = (i) => setImages((prev) => prev.filter((_, idx) => idx !== i));

  const submit = async (e) => {
    e.preventDefault();
    if (posting || body.trim().length < 2) return;
    setPosting(true);
    try {
      const imageData = [];
      for (const f of images) imageData.push(await imageToDataUrl(f));
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

  const { user } = useAuth();
  const [kindOpen, setKindOpen] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const fileRef = useRef(null);
  const km = KIND_META[kind];
  const KindIcon = km.icon;
  const name = user?.display_name || user?.username || 'You';
  const tool = 'inline-flex items-center gap-2 h-9 px-3 rounded-lg text-sm text-cs-text-dim hover:bg-cs-overlay/[0.06] hover:text-cs-text transition-colors';

  const form = (
    <form
      onSubmit={submit}
      className={`rounded-xl border bg-cs-dark transition-colors ${dragging ? 'border-cs-primary' : 'border-cs-line/10'}`}
      onDragEnter={(e) => { e.preventDefault(); dragDepth.current++; setDragging(true); }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => { dragDepth.current = Math.max(0, dragDepth.current - 1); if (dragDepth.current === 0) setDragging(false); }}
      onDrop={(e) => { e.preventDefault(); dragDepth.current = 0; setDragging(false); addFiles(e.dataTransfer.files); }}
    >
      {/* Who + post type (like LinkedIn's "Post to Anyone") */}
      <div className="flex items-center gap-3 px-5 pt-5">
        <span className="w-12 h-12 rounded-full overflow-hidden bg-cs-primary/10 text-cs-primary grid place-items-center font-bold text-lg shrink-0">
          {user?.avatar ? <img src={user.avatar} alt="" className="w-full h-full object-cover" /> : name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="font-semibold leading-tight truncate">{name}</p>
          <div className="relative mt-1">
            <button type="button" onClick={() => setKindOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border border-cs-line/20 text-xs font-medium hover:bg-cs-overlay/[0.06] transition-colors">
              <KindIcon /> {km.label} <FiChevronDown className={`transition-transform ${kindOpen ? 'rotate-180' : ''}`} />
            </button>
            {kindOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setKindOpen(false)} />
                <div className="absolute left-0 top-[calc(100%+0.375rem)] z-50 w-60 rounded-xl border border-cs-line/15 bg-cs-dark shadow-xl p-1.5">
                  {KIND_KEYS.map((k) => {
                    const m = KIND_META[k];
                    const Icon = m.icon;
                    return (
                      <button key={k} type="button" onClick={() => { setKind(k); setKindOpen(false); }}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-left transition-colors ${kind === k ? 'bg-cs-overlay/[0.09] font-medium' : 'hover:bg-cs-overlay/[0.06]'}`}>
                        <Icon className="text-cs-text-muted" />
                        <span className="flex-1">{m.label}</span>
                        {kind === k && <FiCheck className="text-cs-primary" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 pt-3">
        {showPreview ? (
          <div className="py-2"><Preview kind={kind} body={body} images={images} tagList={tagList} link={link.trim()} /></div>
        ) : (
          <textarea
            ref={taRef}
            value={body}
            onChange={(e) => { setBody(e.target.value); autosize(); }}
            onInput={autosize}
            rows={5}
            maxLength={4000}
            autoFocus
            placeholder={PLACEHOLDER[kind]}
            className="w-full bg-transparent text-[1.0625rem] leading-relaxed outline-none resize-none placeholder:text-cs-text-muted min-h-[9rem] max-h-[30rem] overflow-y-auto"
          />
        )}
      </div>

      {/* Attached images */}
      {urls.length > 0 && (
        <div className={`px-5 pb-1 grid gap-2 ${urls.length === 1 ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-3'}`}>
          {urls.map((src, i) => (
            <div key={i} onClick={() => setViewing(i)}
              className="relative group rounded-lg overflow-hidden border border-cs-line/10 bg-cs-darkest cursor-zoom-in">
              <img src={src} alt="" className={`w-full ${urls.length === 1 ? 'max-h-80 object-contain' : 'h-36 object-cover'}`} />
              <button type="button" onClick={(e) => { e.stopPropagation(); removeImage(i); }}
                className="absolute top-2 right-2 w-7 h-7 grid place-items-center rounded-full bg-black/60 text-white hover:bg-black/80" title="Remove">
                <FiX className="text-sm" />
              </button>
            </div>
          ))}
        </div>
      )}
      {viewing >= 0 && <ImageLightbox sources={urls} start={viewing} onClose={() => setViewing(-1)} />}

      {/* Link / tags fields, shown when switched on */}
      {(showLink || showTags || tagList.length > 0) && (
        <div className="px-5 pt-2 space-y-2">
          {showLink && (
            <div className="flex items-center gap-2 h-10 px-3 rounded-lg border border-cs-line/15 focus-within:border-cs-primary/50">
              <FiLink className="text-cs-text-muted shrink-0" />
              <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://github.com/you/project"
                className="flex-1 min-w-0 bg-transparent outline-none text-sm" />
              <button type="button" onClick={() => { setShowLink(false); setLink(''); }} className="text-cs-text-muted hover:text-cs-red"><FiX /></button>
            </div>
          )}
          {showTags && (
            <div className="flex items-center gap-2 h-10 px-3 rounded-lg border border-cs-line/15 focus-within:border-cs-primary/50">
              <FiHash className="text-cs-text-muted shrink-0" />
              <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="python, sql, beginner (up to 5)"
                className="flex-1 min-w-0 bg-transparent outline-none text-sm" />
            </div>
          )}
          {tagList.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tagList.map((tg) => <span key={tg} className="text-sm text-cs-primary font-medium">#{tg}</span>)}
            </div>
          )}
        </div>
      )}

      {images.length < MAX_IMAGES && (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className={`mx-5 mt-3 w-[calc(100%-2.5rem)] rounded-xl border-2 border-dashed px-4 py-5 flex flex-col items-center gap-1 text-center transition-colors ${
            dragging ? 'border-cs-primary bg-cs-primary/[0.06] text-cs-primary' : 'border-cs-line/20 text-cs-text-dim hover:border-cs-primary/50 hover:text-cs-text'
          }`}
        >
          <FiImage className="text-2xl" />
          <span className="text-sm font-medium">{dragging ? 'Drop to add' : 'Drag & drop images here, or click to browse'}</span>
          <span className="text-xs text-cs-text-muted">PNG, JPG, WebP or GIF · up to {MAX_IMAGES} images · max 50 MB each</span>
        </button>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 px-3 py-3 mt-3 border-t border-cs-line/10">
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={images.length >= MAX_IMAGES} className={`${tool} disabled:opacity-40`} title="Add photos (or drop them here)">
          <FiImage className="text-cs-cyan text-lg" /> Photo{images.length ? ` ${images.length}/${MAX_IMAGES}` : ''}
        </button>
        <button type="button" onClick={() => setShowLink((v) => !v)} className={tool}>
          <FiLink className="text-cs-green text-lg" /> Link
        </button>
        <button type="button" onClick={() => setShowTags((v) => !v)} className={tool}>
          <FiHash className="text-cs-orange text-lg" /> Tags
        </button>
        {!split && (
          <button type="button" onClick={() => setShowPreview((p) => !p)} className={`${tool} ${showPreview ? 'bg-cs-overlay/[0.09] text-cs-text' : ''}`}>
            <FiEye className="text-lg" /> {showPreview ? 'Edit' : 'Preview'}
          </button>
        )}

        <div className="ml-auto flex items-center gap-3 pl-2">
          {body.length > 3500 && <span className="text-xs text-cs-text-muted tabular-nums">{body.length}/4000</span>}
          <button ref={sendRef} type="submit" disabled={posting || body.trim().length < 2}
            className="h-9 px-5 rounded-full bg-cs-primary text-white text-sm font-semibold inline-flex items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed">
            {posting ? 'Posting…' : 'Post'}
          </button>
        </div>
      </div>
    </form>
  );

  if (!split) return form;
  return (
    <div className="grid lg:grid-cols-2 gap-6 items-start">
      {form}
      <aside className="lg:sticky lg:top-20">
        <div className="flex items-center gap-2 mb-2 text-sm text-cs-text-dim">
          <span className="w-2 h-2 rounded-full bg-cs-green animate-pulse" /> Live preview · how your post will look
        </div>
        <LivePost user={user} kind={kind} body={body} images={urls} tagList={tagList} link={link.trim()} />
      </aside>
    </div>
  );
}

// The post as it will appear in the feed, updated while you type.
function LivePost({ user, kind, body, images, tagList, link }) {
  const m = KIND_META[kind];
  const Icon = m.icon;
  const name = user?.display_name || user?.username || 'You';
  return (
    <article className="rounded-xl border border-cs-line/10 bg-cs-dark">
      <div className="flex items-center gap-3 px-5 pt-5">
        <span className="w-11 h-11 rounded-full overflow-hidden bg-cs-primary/10 text-cs-primary grid place-items-center font-bold shrink-0">
          {user?.avatar ? <img src={user.avatar} alt="" className="w-full h-full object-cover" /> : name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight truncate">{name}</p>
          <p className="text-xs text-cs-text-muted">{user?.headline || `@${user?.username || 'you'}`} · just now</p>
        </div>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[0.625rem] uppercase tracking-wide ${ACCENT[m.accent]}`}>
          <Icon className="text-[0.625rem]" /> {m.label}
        </span>
      </div>
      <div className="px-5 pt-3 pb-1 text-[0.9375rem]">
        {body.trim()
          ? <Markdown text={body} />
          : <p className="text-cs-text-muted italic">Start writing — your post shows up here.</p>}
        {tagList.length > 0 && (
          <p className="mt-2 flex flex-wrap gap-x-2">{tagList.map((t) => <span key={t} className="text-cs-primary font-medium">#{t}</span>)}</p>
        )}
        {link && (
          <a href={link} target="_blank" rel="noreferrer" className="mt-3 flex items-center gap-2 rounded-lg border border-cs-line/10 px-3 py-2 text-sm text-cs-primary truncate">
            <FiLink className="shrink-0" /> <span className="truncate">{link}</span>
          </a>
        )}
      </div>
      {images.length > 0 && (
        <div className={`mt-3 grid gap-0.5 ${images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {images.slice(0, 4).map((src, i) => (
            <img key={i} src={src} alt="" className={`w-full ${images.length === 1 ? 'max-h-96 object-contain bg-cs-darkest' : 'h-40 object-cover'}`} />
          ))}
        </div>
      )}
      <div className="mt-3 mx-5 py-1 border-t border-cs-line/10 grid grid-cols-3 text-sm text-cs-text-muted">
        {[['Like', FiThumbsUp], ['Comment', FiMessageSquare], ['Share', FiSend]].map(([label, I]) => (
          <span key={label} className="inline-flex items-center justify-center gap-2 h-10"><I /> {label}</span>
        ))}
      </div>
    </article>
  );
}

function Community() {
  const { user: me } = useAuth();
  const navigate = useNavigate();
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
    // Returning from a post: load at least as many posts as were showing, so it's in the list.
    const back = reset ? readReturn() : null;
    try {
      const r = await communityService.posts({
        sort, tag: tag || undefined, kind: kind || undefined, search: search || undefined,
        limit: back ? Math.min(Math.max(PAGE, back.count || 0), 100) : PAGE, offset: reset ? 0 : offsetRef.current,
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

  // Once the list is in, scroll to the post you came back from and flash it.
  useEffect(() => {
    if (!Array.isArray(posts) || !posts.length) return;
    const back = readReturn();
    if (!back) return;
    sessionStorage.removeItem(RETURN_KEY);
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-post-id="${CSS.escape(String(back.id))}"]`);
      if (!el) return;
      el.scrollIntoView({ block: 'center' });
      setLanded(posts.find((x) => String(x.id) === String(back.id))?.id ?? null);
      setTimeout(() => setLanded(null), 1600);
    });
  }, [posts]);

  const rememberPost = (e) => {
    const a = e.target.closest('a[href*="/community/post/"]');
    const id = a?.getAttribute('href').match(/\/community\/post\/([^/?#]+)/)?.[1];
    if (id) sessionStorage.setItem(RETURN_KEY, JSON.stringify({ id: String(id), count: (posts || []).length }));
  };

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
    <main className="w-full px-6 lg:px-10 py-8">
      {/* Pinned banner: title + type tabs, search and sort stay put while the feed scrolls */}
      <div className="sticky top-[3.75rem] lg:top-14 z-30 -mx-6 lg:-mx-10 px-6 lg:px-10 -mt-8 pt-6 pb-4 mb-2 bg-cs-dark">
        <CommunityBanner
          title="Community"
          subtitle="See what other learners are building, and share your own."
        >
            <div className="flex items-center gap-3">
              <div className="flex items-center flex-1 min-w-0 overflow-x-auto scrollbar-none" ref={feedRef}>
                {['', ...KIND_KEYS].map((k) => {
                  const Meta = k ? KIND_META[k] : null;
                  const Icon = Meta ? Meta.icon : FiUsers;
                  const active = kind === k;
                  return (
                    <button
                      key={k || 'all'}
                      onClick={() => setKind(k)}
                      className={`relative h-11 px-0.5 mr-6 inline-flex items-center gap-2 text-[0.9375rem] whitespace-nowrap transition-colors ${
                        active ? 'text-white font-semibold' : 'text-white/75 hover:text-white'
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="feed-kind-underline"
                          className="absolute left-0 right-0 bottom-0 h-[3px] rounded-t bg-white"
                          transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                        />
                      )}
                      <Icon className="relative text-[0.8125rem]" />
                      <span className="relative">{k ? Meta.label : 'All'}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {searchOpen ? (
                  // Compact search: opens in place of the icon; the tabs stay visible
                  <form
                    onSubmit={(e) => { e.preventDefault(); setSearch(searchInput.trim()); }}
                    className="flex items-center gap-1"
                  >
                    <div className="relative">
                      <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm" />
                      <input
                        autoFocus
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        onBlur={() => { if (!searchInput.trim() && !search) setSearchOpen(false); }}
                        onKeyDown={(e) => { if (e.key === 'Escape') { setSearch(''); setSearchInput(''); setSearchOpen(false); } }}
                        placeholder="Search posts and people…"
                        className="w-44 sm:w-64 h-8 rounded-lg pl-8 pr-2 text-sm bg-white text-gray-900 placeholder:text-gray-500 outline-none border-0 shadow-sm"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => { setSearch(''); setSearchInput(''); setSearchOpen(false); }}
                      aria-label="Close search"
                      className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10"
                    >
                      <FiX />
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSearchOpen(true)}
                    title="Search the feed"
                    aria-label="Search the feed"
                    className={`h-8 inline-flex items-center gap-1.5 px-2.5 rounded-lg text-sm transition-colors ${
                      search ? 'bg-white/20 text-white' : 'text-white/80 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <FiSearch />
                    {search && <span className="max-w-[8rem] truncate">“{search}”</span>}
                  </button>
                )}
                {tag && (
                  <button
                    onClick={() => setParams({})}
                    className="inline-flex items-center gap-1 px-2.5 h-7 rounded-full bg-white/20 text-white text-xs font-medium"
                  >
                    #{tag} <FiX />
                  </button>
                )}
                <div className="inline-flex p-0.5 rounded-lg bg-white/15 text-xs">
                  {['new', 'top'].map((so) => (
                    <button
                      key={so}
                      onClick={() => setSort(so)}
                      className={`px-2.5 h-7 rounded-md capitalize transition-colors ${
                        sort === so ? 'bg-white text-cs-primary font-semibold shadow-sm' : 'text-white/80 hover:text-white'
                      }`}
                    >
                      {so}
                    </button>
                  ))}
                </div>
              </div>
            </div>
        </CommunityBanner>
      </div>

      {/* One centred feed column */}
      <div className="w-full">
        <section className="min-w-0">
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

      {posts === null && (
        <div className="w-full divide-y divide-cs-line/10" aria-busy="true" aria-label="Loading posts">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-4 py-6">
              <span className="skeleton w-12 h-12 rounded-full shrink-0" />
              <div className="flex-1 space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="skeleton h-4 w-32 rounded" />
                  <span className="skeleton h-4 w-16 rounded-full" />
                  <span className="skeleton h-4 w-20 rounded ml-auto" />
                </div>
                <span className="skeleton block h-3.5 w-full rounded" />
                <span className="skeleton block h-3.5 w-4/5 rounded" />
                {i % 2 === 0 && <span className="skeleton block h-40 w-full rounded-lg mt-3" />}
                <div className="flex gap-5 pt-2">
                  {[0, 1, 2, 3].map((j) => <span key={j} className="skeleton h-4 w-8 rounded" />)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {posts === false && (
        <div className="card text-center py-14 border-cs-red/20">
          <p className="text-cs-text-dim text-sm">Couldn't load the feed. Try again in a bit.</p>
        </div>
      )}
      {Array.isArray(posts) && posts.length === 0 && (
        <div className="card text-center py-14 border-cs-primary/20">
          <p className="text-4xl mb-3">👋</p>
          <p className="text-cs-text-dim text-sm max-w-sm mx-auto">
            {search
              ? `Nothing matches “${search}”.`
              : tag
                ? `Nothing tagged #${tag} yet.`
                : 'No posts yet. Tap + to share what you’re learning.'}
          </p>
        </div>
      )}

      {Array.isArray(posts) && posts.length > 0 && (
        <div>
          <div className="divide-y divide-cs-line/10" onClickCapture={rememberPost}>
            {posts.map((p) => (
              <div key={p.id} data-post-id={p.id} className={`scroll-mt-48 ${landed === p.id ? 'animate-post-land' : ''}`}>
                <PostCard post={p} onDelete={drop} />
              </div>
            ))}
          </div>
          {hasMore && (
            <button
              onClick={more}
              disabled={loadingMore}
              className="flex mx-auto mt-6 mb-2 items-center gap-2 h-9 px-5 rounded-full border border-cs-line/15 text-sm text-cs-text-dim hover:text-cs-text hover:bg-cs-overlay/[0.06] transition-colors disabled:opacity-50"
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          )}
        </div>
      )}
        </section>
      </div>

      {/* Floating ➕ (same as My Classes): open the composer for a new post */}
      <button
        onClick={() => navigate('/community/new')}
        aria-label="New post"
        title="New post"
        className="fixed bottom-16 right-12 z-50 w-14 h-14 rounded-full bg-cs-primary text-white grid place-items-center shadow-xl hover:scale-105 active:scale-95 transition-transform"
      >
        <FiPlus className="text-2xl" />
      </button>
    </main>
  );
}

export default Community;
