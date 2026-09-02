import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { lessonService, progressService } from '../services/api';
import { FiCode, FiZap, FiTarget, FiArrowRight, FiPlayCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';
import LangLogo from '../components/LangLogo';
import MajorIcon from '../components/MajorIcon';
import MajorPicker from '../components/MajorPicker';
import { useMajor } from '../context/MajorContext';

function Dashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { major, majorData, hasMajor } = useMajor();
  const navigate = useNavigate();
  const [languages, setLanguages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAllTracks, setShowAllTracks] = useState(false);
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
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-cs-darkest border-t-cs-primary rounded-full animate-spin"></div>
        <p className="text-gray-400">{t('loading_dashboard')}</p>
      </div>
    );
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
  const visibleLanguages = showAllTracks ? [...pathLanguages, ...otherLanguages] : pathLanguages;

  return (
    <div>
      <main className="w-full px-6 lg:px-10 py-8">
        {/* Sticky header — locked while the dashboard scrolls beneath it */}
        <div className="sticky top-0 z-30 -mx-6 lg:-mx-10 px-6 lg:px-10 py-4 -mt-8 mb-6 bg-cs-dark/85 backdrop-blur-xl border-b border-cs-line/[0.07]">
          <div className="animate-slide-up">
            <h1 className="text-3xl font-bold mb-2">{getGreeting()}, {user?.username}!</h1>
            <p className="text-cs-text-dim">{t('dashboard.ready_continue')}</p>
          </div>

          {majorData && (
            <div className="card mt-4 mb-0 flex flex-col sm:flex-row sm:items-center gap-5">
              <span
                className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl shrink-0"
                style={{ background: `${majorData.color}1f`, color: majorData.color }}
              >
                <MajorIcon major={major} />
              </span>
              <div className="flex-grow">
                <p className="mono-label text-cs-text-muted mb-1"> {t('dashboard.your_major')}</p>
                <h2 className="text-xl font-bold">{majorData.label}</h2>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {majorData.focus.map((f) => (
                    <span key={f} className="text-[11px] font-mono px-2 py-0.5 rounded border border-cs-line/10 text-cs-text-muted">
                      {f}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0 self-start sm:self-center">
                <Link to="/roadmap" className="btn btn-primary btn-sm">
                  {t('dashboard.view_roadmap')}
                </Link>
                <Link to="/profile" className="btn btn-ghost btn-sm">
                  {t('dashboard.change')}
                </Link>
              </div>
            </div>
          )}
        </div>

        {resume && (
          <Link
            to={`/learn/${resume.track_slug}/module/${resume.module_id}/lesson/${resume.lesson_id}`}
            className="card mb-10 flex flex-col sm:flex-row sm:items-center gap-5 border-cs-primary/40 hover:border-cs-primary/70 group"
          >
            <span className="w-14 h-14 rounded-xl bg-cs-primary/15 text-cs-primary flex items-center justify-center text-3xl shrink-0">
              <FiPlayCircle />
            </span>
            <div className="flex-grow min-w-0">
              <p className="mono-label text-cs-primary mb-1"> {t('dashboard.pick_up_where')}</p>
              <h2 className="text-xl font-bold truncate">{resume.lesson_title}</h2>
              <p className="text-sm text-cs-text-dim font-mono truncate">
                {resume.track_name} <span className="text-cs-text-muted">›</span> {resume.module_title}
              </p>
              <div className="flex items-center gap-3 mt-2">
                <div className="h-1.5 w-40 max-w-full rounded-full bg-cs-overlay/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-cs-primary transition-all"
                    style={{ width: `${Math.round((resume.completed_in_track / Math.max(1, resume.total_in_track)) * 100)}%` }}
                  />
                </div>
                <span className="font-mono text-[11px] text-cs-text-muted shrink-0">
                  {resume.completed_in_track}/{resume.total_in_track} {t('dashboard.in_track')}
                </span>
              </div>
            </div>
            <span className="inline-flex items-center gap-2 text-cs-primary font-semibold group-hover:text-cs-cyan transition-colors shrink-0 self-start sm:self-center">
              {t('dashboard.resume')} <FiArrowRight />
            </span>
          </Link>
        )}

        <div className="mb-12">
          <div className="flex items-end justify-between gap-4 mb-2 flex-wrap">
            <h2 className="text-2xl font-bold">
              {majorData ? t('dashboard.your_tracks', { major: majorData.label }) : t('dashboard.choose_language')}
            </h2>
            {majorData && otherLanguages.length > 0 && (
              <button
                onClick={() => setShowAllTracks((v) => !v)}
                className="btn btn-ghost btn-sm font-mono"
              >
                {showAllTracks ? t('dashboard.show_only_my') : t('dashboard.explore_all', { count: otherLanguages.length })}
              </button>
            )}
          </div>
          <p className="text-cs-text-dim mb-8">
            {majorData
              ? `The tracks that build toward ${majorData.label}. Others are hidden unless you explore.`
              : t('dashboard.choose_language')}
          </p>

          {majorData && visibleLanguages.length === 0 && (
            <p className="text-sm text-cs-text-muted mb-6">
              {t('dashboard.tracks_not_seeded')}
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {(majorData ? visibleLanguages : languages).map((lang) => (
              <Link
                key={lang.id}
                to={`/learn/${lang.slug}`}
                className={`card text-center py-12 group cursor-pointer relative ${
                  inPath(lang.slug) ? 'border-cs-primary/50' : ''
                }`}
              >
                {inPath(lang.slug) && (
                  <span className="absolute top-3 right-3 text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-cs-primary/15 text-cs-primary">
                    {t('dashboard.for_your_major')}
                  </span>
                )}
                <LangLogo name={lang.slug || lang.name} className="mx-auto mb-4 text-6xl" />
                <h3 className="text-2xl font-bold mb-2">{lang.name}</h3>
                <p className="text-sm text-cs-text-dim mb-6">{lang.description}</p>
                <span className="inline-flex items-center gap-2 text-cs-primary font-semibold group-hover:text-cs-cyan transition-colors">
                  {t('dashboard.start_learning')} <FiArrowRight />
                </span>
              </Link>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-6">{t('dashboard.quick_actions')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Link to="/projects" className="card text-center py-8 group cursor-pointer">
              <FiCode className="text-4xl text-cs-primary mx-auto mb-4" />
              <h4 className="text-lg font-bold mb-2">{t('dashboard.build_project')}</h4>
              <p className="text-sm text-gray-400">{t('dashboard.build_project_desc')}</p>
            </Link>
            <Link to="/practice" className="card text-center py-8 group cursor-pointer">
              <FiTarget className="text-4xl text-cs-primary mx-auto mb-4" />
              <h4 className="text-lg font-bold mb-2">{t('dashboard.practice_mode')}</h4>
              <p className="text-sm text-cs-text-dim">{t('dashboard.practice_mode_desc')}</p>
            </Link>
            <Link to="/tutor" className="card text-center py-8 group cursor-pointer">
              <FiZap className="text-4xl text-cs-primary mx-auto mb-4" />
              <h4 className="text-lg font-bold mb-2">{t('dashboard.ask_tutor')}</h4>
              <p className="text-sm text-cs-text-dim">{t('dashboard.ask_tutor_desc')}</p>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Dashboard;