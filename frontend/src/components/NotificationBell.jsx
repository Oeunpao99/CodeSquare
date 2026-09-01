import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { FiBell, FiHeart, FiMessageCircle, FiCheckCircle } from 'react-icons/fi';
import { notificationService } from '../services/api';
import { timeAgo } from './PostCard';

const KIND_META = {
  like: { icon: FiHeart, cls: 'text-cs-red', text: (actor) => `${actor.display_name || actor.username} appreciated your post` },
  comment: { icon: FiMessageCircle, cls: 'text-cs-primary', text: (actor) => `@${actor.username} commented on your post` },
};

/**
 * Dev-team notification bell. Polls the notifications API for a red unread
 * badge, and drops a list of post links (like / comment by a staff member).
 * Deep-links to the post and marks everything read once the panel is opened.
 */
export default function NotificationBell() {
  const [count, setCount] = useState(0);
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [marked, setMarked] = useState(false);
  const [pos, setPos] = useState(null); // fixed anchor for the dropdown
  const rootRef = useRef(null);
  const btnRef = useRef(null);
  const panelRef = useRef(null);

  const refresh = () => {
    notificationService
      .list()
      .then((r) => {
        setCount(r.data.unread_count || 0);
        setItems((r.data.items || []).slice(0, 12));
      })
      .catch(() => {
        setCount(0);
        setItems([]);
      });
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 15000);
    return () => clearInterval(t);
  }, []);

  // close on outside click / escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      const t = e.target;
      const inside =
        (rootRef.current && rootRef.current.contains(t)) ||
        (panelRef.current && panelRef.current.contains(t));
      if (!inside) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const openPanel = () => {
    setOpen((o) => {
      if (!o) {
        const r = btnRef.current?.getBoundingClientRect();
        if (r) {
          setPos({
            top: r.bottom + 8,
            right: Math.max(8, Math.round(window.innerWidth - r.right)),
          });
        }
      }
      return !o;
    });
    // Mark read once when the panel first opens this mount.
    if (!marked) {
      setMarked(true);
      if (count > 0) {
        notificationService.markAllRead().catch(() => {});
        setCount(0);
        setItems((it) => it.map((n) => ({ ...n, read: true })));
      }
    }
  };

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        ref={btnRef}
        onClick={openPanel}
        className="relative p-2 rounded-lg border border-cs-line/15 bg-cs-overlay/[0.04] text-cs-text-dim hover:text-cs-primary hover:border-cs-primary/40 hover:shadow-[0_0_16px_-8px_rgb(var(--cs-primary)/0.6)] transition-all"
        aria-label={`Notifications${count ? `, ${count} unread` : ''}`}
      >
        <FiBell className="text-lg" />
        {count > 0 && (
          <>
            <span className="absolute -top-1 -right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-cs-red px-1 text-[10px] font-mono font-bold text-cs-dark ring-2 ring-cs-darkest">
              {count > 9 ? '9+' : count}
            </span>
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-cs-red/50 animate-ping" />
          </>
        )}
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            className="fixed w-80 max-w-[calc(100vw-2rem)] z-[80] rounded-xl border border-cs-line/15 bg-cs-darkest/95 backdrop-blur-xl overflow-hidden"
            style={{ top: pos.top, right: pos.right }}
          >
          <div className="px-4 py-3 border-b border-cs-line/10 flex items-center justify-between">
            <span className="mono-label text-cs-text-dim"> notifications</span>
            {items.some((n) => !n.read) && (
              <button
                onClick={() => {
                  notificationService.markAllRead().catch(() => {});
                  setCount(0);
                  setItems((it) => it.map((n) => ({ ...n, read: true })));
                }}
                className="inline-flex items-center gap-1 text-[11px] font-mono text-cs-primary hover:text-cs-cyan"
              >
                <FiCheckCircle /> mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-cs-text-muted font-mono">
                No dev-team activity yet.
              </p>
            ) : (
              items.map((n) => {
                const meta = KIND_META[n.kind] || KIND_META.like;
                const Icon = meta.icon;
                return (
                  <Link
                    key={n.id}
                    to={`/community/${n.post_public_id}`}
                    onClick={() => setOpen(false)}
                    className={`flex items-start gap-3 px-4 py-3 hover:bg-cs-overlay/[0.06] transition-colors border-b border-cs-line/[0.06] last:border-0 ${
                      n.read ? 'opacity-55' : ''
                    }`}
                  >
                    <span className={`mt-0.5 ${meta.cls}`}><Icon /></span>
                    <span className="min-w-0">
                      <span className="block text-sm font-mono font-semibold truncate">
                        {n.actor.display_name || n.actor.username}
                        {!n.read && <span className="ml-2 inline-block w-1.5 h-1.5 rounded-full bg-cs-red align-middle" />}
                      </span>
                      <span className="block text-xs text-cs-text-dim leading-snug">{meta.text(n.actor)}</span>
                      <span className="block text-[11px] text-cs-text-muted font-mono mt-0.5">
                        {timeAgo(n.created_at)}
                      </span>
                    </span>
                  </Link>
                );
              })
            )}
          </div>
</div>,
          document.body
        )}
    </div>
  );
}