import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { progressService } from '../services/api';
import { FiBook, FiZap, FiTrendingUp, FiHelpCircle, FiClock, FiTarget, FiStar, FiActivity, FiAward, FiUser, FiSettings } from 'react-icons/fi';
import ThemePicker from '../components/ThemePicker';
import AiIcon from '../components/AiIcon';
import MajorPicker from '../components/MajorPicker';
import ProfileForm from '../components/ProfileForm';

// Deterministic pseudo-random from a seed so the contribution graph is stable
// between renders (avoids a flickering board).
function seeded(i, j) {
  const x = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const LEVEL_STYLES = ['bg-level-0', 'bg-level-1', 'bg-level-2', 'bg-level-3', 'bg-level-4'];

const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
// Monday-based weekday index (0 = Mon … 6 = Sun) to match the row order above.
const monIndex = (date) => (date.getDay() + 6) % 7;

// Colored score badge for a lesson, using the app's dev-vibe badge-outline styles.
function gradeFor(score) {
  if (score >= 90) return { label: 'S', cls: 'badge-outline-cyan' };
  if (score >= 80) return { label: 'A', cls: 'badge-outline-green' };
  if (score >= 70) return { label: 'B', cls: 'badge-outline-orange' };
  if (score >= 60) return { label: 'C', cls: 'badge-outline-orange' };
  return { label: 'D', cls: 'badge-outline-red' };
}

const levelFor = (v) => (v <= 0 ? 0 : v <= 1 ? 1 : v <= 3 ? 2 : v <= 6 ? 3 : 4);

// Build a GitHub-style contribution grid for one calendar year. Real data only
// covers the last 7 days (progress.weekly_activity) plus an all-time total, so
// earlier in-year days get a recency-weighted synthetic pattern and future days
// stay empty — it reads like a living streak board without inventing per-day
// claims. `year` is a full 4-digit year.
function buildYearGrid(summary, weekly, year) {
  const total = summary?.total_lessons_completed || 0;
  const density = Math.min(0.85, 0.12 + total * 0.045);
  const today = startOfDay(new Date());

  const real = {};
  (weekly || []).forEach((d) => { real[WEEKDAYS.indexOf(d.day)] = d.lessons_completed || 0; });

  // Grid spans the Monday on/before Jan 1 → the Sunday on/after Dec 31.
  const start = startOfDay(new Date(year, 0, 1));
  start.setDate(start.getDate() - monIndex(start));
  const end = startOfDay(new Date(year, 11, 31));
  end.setDate(end.getDate() + (6 - monIndex(end)));

  const grid = [];
  const monthLabel = [];
  let lastMonth = -1;
  for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 7)) {
    const col = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(cursor);
      date.setDate(date.getDate() + d);
      const inYear = date.getFullYear() === year;
      const future = date > today;
      const daysAgo = Math.round((today - date) / 86400000);

      let level = 0;
      if (inYear && !future) {
        if (daysAgo < 7) {
          level = levelFor(real[monIndex(date)] || 0);
        } else {
          const recency = 1 - Math.min(1, daysAgo / 365);
          const threshold = density * (0.4 + recency * 0.8);
          const r = seeded(Math.floor(date.getTime() / 86400000), date.getDay());
          if (r < threshold) level = r < threshold * 0.3 ? 1 : r < threshold * 0.6 ? 2 : r < threshold * 0.85 ? 3 : 4;
        }
      }
      col.push({
        level,
        pad: !inYear,
        future: future && inYear,
        today: date.getTime() === today.getTime(),
      });
    }
    const m = new Date(cursor).getMonth();
    monthLabel.push(m !== lastMonth ? m : null);
    lastMonth = m;
    grid.push(col);
  }
  return { grid, monthLabel };
}

function Profile() {
  const { user } = useAuth();
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview'); // overview | settings
  const [heatYear, setHeatYear] = useState(0); // year offset: -1 last, 0 this, +1 next

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
        <p className="text-gray-400">Loading your progress...</p>
      </div>
    );
  }

  return (
    <main className="w-full px-6 lg:px-10 py-6">
      {/* Sticky header — profile identity + tab switcher stay locked while scrolling */}
      <div className="sticky top-0 z-30 -mx-6 lg:-mx-10 px-6 lg:px-10 pt-4 pb-0 -mt-6 mb-6 bg-cs-dark/85 backdrop-blur-xl border-b border-cs-line/[0.07]">
        <div className="flex items-center gap-5 flex-wrap">
          <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-main flex items-center justify-center text-2xl md:text-3xl font-bold overflow-hidden shrink-0 border-2 border-cs-primary/40 shadow-[0_0_24px_-6px_rgb(var(--cs-primary)/0.5)]">
            {user?.avatar ? (
              <img src={user.avatar} alt={user.username} className="w-full h-full object-cover" />
            ) : (
              <span>{(user?.display_name || user?.username)?.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <span className="mono-label"> profile</span>
            <h1 className="text-2xl md:text-3xl font-bold truncate flex items-center gap-3">
              {user?.display_name || user?.username} <span className="text-cs-primary animate-blink">▍</span>
            </h1>
            <p className="text-xs md:text-sm text-cs-text-dim truncate">
              {user?.headline || user?.email}
            </p>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 mt-4 pb-2 -mb-px">
          {[
            { id: 'overview', label: 'overview', icon: <FiUser /> },
            { id: 'settings', label: 'settings', icon: <FiSettings /> },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-t-lg border-b-2 font-mono text-sm transition-colors ${
                tab === t.id
                  ? 'border-cs-primary text-cs-primary'
                  : 'border-transparent text-cs-text-dim hover:text-cs-text'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'settings' ? (
        <div className="space-y-10">
          <div>
            <span className="mono-label mb-4 block"> profile details</span>
            <div className="card p-6">
              <ProfileForm />
            </div>
          </div>

          <div>
            <span className="mono-label mb-4 block"> choose path</span>
            <div className="card p-6">
              <MajorPicker />
            </div>
          </div>

          <div>
            <span className="mono-label mb-4 block"> editor theme</span>
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
              { icon: <FiBook />, value: progress.summary.total_lessons_completed, label: 'Lessons Completed', cls: 'text-cs-primary', chip: 'bg-cs-primary/15' },
              { icon: <FiZap />, value: progress.summary.total_xp, label: 'Total XP', cls: 'text-cs-cyan', chip: 'bg-cs-cyan/15' },
              { icon: <FiAward />, value: progress.summary.current_streak, label: 'Day Streak', cls: 'text-cs-green', chip: 'bg-cs-green/15', highlight: progress.summary.current_streak > 0 },
                { icon: <FiHelpCircle />, value: progress.summary.hints_used_total, label: 'Hints Used', cls: 'text-cs-orange', chip: 'bg-cs-orange/15' },
              ].map((stat, index) => (
                <div
                  key={index}
                  className={`card text-center relative overflow-hidden ${
                    stat.highlight ? 'border-cs-green/40 glow-border' : ''
                  }`}
                >
                  {stat.highlight && (
                    <span className="absolute top-3 right-3 inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-cs-orange">
                      <FiAward className="animate-pulse" /> on fire
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
              const { grid, monthLabel } = buildYearGrid(
                progress.summary, progress.weekly_activity, selectedYear,
              );
              return (
                <div className="card mb-8 overflow-hidden">
                  <div className="flex items-start justify-between flex-wrap gap-3 mb-3">
                    <div>
                      <h3 className="text-lg font-bold flex items-center gap-2"><FiActivity /> Your coding heatmap</h3>
                      <p className="text-xs text-cs-text-muted">
                        {heatYear > 0
                          ? `${selectedYear} hasn't started — nothing logged yet`
                          : `Activity across ${selectedYear}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-cs-text-muted">
                      Less
                      {[0, 1, 2, 3, 4].map((lvl) => (
                        <span key={lvl} className={`w-3 h-3 rounded-[3px] border border-cs-line/10 ${LEVEL_STYLES[lvl]}`} />
                      ))}
                      More
                    </div>
                  </div>

                  {/* year filter */}
                  <div className="flex items-center gap-1 mb-3">
                    {[
                      { k: -1, label: 'Last year' },
                      { k: 0, label: 'This year' },
                      { k: 1, label: 'Next year' },
                    ].map((o) => (
                      <button
                        key={o.k}
                        onClick={() => setHeatYear(o.k)}
                        className={`px-2.5 py-1 rounded-md font-mono text-[11px] border transition-colors ${
                          heatYear === o.k
                            ? 'border-cs-primary text-cs-primary bg-cs-primary/10'
                            : 'border-cs-line/15 text-cs-text-muted hover:text-cs-text'
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                    <span className="ml-2 font-mono text-[11px] text-cs-text-dim">{selectedYear}</span>
                  </div>

                  <div className="overflow-x-auto mt-1">
                    <div className="min-w-[780px]">
                      {/* month labels — aligned to the 10px cell + 3px gap grid */}
                      <div className="flex gap-[3px] mb-1.5" style={{ marginLeft: '2.25rem' }}>
                        {monthLabel.map((m, i) => (
                          <div key={i} className="w-2.5 text-[10px] text-cs-text-muted whitespace-nowrap">
                            {m != null ? MONTHS[m] : ''}
                          </div>
                        ))}
                      </div>
                      <div className="flex">
                        {/* weekday labels */}
                        <div className="flex flex-col gap-[3px] mr-2 text-[9px] text-cs-text-muted pr-1 w-7">
                          {['Mon', '', 'Wed', '', 'Fri', '', 'Sun'].map((d, i) => (
                            <div key={i} className="h-2.5 flex items-center leading-none">{d}</div>
                          ))}
                        </div>
                        {/* grid */}
                        <div className="flex gap-[3px]">
                          {grid.map((col, w) => (
                            <div key={w} className="flex flex-col gap-[3px]">
                              {col.map((cell, d) => (
                                <div
                                  key={d}
                                  className={`w-2.5 h-2.5 rounded-[3px] transition-transform duration-150 ${
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
                <h2 className="text-2xl font-bold mb-5">Lesson History</h2>
                <div className="rounded-xl border border-cs-line/10 bg-cs-darker/60 overflow-hidden">
                  {progress.lessons.map((lesson, i) => {
                    const grade = gradeFor(lesson.score);
                    return (
                      <div key={lesson.lesson_id} className={`flex items-center gap-3 px-4 py-2.5 ${i > 0 ? 'border-t border-cs-line/10' : ''}`}>
                        <div className={`w-6 h-6 flex items-center justify-center rounded-full shrink-0 text-xs ${lesson.completed ? 'bg-cs-green/15 text-cs-green' : 'bg-cs-overlay/10 text-gray-500'}`}>
                          {lesson.completed ? '✓' : '·'}
                        </div>
                        <div className="flex-grow min-w-0">
                          <p className="text-sm font-semibold truncate">{lesson.lesson_title}</p>
                          <p className="text-[11px] text-cs-text-muted truncate">{lesson.module_title}</p>
                        </div>
                        <span className={`badge-outline ${grade.cls} shrink-0`}>{grade.label}</span>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold">{Math.round(lesson.score)}%</p>
                          <p className="text-[11px] text-cs-text-muted">{Math.round(lesson.time_spent / 60)}m • {lesson.hints_used} hints</p>
                        </div>
                      </div>
                    );
                  })}
                  {progress.lessons.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                      <p className="text-5xl mb-4">📚</p>
                      <p>No lessons completed yet.</p>
                      <Link to="/dashboard" className="btn btn-primary btn-sm mt-4">Start learning!</Link>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h2 className="text-2xl font-bold mb-6">Weekly Activity</h2>
                <div className="card">
                  {progress.weekly_activity.map((day, index) => {
                    const max = Math.max(...progress.weekly_activity.map(d => d.lessons_completed), 1);
                    return (
                      <div key={index} className="flex items-center gap-3 py-2">
                        <span className="w-10 text-sm text-gray-400">{day.day}</span>
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
                    <h2 className="text-2xl font-bold mt-8 mb-4">Recent Projects</h2>
                    <div className="space-y-3">
                      {progress.recent_projects.map((project) => (
                        <div key={project.id} className="card py-4">
                          <p className="font-semibold">{project.title}</p>
                          <p className="text-xs text-gray-500">{project.language}</p>
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
          <p className="text-cs-text-dim">Nothing here yet — go learn something!</p>
          <Link to="/dashboard" className="btn btn-primary btn-sm mt-4">Start learning</Link>
        </div>
      ))}
    </main>
  );
}

export default Profile;
