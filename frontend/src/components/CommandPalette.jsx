import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  FiSearch, FiBook, FiTarget, FiBookOpen, FiGrid, FiZap, FiHelpCircle, FiCpu, FiCode, FiGlobe,
  FiFileText, FiActivity, FiTrendingUp, FiMessageSquare, FiUsers, FiAward, FiUser, FiBarChart2,
  FiEdit3, FiCornerDownLeft,
} from 'react-icons/fi';
import { lessonService } from '../services/api';

// Every place you can jump to. Courses are added from the API.
const PAGES = [
  { group: 'Learn', label: 'My courses', to: '/dashboard', icon: FiBook, keys: 'learn home dashboard' },
  { group: 'Learn', label: 'Roadmap', to: '/roadmap', icon: FiTarget, keys: 'path plan' },
  { group: 'Learn', label: 'Library', to: '/library', icon: FiBookOpen, keys: 'docs articles read' },
  { group: 'Learn', label: 'My Classes', to: '/classes', icon: FiGrid, keys: 'class join code instructor' },
  { group: 'Practice', label: 'Coding challenges', to: '/practice', icon: FiZap, keys: 'practice exercises' },
  { group: 'Practice', label: 'Quizzes', to: '/quizzes', icon: FiHelpCircle, keys: 'quiz test' },
  { group: 'Practice', label: 'CodeSquareAgent', to: '/tutor', icon: FiCpu, keys: 'ai tutor chat help' },
  { group: 'Build', label: 'Projects', to: '/projects', icon: FiCode, keys: 'workspace code' },
  { group: 'Build', label: 'Portfolio', to: '/portfolio', icon: FiGlobe, keys: 'showcase' },
  { group: 'Build', label: 'Notes', to: '/notes', icon: FiFileText, keys: 'note secret' },
  { group: 'Grow', label: 'Progress', to: '/progress', icon: FiActivity, keys: 'stats xp skills' },
  { group: 'Grow', label: 'Job readiness', to: '/career', icon: FiTrendingUp, keys: 'career job ready' },
  { group: 'Community', label: 'Community feed', to: '/community', icon: FiMessageSquare, keys: 'posts feed' },
  { group: 'Community', label: 'New post', to: '/community/new', icon: FiEdit3, keys: 'write share' },
  { group: 'Community', label: 'People', to: '/devs', icon: FiUsers, keys: 'directory developers' },
  { group: 'Community', label: 'Leaderboard', to: '/leaderboard', icon: FiAward, keys: 'rank top' },
  { group: 'Account', label: 'Profile & settings', to: '/profile', icon: FiUser, keys: 'account settings theme' },
  { group: 'Account', label: 'Usage', to: '/usage', icon: FiBarChart2, keys: 'tokens plan billing' },
];

/** Ctrl/Cmd+K "jump to" palette: type to filter pages and courses, Enter to go. */
export default function CommandPalette({ onClose }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [courses, setCourses] = useState([]);
  const listRef = useRef(null);

  useEffect(() => {
    lessonService.getLanguages()
      .then((r) => setCourses((r.data || []).map((l) => ({
        group: 'Courses', label: l.name, to: `/learn/${l.slug}`, icon: FiBook, keys: `${l.slug} course track`,
      }))))
      .catch(() => {});
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    const all = [...PAGES, ...courses];
    if (!term) return PAGES;
    return all.filter((r) => `${r.label} ${r.group} ${r.keys}`.toLowerCase().includes(term)).slice(0, 12);
  }, [q, courses]);

  useEffect(() => { setActive(0); }, [q]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const go = (r) => { onClose(); navigate(r.to); };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter' && results[active]) go(results[active]);
  };

  let lastGroup = null;
  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-start justify-center pt-[12vh] px-4 bg-black/50 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="w-full max-w-xl rounded-2xl border border-cs-line/10 bg-cs-dark shadow-2xl overflow-hidden animate-route-fade"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 border-b border-cs-line/10">
          <FiSearch className="text-cs-text-muted text-lg shrink-0" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search pages and courses…"
            className="flex-1 h-14 bg-transparent outline-none text-base placeholder:text-cs-text-muted"
          />
          <kbd className="text-[0.6875rem] text-cs-text-muted border border-cs-line/15 rounded px-1.5 py-0.5">Esc</kbd>
        </div>
        <ul ref={listRef} className="max-h-[50vh] overflow-y-auto py-2">
          {results.length === 0 && <li className="px-4 py-8 text-center text-sm text-cs-text-dim">No results for “{q}”.</li>}
          {results.map((r, i) => {
            const header = r.group !== lastGroup ? r.group : null;
            lastGroup = r.group;
            const Icon = r.icon;
            return (
              <React.Fragment key={`${r.group}-${r.to}`}>
                {header && <li className="px-4 pt-2 pb-1 text-xs font-medium text-cs-text-muted">{header}</li>}
                <li
                  data-idx={i}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => { e.preventDefault(); go(r); }}
                  className={`mx-2 flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-sm ${
                    i === active ? 'bg-cs-overlay/[0.09] text-cs-text' : 'text-cs-text-dim'
                  }`}
                >
                  <Icon className={`shrink-0 ${i === active ? 'text-cs-text' : 'text-cs-text-muted'}`} />
                  <span className="flex-1 truncate">{r.label}</span>
                  {i === active && <FiCornerDownLeft className="text-cs-text-muted" />}
                </li>
              </React.Fragment>
            );
          })}
        </ul>
      </div>
    </div>,
    document.body,
  );
}
