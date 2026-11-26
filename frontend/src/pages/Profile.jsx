import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { progressService } from '../services/api';
import { FiBook, FiZap, FiTrendingUp, FiHelpCircle, FiClock, FiTarget, FiStar, FiActivity, FiAward, FiUser, FiSettings, FiExternalLink } from 'react-icons/fi';
import ThemePicker from '../components/ThemePicker';
import AiIcon from '../components/AiIcon';
import MajorPicker from '../components/MajorPicker';
import ProfileForm from '../components/ProfileForm';
import { contactLabel } from '../utils/contact';
import { buildYearGrid, MONTHS, LEVEL_STYLES } from '../utils/heatmap';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];


// Colored score badge for a lesson, using the app's dev-vibe badge-outline styles.
function gradeFor(score) {
  if (score >= 90) return { label: 'S', cls: 'badge-outline-cyan' };
  if (score >= 80) return { label: 'A', cls: 'badge-outline-green' };
  if (score >= 70) return { label: 'B', cls: 'badge-outline-orange' };
  if (score >= 60) return { label: 'C', cls: 'badge-outline-orange' };
  return { label: 'D', cls: 'badge-outline-red' };
}


function Profile() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview'); // overview | settings
  const [heatYear, setHeatYear] = useState(0); // year offset: -1 last year, 0 this year
  const [activity, setActivity] = useState(null); // { days: {iso: count}, total }

  useEffect(() => {
    setActivity(null);
    progressService.activity(new Date().getFullYear() + heatYear)
      .then((r) => setActivity(r.data)).catch(() => setActivity({ days: {}, total: 0 }));
  }, [heatYear]);
  const [lessonQuery, setLessonQuery] = useState('');
  const [lessonPage, setLessonPage] = useState(0);
  const LESSONS_PER_PAGE = 12;

  useEffect(() => {
    fetchProgress();
  }, []);

  const fetchProgress = async () => {
    try {
      const response = await progressService.getDetailed();
      setProgress(response.data);
    } catch (error) {
      console.error('Error fetching progress:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-cs-darkest border-t-cs-primary rounded-full animate-spin"></div>
        <p className="text-cs-text-dim">{t('loading_progress')}</p>
      </div>
    );
  }

  return (
    <main className="w-full px-6 lg:px-10 py-6">
      {/* Sticky header — profile identity + tab switcher stay locked while scrolling */}
      <div className="sticky top-[3.75rem] lg:top-14 z-30 -mx-6 lg:-mx-10 px-6 lg:px-10 pt-4 pb-0 -mt-6 mb-6 bg-cs-dark/85 backdrop-blur-xl border-b border-cs-line/[0.07]">
        <div className="flex items-center gap-5 flex-wrap">
          <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-main flex items-center justify-center text-2xl md:text-3xl font-bold overflow-hidden shrink-0 border-2 border-cs-primary/40">
            {user?.avatar ? (
              <img src={user.avatar} alt={user.username} className="w-full h-full object-cover" />
            ) : (
              <span>{(user?.display_name || user?.username)?.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl md:text-3xl font-bold truncate flex items-center gap-3">
              {user?.display_name || user?.username}
            </h1>
            <p className="text-xs md:text-sm text-cs-text-dim truncate">
              {user?.headline || contactLabel(user)}
            </p>
          </div>
          {user?.username && (
            <Link
              to={`/u/${user.username}`}
              className="btn btn-ghost btn-sm shrink-0 self-start"
            >
              <FiExternalLink /> public profile
            </Link>
          )}
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 mt-4 pb-2 -mb-px">
          {[
            { id: 'overview', label: t('profile.overview'), icon: <FiUser /> },
            { id: 'settings', label: t('profile.settings'), icon: <FiSettings /> },
          ].map((tabItem) => (
            <button
              key={tabItem.id}
              onClick={() => setTab(tabItem.id)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-t-lg border-b-2 text-sm transition-colors ${
                tab === tabItem.id
                  ? 'border-cs-primary text-cs-primary'
                  : 'border-transparent text-cs-text-dim hover:text-cs-text'
              }`}
            >
              {tabItem.icon} {tabItem.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'settings' ? (
        <div className="space-y-10">
          <div>
            <span className="mono-label mb-4 block"> {t('profile.profile_details')}</span>
            <div className="card p-6">
              <ProfileForm />
            </div>
          </div>

          <div>
            <span className="mono-label mb-4 block"> {t('profile.choose_path')}</span>
            <div className="card p-6">
              <MajorPicker />
            </div>
          </div>

          <div>
            <span className="mono-label mb-4 block"> {t('profile.editor_theme')}</span>
            <div className="card p-6">
              <ThemePicker />
            </div>
          </div>
        </div>
      ) : (
      progress ? (
        <>
          {/* Stat cards — moved here from the dashboard, given a streak-board feel */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
            {[
              { icon: <FiBook />, value: progress.summary.total_lessons_completed, label: t('profile.lessons_completed'), cls: 'text-cs-primary', chip: 'bg-cs-primary/15' },
              { icon: <FiZap />, value: progress.summary.total_xp, label: t('profile.total_xp'), cls: 'text-cs-cyan', chip: 'bg-cs-cyan/15' },
              { icon: <FiAward />, value: progress.summary.current_streak, label: t('profile.day_streak'), cls: 'text-cs-green', chip: 'bg-cs-green/15', highlight: progress.summary.current_streak > 0 },
                { icon: <FiHelpCircle />, value: progress.summary.hints_used_total, label: t('profile.hints_used'), cls: 'text-cs-orange', chip: 'bg-cs-orange/15' },
              ].map((stat, index) => (
                <div
                  key={index}
                  className={`card text-center relative overflow-hidden ${
                    stat.highlight ? 'border-cs-green/40 glow-border' : ''
                  }`}
                >
                  {stat.highlight && (
                    <span className="absolute top-3 right-3 inline-flex items-center gap-1 text-[0.625rem] uppercase tracking-wider text-cs-orange">
                      <FiAward className="animate-pulse" /> {t('profile.on_fire')}
                    </span>
                  )}
                  <div className="flex items-center justify-center gap-3 mb-3">
                    <span className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl ${stat.chip} ${stat.cls}`}>
                      {stat.icon}
                    </span>
                  </div>
                  <div className="text-3xl font-bold">{stat.value}</div>
                  <div className="text-sm text-cs-text-dim mt-1">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* GitHub-style contribution graph */}
            {(() => {
              const selectedYear = new Date().getFullYear() + heatYear;
              const { grid, monthLabel, activeDays } = buildYearGrid(activity?.days, selectedYear);
              return (
                <div className="card mb-8 overflow-hidden">
                  <div className="flex items-start justify-between flex-wrap gap-3 mb-3">
                    <div>
                      <h3 className="text-lg font-bold flex items-center gap-2"><FiActivity /> {t('profile.coding_heatmap')}</h3>
                      <p className="text-xs text-cs-text-muted">
                        {activity === null ? 'Loading…'
                          : activity.total === 0 ? `No activity in ${selectedYear} yet. Finish a lesson, challenge or quiz to light up a day.`
                          : `${activity.total} ${activity.total === 1 ? 'activity' : 'activities'} on ${activeDays} ${activeDays === 1 ? 'day' : 'days'} in ${selectedYear}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 text-[0.6875rem] text-cs-text-muted">
                      {t('profile.less')}
                      {[0, 1, 2, 3, 4].map((lvl) => (
                        <span key={lvl} className={`w-3 h-3 rounded-[0.1875rem] border border-cs-line/10 ${LEVEL_STYLES[lvl]}`} />
                      ))}
                      {t('profile.more')}
                    </div>
                  </div>

                  {/* year filter */}
                  <div className="flex items-center gap-1 mb-3">
                    {[
                      { k: -1, label: t('profile.last_year') },
                      { k: 0, label: t('profile.this_year') },
                    ].map((o) => (
                      <button
                        key={o.k}
                        onClick={() => setHeatYear(o.k)}
                        className={`px-2.5 py-1 rounded-md text-[0.6875rem] border transition-colors ${
                          heatYear === o.k
                            ? 'border-cs-primary text-cs-primary bg-cs-primary/10'
                            : 'border-cs-line/15 text-cs-text-muted hover:text-cs-text'
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                    <span className="ml-2 text-[0.6875rem] text-cs-text-dim">{selectedYear}</span>
                  </div>

                  <div className="overflow-x-auto mt-1">
                    <div className="min-w-[48.75rem]">
                      {/* month labels — aligned to the 10px cell + 3px gap grid */}
                      <div className="flex gap-[0.1875rem] mb-1.5" style={{ marginLeft: '2.25rem' }}>
                        {monthLabel.map((m, i) => (
                          <div key={i} className="w-2.5 text-[0.625rem] text-cs-text-muted whitespace-nowrap">
                            {m != null ? MONTHS[m] : ''}
                          </div>
                        ))}
                      </div>
                      <div className="flex">
                        {/* weekday labels */}
                        <div className="flex flex-col gap-[0.1875rem] mr-2 text-[0.5625rem] text-cs-text-muted pr-1 w-7">
                          {['Mon', '', 'Wed', '', 'Fri', '', 'Sun'].map((d, i) => (
                            <div key={i} className="h-2.5 flex items-center leading-none">{d}</div>
                          ))}
                        </div>
                        {/* grid */}
                        <div className="flex gap-[0.1875rem]">
                          {grid.map((col, w) => (
                            <div key={w} className="flex flex-col gap-[0.1875rem]">
                              {col.map((cell, d) => (
                                <div
                                  key={d}
                                  className={`w-2.5 h-2.5 rounded-[0.1875rem] transition-transform duration-150 ${
                                    cell.pad ? 'invisible' : LEVEL_STYLES[cell.level]
                                  } ${cell.future ? 'opacity-40' : ''} ${
                                    cell.today ? 'ring-1 ring-cs-primary scale-125' : ''
                                  }`}
                                />
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* AI Recommendation + focus areas (moved here from the dashboard) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {progress.summary.recommended_action && (
                <div className="card lg:col-span-2 relative overflow-hidden">
                  <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-gradient-main opacity-10 blur-2xl" />
                  <div className="flex items-center gap-4">
                    <span className="w-12 h-12 bg-gradient-main rounded-2xl flex items-center justify-center text-2xl text-cs-dark shrink-0">
                      <FiTarget />
                    </span>
                    <div>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-main text-cs-dark rounded-full text-xs font-semibold">
                        <AiIcon className="text-sm" /> AI Recommendation
                      </span>
                      <p className="text-cs-text text-lg mt-3">{progress.summary.recommended_action}</p>
                    </div>
                  </div>
                </div>
              )}

              {progress.summary.weak_concepts?.length > 0 && (
                <div className="card">
                  <h3 className="flex items-center gap-2 mb-4 text-cs-orange font-bold text-base">
                    <FiStar /> Areas to Focus On
                  </h3>
                  <div className="flex flex-wrap gap-2.5">
                    {progress.summary.weak_concepts.map((concept, index) => (
                      <span
                        key={index}
                        className="px-3.5 py-1.5 bg-cs-orange bg-opacity-10 border border-cs-orange border-opacity-30 rounded-full text-sm text-cs-orange"
                      >
                        {concept}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
                  <h2 className="text-2xl font-bold">{t('profile.lesson_history')}</h2>
                  {progress.lessons.length > 0 && (
                    <input
                      value={lessonQuery}
                      onChange={(e) => { setLessonQuery(e.target.value); setLessonPage(0); }}
                      placeholder="filter lessons…"
                      className="rounded-lg bg-cs-darkest/70 border border-cs-line/15 px-3 py-1.5 text-xs outline-none focus:border-cs-primary/50 w-40 sm:w-48"
                    />
                  )}
                </div>
                {(() => {
                  const q = lessonQuery.trim().toLowerCase();
                  const filtered = q
                    ? progress.lessons.filter((l) =>
                        (l.lesson_title || '').toLowerCase().includes(q) ||
                        (l.module_title || '').toLowerCase().includes(q))
                    : progress.lessons;
                  const pages = Math.max(1, Math.ceil(filtered.length / LESSONS_PER_PAGE));
                  const page = Math.min(lessonPage, pages - 1);
                  const shown = filtered.slice(page * LESSONS_PER_PAGE, (page + 1) * LESSONS_PER_PAGE);
                  return (
                    <>
                      <div className="rounded-xl border border-cs-line/10 bg-cs-darker/60 overflow-hidden">
                        {shown.map((lesson, i) => {
                          const grade = gradeFor(lesson.score);
                          return (
                            <div key={lesson.lesson_id} className={`flex items-center gap-3 px-4 py-2.5 ${i > 0 ? 'border-t border-cs-line/10' : ''}`}>
                              <div className={`w-6 h-6 flex items-center justify-center rounded-full shrink-0 text-xs ${lesson.completed ? 'bg-cs-green text-white' : 'bg-cs-overlay/10 text-cs-text-muted'}`}>
                                {lesson.completed ? '✓' : '·'}
                              </div>
                              <div className="flex-grow min-w-0">
                                <p className="text-sm font-semibold truncate">{lesson.lesson_title}</p>
                                <p className="text-[0.6875rem] text-cs-text-muted truncate">{lesson.module_title}</p>
                              </div>
                              <span className={`badge-outline ${grade.cls} shrink-0`}>{grade.label}</span>
                              <div className="text-right shrink-0">
                                <p className="text-sm font-semibold">{Math.round(lesson.score)}%</p>
                                <p className="text-[0.6875rem] text-cs-text-muted">{Math.round(lesson.time_spent / 60)}m • {lesson.hints_used} hints</p>
                              </div>
                            </div>
                          );
                        })}
                        {progress.lessons.length === 0 && (
                          <div className="text-center py-12 text-cs-text-muted">
                            <p className="text-5xl mb-4">📚</p>
                            <p>{t('profile.no_lessons')}</p>
                            <Link to="/dashboard" className="btn btn-primary btn-sm mt-4">{t('profile.start_learning')}</Link>
                          </div>
                        )}
                        {progress.lessons.length > 0 && filtered.length === 0 && (
                          <div className="text-center py-10 text-cs-text-muted text-sm">
                            No lessons match “{lessonQuery}”.
                          </div>
                        )}
                      </div>
                      {pages > 1 && (
                        <div className="flex items-center justify-between mt-3 text-xs text-cs-text-muted">
                          <button
                            onClick={() => setLessonPage(Math.max(0, page - 1))}
                            disabled={page === 0}
                            className="tap px-3 py-1.5 rounded-lg border border-cs-line/15 hover:text-cs-text disabled:opacity-40"
                          >
                            prev
                          </button>
                          <span>page {page + 1} / {pages} · {filtered.length} lessons</span>
                          <button
                            onClick={() => setLessonPage(Math.min(pages - 1, page + 1))}
                            disabled={page >= pages - 1}
                            className="tap px-3 py-1.5 rounded-lg border border-cs-line/15 hover:text-cs-text disabled:opacity-40"
                          >
                            next
                          </button>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              <div>
                <h2 className="text-2xl font-bold mb-6">{t('profile.weekly_activity')}</h2>
                <div className="card">
                  {progress.weekly_activity.map((day, index) => {
                    const max = Math.max(...progress.weekly_activity.map(d => d.lessons_completed), 1);
                    return (
                      <div key={index} className="flex items-center gap-3 py-2">
                        <span className="w-10 text-sm text-cs-text-dim">{day.day}</span>
                        <div className="flex-grow h-5 bg-cs-overlay bg-opacity-10 rounded overflow-hidden">
                          <div
                            className="h-full bg-gradient-main rounded transition-all duration-500"
                            style={{ width: `${(day.lessons_completed / max) * 100}%` }}
                          ></div>
                        </div>
                        <span className="w-6 text-right text-sm">{day.lessons_completed}</span>
                      </div>
                    );
                  })}
                </div>

                {progress.recent_projects?.length > 0 && (
                  <>
                    <h2 className="text-2xl font-bold mt-8 mb-4">{t('profile.recent_projects')}</h2>
                    <div className="space-y-3">
                      {progress.recent_projects.map((project) => (
                        <div key={project.id} className="card py-4">
                          <p className="font-semibold">{project.title}</p>
                          <p className="text-xs text-cs-text-muted">{project.language}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
        </>
      ) : (
        <div className="card text-center py-16">
          <p className="text-cs-text-dim">{t('profile.nothing_here')}</p>
          <Link to="/dashboard" className="btn btn-primary btn-sm mt-4">{t('profile.start_learning_link')}</Link>
        </div>
      ))}
    </main>
  );
}

export default Profile;
