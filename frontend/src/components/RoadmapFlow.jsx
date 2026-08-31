import React, { useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { FiCheck, FiPlay, FiLock, FiArrowRight, FiArrowDown, FiMapPin } from 'react-icons/fi';
import LangLogo from './LangLogo';

// A left-to-right "you are here" map of the whole path: tracks as connected
// nodes, each opening into its module rungs. Progress is colour-coded so a
// learner can catch up at a glance. Data is the /roadmap/:major payload — no
// extra request.

const TRACK_RING = {
  completed: 'border-cs-green/50 shadow-[0_0_30px_-14px_rgb(var(--cs-green)/0.8)]',
  'in-progress': 'border-cs-primary/50 shadow-[0_0_30px_-12px_rgb(var(--cs-primary)/0.8)]',
  'not-started': 'border-cs-line/15',
};

function moduleState(mod) {
  const done = mod.total_lessons > 0 && mod.completed_lessons >= mod.total_lessons;
  const started = mod.completed_lessons > 0 && !done;
  return { done, started };
}

function RoadmapFlow({ data }) {
  const scroller = useRef(null);

  // The single "you are here" rung: first module that's started-but-not-done,
  // else the first not-done module after the completed prefix.
  const hereKey = useMemo(() => {
    if (!data?.tracks) return null;
    let firstOpen = null;
    for (const t of data.tracks) {
      for (const m of t.modules) {
        const { done, started } = moduleState(m);
        if (started) return `${t.slug}:${m.id}`;
        if (!done && !firstOpen) firstOpen = `${t.slug}:${m.id}`;
      }
    }
    return firstOpen;
  }, [data]);

  if (!data?.tracks?.length) return null;

  return (
    <div>
      <div className="flex items-center gap-4 mb-4 text-[11px] font-mono text-cs-text-muted">
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-cs-green" /> done</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-cs-primary" /> in progress</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full border border-cs-line/30" /> upcoming</span>
        <span className="inline-flex items-center gap-1.5"><FiMapPin className="text-cs-cyan" /> you are here</span>
      </div>

      <div
        ref={scroller}
        className="overflow-x-auto pb-3 -mx-1 px-1"
      >
        <div className="flex flex-col md:flex-row md:items-stretch gap-3 md:gap-0 md:min-w-max">
          {data.tracks.map((track, i) => {
            const pct = track.percent || 0;
            return (
              <React.Fragment key={track.slug}>
                {i > 0 && (
                  <div className="flex md:flex-col items-center justify-center md:px-3 text-cs-line/40 shrink-0">
                    <FiArrowDown className="md:hidden" />
                    <FiArrowRight className="hidden md:block text-lg" />
                  </div>
                )}

                <div className={`card md:w-[300px] shrink-0 border ${TRACK_RING[track.status] || TRACK_RING['not-started']}`}>
                  {/* track header */}
                  <Link to={`/learn/${track.slug}`} className="flex items-start gap-3 group">
                    <span
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                      style={{ background: `${track.color || '#2DD4BF'}1f`, color: track.color || '#2DD4BF' }}
                    >
                      <LangLogo name={track.name} className="text-xl" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm truncate group-hover:text-cs-primary transition-colors">{track.name}</h3>
                        {track.status === 'completed' && <FiCheck className="text-cs-green shrink-0" />}
                        {track.status === 'in-progress' && <FiPlay className="text-cs-primary shrink-0 text-xs" />}
                      </div>
                      <p className="text-[11px] font-mono text-cs-text-muted mt-0.5">
                        {track.completed_lessons} / {track.total_lessons} lessons · {pct}%
                      </p>
                    </div>
                  </Link>

                  <div className="h-1.5 rounded-full bg-cs-overlay/10 overflow-hidden mt-3">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${pct}%`,
                        background:
                          track.status === 'completed'
                            ? 'linear-gradient(90deg, rgb(var(--cs-green)/0.4), rgb(var(--cs-green)))'
                            : 'linear-gradient(90deg, rgb(var(--cs-primary)/0.4), rgb(var(--cs-primary)))',
                      }}
                    />
                  </div>

                  {/* module rungs */}
                  <div className="mt-4 space-y-1.5">
                    {track.modules.map((mod) => {
                      const { done, started } = moduleState(mod);
                      const here = hereKey === `${track.slug}:${mod.id}`;
                      const mpct = mod.total_lessons ? (mod.completed_lessons / mod.total_lessons) * 100 : 0;
                      return (
                        <div
                          key={mod.id}
                          className={`rounded-lg border px-2.5 py-2 flex items-center gap-2.5 ${
                            here
                              ? 'border-cs-cyan/60 bg-cs-cyan/[0.07]'
                              : done
                              ? 'border-cs-green/25 bg-cs-green/[0.04]'
                              : started
                              ? 'border-cs-primary/30 bg-cs-primary/[0.05]'
                              : 'border-cs-line/10'
                          }`}
                        >
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 border ${
                              done
                                ? 'bg-cs-green/20 border-cs-green text-cs-green'
                                : started || here
                                ? 'bg-cs-primary/20 border-cs-primary text-cs-primary'
                                : 'border-cs-line/25 text-cs-text-muted'
                            }`}
                          >
                            {done ? <FiCheck /> : started || here ? <FiPlay /> : <FiLock className="text-[9px]" />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium truncate">
                              <span className="font-mono text-cs-text-muted">L{mod.level ?? mod.order}</span> {mod.title}
                            </p>
                            <div className="h-1 rounded-full bg-cs-overlay/10 overflow-hidden mt-1">
                              <div
                                className={`h-full rounded-full ${done ? 'bg-cs-green' : 'bg-cs-primary'}`}
                                style={{ width: `${mpct}%` }}
                              />
                            </div>
                          </div>
                          {here && (
                            <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-mono text-cs-cyan">
                              <FiMapPin /> here
                            </span>
                          )}
                        </div>
                      );
                    })}
                    {track.modules.length === 0 && (
                      <p className="text-[11px] font-mono text-cs-text-muted">no modules yet</p>
                    )}
                  </div>

                  <Link
                    to={`/learn/${track.slug}`}
                    className="btn btn-secondary btn-sm w-full justify-center mt-4"
                  >
                    {track.status === 'completed' ? 'Review' : track.status === 'in-progress' ? 'Continue' : 'Start'}
                    <FiArrowRight />
                  </Link>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default RoadmapFlow;
