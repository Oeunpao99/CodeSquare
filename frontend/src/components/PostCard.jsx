import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiHeart, FiMessageSquare, FiFlag, FiTrash2, FiEdit2, FiExternalLink,
  FiZap, FiTrendingUp, FiHelpCircle, FiGlobe, FiCode, FiCpu, FiX, FiChevronsDown,
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
  return (
    <span
      className={`${size} rounded-lg bg-cs-darkest border border-cs-line/15 flex items-center justify-center font-mono font-bold text-cs-primary overflow-hidden shrink-0`}
    >
      {author.avatar
        ? <img src={author.avatar} alt="" className="w-full h-full object-cover" />
        : <span className="text-sm">{(author.display_name || author.username)?.charAt(0).toUpperCase()}</span>}
    </span>
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
          className="post-image-frame cursor-zoom-in"
          onClick={() => setViewing(0)}
          title="View full size"
        >
          <div className="p-3 sm:p-4 bg-cs-darkest/40 flex items-center justify-center min-h-[10rem]">
            <img
              src={images[0]}
              alt=""
              loading="lazy"
              className="max-w-full max-h-[28rem] object-contain rounded-md"
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
      <div className="post-image-frame">
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
    <div className={full ? '' : `relative overflow-hidden ${isLong ? 'max-h-60' : ''}`}>
      <Markdown text={p.body} size="text-sm" className="text-cs-text-dim leading-relaxed" />
      <ImageGrid images={p.images} full={full} />
      {isLong && (
        <>
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-cs-darker via-cs-darker/80 to-transparent" />
          <span className="absolute inset-x-0 bottom-2 flex justify-center">
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-cs-darkest/90 border border-cs-primary/30 text-cs-primary font-mono text-[11px] uppercase tracking-wide">
              read more <FiChevronsDown className="text-[11px]" />
            </span>
          </span>
        </>
      )}
    </div>
  );

  return (
    <article className="post-card group">
      {/* Header: avatar + author + kind badge */}
      <div className="flex items-center gap-3 mb-3">
        <Avatar author={p.author} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <AuthorName
              author={p.author}
              to={`/u/${p.author.username}`}
              className="font-mono text-sm font-semibold"
            />
            {p.is_mine && (
              <span className="text-cs-primary/70 text-xs font-mono whitespace-nowrap">you</span>
            )}
          </div>
          <p className="font-mono text-xs text-cs-text-muted mt-0.5">
            {major && <span className="text-cs-text-dim">{major}</span>}
            {major && <span className="mx-1.5 text-cs-line/30">·</span>}
            <span>{timeAgo(p.created_at)}</span>
            {p.updated_at && p.updated_at !== p.created_at && (
              <span className="ml-1.5 text-cs-text-dim/60">(edited)</span>
            )}
          </p>
        </div>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border font-mono text-[11px] uppercase tracking-wider shrink-0 ${ACCENT[meta.accent]}`}>
          <KindIcon className="text-[11px]" /> {meta.label}
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
              className="inline-flex items-center font-mono text-xs px-2 py-0.5 rounded-md bg-cs-darkest/60 border border-cs-line/10 text-cs-text-muted hover:text-cs-primary hover:border-cs-primary/30 transition-colors"
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

      {/* Quality */}
      {p.can_review_quality && (
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

      {/* Actions */}
      <div className="flex items-center gap-0.5 mt-3 pt-3 border-t border-cs-line/8">
        <button
          onClick={like}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all duration-150 ${
            p.liked_by_me
              ? 'text-cs-red bg-cs-red/8'
              : 'text-cs-text-muted hover:text-cs-text hover:bg-cs-overlay/5'
          }`}
        >
          <FiHeart className={p.liked_by_me ? 'fill-current' : ''} /> {p.like_count || 0}
        </button>
        <Link
          to={`/community/${p.id}`}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono text-cs-text-muted hover:text-cs-text hover:bg-cs-overlay/5 transition-all duration-150"
        >
          <FiMessageSquare /> {p.comment_count || 0}
        </Link>

        <span className="flex-grow" />

        {hasCode && (
          <button
            onClick={explainCode}
            disabled={explain?.loading}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono text-cs-violet hover:bg-cs-violet/10 disabled:opacity-50 transition-all duration-150"
            title="AI explain this code"
          >
            <FiCpu className={explain?.loading ? 'animate-pulse' : ''} />
            {explain?.loading ? 'explaining…' : explain ? 're-explain' : 'explain'}
          </button>
        )}

        {p.is_mine && full && (
          <button
            onClick={() => onChange?.({ ...p, _edit: true })}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono text-cs-text-muted hover:text-cs-text hover:bg-cs-overlay/5 transition-all duration-150"
          >
            <FiEdit2 /> edit
          </button>
        )}
        {p.can_delete ? (
          <button
            onClick={() => setConfirm('delete')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono text-cs-text-muted hover:text-cs-red hover:bg-cs-red/5 transition-all duration-150"
          >
            <FiTrash2 /> delete
          </button>
        ) : (
          <button
            onClick={() => setConfirm('report')}
            title="Report"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono text-cs-text-muted hover:text-cs-orange hover:bg-cs-orange/5 transition-all duration-150"
          >
            <FiFlag />
          </button>
        )}
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
