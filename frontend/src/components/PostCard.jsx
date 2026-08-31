import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiHeart, FiMessageSquare, FiFlag, FiTrash2, FiEdit2, FiExternalLink,
  FiZap, FiTrendingUp, FiHelpCircle, FiGlobe,
} from 'react-icons/fi';
import Markdown from './Markdown';
import { MAJORS } from '../majors';
import { communityService } from '../services/api';
import { toast } from '../utils/toast';
import VerifiedBadge from './VerifiedBadge';

export const KIND_META = {
  idea: { label: 'Idea', icon: FiZap, cls: 'text-cs-primary border-cs-primary/40 bg-cs-primary/10' },
  progress: { label: 'Progress', icon: FiTrendingUp, cls: 'text-cs-green border-cs-green/40 bg-cs-green/10' },
  question: { label: 'Question', icon: FiHelpCircle, cls: 'text-cs-orange border-cs-orange/40 bg-cs-orange/10' },
  showcase: { label: 'Showcase', icon: FiGlobe, cls: 'text-cs-cyan border-cs-cyan/40 bg-cs-cyan/10' },
};

export function timeAgo(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

function Avatar({ author, size = 'w-9 h-9' }) {
  return (
    <span className={`${size} rounded-lg bg-cs-darkest border border-cs-primary/25 flex items-center justify-center font-mono font-bold text-cs-primary overflow-hidden shrink-0`}>
      {author.avatar
        ? <img src={author.avatar} alt="" className="w-full h-full object-cover" />
        : <span>{(author.display_name || author.username)?.charAt(0).toUpperCase()}</span>}
    </span>
  );
}

// Clickable author name + verified badge, shared by posts and comments.
function AuthorName({ author, to, className = '' }) {
  return (
    <Link
      to={to}
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex items-center gap-1 min-w-0 hover:text-cs-primary transition-colors ${className}`}
    >
      <span className="truncate">{author.display_name || author.username}</span>
      {author.verified && <VerifiedBadge size="h-4 w-4" />}
    </Link>
  );
}

// One post. `full` = detail view (no body clamp, no "open" affordance).
function PostCard({ post, full = false, onChange, onDelete }) {
  const [p, setP] = useState(post);
  const [busy, setBusy] = useState(false);
  const meta = KIND_META[p.kind] || KIND_META.idea;
  const KindIcon = meta.icon;
  const major = p.author.major ? MAJORS[p.author.major]?.label : null;

  const like = async () => {
    if (busy) return;
    setBusy(true);
    // optimistic
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
    if (!confirm('Report this post to moderators?')) return;
    try {
      const r = await communityService.flagPost(p.id);
      toast.success(r.data.hidden ? 'Reported — hidden pending review.' : 'Reported. Thanks.');
      if (r.data.hidden) onDelete?.(p.id);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not report.');
    }
  };

  const remove = async () => {
    if (!confirm('Delete this post? This cannot be undone.')) return;
    try {
      await communityService.deletePost(p.id);
      toast.success('Post deleted');
      onDelete?.(p.id);
    } catch {
      toast.error('Could not delete.');
    }
  };

  const body = (
    <div className={full ? '' : 'max-h-64 overflow-hidden relative'}>
      <Markdown text={p.body} size="text-sm" className="text-cs-text-dim" />
      {!full && p.body.length > 400 && (
        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-cs-darkest to-transparent" />
      )}
    </div>
  );

  return (
    <article className="card">
      <div className="flex items-center gap-3 mb-3">
        <Avatar author={p.author} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <AuthorName
              author={p.author}
              to={`/u/${p.author.username}`}
              className="font-mono text-base font-semibold"
            />
            {p.is_mine && <span className="text-cs-primary font-normal whitespace-nowrap">· you</span>}
          </div>
          <p className="font-mono text-[11px] text-cs-text-muted truncate mt-0.5">
            {major ? `${major} · ` : ''}{timeAgo(p.created_at)}
            {p.updated_at && p.updated_at !== p.created_at ? ' · edited' : ''}
          </p>
        </div>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border font-mono text-[10px] uppercase tracking-wide shrink-0 ${meta.cls}`}>
          <KindIcon className="text-[11px]" /> {meta.label}
        </span>
      </div>

      {full ? body : <Link to={`/community/${p.id}`} className="block">{body}</Link>}

      {p.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {p.tags.map((t) => (
            <Link
              key={t}
              to={`/community?tag=${encodeURIComponent(t)}`}
              className="font-mono text-[11px] px-2 py-0.5 rounded border border-cs-line/15 text-cs-text-muted hover:text-cs-primary hover:border-cs-primary/40"
            >
              #{t}
            </Link>
          ))}
        </div>
      )}

      {p.link_url && (
        <a
          href={p.link_url}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-3 inline-flex items-center gap-1.5 font-mono text-xs text-cs-primary hover:text-cs-cyan truncate max-w-full"
        >
          <FiExternalLink className="shrink-0" /> <span className="truncate">{p.link_url.replace(/^https?:\/\//, '')}</span>
        </a>
      )}

      <div className="flex items-center gap-1 mt-4 pt-3 border-t border-cs-line/10 text-cs-text-muted">
        <button
          onClick={like}
          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-mono transition-colors ${
            p.liked_by_me ? 'text-cs-red' : 'hover:text-cs-text'
          }`}
        >
          <FiHeart className={p.liked_by_me ? 'fill-current' : ''} /> {p.like_count || 0}
        </button>
        <Link
          to={`/community/${p.id}`}
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-mono hover:text-cs-text transition-colors"
        >
          <FiMessageSquare /> {p.comment_count || 0}
        </Link>

        <span className="flex-grow" />

        {p.is_mine && full && (
          <button
            onClick={() => onChange?.({ ...p, _edit: true })}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-mono hover:text-cs-text transition-colors"
          >
            <FiEdit2 /> edit
          </button>
        )}
        {p.can_delete ? (
          <button
            onClick={remove}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-mono hover:text-cs-red transition-colors"
          >
            <FiTrash2 /> delete
          </button>
        ) : (
          <button
            onClick={flag}
            title="Report"
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-mono hover:text-cs-orange transition-colors"
          >
            <FiFlag />
          </button>
        )}
      </div>
    </article>
  );
}

export { Avatar, AuthorName };
export default PostCard;
