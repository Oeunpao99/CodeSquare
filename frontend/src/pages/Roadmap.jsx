import React, { useState, useEffect } from 'react';
import { progressColor } from '../utils/levels';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMajor } from '../context/MajorContext';
import { roadmapService } from '../services/api';
import {
  FiCheck, FiCircle, FiPlay, FiBook,
  FiChevronDown, FiAward, FiList, FiShare2,
} from 'react-icons/fi';
import MajorIcon from '../components/MajorIcon';
import RoadmapFlow from '../components/RoadmapFlow';

const VIEW_KEY = 'cs-roadmap-view';

// Solid, full-colour status pills (no faded tints).
const STATUS_META = {
  'not-started': { label: 'Not started', cls: 'border-transparent bg-cs-overlay/10 text-cs-text-dim' },
  'in-progress': { label: 'In progress', cls: 'border-transparent bg-cs-primary text-white' },
  completed: { label: 'Completed', cls: 'border-transparent bg-cs-green text-white' },
};

function Roadmap() {
  const { t } = useTranslation();
  const { major, majorData } = useMajor();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [view, setView] = useState(() => {
    try { return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'flow'; } catch { return 'flow'; }
  });

  const setViewPersist = (v) => {
    setView(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* ignore */ }
  };

  useEffect(() => {
    if (!major) return;
    roadmapService
      .getForMajor(major)
      .then((res) => setData(res.data))
      .catch((err) => console.error('Error fetching roadmap:', err))
      .finally(() => setLoading(false));
  }, [major]);

  const toggle = (slug) => setExpanded((e) => ({ ...e, [slug]: !e[slug] }));

  if (!major) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <p className="text-lg text-cs-text-muted">{t('roadmap.pick_major')}</p>
        <Link to="/profile" className="btn btn-primary">{t('roadmap.choose_major')}</Link>
      </div>
    );
  }

  const statusMeta = (status) => {
    const key = status || 'not-started';
    const cls = STATUS_META[key] || STATUS_META['not-started'];
    return {
      label: t(`roadmap.${key === 'not-started' ? 'not_started' : key === 'in-progress' ? 'in_progress' : 'completed'}`),
      cls: cls.cls,
    };
  };

  return (
    <main className="w-full px-6 lg:px-10 py-8">
      <section className="rounded-xl border border-cs-line/10 px-5 mb-6">
        {/* View tabs + overall progress */}
        <div className="flex flex-wrap items-center gap-x-7 gap-y-2 border-b border-cs-line/10">
          {[['flow', 'Map', FiShare2], ['list', 'List', FiList]].map(([v, label, Icon]) => (
            <button key={v} onClick={() => setViewPersist(v)}
              className={`relative h-12 px-0.5 inline-flex items-center gap-2 text-[0.9375rem] transition-colors ${view === v ? 'text-cs-primary' : 'text-cs-text-dim hover:text-cs-text'}`}>
              <Icon /> {label}
              {view === v && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-cs-primary" />}
            </button>
          ))}
          {data && (
            <div className="ml-auto flex items-center gap-3 py-2 text-sm">
              <FiAward className="text-cs-primary" />
              <span className="text-cs-text-dim">
                {data.percent === 100 ? t('roadmap.major_complete') : t('roadmap.lessons', { done: data.completed_lessons, total: data.total_lessons })}
              </span>
              <span className="w-32 h-1.5 rounded-full bg-cs-overlay/[0.12] overflow-hidden">
                <span className="block h-full rounded-full bg-cs-primary transition-all duration-700" style={{ width: `${data.percent}%` }} />
              </span>
              <span className="font-semibold tabular-nums">{data.percent}%</span>
            </div>
          )}
        </div>

        {/* Major focus */}
        {majorData && (
          <div className="py-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="text-sm text-cs-text-dim flex-1 min-w-[16rem]">{majorData.blurb}</p>
            <div className="flex flex-wrap gap-1.5">
              {majorData.focus.map((f) => (
                <span key={f} className="text-xs px-2.5 py-1 rounded-md border border-cs-line/15 text-cs-text-dim">{f}</span>
              ))}
            </div>
          </div>
        )}
      </section>

        {loading ? (
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-72 rounded-xl" />)}
          </div>
        ) : (
          <>
            {view === 'flow' ? (
              <RoadmapFlow data={data} />
            ) : (
            <>
            <h2 className="text-base font-semibold mb-5 flex items-center gap-2">
              <FiBook className="text-cs-text-muted" /> {t('roadmap.suggested_path')}
            </h2>

            <div className="relative">
              <div className="absolute left-6 top-2 bottom-2 w-0.5 bg-cs-line/10"></div>

              <div className="space-y-6">
                {data?.tracks.map((track, index) => {
                  const meta = statusMeta(track.status);
                  const isOpen = !!expanded[track.slug];
                  return (
                    <div key={track.slug} className="relative pl-16">
                      <div
                        className={`absolute left-0 top-1 w-12 h-12 rounded-full border-2 bg-cs-dark flex items-center justify-center text-lg ${
                          track.status === 'completed'
                            ? 'border-cs-green !bg-cs-green text-white'
                            : track.status === 'in-progress'
                            ? 'border-cs-primary !bg-cs-primary text-white'
                            : 'border-cs-line/25 text-cs-text-muted'
                        }`}
                      >
                        {track.status === 'completed' ? (
                          <FiCheck />
                        ) : track.status === 'in-progress' ? (
                          <FiPlay />
                        ) : (
                          <FiCircle />
                        )}
                      </div>

                      <div className="card p-5">
                        <div className="flex items-center gap-4">
                          <div className="flex-grow">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-xs text-cs-text-muted">{index + 1}.</span>
                              <h3 className="text-lg font-bold">{track.name}</h3>
                              <span
                                className={`text-[0.6875rem] font-semibold px-2 py-0.5 rounded-full border ${meta.cls}`}
                              >
                                {meta.label}
                              </span>
                            </div>
                            <p className="text-sm text-cs-text-dim mb-2">{track.description}</p>
                            <div className="flex items-center gap-3">
                              <div className="flex-grow max-w-xs h-2 bg-cs-overlay/10 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: `${track.percent}%`,
                                    background: progressColor(track.status === 'completed'),
                                  }}
                                ></div>
                              </div>
                              <span className="text-xs text-cs-text-muted">
                                {track.completed_lessons} / {track.total_lessons}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-2 shrink-0">
                            <Link to={`/learn/${track.slug}`} className="btn btn-primary btn-sm">
                              {track.status === 'completed' ? t('roadmap.review') : track.status === 'in-progress' ? t('roadmap.continue') : t('roadmap.start')}
                            </Link>
                            {track.modules.length > 0 && (
                              <button
                                onClick={() => toggle(track.slug)}
                                className="text-xs text-cs-primary hover:text-cs-cyan flex items-center gap-1"
                              >
                                {isOpen ? t('roadmap.hide_modules') : t('roadmap.show_modules')} <FiChevronDown className={isOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
                              </button>
                            )}
                          </div>
                        </div>

                        {isOpen && (
                          <div className="mt-4 pt-4 border-t border-cs-line/10">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {track.modules.map((mod) => (
                                <div key={mod.id} className="rounded-lg bg-cs-darker/60 p-3">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm font-semibold">
                                      <span className="text-cs-text-muted">L{mod.level ?? mod.order} ·</span> {mod.title}
                                    </span>
                                    <span className="flex items-center gap-2 shrink-0">
                                      {mod.difficulty && (
                                        <span
                                          className={`text-[0.625rem] uppercase tracking-wider ${
                                            mod.difficulty === 'beginner'
                                              ? 'text-cs-green'
                                              : mod.difficulty === 'intermediate'
                                              ? 'text-cs-orange'
                                              : 'text-cs-red'
                                          }`}
                                        >
                                          {mod.difficulty}
                                        </span>
                                      )}
                                      {mod.completed_lessons >= mod.total_lessons && mod.total_lessons > 0 && (
                                        <FiCheck className="text-cs-green" />
                                      )}
                                    </span>
                                  </div>
                                  <p className="text-xs text-cs-text-muted">
                                    {t('roadmap.lessons_lowercase', { done: mod.completed_lessons, total: mod.total_lessons })}
                                  </p>
                                  <div className="h-1.5 bg-cs-overlay/10 rounded-full overflow-hidden mt-2">
                                    <div
                                      className="h-full rounded"
                                      style={{
                                        width: `${mod.total_lessons ? (mod.completed_lessons / mod.total_lessons) * 100 : 0}%`,
                                        background: progressColor(mod.total_lessons && mod.completed_lessons >= mod.total_lessons),
                                      }}
                                    ></div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            </>
            )}
          </>
        )}
    </main>
  );
}

export default Roadmap;
