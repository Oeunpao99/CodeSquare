import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { lessonService, progressService } from '../services/api';
import { FiTarget, FiArrowRight, FiPlayCircle, FiSearch, FiX, FiCompass } from 'react-icons/fi';
import toast from 'react-hot-toast';
import LangLogo from '../components/LangLogo';
import MajorIcon from '../components/MajorIcon';
import MajorPicker from '../components/MajorPicker';
import { useMajor } from '../context/MajorContext';
import { DashboardSkeleton } from '../components/Skeletons';

function Dashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { major, majorData, hasMajor } = useMajor();
  const navigate = useNavigate();
  const [languages, setLanguages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAllTracks, setShowAllTracks] = useState(false);
  const [query, setQuery] = useState(''); // course search (searches ALL tracks)
  const [resume, setResume] = useState(null); // next lesson to pick up, or null

  useEffect(() => {
    fetchData();
    progressService.getContinue()
      .then((r) => setResume(r.data || null))
      .catch(() => setResume(null));
  }, []);

  const fetchData = async () => {
    try {
      const langRes = await lessonService.getLanguages();
      setLanguages(langRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t('dashboard.good_morning');
    if (hour < 18) return t('dashboard.good_afternoon');
    return t('dashboard.good_evening');
  };

  if (loading) {
    return <DashboardSkeleton />;
  }

  // First run: no major chosen yet → show the picker instead of the dashboard.
  if (!hasMajor) {
    return (
      <div>
        <main className="max-w-5xl mx-auto px-8 py-12 animate-slide-up">
          <MajorPicker onboarding onPicked={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />
        </main>
      </div>
    );
  }

  // Tracks the chosen major covers, in the major's own order.
  const order = majorData?.tracks || [];
  const inPath = (slug) => order.includes(slug);
  const byOrder = (a, b) => {
    const ia = order.indexOf(a.slug);
    const ib = order.indexOf(b.slug);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  };
  const pathLanguages = languages.filter((l) => inPath(l.slug)).sort(byOrder);
  const otherLanguages = languages.filter((l) => !inPath(l.slug));
  const allLanguages = [...pathLanguages, ...otherLanguages];

  // Search looks through every course, not just the major's, by name/slug/description.
  const q = query.trim().toLowerCase();
  const pool = showAllTracks || !majorData ? allLanguages : pathLanguages;
  const shownLanguages = q
    ? allLanguages.filter((l) => [l.name, l.slug, l.description].some((v) => (v || '').toLowerCase().includes(q)))
    : pool;

  // Decorative logo tiles either side of the hero search (like a hub page).
  const tiles = allLanguages.slice(0, 12);
  const TileGrid = ({ items, flip }) => (
    <div className={`hidden xl:grid grid-cols-3 gap-4 shrink-0 ${flip ? '[direction:rtl]' : ''}`} aria-hidden>
      {items.map((l, i) => (
        <span
          key={`${l.slug}-${i}`}
          className={`w-16 h-16 rounded-xl border border-cs-line/10 bg-cs-overlay/[0.03] grid place-items-center text-2xl transition-opacity ${
            (i + (flip ? 1 : 0)) % 3 === 2 ? 'opacity-30' : (i % 2 ? 'opacity-60' : 'opacity-90')
          }`}
        >
          <LangLogo name={l.slug || l.name} />
        </span>
      ))}
    </div>
  );

  const tabs = majorData
    ? [['path', 'Your path', pathLanguages.length], ['all', 'All courses', allLanguages.length]]
    : [['all', 'All courses', allLanguages.length]];
  const activeTab = showAllTracks || !majorData ? 'all' : 'path';

  return (
    <div>
      <main className="w-full px-6 lg:px-10 py-8">
        {/* Hero: search with course tiles either side */}
        <section className="flex items-center justify-center gap-10 py-6">
          <TileGrid items={tiles.slice(0, 6)} />
          <div className="w-full max-w-2xl text-center">
            <p className="text-sm text-cs-text-dim">{getGreeting()}, {user?.display_name || user?.username}</p>
            <h1 className="text-3xl md:text-4xl font-bold mt-1">What do you want to learn?</h1>
            <label className="mt-6 h-12 flex items-center gap-3 px-4 rounded-xl border border-cs-line/15 bg-cs-overlay/[0.03] focus-within:border-cs-primary/60 transition-colors text-left">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search courses: Python, SQL, Power BI…"
                aria-label="Search courses"
                className="flex-1 min-w-0 bg-transparent outline-none text-base placeholder:text-cs-text-muted"
              />
              {query
                ? <button type="button" onClick={() => setQuery('')} className="text-cs-text-muted hover:text-cs-text" aria-label="Clear search"><FiX /></button>
                : <FiSearch className="text-cs-text-muted text-lg" />}
            </label>
          </div>
          <TileGrid items={tiles.slice(6, 12).length ? tiles.slice(6, 12) : tiles.slice(0, 6)} flip />
        </section>

        {/* Continue where you left off: slim bar */}
        {resume && (
          <Link
            to={`/learn/${resume.track_slug}/module/${resume.module_id}/lesson/${resume.lesson_id}`}
            className="mt-4 rounded-xl border border-cs-line/10 bg-cs-overlay/[0.03] hover:border-cs-primary/40 px-5 py-4 flex flex-wrap items-center gap-4 group transition-colors"
          >
            <FiPlayCircle className="text-cs-primary text-xl shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[0.9375rem] truncate">
                <span className="font-semibold">Continue</span>
                <span className="text-cs-text-dim"> · {resume.lesson_title} · {resume.track_name}</span>
              </p>
            </div>
            <span className="flex items-center gap-3 text-sm text-cs-text-dim">
              <span className="w-28 h-1.5 rounded-full bg-cs-overlay/[0.12] overflow-hidden">
                <span className="block h-full rounded-full bg-cs-primary" style={{ width: `${Math.round((resume.completed_in_track / Math.max(1, resume.total_in_track)) * 100)}%` }} />
              </span>
              {resume.completed_in_track}/{resume.total_in_track}
            </span>
            <span className="inline-flex items-center gap-1.5 text-cs-primary font-semibold text-sm">
              {t('dashboard.resume')} <FiArrowRight className="group-hover:translate-x-0.5 transition-transform" />
            </span>
          </Link>
        )}

        {/* Tabs + major */}
        <div className="mt-8 flex flex-wrap items-center gap-x-7 border-b border-cs-line/10">
          {q ? (
            <span className="relative h-12 inline-flex items-center text-[0.9375rem] text-cs-primary">
              {shownLanguages.length} result{shownLanguages.length === 1 ? '' : 's'} for “{query.trim()}”
              <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-cs-primary" />
            </span>
          ) : tabs.map(([k, label, n]) => (
            <button key={k} onClick={() => setShowAllTracks(k === 'all')}
              className={`relative h-12 px-0.5 text-[0.9375rem] transition-colors ${activeTab === k ? 'text-cs-primary' : 'text-cs-text-dim hover:text-cs-text'}`}>
              {label}<span className="ml-1.5 text-xs text-cs-text-muted">{n}</span>
              {activeTab === k && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-cs-primary" />}
            </button>
          ))}
          {majorData && (
            <div className="ml-auto flex items-center gap-2.5 py-2 text-sm">
              <span style={{ color: majorData.color }}><MajorIcon major={major} /></span>
              <span className="font-medium">{majorData.label}</span>
              <Link to="/roadmap" className="text-cs-text-dim hover:text-cs-primary">Roadmap</Link>
              <span className="text-cs-text-muted">·</span>
              <Link to="/profile" className="text-cs-text-dim hover:text-cs-primary">{t('dashboard.change')}</Link>
            </div>
          )}
        </div>

        {!q && majorData && activeTab === 'path' && pathLanguages.length === 0 && (
          <p className="text-sm text-cs-text-muted mt-6">{t('dashboard.tracks_not_seeded')}</p>
        )}
        {q && shownLanguages.length === 0 && (
          <p className="text-sm text-cs-text-dim mt-8 text-center">No course matches that. Try a shorter word, or search the Library for articles.</p>
        )}

        {/* Course cards */}
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 mt-6">
          {shownLanguages.map((lang) => {
            const mine = inPath(lang.slug);
            return (
              <Link
                key={lang.id}
                to={`/learn/${lang.slug}`}
                className="group rounded-lg border border-cs-line/10 p-5 flex flex-col text-cs-text hover:bg-cs-overlay/[0.03] hover:border-cs-line/25 transition-colors"
              >
                <LangLogo name={lang.slug || lang.name} className="text-3xl" />
                <h3 className="text-lg font-semibold mt-4">{lang.name}</h3>
                <p className="text-sm text-cs-text-dim mt-1.5 line-clamp-2">{lang.description}</p>
                <div className="mt-auto pt-5">
                  <div className="pt-4 border-t border-cs-line/10 flex items-center justify-between gap-3 text-sm">
                    <span className={`inline-flex items-center gap-2 ${mine ? 'text-cs-primary' : 'text-cs-text-dim'}`}>
                      {mine ? <FiTarget /> : <FiCompass />} {mine ? t('dashboard.for_your_major') : 'Explore'}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-cs-text-dim group-hover:text-cs-primary transition-colors">
                      {t('dashboard.start_learning')} <FiArrowRight className="group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}

export default Dashboard;
