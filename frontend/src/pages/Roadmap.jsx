import React, { useState, useEffect } from 'react';
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

const STATUS_META = {
  'not-started': { label: 'Not started', cls: 'border-cs-line/20 bg-cs-overlay/10 text-cs-text-muted' },
  'in-progress': { label: 'In progress', cls: 'border-cs-primary/40 bg-cs-primary/10 text-cs-primary' },
  completed: { label: 'Completed', cls: 'border-cs-green/40 bg-cs-green/10 text-cs-green' },
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
    <main className="w-full px-6 lg:px-10 py-6">
      {/* Sticky header — just the back link + title (compact, like every other
          page). The major blurb/chips scroll away in the card below. */}
      <div className="sticky top-0 z-30 bg-cs-dark/85 backdrop-blur-xl border-b border-cs-line/[0.07] -mx-6 lg:-mx-10 px-6 lg:px-10 pt-4 pb-4 -mt-6 mb-6">
        <p className="mono-label text-cs-text-muted"> {t('roadmap.your_roadmap')}</p>
        <div className="flex items-end justify-between gap-4 flex-wrap lg:pr-14">
          <h1 className="text-3xl font-bold mt-2 flex items-center gap-3">
            {majorData && (
              <span
                className="w-9 h-9 rounded-lg flex items-center justify-center text-xl shrink-0"
                style={{ background: `${majorData.color}1f`, color: majorData.color }}
              >
                <MajorIcon major={major} />
              </span>
            )}
            {majorData ? majorData.label : 'Your'} <span className="text-cs-primary">Roadmap</span>
          </h1>
          <div className="inline-flex rounded-lg border border-cs-line/15 overflow-hidden font-mono text-xs">
            <button
              onClick={() => setViewPersist('flow')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 transition-colors ${
                view === 'flow' ? 'bg-cs-primary/15 text-cs-primary' : 'text-cs-text-muted hover:text-cs-text'
              }`}
            >
              <FiShare2 /> Map
            </button>
            <button
              onClick={() => setViewPersist('list')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 border-l border-cs-line/15 transition-colors ${
                view === 'list' ? 'bg-cs-primary/15 text-cs-primary' : 'text-cs-text-muted hover:text-cs-text'
              }`}
            >
              <FiList /> List
            </button>
          </div>
        </div>
      </div>

      {majorData && (
        <div className="card mb-8">
          <p className="text-sm text-cs-text-dim">{majorData.blurb}</p>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {majorData.focus.map((f) => (
              <span key={f} className="text-[11px] font-mono px-2 py-0.5 rounded border border-cs-line/10 text-cs-text-muted">
                {f}
              </span>
            ))}
          </div>
        </div>
      )}

        {loading ? (
          <div className="min-h-[40vh] flex flex-col items-center justify-center gap-4">
            <div className="w-12 h-12 border-4 border-cs-darkest border-t-cs-primary rounded-full animate-spin"></div>
            <p className="text-cs-text-muted">{t('roadmap.loading')}</p>
          </div>
        ) : (
          <>
            {data && (
              <div className="card mb-10 p-6">
                <div className="flex items-center gap-4 mb-3">
                  <FiAward className="text-xl text-cs-primary" />
                  <div className="flex-grow">
                    <p className="font-semibold">
                      {data.percent === 100 ? t('roadmap.major_complete') : t('roadmap.overall_progress')}
                    </p>
                    <p className="text-sm text-cs-text-dim">
                      {t('roadmap.lessons', { done: data.completed_lessons, total: data.total_lessons })}
                    </p>
                  </div>
                  <span className="text-2xl font-bold text-cs-primary">{data.percent}%</span>
                </div>
                <div className="h-3 bg-cs-darker rounded overflow-hidden">
                  <div
                    className="h-full rounded transition-all duration-700"
                    style={{
                      width: `${data.percent}%`,
                      background: 'linear-gradient(90deg, rgb(var(--cs-primary)/0.4), rgb(var(--cs-primary)))',
                    }}
                  ></div>
                </div>
              </div>
            )}

            {view === 'flow' ? (
              <RoadmapFlow data={data} />
            ) : (
            <>
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-cs-text-muted">
              <FiBook /> {t('roadmap.suggested_path')}
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
                            ? 'border-cs-green text-cs-green shadow-[inset_0_0_0_2.5rem_rgb(var(--cs-green)/0.16)]'
                            : track.status === 'in-progress'
                            ? 'border-cs-primary text-cs-primary shadow-[inset_0_0_0_2.5rem_rgb(var(--cs-primary)/0.16)]'
                            : 'border-cs-line/25 text-cs-text-muted shadow-[inset_0_0_0_2.5rem_rgb(var(--cs-overlay)/0.1)]'
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

                      <div className={`card p-5 ${track.status === 'completed' ? '!border-cs-green/30' : ''}`}>
                        <div className="flex items-center gap-4">
                          <div className="flex-grow">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-xs text-cs-text-muted">{index + 1}.</span>
                              <h3 className="text-lg font-bold">{track.name}</h3>
                              <span
                                className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full border ${meta.cls}`}
                              >
                                {meta.label}
                              </span>
                            </div>
                            <p className="text-sm text-cs-text-dim mb-2">{track.description}</p>
                            <div className="flex items-center gap-3">
                              <div className="flex-grow max-w-xs h-2 bg-cs-darker rounded overflow-hidden">
                                <div
                                  className="h-full rounded transition-all duration-500"
                                  style={{
                                    width: `${track.percent}%`,
                                    background: 'linear-gradient(90deg, rgb(var(--cs-primary)/0.4), rgb(var(--cs-primary)))',
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
                                      <span className="text-cs-text-muted font-mono">L{mod.level ?? mod.order} ·</span> {mod.title}
                                    </span>
                                    <span className="flex items-center gap-2 shrink-0">
                                      {mod.difficulty && (
                                        <span
                                          className={`text-[10px] font-mono uppercase tracking-wider ${
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
                                  <div className="h-1.5 bg-cs-darker rounded overflow-hidden mt-2">
                                    <div
                                      className="h-full rounded"
                                      style={{
                                        width: `${mod.total_lessons ? (mod.completed_lessons / mod.total_lessons) * 100 : 0}%`,
                                        background: 'linear-gradient(90deg, rgb(var(--cs-primary)/0.4), rgb(var(--cs-primary)))',
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
