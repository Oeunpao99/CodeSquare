import React, { useState, useEffect } from 'react';
import { crumbName, onCrumbNames } from '../utils/crumbs';
import { NavLink, Link, useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useMajor } from '../context/MajorContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { progressService, usageService, teacherService } from '../services/api';
import TeacherApplyModal from './TeacherApplyModal';
import CommandPalette from './CommandPalette';
import AccountMenu from './AccountMenu';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FiSun, FiMoon, FiGrid, FiSearch, FiMenu, FiX, FiBook, FiBookOpen, FiTarget, FiCode, FiCheck, FiLogOut,
  FiUser, FiSettings, FiLayers, FiCircle, FiActivity, FiChevronRight, FiChevronUp,
  FiChevronsLeft, FiChevronsRight, FiChevronDown, FiZap, FiCpu, FiTrendingUp, FiGlobe,
  FiAward, FiFileText, FiBarChart2, FiArrowRight, FiHelpCircle, FiUsers, FiMessageSquare, FiMail,
} from 'react-icons/fi';
import MajorIcon from './MajorIcon';
import NotificationBell from './NotificationBell';
import { contactLabel } from '../utils/contact';

// Sidebar nav grouped by the student journey (Learn → Practice → Build) so new
// sections slot into an existing group instead of lengthening a flat list.
// Every entry points at a route that already exists — no dead links.
function getNavGroups(t) {
  // 10 entries. Merged sections keep their old pages as tabs (see SECTION_TABS),
  // and `match` keeps the sidebar item highlighted on every tab of the section.
  return [
    {
      id: 'learn',
      items: [
        { to: '/dashboard', label: t('nav.learn'), icon: FiBook, end: true, match: ['/learn', '/roadmap'] },
        { to: '/library', label: t('nav.library'), icon: FiBookOpen },
        { to: '/classes', label: t('nav.my_classes'), icon: FiGrid, match: ['/classes', '/teach'] },
      ],
    },
    {
      id: 'practice',
      items: [
        { to: '/practice', label: t('nav.practice'), icon: FiZap, match: ['/quizzes'] },
        { to: '/tutor', label: t('nav.tutor'), icon: FiCpu },
      ],
    },
    {
      id: 'build',
      items: [
        { to: '/projects', label: t('nav.projects'), icon: FiCode, match: ['/portfolio'] },
        { to: '/notes', label: t('nav.notes'), icon: FiFileText },
      ],
    },
    {
      id: 'grow',
      items: [
        { to: '/progress', label: t('nav.progress'), icon: FiActivity, match: ['/career'] },
      ],
    },
    {
      id: 'community',
      items: [
        { to: '/community', label: t('nav.community'), icon: FiMessageSquare },
        { to: '/devs', label: t('nav.people'), icon: FiUsers, match: ['/leaderboard'] },
        { to: '/messages', label: 'Messages', icon: FiMail, match: ['/messages/'] },
      ],
    },
  ];
}

const GROUP_LABELS = { learn: 'Learn', practice: 'Practice', build: 'Build', grow: 'Grow', community: 'Community' };

// Merged sections: a tab row shown above the page for each set of sibling pages.
// Old URLs (/roadmap, /quizzes, /portfolio, /career, /leaderboard) still work and
// simply open their tab.
const SECTION_TABS = [
  [['/dashboard', 'My courses'], ['/roadmap', 'Roadmap']],
  [['/practice', 'Coding challenges'], ['/quizzes', 'Quizzes']],
  [['/projects', 'Workspaces'], ['/portfolio', 'Portfolio']],
  [['/progress', 'Overview'], ['/career', 'Job readiness']],
  [['/devs', 'Directory'], ['/leaderboard', 'Leaderboard']],
];

// Breadcrumb for the top bar, e.g. "Practice › Coding challenges", "Learn › Power BI › Lesson".
const pretty = (slug) => crumbName(slug) || decodeURIComponent(slug || '').replace(/[-_]+/g, ' ').replace(/^./, (c) => c.toUpperCase());
const CRUMBS = {
  '/dashboard': [['Learn', '/dashboard'], ['My courses']],
  '/roadmap': [['Learn', '/dashboard'], ['Roadmap']],
  '/library': [['Library']],
  '/classes': [['My Classes']],
  '/practice': [['Practice', '/practice'], ['Coding challenges']],
  '/quizzes': [['Practice', '/practice'], ['Quizzes']],
  '/tutor': [['Practice', '/practice'], ['CodeSquareAgent']],
  '/projects': [['Build', '/projects'], ['Projects']],
  '/projects/generate': [['Build', '/projects'], ['Projects', '/projects'], ['Generate with AI']],
  '/portfolio': [['Build', '/projects'], ['Portfolio']],
  '/notes': [['Build', '/projects'], ['Notes']],
  '/progress': [['Grow', '/progress'], ['Progress']],
  '/career': [['Grow', '/progress'], ['Job readiness']],
  '/community': [['Community']],
  '/community/new': [['Community', '/community'], ['New post']],
  '/devs': [['Community', '/community'], ['People']],
  '/messages': [['Community', '/community'], ['Messages']],
  '/leaderboard': [['Community', '/community'], ['Leaderboard']],
  '/profile': [['Account'], ['Profile & settings']],
  '/usage': [['Account'], ['Usage']],
};

function crumbsFor(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (CRUMBS[path]) return CRUMBS[path];
  const seg = path.split('/').filter(Boolean);
  if (seg[0] === 'learn' && seg[1]) {
    return seg.length > 2
      ? [
        ['Learn', '/dashboard'],
        [pretty(seg[1]), `/learn/${seg[1]}`],
        ...(seg[2] === 'module' && crumbName(`module-${seg[3]}`) ? [[crumbName(`module-${seg[3]}`), `/learn/${seg[1]}`]] : []),
        [crumbName(seg[seg.length - 1]) || 'Lesson'],
      ]
      : [['Learn', '/dashboard'], [pretty(seg[1])]];
  }
  if (seg[0] === 'library') {
    const out = [['Library', '/library']];
    if (seg[1]) out.push([pretty(seg[1]), seg[2] ? `/library/${seg[1]}` : undefined]);
    if (seg[2]) out.push([pretty(seg[2])]);
    return out;
  }
  if (seg[0] === 'classes' && seg[1]) return [['My Classes', '/classes'], [crumbName(seg[1]) || 'Class']];
  if (seg[0] === 'community' && seg[1] === 'post') return [['Community', '/community'], ['Post']];
  if (seg[0] === 'messages' && seg[1]) return [['Community', '/community'], ['Messages', '/messages'], [`@${seg[1]}`]];
  if (seg[0] === 'u' && seg[1]) return [['Community', '/community'], ['People', '/devs'], [`@${seg[1]}`]];
  if (seg[0] === 'projects' && seg[1]) return [['Build', '/projects'], ['Projects', '/projects'], [crumbName(seg[1]) || 'Project']];
  if (seg[0] === 'practice' && seg[1] === 'c') return [['Practice', '/practice'], ['Coding challenges', '/practice'], ['Challenge']];
  if (seg[0] === 'quizzes' && seg[1]) return [['Practice', '/practice'], ['Quizzes', '/quizzes'], ['Quiz']];
  return [[pretty(seg[0] || 'Home')]];
}

function Breadcrumb({ pathname }) {
  const [, bump] = useState(0);
  useEffect(() => onCrumbNames(() => bump((n) => n + 1)), []);
  const crumbs = crumbsFor(pathname);
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 min-w-0 text-[0.9375rem]">
      {crumbs.map(([label, to], i) => {
        const last = i === crumbs.length - 1;
        return (
          <React.Fragment key={`${label}-${i}`}>
            {i > 0 && <FiChevronRight className="text-cs-text-muted shrink-0" />}
            {to && !last ? (
              <Link to={to} className="text-cs-text-dim hover:text-cs-text truncate">{label}</Link>
            ) : (
              <span className={`truncate ${last ? 'text-cs-text font-medium' : 'text-cs-text-dim'}`}>{label}</span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

function SectionTabs({ pathname }) {
  const path = pathname.replace(/\/+$/, '') || '/';
  const tabs = SECTION_TABS.find((set) => set.some(([to]) => to === path));
  if (!tabs) return null;
  return (
    <nav className="px-6 lg:px-10 flex gap-7 border-b border-cs-line/10" aria-label="Section">
      {tabs.map(([to, label]) => {
        const active = to === path;
        return (
          <Link
            key={to}
            to={to}
            className={`relative h-12 px-0.5 inline-flex items-center text-[0.9375rem] whitespace-nowrap transition-colors ${
              active ? 'text-cs-primary' : 'text-cs-text-dim hover:text-cs-text'
            }`}
          >
            {active && (
              <motion.span
                layoutId={`section-tab-${tabs[0][0]}`}
                className="absolute left-0 right-0 -bottom-px h-0.5 bg-cs-primary"
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              />
            )}
            <span className="relative">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

// Per-group accent colors give each journey stage its own dev-vibe hue — the
// group header and the active pill inherit the group's color so the whole sidebar
// reads as colour-coded navigation (like an IDE's editor groups). Values are
// "R G B" triples matched to the ACCENTS palette.
const GROUP_COLORS = {
  learn: { rgb: '45 212 191', mint: '94 234 212' },   // teal
  classes: { rgb: '59 130 246', mint: '96 165 250' },  // blue
  practice: { rgb: '139 92 246', mint: '167 139 250' }, // violet
  build: { rgb: '34 211 238', mint: '125 236 255' },   // cyan
  career: { rgb: '74 222 128', mint: '134 239 172' },  // green
  grow: { rgb: '74 222 128', mint: '134 239 172' },    // green
  community: { rgb: '251 146 60', mint: '253 186 116' }, // orange
};


const NAV_ITEMS_RAW = [
  { to: '/dashboard', icon: FiBook, end: true, match: ['/learn', '/roadmap'] },
  { to: '/library', icon: FiBookOpen },
  { to: '/classes', icon: FiGrid, match: ['/classes', '/teach'] },
  { to: '/practice', icon: FiZap, match: ['/quizzes'] },
  { to: '/tutor', icon: FiCpu },
  { to: '/projects', icon: FiCode, match: ['/portfolio'] },
  { to: '/notes', icon: FiFileText },
  { to: '/progress', icon: FiActivity, match: ['/career'] },
  { to: '/community', icon: FiMessageSquare },
  { to: '/devs', icon: FiUsers, match: ['/leaderboard'] },
];

const NAV_COLLAPSE_KEY = 'cs-nav-groups-collapsed';

function readNavGroups() {
  try {
    return JSON.parse(localStorage.getItem(NAV_COLLAPSE_KEY)) || {};
  } catch {
    return {};
  }
}

const ACCENTS = [
  { name: 'Teal', token: '45 212 191', mint: '94 234 212' },
  { name: 'Cyan', token: '34 211 238', mint: '125 236 255' },
  { name: 'Blue', token: '59 130 246', mint: '96 165 250' },
  { name: 'Violet', token: '139 92 246', mint: '167 139 250' },
  { name: 'Green', token: '74 222 128', mint: '134 239 172' },
  { name: 'Orange', token: '251 146 60', mint: '253 186 116' },
  { name: 'Pink', token: '236 72 153', mint: '249 168 212' },
  { name: 'Red', token: '248 113 113', mint: '252 165 165' },
];

const ACCENT_KEY = 'cs-accent';

function readAccent() {
  try {
    const saved = localStorage.getItem(ACCENT_KEY);
    if (saved) return saved;
  } catch { /* ignore */ }
  return null;
}

// Shared shell for authenticated pages: a responsive left sidebar (fixed on
// desktop, slide-in drawer on mobile) plus the main content area. Clicking the
// user row opens a settings/theme/color/activity popup.
function ModeToggle({ mode, toggleMode, theme, setTheme, themes, themeKeys }) {
  // Split control: the sun/moon flips light <-> dark in one click; the chevron
  // opens a small menu to pick the exact theme without going to Settings.
  const isDark = mode === 'dark';
  const [open, setOpen] = useState(false);
  const ref = React.useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const swatch = (key) => {
    const c = themes[key].colors;
    return (
      <span
        className="relative w-9 h-6 rounded-md overflow-hidden shrink-0 border border-cs-line/15"
        style={{ background: `rgb(${c['cs-dark']})` }}
      >
        <span className="absolute left-1 top-1 h-1 w-4 rounded-full" style={{ background: `rgb(${c['cs-text']})` }} />
        <span className="absolute left-1 top-3 h-1 w-6 rounded-full" style={{ background: `rgb(${c['cs-primary']})` }} />
        <span className="absolute right-1 bottom-1 h-1.5 w-1.5 rounded-full" style={{ background: `rgb(${c['cs-green']})` }} />
      </span>
    );
  };

  return (
    <div className="relative" ref={ref}>
      <div className="inline-flex items-center h-8 rounded-full border border-cs-line/15 bg-cs-darker/80 backdrop-blur-md text-cs-text-dim">
        <button
          type="button"
          onClick={toggleMode}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          className="h-full pl-2.5 pr-1.5 inline-flex items-center hover:text-cs-primary transition-colors"
        >
          {isDark ? <FiSun className="text-[0.9375rem]" /> : <FiMoon className="text-[0.9375rem]" />}
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          title="Choose a theme"
          aria-label="Choose a theme"
          aria-haspopup="menu"
          aria-expanded={open}
          className="h-full pl-1 pr-2 inline-flex items-center border-l border-cs-line/15 hover:text-cs-primary transition-colors"
        >
          <FiChevronDown className={`text-[0.8125rem] transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 p-2 rounded-xl border border-cs-line/15 bg-cs-darkest shadow-2xl z-[60] animate-route-fade"
        >
          {/* Light / Dark segmented switch */}
          <div className="grid grid-cols-2 gap-1 p-1 mb-2 rounded-lg bg-cs-overlay/[0.06] text-xs font-semibold">
            {[
              ['light', 'Light', FiSun],
              ['dark', 'Dark', FiMoon],
            ].map(([m, label, Icon]) => (
              <button
                key={m}
                type="button"
                onClick={() => m !== mode && toggleMode()}
                className={`inline-flex items-center justify-center gap-1.5 py-1.5 rounded-md transition-colors ${
                  mode === m ? 'bg-cs-overlay/[0.09] text-cs-text font-medium' : 'text-cs-text-dim hover:text-cs-text'
                }`}
              >
                <Icon /> {label}
              </button>
            ))}
          </div>

          <p className="px-2 pt-1 pb-1.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-cs-text-muted">
            {isDark ? 'Dark themes' : 'Light themes'}
          </p>
          <div className="max-h-72 overflow-y-auto">
            {themeKeys
              .filter((key) => themes[key].mode === mode)
              .map((key) => {
                const active = key === theme;
                return (
                  <button
                    key={key}
                    type="button"
                    role="menuitemradio"
                    aria-checked={active}
                    onClick={() => setTheme(key)}
                    className={`w-full flex items-center gap-3 px-2 py-1.5 rounded-lg text-left transition-colors ${
                      active ? 'bg-cs-primary/10' : 'hover:bg-cs-overlay/5'
                    }`}
                  >
                    {swatch(key)}
                    <span className="flex-grow min-w-0">
                      <span className={`block text-sm font-medium truncate ${active ? 'text-cs-primary' : 'text-cs-text'}`}>
                        {themes[key].label}
                      </span>
                      {themes[key].hint && (
                        <span className="block text-[0.6875rem] text-cs-text-muted truncate">{themes[key].hint}</span>
                      )}
                    </span>
                    {active && <FiCheck className="text-cs-primary shrink-0" />}
                  </button>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}

// Settings entry for becoming an instructor. Everyone starts as a student;
// this is the one place that leads to the teacher application (/teach).
function InstructorEntry({ status, onLoad, onNavigate, onApply }) {
  useEffect(() => {
    if (status !== undefined) return;
    teacherService.me()
      .then((r) => onLoad(r.data?.status || null))
      .catch(() => onLoad(null));
  }, [status, onLoad]);

  if (status === undefined) return null;
  const approved = status === 'approved';
  const pending = status === 'pending';
  // Approved: go straight to the classes. Otherwise open the application dialog.
  const Tag = approved ? Link : 'button';
  const tagProps = approved
    ? { to: '/classes', onClick: onNavigate }
    : { type: 'button', onClick: onApply };
  return (
    <div>
      <p className="mono-label text-cs-text-muted mb-2">Instructor</p>
      <Tag
        {...tagProps}
        className="w-full text-left flex items-center gap-3 p-3 rounded-xl border border-cs-line/10 hover:border-cs-primary/40 transition-colors"
      >
        <FiGrid className="text-cs-primary" />
        <span className="min-w-0">
          <span className="block text-sm font-medium">
            {approved ? 'Manage my classes' : pending ? 'Instructor application pending' : 'Join as Instructor'}
          </span>
          <span className="block text-xs text-cs-text-dim">
            {approved
              ? 'You’re an approved instructor'
              : pending
                ? 'We’ll let you know once it’s reviewed'
                : 'Create classes and share materials with your students'}
          </span>
        </span>
        <FiChevronRight className="ml-auto text-cs-text-muted shrink-0" />
      </Tag>
    </div>
  );
}

function LangToggle({ lang, setLang, languages }) {
  // Two-option segmented switch: EN | ខ្មែរ. Lives in the top header.
  const short = { en: 'EN', km: 'ខ្មែរ' };
  return (
    <div
      role="group"
      aria-label="Language"
      className="inline-flex items-center rounded-full border border-cs-line/15 bg-cs-darker/80 backdrop-blur-md p-0.5 text-xs font-semibold"
    >
      {languages.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => setLang(l.code)}
          aria-pressed={lang === l.code}
          title={l.native}
          className={`px-2.5 py-1 rounded-full transition-colors ${
            lang === l.code
              ? 'bg-cs-primary text-cs-btn-text'
              : 'text-cs-text-dim hover:text-cs-text'
          }`}
        >
          {short[l.code] || l.code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function AppLayout() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const [teacherStatus, setTeacherStatus] = useState(undefined); // undefined = not loaded
  const [applyOpen, setApplyOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Ctrl/Cmd+K opens the "jump to" search from anywhere in the app.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const { major, majorData, clearMajor } = useMajor();
  const { theme, setTheme, themes, themeKeys, mode, toggleMode } = useTheme();
  const { lang, setLang, languages } = useLanguage();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('cs-sidebar-collapsed') === '1';
    } catch { /* ignore */ }
    return false;
  });
  const [popup, setPopup] = useState(false);
  const [tab, setTab] = useState('activity');
  const [activity, setActivity] = useState(null);
  const [usage, setUsage] = useState(null);
  const [navGroups, setNavGroups] = useState(readNavGroups);
  const navigate = useNavigate();
  const location = useLocation();

  const NAV_GROUPS = getNavGroups(t);

  // First two path segments — keys the content wrapper so navigating *within*
  // a section (lesson ↔ lesson) swaps instantly while section/detail changes
  // (e.g. clicking "read more" on a post card) get a smooth fade-in.
  const contentKey = location.pathname.startsWith('/messages/')
    ? '/messages' : location.pathname.split('/').slice(0, 3).join('/') || '/';
  const isMessages = contentKey === '/messages';

  // Reset scroll smoothly whenever the visible section actually changes.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [contentKey]);

  const close = () => setOpen(false);

  const toggleNavGroup = (id) => {
    setNavGroups((g) => {
      const next = { ...g, [id]: !g[id] };
      try { localStorage.setItem(NAV_COLLAPSE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem('cs-sidebar-collapsed', next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  };

  const handleLogout = () => {
    close();
    setPopup(false);
    logout();
    navigate('/');
  };

  const openPopup = (t) => {
    setTab(t || 'activity');
    setPopup(true);
  };

  // Load real activity stats only when the popup's activity tab is shown.
  useEffect(() => {
    if (popup && tab === 'activity' && !activity) {
      progressService
        .getSummary()
        .then((r) => setActivity(r.data))
        .catch(() => setActivity(null));
    }
  }, [popup, tab, activity]);

  // Keep usage fresh whenever the popup opens (any tab — the footer chip shows it too).
  useEffect(() => {
    if (popup) {
      usageService.get().then((r) => setUsage(r.data)).catch(() => {});
    }
  }, [popup]);

  // And a lightweight pull on mount so the footer chip has numbers.
  useEffect(() => {
    usageService.get().then((r) => setUsage(r.data)).catch(() => {});
  }, []);

  const applyAccent = (accent) => {
    const root = document.documentElement;
    root.style.setProperty('--cs-primary', accent.token);
    root.style.setProperty('--cs-mint', accent.mint);
    try {
      localStorage.setItem(ACCENT_KEY, accent.name);
    } catch { /* ignore */ }
  };

  const accentName = readAccent();

  // Some sections (Learn) own routes that don't sit under their nav `to`
  // (`/learn/:slug` lives "inside" the Dashboard). `match` lets such an item
  // stay highlighted on those sibling routes too.
  const isNavActive = (item, routerActive) =>
    routerActive || (item.match?.some((p) => location.pathname.startsWith(p)) ?? false);

  const renderNavLink = (item) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.end}
      onClick={close}
      className="relative block group"
    >
      {({ isActive: routerActive }) => {
      const isActive = isNavActive(item, routerActive);
      return (
        <>
          {isActive && (
            <span className="absolute inset-0 rounded-lg bg-cs-overlay/[0.09]" />
          )}
          <span
            className={`relative flex items-center gap-3 px-3 py-[0.4375rem] rounded-lg text-[0.9375rem] transition-colors duration-150 ${
              isActive
                ? 'text-cs-text font-medium'
                : 'text-cs-text-dim font-medium group-hover:bg-cs-overlay/[0.06] group-hover:text-cs-text'
            }`}
          >
            <item.icon className={`text-[1.125rem] shrink-0 transition-colors ${isActive ? 'text-cs-text' : 'text-cs-text-muted group-hover:text-cs-text'}`} />
            <span className="flex-grow truncate">{item.label}</span>
          </span>
        </>
      );
      }}
    </NavLink>
  );

  const sidebarBackdrop = (
    <>
      {/* frosted glass wash over the whole rail */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(160deg, rgb(var(--cs-overlay) / 0.06), rgb(var(--cs-overlay) / 0.02) 45%, transparent 80%)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
        }}
      />
      {/* subtle grid / scanline tech backdrop */}
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            'radial-gradient(rgb(var(--cs-primary) / 0.05) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
          maskImage: 'radial-gradient(ellipse 120% 70% at 50% 0%, #000 30%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 120% 70% at 50% 0%, #000 30%, transparent 100%)',
        }}
      />
    </>
  );

  const sidebarContent = collapsed ? (
    <div className="flex flex-col w-full min-w-0 h-full relative overflow-hidden">
      {sidebarBackdrop}

      {/* Brand (compact) + expand at top */}
      <div className="relative px-3 pt-5 pb-2 flex flex-col items-center gap-3">
        <img src="/logo.png" alt="CodeSquare" className="h-9 w-auto object-contain" />
        <button
          onClick={toggleCollapsed}
          title={t('sidebar.expand_sidebar')}
          className="w-full flex items-center justify-center py-2.5 rounded-[0.625rem] text-cs-text-dim border border-cs-line/15 bg-cs-overlay/[0.05] backdrop-blur-md hover:border-cs-primary/40 hover:text-cs-primary transition-all"
        >
          <FiChevronsRight className="text-lg" />
        </button>
      </div>

      {/* Nav — icon-only rail */}
      <nav className="relative flex-1 px-3 space-y-2 overflow-y-auto flex flex-col items-stretch">
        {NAV_ITEMS_RAW.map((item) => {
          const grp = NAV_GROUPS.find((g) => g.items.some((it) => it.to === item.to));
          const label = grp?.items.find((it) => it.to === item.to)?.label || '';
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={close}
              className="relative block group"
              title={label}
            >
              {({ isActive: routerActive }) => {
                const isActive = isNavActive(item, routerActive);
                return (
              <>
                {isActive && (
                  <span className="absolute inset-0 rounded-[0.625rem] bg-cs-overlay/[0.09]" />
                )}
                <span
                  className={`relative flex items-center justify-center py-3.5 rounded-[0.625rem] text-xl transition-colors duration-150 ${
                    isActive
                      ? 'text-cs-text'
                      : 'text-cs-text-muted group-hover:bg-cs-overlay/[0.06] group-hover:text-cs-cyan'
                  }`}
                >
                  <item.icon className="shrink-0" />
                </span>
              </>
            );
            }}
          </NavLink>
          );
        })}
      </nav>
    </div>
  ) : (
    <div className="flex flex-col w-full min-w-0 h-full relative overflow-hidden">
      {sidebarBackdrop}

      {/* Brand — green brandmark on the same line as the collapse control */}
      <div className="relative px-5 py-5 flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="/logo.png"
              alt="CodeSquare"
              className="h-10 w-auto object-contain shrink-0"
            />
            {/* Neutral wordmark: calm grey, follows light/dark theme */}
            <span className="text-2xl font-bold tracking-tight leading-none text-cs-text-dim whitespace-nowrap">
              codesquare
            </span>
          </div>
          <button
            onClick={toggleCollapsed}
            title={t('sidebar.collapse_sidebar')}
            className="hidden lg:inline-flex p-2 rounded-lg text-cs-text-dim border border-cs-line/15 bg-cs-overlay/[0.04] backdrop-blur-md hover:border-cs-primary/40 hover:text-cs-primary transition-all shrink-0"
          >
            <FiChevronsLeft className="text-lg" />
          </button>
        </div>
      </div>

      {/* Search / jump to (Ctrl K) */}
      <div className="relative px-3 pb-2">
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="w-full flex items-center gap-2.5 h-10 px-3 rounded-lg border border-cs-line/15 bg-cs-overlay/[0.03] text-sm text-cs-text-muted hover:text-cs-text hover:border-cs-line/30 transition-colors"
        >
          <FiSearch className="shrink-0" />
          <span className="flex-1 text-left">Search</span>
          <kbd className="text-[0.6875rem] font-sans font-medium text-cs-text-muted">Ctrl K</kbd>
        </button>
      </div>

      {/* Nav, grouped by journey stage */}
      <nav className="relative flex-1 px-3 space-y-1 overflow-y-auto pb-3">
        {NAV_GROUPS.map((grp) => {
          const isCollapsed = !!navGroups[grp.id];
          return (
            <div key={grp.id} className="space-y-0.5">
              <button
                onClick={() => toggleNavGroup(grp.id)}
                className="w-full flex items-center gap-1.5 px-3 pt-3 pb-1 text-[0.8125rem] font-medium text-cs-text-muted hover:text-cs-text transition-colors"
                aria-expanded={!isCollapsed}
              >
                <span>{GROUP_LABELS[grp.id] || grp.id}</span>
                <FiChevronDown
                  className={`text-xs shrink-0 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-180'}`}
                />
              </button>
              <AnimatePresence initial={false}>
                {!isCollapsed && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    className="overflow-hidden space-y-0.5"
                  >
                    {grp.items.map(renderNavLink)}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>

    </div>
  );

  const popupTabs = [
    { id: 'activity', label: t('settings.activity'), icon: FiActivity },
    { id: 'usage', label: t('settings.usage'), icon: FiBarChart2 },
    { id: 'settings', label: t('settings.settings'), icon: FiSettings },
    { id: 'theme', label: t('settings.theme'), icon: FiLayers },
    { id: 'color', label: t('settings.color'), icon: FiCircle },
  ];

  const fmtCountdown = (s) => {
    if (!s || s <= 0) return 'now';
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
    return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const UsageBar = ({ w }) => {
    const warn = w.percent >= 80;
    return (
      <div className="rounded-xl bg-cs-darker/60 border border-cs-line/10 p-4">
        <div className="flex items-end justify-between gap-2 mb-2">
          <span className="mono-label text-cs-text-muted">{w.label}</span>
          <span className={`text-lg font-bold ${warn ? 'text-cs-orange' : 'text-cs-primary'}`}>
            {w.percent}<span className="text-xs text-cs-text-muted">%</span>
          </span>
        </div>
        <div className="h-2 rounded-full bg-cs-overlay/10 overflow-hidden">
          <div
            className="h-full rounded-full transition-[width] duration-700"
            style={{
              width: `${Math.max(2, w.percent)}%`,
              background: warn
                ? 'linear-gradient(90deg, rgb(var(--cs-orange)/0.4), rgb(var(--cs-orange)))'
                : 'linear-gradient(90deg, rgb(var(--cs-primary)/0.4), rgb(var(--cs-primary)))',
            }}
          />
        </div>
        <p className="mt-2 text-[0.6875rem] text-cs-text-muted">
          {(w.used || 0).toLocaleString()} / {(w.limit || 0).toLocaleString()} tokens · frees up in {fmtCountdown(w.resets_in_seconds)}
        </p>
      </div>
    );
  };

  return (
    <div className={`bg-cs-dark ${isMessages ? 'flex h-dvh flex-col' : 'min-h-screen'}`}>
      {/* Desktop notification bell — pinned top-right, vertically centered in an
          h-14 strip anchored at top-0 so it sits within the top band that pages'
          sticky headers keep clear on the right (the few pages with a top-right
          control — e.g. Practice's mode toggle — add `lg:pr-72` to their header
          row to reserve this ~240px: theme + language toggles + bell). The strip is click-through
          (pointer-events-none) except for the bell itself. z sits above page
          sticky headers (30) but below the CodeSquareAgent dock (40), so an open
          dock on the library pages covers it instead of it floating over chat. */}
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}

      {applyOpen && (
        <TeacherApplyModal onClose={() => setApplyOpen(false)} onStatus={setTeacherStatus} />
      )}

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 shrink-0 lg:hidden bg-cs-dark bg-opacity-90 backdrop-blur-2xl border-b border-cs-line/10">
        <div className="px-4 py-3 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2">
            <img src="/logo.png" alt="CodeSquare" className="h-7 w-auto object-contain" />
            <span className="text-lg font-bold text-cs-text">codesquare</span>
          </Link>
          <div className="flex items-center gap-2">
            <ModeToggle mode={mode} toggleMode={toggleMode} theme={theme} setTheme={setTheme} themes={themes} themeKeys={themeKeys} />
          <LangToggle lang={lang} setLang={setLang} languages={languages} />
            <NotificationBell />
            <AccountMenu
              user={user}
              onLogout={handleLogout}
              onOpenSettings={() => openPopup('settings')}
              onOpenActivity={() => openPopup('activity')}
              onInstructor={() => setApplyOpen(true)}
            />
            <button
              onClick={() => setOpen(true)}
              className="p-2 rounded-lg border border-cs-line/10 text-cs-text-dim hover:text-cs-primary transition-colors"
              aria-label="Open menu"
            >
              <FiMenu className="text-xl" />
            </button>
          </div>
        </div>
      </header>

      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex fixed top-0 left-0 bottom-0 ${
          collapsed ? 'w-20' : 'w-80'
        } border-r border-cs-line/10 bg-cs-dark/80 backdrop-blur-2xl z-30 transition-[width] duration-300`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile drawer overlay */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden bg-black/60" onClick={close} aria-hidden="true"></div>
      )}

      {/* Mobile drawer */}
      <aside
        className={`fixed top-0 left-0 bottom-0 w-80 bg-cs-dark/80 backdrop-blur-2xl border-r border-cs-line/10 z-50 transition-transform duration-300 lg:hidden ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <button
          onClick={close}
          className="absolute top-4 right-4 p-2 rounded-lg text-cs-text-dim hover:text-cs-primary transition-colors"
          aria-label="Close menu"
        >
          <FiX className="text-xl" />
        </button>
        {sidebarContent}
      </aside>

      {/* Main content — cross-fades on tab / section change; the sidebar persists.
          Keyed by the first two path segments so navigating *within* a section
          (article ↔ article, lesson ↔ lesson) swaps instantly without a fade. */}
      <main className={`${collapsed ? 'lg:pl-20' : 'lg:pl-80'} ${isMessages ? 'flex min-h-0 flex-1 flex-col' : ''} transition-[padding] duration-300`}>
        {/* Fade-only (opacity, no transform) so position:sticky stays attached to
            the window scroll. Keyed by the first two path segments so
            within-section navigations swap without a remount. */}
        {/* App top bar (desktop): breadcrumb left, controls right */}
        <header className="hidden lg:flex sticky top-0 z-40 h-14 shrink-0 items-center justify-between gap-4 px-6 lg:px-10 bg-cs-dark/95 backdrop-blur-xl border-b border-cs-line/10">
          <Breadcrumb pathname={location.pathname} />
          <div className="flex items-center gap-2 shrink-0">
          <ModeToggle mode={mode} toggleMode={toggleMode} theme={theme} setTheme={setTheme} themes={themes} themeKeys={themeKeys} />
          <LangToggle lang={lang} setLang={setLang} languages={languages} />
          <NotificationBell />
          <AccountMenu
            user={user}
            onLogout={handleLogout}
            onOpenSettings={() => openPopup('settings')}
            onOpenActivity={() => openPopup('activity')}
            onInstructor={() => setApplyOpen(true)}
          />
          </div>
        </header>
        <SectionTabs pathname={location.pathname} />
        <div
          key={contentKey}
          className={`animate-route-fade ${isMessages ? 'flex min-h-0 flex-1' : 'min-h-[calc(100vh-3.75rem)] lg:min-h-[calc(100vh-3.5rem)]'}`}
        >
          <Outlet />
        </div>
      </main>

      {/* Settings popup */}
      {popup && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="absolute inset-0 bg-cs-dark/70 backdrop-blur-sm" onClick={() => setPopup(false)} />

          <div className="relative flex w-[94vw] max-w-4xl h-[88vh] max-h-[45rem] flex-col overflow-hidden rounded-2xl border border-cs-line/10 bg-cs-darkest shadow-2xl sm:w-[82vw] lg:w-[62vw]">
            {/* header */}
            <div className="px-4 sm:px-6 py-4 border-b border-cs-line/10 flex items-center gap-3 sm:gap-4">
              <span className="w-12 h-12 rounded-full bg-gradient-main flex items-center justify-center font-bold overflow-hidden text-cs-dark shrink-0">
                {user?.avatar ? (
                  <img src={user.avatar} alt={user.username} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl">{(user?.display_name || user?.username)?.charAt(0).toUpperCase()}</span>
                )}
              </span>
              <div className="flex-grow min-w-0">
                <p className="font-bold truncate">{user?.display_name || user?.username}</p>
                <p className="text-xs text-cs-text-muted truncate">{contactLabel(user)}</p>
              </div>
              <button
                onClick={() => setPopup(false)}
                className="p-2 rounded-lg text-cs-text-dim hover:text-cs-primary transition-colors"
                aria-label="Close"
              >
                <FiX />
              </button>
            </div>

            {/* tabs */}
            <div className="flex overflow-x-auto border-b border-cs-line/10">
              {popupTabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-2 sm:px-3 py-3 text-xs sm:text-sm font-medium whitespace-nowrap transition-colors ${
                    tab === t.id
                      ? 'text-cs-primary border-b-2 border-cs-primary'
                      : 'text-cs-text-dim hover:text-cs-text'
                  }`}
                >
                  <t.icon className="text-sm shrink-0" />
                  <span className="hidden sm:inline">{t.label}</span>
                </button>
              ))}
            </div>

            {/* body */}
            <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-5">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={tab}
                  initial={{ opacity: 0, x: 18 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -18 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                >
              {tab === 'activity' && (
                <div>
                  <p className="mono-label text-cs-text-muted mb-4"> {t('activity.your_recent')}</p>
                  {activity ? (
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: t('activity.lessons'), value: activity.total_lessons_completed, icon: FiBook, cls: 'text-cs-primary' },
                        { label: t('activity.total_xp'), value: activity.total_xp, icon: FiActivity, cls: 'text-cs-cyan' },
                        { label: t('activity.day_streak'), value: activity.current_streak, icon: FiBook, cls: 'text-cs-green' },
                        { label: t('activity.hints_used'), value: activity.hints_used_total, icon: FiBook, cls: 'text-cs-orange' },
                      ].map((s) => (
                        <div key={s.label} className="rounded-xl bg-cs-darker/60 border border-cs-line/10 p-4">
                          <div className={`text-xl mb-2 ${s.cls}`}><s.icon /></div>
                          <div className="text-2xl font-bold">{s.value}</div>
                          <div className="text-xs text-cs-text-muted">{s.label}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-cs-text-muted text-center py-6">Loading activity…</p>
                  )}
                </div>
              )}

              {tab === 'usage' && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <p className="mono-label text-cs-text-muted"> {t('usage.ai_token_usage')}</p>
                    {usage && (
                      <span className="px-2 py-0.5 rounded-md text-[0.625rem] font-semibold uppercase tracking-wide border border-cs-primary/30 bg-cs-primary/10 text-cs-primary">
                        {usage.plan_label}
                      </span>
                    )}
                  </div>
                  {usage ? (
                    <div className="space-y-3">
                      <UsageBar w={usage.session} />
                      <UsageBar w={usage.weekly} />
                      <p className="text-[0.6875rem] text-cs-text-muted">
                        {t('usage.ai_calls_this_week', { count: usage.calls_this_week })}
                      </p>
                      <Link
                        to="/usage"
                        onClick={() => setPopup(false)}
                        className="inline-flex items-center gap-1.5 text-sm text-cs-primary hover:text-cs-cyan mt-1"
                      >
                        {t('usage.full_usage_plans')} <FiArrowRight />
                      </Link>
                    </div>
                  ) : (
                    <p className="text-sm text-cs-text-muted text-center py-6">Loading usage…</p>
                  )}
                </div>
              )}

              {tab === 'settings' && (
                <div className="space-y-4">
                  <InstructorEntry
                    status={teacherStatus}
                    onLoad={setTeacherStatus}
                    onNavigate={() => setPopup(false)}
                    onApply={() => { setPopup(false); setApplyOpen(true); }}
                  />
                  <div>
                    <p className="mono-label text-cs-text-muted mb-2"> {t('settings.settings')}</p>
                    <Link
                      to="/profile"
                      onClick={() => setPopup(false)}
                      className="flex items-center gap-3 p-3 rounded-xl border border-cs-line/10 hover:border-cs-primary/40 transition-colors"
                    >
                      <FiUser className="text-cs-primary" />
                      <span className="text-sm font-medium">{t('settings.profile_full_settings')}</span>
                      <FiChevronRight className="ml-auto text-cs-text-muted" />
                    </Link>
                  </div>

                  <div>
                    <p className="mono-label text-cs-text-muted mb-2"> {t('settings.major')}</p>
                    {majorData ? (
                      <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-cs-line/10">
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                            style={{ background: `${majorData.color}1f`, color: majorData.color }}
                          >
                            <MajorIcon major={major} />
                          </span>
                          <div className="min-w-0">
                            <p className="text-2xl font-bold" style={{ color: majorData.color }}>{majorData.label}</p>
                            <p className="text-xs text-cs-text-muted truncate">{majorData.blurb}</p>
                            <p className="text-xs text-cs-text-muted">
                              {majorData.focus.slice(0, 4).join(' · ')}…
                            </p>
                          </div>
                        </div>
                        <button onClick={clearMajor} className="text-xs text-cs-red hover:underline shrink-0">
                          {t('settings.clear')}
                        </button>
                      </div>
                    ) : (
                      <p className="text-sm text-cs-text-muted">{t('settings.no_major')}</p>
                    )}
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={handleLogout}
                      className="flex items-center justify-center gap-2 w-[6.25rem] p-2.5 rounded-xl border border-cs-red/30 text-cs-red text-sm hover:bg-cs-red/10 transition-colors"
                    >
                      <FiLogOut /> {t('settings.log_out')}
                    </button>
                  </div>
                </div>
              )}

              {tab === 'theme' && (
                <div>
                  <p className="mono-label text-cs-text-muted mb-3"> {t('settings.themes')}</p>
                  {['dark', 'light'].map((mode) => (
                    <div key={mode} className="mb-4 last:mb-0">
                      <p className="text-xs uppercase tracking-wider text-cs-text-muted mb-2">{mode}</p>
                      <div className="grid grid-cols-1 gap-2">
                        {themeKeys
                          .filter((key) => themes[key].mode === mode)
                          .map((key) => {
                            const active = key === theme;
                            const accent = `${themes[key].colors['cs-primary']}`;
                            return (
                              <button
                                key={key}
                                onClick={() => {
                                  setTheme(key);
                                  // Re-apply any chosen custom accent after the
                                  // theme resets the brand tokens.
                                  const saved = readAccent();
                                  const match = ACCENTS.find((a) => a.name === saved);
                                  if (match) {
                                    const root = document.documentElement;
                                    root.style.setProperty('--cs-primary', match.token);
                                    root.style.setProperty('--cs-mint', match.mint);
                                  }
                                }}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors ${
                                  active
                                    ? 'border-cs-primary bg-cs-primary/10'
                                    : 'border-cs-line/10 hover:border-cs-primary/40'
                                }`}
                              >
                                <span
                                  className="w-6 h-6 rounded-md shrink-0"
                                  style={{ background: `rgb(${accent})` }}
                                />
                                <span className="flex-1 min-w-0">
                                  <span className="block text-sm font-medium truncate">{themes[key].label}</span>
                                </span>
                                {active && <FiCheck className="text-cs-primary shrink-0" />}
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {tab === 'color' && (
                <div>
                  <p className="mono-label text-cs-text-muted mb-3">
                    {t('settings.accent_color')} {accentName ? `· ${accentName}` : ''}
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {ACCENTS.map((a) => (
                      <button
                        key={a.name}
                        onClick={() => applyAccent(a)}
                        className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-colors ${
                          accentName === a.name
                            ? 'border-cs-primary bg-cs-primary/10'
                            : 'border-cs-line/10 hover:border-cs-primary/40'
                        }`}
                      >
                        <span
                          className="w-9 h-9 rounded-full"
                          style={{ background: `rgb(${a.token})` }}
                        />
                        <span className="text-[0.6875rem] text-cs-text-muted">{a.name}</span>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-cs-text-muted mt-4">
                    Overrides the brand accent on top of your chosen theme. Switch back in the Theme tab.
                  </p>
                </div>
              )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AppLayout;
