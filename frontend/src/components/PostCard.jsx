import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiHeart, FiMessageSquare, FiFlag, FiTrash2, FiEdit2, FiExternalLink,
  FiZap, FiTrendingUp, FiHelpCircle, FiGlobe, FiCode, FiCpu, FiX, FiChevronsDown,
  FiMoreHorizontal, FiBookmark, FiRepeat,
} from 'react-icons/fi';
import Markdown from './Markdown';
import { MAJORS } from '../majors';
import { communityService } from '../services/api';
import { toast } from '../utils/toast';
import { timeAgo as timeAgoFromDate } from '../utils/datetime';
import VerifiedBadge from './VerifiedBadge';
import ImageLightbox from './ImageLightbox';
import ConfirmDialog from './ConfirmDialog';

export const KIND_META = {
  idea:       { label: 'Idea',      icon: FiZap,         accent: 'primary' },
  progress:   { label: 'Progress',  icon: FiTrendingUp,  accent: 'green'   },
  question:   { label: 'Question',  icon: FiHelpCircle,  accent: 'orange'  },
  showcase:   { label: 'Showcase',  icon: FiGlobe,       accent: 'cyan'    },
  code:       { label: 'Code',      icon: FiCode,        accent: 'violet'  },
};

export const ACCENT = {
  primary: 'text-cs-primary border-cs-primary/30 bg-cs-primary/8',
  green:   'text-cs-green  border-cs-green/30  bg-cs-green/8',
  orange:  'text-cs-orange border-cs-orange/30 bg-cs-orange/8',
  cyan:    'text-cs-cyan   border-cs-cyan/30   bg-cs-cyan/8',
  violet:  'text-cs-violet border-cs-violet/30 bg-cs-violet/8',
};

export function timeAgo(iso) {
  return timeAgoFromDate(iso);
}

const QUAL_STYLE = [
  'bg-cs-orange/8 text-cs-orange border-cs-orange/30',
  'bg-cs-cyan/8   text-cs-cyan   border-cs-cyan/30',
  'bg-cs-green/8  text-cs-green  border-cs-green/30',
];

function qualityTier(score) {
  if (score == null) return -1;
  if (score >= 75) return 2;
  if (score >= 55) return 1;
  return 0;
}

function Avatar({ author, size = 'w-10 h-10' }) {
  const ring = 15 + (hashStr(author.username || '') % 85);
  return (
    <span className={`ring-avatar ${size}`} style={{ '--p': ring }}>
      <span>
        {author.avatar
          ? <img src={author.avatar} alt="" className="w-full h-full object-cover" />
          : <span className="text-sm font-bold text-cs-primary">{(author.display_name || author.username)?.charAt(0).toUpperCase()}</span>}
      </span>
    </span>
  );
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) >>> 0; }
  return h;
}

function OverflowMenu({ items }) {
  const [open, setOpen] = useState(false);
  if (!items.length) return null;
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="More actions"
        aria-expanded={open}
        className="tap inline-flex items-center px-2 py-1.5 rounded-lg text-cs-text-muted hover:text-cs-text"
      >
        <FiMoreHorizontal />
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute right-0 top-full mt-1 z-50 min-w-[9rem] rounded-lg border border-cs-line/15 bg-cs-darkest shadow-lg overflow-hidden py-1">
            {items.map((it) => (
              <button
                key={it.label}
                onClick={() => { setOpen(false); it.onClick(); }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs font-mono text-left transition-colors hover:bg-cs-overlay/5 ${
                  it.danger ? 'text-cs-text-muted hover:text-cs-red' : 'text-cs-text-muted hover:text-cs-text'
                }`}
              >
                {it.icon} {it.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function AuthorName({ author, to, className = '' }) {
  return (
    <Link
      to={to}
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex items-center gap-1.5 min-w-0 hover:text-cs-primary transition-colors ${className}`}
    >
      <span className="truncate">{author.display_name || author.username}</span>
      {author.verified && <VerifiedBadge size="h-4 w-4" />}
    </Link>
  );
}

function ImageGrid({ images, full }) {
  if (!images?.length) return null;
  const [viewing, setViewing] = useState(-1);
  const count = images.length;

  if (count === 1) {
    return (
      <div className="mt-4">
        <div
          className={`post-image-frame cursor-zoom-in ${full ? 'max-w-2xl' : 'max-w-xl'}`}
          onClick={() => setViewing(0)}
          title="View full size"
        >
          <div className="p-3 sm:p-4 bg-cs-darkest/40 flex items-center justify-center min-h-[8rem]">
            <img
              src={images[0]}
              alt=""
              loading="lazy"
              className={`max-w-full object-contain rounded-md ${full ? 'max-h-[32rem]' : 'max-h-96'}`}
            />
          </div>
        </div>
        <p className="mt-1.5 font-mono text-[10px] text-cs-text-muted/50 tracking-wide">
          img · {count} attached
        </p>
        {viewing >= 0 && (
          <ImageLightbox sources={images} start={0} onClose={() => setViewing(-1)} />
        )}
      </div>
    );
  }

  return (
    <div className="mt-4">
      <div className={`post-image-frame ${full ? 'max-w-2xl' : 'max-w-xl'}`}>
        <div className="p-3 sm:p-4 bg-cs-darkest/40">
          <div className="grid grid-cols-2 gap-2">
            {images.map((src, i) => (
              <div
                key={i}
                onClick={() => setViewing(i)}
                title="View full size"
                className="aspect-square rounded-lg overflow-hidden bg-cs-darkest/50 border border-cs-line/8 cursor-zoom-in hover:border-cs-primary/40 transition-colors"
              >
                <img
                  src={src}
                  alt=""
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-1.5 font-mono text-[10px] text-cs-text-muted/50 tracking-wide">
        img · {count} attached
      </p>
      {viewing >= 0 && (
        <ImageLightbox sources={images} start={viewing} onClose={() => setViewing(-1)} />
      )}
    </div>
  );
}

function PostCard({ post, full = false, onChange, onDelete }) {
  const [p, setP] = useState(post);
  const [busy, setBusy] = useState(false);
  const [qBusy, setQBusy] = useState(false);
  const [explain, setExplain] = useState(null); // null | { loading } | { text }
  const [confirm, setConfirm] = useState(null); // 'report' | 'delete'
  const meta = KIND_META[p.kind] || KIND_META.idea;
  const KindIcon = meta.icon;
  const major = p.author.major ? MAJORS[p.author.major]?.label : null;
  const hasCode = /```/g.test(p.body || '');

  const explainCode = async () => {
    if (explain?.loading) return;
    setExplain({ loading: true });
    try {
      const r = await communityService.explainCode(p.id);
      setExplain({ text: r.data.explanation });
    } catch (e) {
      setExplain(null);
      toast.error(e.response?.data?.detail || 'Explain failed.');
    }
  };

  const review = async () => {
    if (qBusy) return;
    setQBusy(true);
    try {
      const r = await communityService.reviewQuality(p.id);
      const next = {
        ...p,
        quality_score: r.data.score,
        quality_note: r.data.note,
        quality_ai: r.data.ai,
      };
      setP(next);
      onChange?.(next);
      if (r.data.ai_unavailable) toast.info('AI review offline — used the quick check instead.');
      else toast.success(r.data.ai ? 'AI review updated.' : 'Quality note updated.');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Review failed.');
    } finally {
      setQBusy(false);
    }
  };

  const like = async () => {
    if (busy) return;
    setBusy(true);
    const next = { ...p, liked_by_me: !p.liked_by_me, like_count: p.like_count + (p.liked_by_me ? -1 : 1) };
    setP(next);
    try {
      const r = await communityService.likePost(p.id);
      const synced = { ...next, liked_by_me: r.data.liked, like_count: r.data.like_count };
      setP(synced);
      onChange?.(synced);
    } catch {
      setP(p);
      toast.error('Could not register that.');
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    const next = { ...p, saved_by_me: !p.saved_by_me };
    setP(next);
    try {
      const r = await communityService.savePost(p.id);
      const synced = { ...next, saved_by_me: r.data.saved };
      setP(synced);
      onChange?.(synced);
      toast.success(r.data.saved ? 'Saved to your bookmarks' : 'Removed from bookmarks');
    } catch {
      setP(p);
      toast.error('Could not save that.');
    }
  };

  const doRepost = async () => {
    if (p.is_mine) return;
    const on = p.reposted_by_me;
    const next = { ...p, reposted_by_me: !on, repost_count: (p.repost_count || 0) + (on ? -1 : 1) };
    setP(next);
    try {
      const r = await communityService.repost(p.id);
      const synced = { ...next, reposted_by_me: r.data.reposted, repost_count: r.data.repost_count };
      setP(synced);
      onChange?.(synced);
      toast.success(r.data.reposted ? 'Reposted to your profile' : 'Repost removed');
    } catch (e) {
      setP(p);
      toast.error(e.response?.data?.detail || 'Could not repost.');
    }
  };

  const flag = async () => {
    try {
      const r = await communityService.flagPost(p.id);
      toast.success(r.data.hidden ? 'Reported — hidden pending review.' : 'Reported. Thanks.');
      if (r.data.hidden) onDelete?.(p.id);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not report.');
    }
  };

  const remove = async () => {
    try {
      await communityService.deletePost(p.id);
      toast.success('Post deleted');
      onDelete?.(p.id);
    } catch {
      toast.error('Could not delete.');
    }
  };

  const isLong = !full && (p.body?.length || 0) > 400;
  const body = (
    <div>
      {/* Only the TEXT is clamped + faded — the image always renders in full below. */}
      <div className={`max-w-[72ch] ${full ? '' : `relative overflow-hidden ${isLong ? 'max-h-60' : ''}`}`}>
        <Markdown text={p.body} size="text-sm" className="text-cs-text-dim leading-relaxed" />
        {isLong && (
          <>
            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-cs-dark via-cs-dark/80 to-transparent" />
            <span className="absolute inset-x-0 bottom-2 flex justify-center">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-cs-darkest/90 border border-cs-primary/30 text-cs-primary font-mono text-[11px] uppercase tracking-wide">
                read more <FiChevronsDown className="text-[11px]" />
              </span>
            </span>
          </>
        )}
      </div>
      <ImageGrid images={p.images} full={full} />
    </div>
  );

  return (
    <article className="post-card group">
      <div className="flex gap-3.5">
        {/* Avatar */}
        <div className="shrink-0">
          <Avatar author={p.author} size="w-11 h-11" />
        </div>

        {/* Content column — fills most of the row; the paragraph text below gets
            its own reading-measure cap so lines don't run too wide. */}
        <div className="min-w-0 flex-1 max-w-5xl">
          {p.reposted_by && (
            <div className="flex items-center gap-1.5 mb-1 font-mono text-[11px] text-cs-text-muted">
              <FiRepeat className="text-[11px]" />
              <Link
                to={`/u/${p.reposted_by.username}`}
                onClick={(e) => e.stopPropagation()}
                className="hover:text-cs-text"
              >
                {p.reposted_by.display_name || p.reposted_by.username}
              </Link>
              <span>reposted</span>
            </div>
          )}
          {/* Author line */}
          <div className="flex items-center gap-2 flex-wrap">
            <AuthorName
              author={p.author}
              to={`/u/${p.author.username}`}
              className="font-mono text-sm font-semibold"
            />
            {p.is_mine && (
              <span className="text-cs-primary/70 text-xs font-mono whitespace-nowrap">you</span>
            )}
            {p.author.week != null && (
              <span className="inline-flex items-center font-mono text-[10px] text-cs-text-muted bg-cs-overlay/5 border border-cs-line/[0.12] px-1.5 py-px rounded-full whitespace-nowrap">
                week {p.author.week}
              </span>
            )}
            <span className="flex items-center gap-1.5 shrink-0 font-mono text-[11px] text-cs-text-muted whitespace-nowrap">
              {major && <span className="text-cs-text-dim hidden sm:inline">{major}</span>}
              {major && <span className="hidden sm:inline text-cs-line/30">·</span>}
              <span>{timeAgo(p.created_at)}</span>
              {p.updated_at && p.updated_at !== p.created_at && (
                <span className="text-cs-text-dim/60">(edited)</span>
              )}
            </span>
            <span className={`ml-auto inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border font-mono text-[10px] uppercase tracking-wider shrink-0 ${ACCENT[meta.accent]}`}>
              <KindIcon className="text-[10px]" /> {meta.label}
            </span>
          </div>

          {/* Body */}
          {full ? body : <Link to={`/community/${p.id}`} className="block">{body}</Link>}

          {/* Tags */}
          {p.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {p.tags.map((t) => (
                <Link
                  key={t}
                  to={`/community?tag=${encodeURIComponent(t)}`}
                  className="inline-flex items-center font-mono text-xs px-2 py-0.5 rounded-md bg-cs-overlay/5 border border-cs-line/10 text-cs-text-muted hover:text-cs-primary hover:border-cs-primary/30 transition-colors"
                >
                  #{t}
                </Link>
              ))}
            </div>
          )}

          {/* Link */}
          {p.link_url && (
            <a
              href={p.link_url}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-3 inline-flex items-center gap-1.5 font-mono text-xs text-cs-primary hover:text-cs-cyan transition-colors truncate max-w-full"
            >
              <FiExternalLink className="shrink-0" />
              <span className="truncate">{p.link_url.replace(/^https?:\/\//, '')}</span>
            </a>
          )}

          {/* Quality — compact inline chip (detail view only; keeps the feed clean) */}
          {p.can_review_quality && full && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border font-mono text-[11px] ${
                  qualityTier(p.quality_score) >= 0
                    ? QUAL_STYLE[qualityTier(p.quality_score)]
                    : 'bg-cs-overlay/5 text-cs-text-muted border-cs-line/10'
                }`}
              >
                {p.quality_score != null ? (
                  <>
                    <FiZap className="text-[11px]" />
                    {p.quality_score}
                    <span className="opacity-70">{p.quality_ai ? '· ai' : '· auto'}</span>
                  </>
                ) : (
                  'quality — pending'
                )}
              </span>
              <button
                onClick={review}
                disabled={qBusy}
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-cs-line/15 text-[11px] font-mono text-cs-text-muted hover:text-cs-text hover:border-cs-primary/30 transition-colors disabled:opacity-50"
              >
                <FiTrendingUp className={qBusy ? 'animate-pulse' : ''} />
                {qBusy ? 'reviewing…' : p.quality_ai ? 're-review' : 'AI review'}
              </button>
              {p.quality_note && (
                <p className="w-full text-[11px] text-cs-text-muted font-mono leading-relaxed">
                  <span className="text-cs-text-dim/70">{p.quality_ai ? 'ai' : 'quick'} check · </span>
                  {p.quality_note}
                </p>
              )}
            </div>
          )}

          {/* AI explain panel */}
          {explain && (
            <div className="mt-3 rounded-lg border border-cs-violet/25 bg-cs-violet/5 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-cs-violet/15 bg-cs-violet/10">
                <span className="font-mono text-[10px] text-cs-violet inline-flex items-center gap-1.5 uppercase tracking-wider">
                  <FiCpu /> ai · explain this code
                </span>
                <button
                  onClick={() => setExplain(null)}
                  className="font-mono text-[10px] text-cs-text-muted hover:text-cs-text inline-flex items-center gap-1"
                >
                  close <FiX />
                </button>
              </div>
              {explain.loading ? (
                <div className="p-4 space-y-2 animate-pulse">
                  <div className="h-3 w-2/3 bg-cs-violet/15 rounded" />
                  <div className="h-3 w-full bg-cs-violet/10 rounded" />
                  <div className="h-3 w-1/2 bg-cs-violet/10 rounded" />
                </div>
              ) : (
                <Markdown
                  text={explain.text}
                  size="text-[13px]"
                  className="p-3 text-cs-text-dim leading-relaxed"
                />
              )}
            </div>
          )}

          {/* Action bar */}
          <div className="flex items-center gap-1 mt-3 pt-3 border-t border-cs-line/8">
            <button
              onClick={like}
              className={`tap inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono ${
                p.liked_by_me ? 'text-cs-red' : 'text-cs-text-muted hover:text-cs-text'
              }`}
            >
              <FiHeart className={p.liked_by_me ? 'fill-current' : ''} /> <span className="tabular-nums">{p.like_count || 0}</span>
            </button>
            <Link
              to={`/community/${p.id}`}
              className="tap inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono text-cs-text-muted hover:text-cs-text"
            >
              <FiMessageSquare /> <span className="tabular-nums">{p.comment_count || 0}</span>
            </Link>
            {!p.is_mine && (
              <button
                onClick={doRepost}
                title={p.reposted_by_me ? 'Undo repost' : 'Repost'}
                className={`tap inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono ${
                  p.reposted_by_me ? 'text-cs-green' : 'text-cs-text-muted hover:text-cs-text'
                }`}
              >
                <FiRepeat /> <span className="tabular-nums">{p.repost_count || 0}</span>
              </button>
            )}
            <button
              onClick={save}
              title={p.saved_by_me ? 'Remove bookmark' : 'Save'}
              className={`tap inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-mono ${
                p.saved_by_me ? 'text-cs-primary' : 'text-cs-text-muted hover:text-cs-text'
              }`}
            >
              <FiBookmark className={p.saved_by_me ? 'fill-current' : ''} />
            </button>

            <span className="flex-grow" />

            {hasCode && (
              <button
                onClick={explainCode}
                disabled={explain?.loading}
                title="AI explain this code"
                className="tap inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-cs-line/20 text-xs font-mono text-cs-violet hover:text-cs-violet hover:border-cs-violet/40 disabled:opacity-50"
              >
                <FiCpu className={explain?.loading ? 'animate-pulse' : ''} />
                {explain?.loading ? 'explaining…' : explain ? 're-explain' : 'Explain'}
              </button>
            )}

            <OverflowMenu
              items={[
                ...(p.is_mine && full
                  ? [{ label: 'Edit', icon: <FiEdit2 />, onClick: () => onChange?.({ ...p, _edit: true }) }]
                  : []),
                p.can_delete
                  ? { label: 'Delete', icon: <FiTrash2 />, danger: true, onClick: () => setConfirm('delete') }
                  : { label: 'Report', icon: <FiFlag />, danger: true, onClick: () => setConfirm('report') },
              ]}
            />
          </div>
        </div>
      </div>

      {confirm === 'delete' && (
        <ConfirmDialog
          title="Delete post"
          message="Delete this post? This cannot be undone."
          confirmLabel="Delete"
          confirmClass="btn-danger"
          onConfirm={() => { setConfirm(null); remove(); }}
          onClose={() => setConfirm(null)}
        />
      )}
      {confirm === 'report' && (
        <ConfirmDialog
          title="Report post"
          message="Report this post to the moderators?"
          confirmLabel="Report"
          confirmClass="btn-danger"
          onConfirm={() => { setConfirm(null); flag(); }}
          onClose={() => setConfirm(null)}
        />
      )}
    </article>
  );
}

export { Avatar, AuthorName };
export default PostCard;
