import React, { useState, useEffect } from 'react';
import { NavLink, Link, useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useMajor } from '../context/MajorContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { progressService, usageService } from '../services/api';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FiMenu, FiX, FiBook, FiBookOpen, FiTarget, FiCode, FiCheck, FiLogOut,
  FiUser, FiSettings, FiLayers, FiCircle, FiActivity, FiChevronRight, FiChevronUp,
  FiChevronsLeft, FiChevronsRight, FiChevronDown, FiZap, FiCpu, FiTrendingUp, FiGlobe,
  FiAward, FiFileText, FiBarChart2, FiArrowRight, FiHelpCircle, FiUsers, FiMessageSquare,
  FiGlobe as FiLanguage,
} from 'react-icons/fi';
import MajorIcon from './MajorIcon';
import NotificationBell from './NotificationBell';

// Sidebar nav grouped by the student journey (Learn → Practice → Build) so new
// sections slot into an existing group instead of lengthening a flat list.
// Every entry points at a route that already exists — no dead links.
function getNavGroups(t) {
  return [
    {
      id: 'learn',
      items: [
        { to: '/dashboard', label: t('nav.learn'), icon: FiBook, end: true, match: ['/learn'] },
        { to: '/roadmap', label: t('nav.roadmap'), icon: FiTarget },
        { to: '/library', label: t('nav.library'), icon: FiBookOpen },
        { to: '/progress', label: t('nav.progress'), icon: FiActivity },
      ],
    },
    {
      id: 'practice',
      items: [
        { to: '/practice', label: t('nav.practice'), icon: FiZap },
        { to: '/quizzes', label: t('nav.quizzes'), icon: FiHelpCircle },
        { to: '/tutor', label: t('nav.tutor'), icon: FiCpu },
      ],
    },
    {
      id: 'build',
      items: [
        { to: '/projects', label: t('nav.projects'), icon: FiCode },
        { to: '/notes', label: t('nav.notes'), icon: FiFileText },
        { to: '/portfolio', label: t('nav.portfolio'), icon: FiGlobe },
      ],
    },
    {
      id: 'career',
      items: [
        { to: '/career', label: t('nav.job_readiness'), icon: FiTrendingUp },
      ],
    },
    {
      id: 'community',
      items: [
        { to: '/devs', label: t('nav.dev_directory'), icon: FiUsers },
        { to: '/community', label: t('nav.dev_community'), icon: FiMessageSquare },
        { to: '/leaderboard', label: t('nav.leaderboard'), icon: FiAward },
      ],
    },
  ];
}

// Per-group accent colors give each journey stage its own dev-vibe hue — the
// group header and the active pill inherit the group's color so the whole sidebar
// reads as colour-coded navigation (like an IDE's editor groups). Values are
// "R G B" triples matched to the ACCENTS palette.
const GROUP_COLORS = {
  learn: { rgb: '45 212 191', mint: '94 234 212' },   // teal
  practice: { rgb: '139 92 246', mint: '167 139 250' }, // violet
  build: { rgb: '34 211 238', mint: '125 236 255' },   // cyan
  career: { rgb: '74 222 128', mint: '134 239 172' },  // green
  community: { rgb: '251 146 60', mint: '253 186 116' }, // orange
};


const NAV_ITEMS_RAW = [
  { to: '/dashboard', icon: FiBook, end: true, match: ['/learn'] },
  { to: '/roadmap', icon: FiTarget },
  { to: '/library', icon: FiBookOpen },
  { to: '/progress', icon: FiActivity },
  { to: '/practice', icon: FiZap },
  { to: '/quizzes', icon: FiHelpCircle },
  { to: '/tutor', icon: FiCpu },
  { to: '/projects', icon: FiCode },
  { to: '/notes', icon: FiFileText },
  { to: '/portfolio', icon: FiGlobe },
  { to: '/career', icon: FiTrendingUp },
  { to: '/devs', icon: FiUsers },
  { to: '/community', icon: FiMessageSquare },
  { to: '/leaderboard', icon: FiAward },
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
function AppLayout() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { major, majorData, clearMajor } = useMajor();
  const { theme, setTheme, themes, themeKeys } = useTheme();
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
  const [langOpen, setLangOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const NAV_GROUPS = getNavGroups(t);

  // First two path segments — keys the content wrapper so navigating *within*
  // a section (lesson ↔ lesson) swaps instantly while section/detail changes
  // (e.g. clicking "read more" on a post card) get a smooth fade-in.
  const contentKey = location.pathname.split('/').slice(0, 3).join('/') || '/';

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
            <motion.span
              layoutId="sidebar-active"
              className="absolute inset-0 rounded-[10px] bg-cs-primary/[0.10]"
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            />
          )}
          {isActive && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-full bg-cs-primary" aria-hidden="true" />
          )}
          <span
            className={`relative flex items-center gap-3 pl-3.5 pr-3 py-2.5 rounded-[10px] font-mono text-[15px] transition-colors duration-150 ${
              isActive
                ? 'text-cs-primary font-semibold'
                : 'text-cs-text-dim font-medium group-hover:bg-cs-overlay/[0.06] group-hover:text-cs-text'
            }`}
          >
            <item.icon className={`text-[19px] shrink-0 transition-colors ${isActive ? 'text-cs-primary' : 'text-cs-text-muted group-hover:text-cs-cyan'}`} />
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
    <div className="flex flex-col h-full relative overflow-hidden">
      {sidebarBackdrop}

      {/* Brand (compact) + expand at top */}
      <div className="relative px-3 pt-5 pb-2 flex flex-col items-center gap-3">
        <img src="/logo.png" alt="CodeSquare" className="h-9 w-auto object-contain" />
        <button
          onClick={toggleCollapsed}
          title={t('sidebar.expand_sidebar')}
          className="w-full flex items-center justify-center py-2.5 rounded-[10px] font-mono text-cs-text-dim border border-cs-line/15 bg-cs-overlay/[0.05] backdrop-blur-md hover:border-cs-primary/40 hover:text-cs-primary hover:shadow-[0_0_16px_-8px_rgb(var(--cs-primary)/0.6)] transition-all"
        >
          <FiChevronsRight className="text-lg" />
        </button>
        {/* Language switcher — compact icon */}
        <div className="relative w-full">
          <button
            onClick={() => setLangOpen((v) => !v)}
            className="w-full flex items-center justify-center py-2.5 rounded-[10px] font-mono text-cs-text-dim border border-cs-line/15 bg-cs-overlay/[0.05] backdrop-blur-md hover:border-cs-primary/40 hover:text-cs-primary transition-all"
          >
            <FiLanguage className="text-lg" />
          </button>
          {langOpen && (
            <>
              <div className="fixed inset-0 z-[80]" onClick={() => setLangOpen(false)} />
              <div className="absolute left-0 bottom-full mb-2 z-[90] w-36 rounded-xl border border-cs-line/15 bg-cs-darkest/95 backdrop-blur-xl p-1.5 shadow-xl">
                {languages.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => { setLang(l.code); setLangOpen(false); }}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                      lang === l.code
                        ? 'bg-cs-primary/15 text-cs-primary'
                        : 'text-cs-text-dim hover:bg-cs-overlay/[0.06] hover:text-cs-text'
                    }`}
                  >
                    <span>{l.flag}</span>
                    <span>{l.native}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
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
                  <motion.span
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-[10px] bg-cs-primary/[0.10]"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  />
                )}
                <span
                  className={`relative flex items-center justify-center py-3.5 rounded-[10px] font-mono text-xl transition-colors duration-150 ${
                    isActive
                      ? 'text-cs-primary'
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
    <div className="flex flex-col h-full relative overflow-hidden">
      {sidebarBackdrop}

      {/* Brand — green brandmark on the same line as the collapse control */}
      <div className="relative px-5 py-5 flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="/logo.png"
              alt="CodeSquare"
              className="h-12 w-auto object-contain shrink-0"
            />
            <span className="font-mono text-3xl font-bold tracking-tight leading-none text-cs-green [text-shadow:0_0_18px_rgb(var(--cs-green)/0.35)] whitespace-nowrap">
              Code
              <span className="text-cs-mint">Square</span>
              <span className="text-cs-text animate-blink">_</span>
            </span>
          </div>
          <button
            onClick={toggleCollapsed}
            title={t('sidebar.collapse_sidebar')}
            className="hidden lg:inline-flex p-2 rounded-lg font-mono text-cs-text-dim border border-cs-line/15 bg-cs-overlay/[0.04] backdrop-blur-md hover:border-cs-primary/40 hover:text-cs-primary hover:shadow-[0_0_16px_-8px_rgb(var(--cs-primary)/0.6)] transition-all shrink-0"
          >
            <FiChevronsLeft className="text-lg" />
          </button>
        </div>
        <span className="font-mono text-[11px] tracking-wide text-cs-text-muted">
          {t('sidebar.build_boldly')}
        </span>
      </div>

      {/* Nav — terminal command list, grouped by journey stage */}
      <nav className="relative flex-1 px-3 space-y-2 overflow-y-auto pb-3">
        {NAV_GROUPS.map((grp) => {
          const isCollapsed = !!navGroups[grp.id];
          return (
            <div key={grp.id} className="space-y-1">
              <button
                onClick={() => toggleNavGroup(grp.id)}
                className="w-full flex items-center gap-1.5 px-3.5 pt-3 pb-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-cs-text-muted hover:text-cs-text transition-colors"
                aria-expanded={!isCollapsed}
              >
                <FiChevronDown
                  className={`text-xs shrink-0 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`}
                />
                <span>{grp.id}</span>
              </button>
              <AnimatePresence initial={false}>
                {!isCollapsed && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    className="overflow-hidden space-y-1"
                  >
                    {grp.items.map(renderNavLink)}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>

      {/* Profile — terminal-style status card opening the settings popup */}
      <div className="relative border-t border-cs-line/10 px-3 pt-3 pb-3">
        {/* Language switcher */}
        <div className="relative mb-2">
          <button
            onClick={() => setLangOpen((v) => !v)}
            className="w-full flex items-center gap-3 p-2 rounded-lg border border-cs-line/15 bg-cs-overlay/[0.06] backdrop-blur-md hover:border-cs-primary/40 hover:shadow-[0_0_18px_-10px_rgb(var(--cs-primary)/0.7),inset_0_1px_0_rgb(var(--cs-line)/0.06)] hover:bg-cs-overlay/[0.1] transition-all text-left"
          >
            <span className="relative w-8 h-8 rounded-lg bg-cs-darkest border border-cs-primary/30 flex items-center justify-center text-cs-primary shrink-0 text-lg">
              {languages.find((l) => l.code === lang)?.flag}
            </span>
            <span className="flex-grow min-w-0">
              <span className="block text-xs font-mono font-semibold text-cs-text-dim">
                {lang === 'km' ? 'ភាសា' : 'Language'}
              </span>
              <span className="block text-[11px] font-mono text-cs-text-muted truncate">
                {languages.find((l) => l.code === lang)?.native}
              </span>
            </span>
            <FiChevronUp className={`text-cs-text-muted shrink-0 transition-transform duration-200 ${langOpen ? '' : 'rotate-180'}`} />
          </button>
          {langOpen && (
            <>
              <div className="fixed inset-0 z-[80]" onClick={() => setLangOpen(false)} />
              <div className="absolute left-0 bottom-full mb-2 z-[90] w-44 rounded-xl border border-cs-line/15 bg-cs-darkest/95 backdrop-blur-xl p-1.5 shadow-xl">
                {languages.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => { setLang(l.code); setLangOpen(false); }}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-all ${
                      lang === l.code
                        ? 'bg-cs-primary/15 text-cs-primary'
                        : 'text-cs-text-dim hover:bg-cs-overlay/[0.06] hover:text-cs-text'
                    }`}
                  >
                    <span className="text-base">{l.flag}</span>
                    <span className="font-medium">{l.native}</span>
                    {lang === l.code && <FiCheck className="ml-auto text-cs-primary shrink-0" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <button
          onClick={() => openPopup('activity')}
          className="w-full flex items-center gap-3 p-2 rounded-lg border border-cs-line/15 bg-cs-overlay/[0.06] backdrop-blur-md hover:border-cs-primary/40 hover:shadow-[0_0_18px_-10px_rgb(var(--cs-primary)/0.7),inset_0_1px_0_rgb(var(--cs-line)/0.06)] hover:bg-cs-overlay/[0.1] transition-all text-left"
        >
          <span className="relative w-10 h-10 rounded-lg bg-cs-darkest border border-cs-primary/30 flex items-center justify-center font-mono font-bold text-cs-primary overflow-hidden shrink-0">
            {user?.avatar ? (
              <img src={user.avatar} alt={user.username} className="w-full h-full object-cover" />
            ) : (
              <span className="text-base">{(user?.display_name || user?.username)?.charAt(0).toUpperCase()}</span>
            )}
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-cs-green ring-2 ring-cs-darkest" />
          </span>
          <span className="flex-grow min-w-0">
            <span className="block text-sm font-mono font-semibold truncate">
              {user?.username}
              <span className="text-cs-text-muted font-normal">@local</span>
            </span>
            <span className="block text-[11px] font-mono text-cs-text-muted truncate">
              {t('sidebar.status')}: <span className="text-cs-green">{t('sidebar.online')}</span>
            </span>
          </span>
          <FiChevronUp className="text-cs-text-muted shrink-0" />
        </button>
      </div>
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
          <span className={`font-mono text-lg font-bold ${warn ? 'text-cs-orange' : 'text-cs-primary'}`}>
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
        <p className="mt-2 font-mono text-[11px] text-cs-text-muted">
          {(w.used || 0).toLocaleString()} / {(w.limit || 0).toLocaleString()} tokens · frees up in {fmtCountdown(w.resets_in_seconds)}
        </p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-cs-dark">
      {/* Desktop notification bell — pinned top-right, vertically centered in an
          h-14 strip anchored at top-0 so it sits within the top band that pages'
          sticky headers keep clear on the right (the few pages with a top-right
          control — e.g. Practice's mode toggle — add `lg:pr-14` to their header
          row to reserve this ~44px). The strip is click-through
          (pointer-events-none) except for the bell itself. z sits above page
          sticky headers (30) but below the CodeSquareAgent dock (40), so an open
          dock on the library pages covers it instead of it floating over chat. */}
      <div className="hidden lg:flex items-center justify-end fixed top-0 right-0 h-14 pr-6 z-[35] pointer-events-none">
        <div className="pointer-events-auto">
          <NotificationBell />
        </div>
      </div>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 lg:hidden bg-cs-dark bg-opacity-90 backdrop-blur-2xl border-b border-cs-line/10">
        <div className="px-4 py-3 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2">
            <img src="/logo.png" alt="CodeSquare" className="h-7 w-auto object-contain" />
            <span className="font-mono text-lg font-bold text-cs-text">codesphere</span>
          </Link>
          <div className="flex items-center gap-2">
            <NotificationBell />
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
      <main className={`${collapsed ? 'lg:pl-20' : 'lg:pl-80'} transition-[padding] duration-300`}>
        {/* Fade-only (opacity, no transform) so position:sticky stays attached to
            the window scroll. Keyed by the first two path segments so
            within-section navigations swap without a remount. */}
        <div
          key={contentKey}
          className="min-h-[calc(100vh-60px)] lg:min-h-screen animate-route-fade"
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

          <div className="relative flex w-[94vw] max-w-4xl h-[88vh] max-h-[720px] flex-col overflow-hidden rounded-2xl border border-cs-line/10 bg-cs-darkest shadow-2xl sm:w-[82vw] lg:w-[62vw]">
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
                <p className="text-xs text-cs-text-muted truncate">{user?.email}</p>
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
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold uppercase tracking-wide border border-cs-primary/30 bg-cs-primary/10 text-cs-primary">
                        {usage.plan_label}
                      </span>
                    )}
                  </div>
                  {usage ? (
                    <div className="space-y-3">
                      <UsageBar w={usage.session} />
                      <UsageBar w={usage.weekly} />
                      <p className="font-mono text-[11px] text-cs-text-muted">
                        {t('usage.ai_calls_this_week', { count: usage.calls_this_week })}
                      </p>
                      <Link
                        to="/usage"
                        onClick={() => setPopup(false)}
                        className="inline-flex items-center gap-1.5 text-sm text-cs-primary hover:text-cs-cyan font-mono mt-1"
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
                      className="flex items-center justify-center gap-2 w-[100px] p-2.5 rounded-xl border border-cs-red/30 text-cs-red text-sm hover:bg-cs-red/10 transition-colors"
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
                        <span className="text-[11px] text-cs-text-muted">{a.name}</span>
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
