import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FiArrowLeft, FiChevronRight, FiPlay, FiCheck, FiBookOpen, FiArrowRight, FiStar, FiUsers, FiCheckCircle } from 'react-icons/fi';
import { docService } from '../services/api';
import { toast } from '../utils/toast';

function StarRow({ value, onRate }) {
  const [hover, setHover] = useState(0);
  return (
    <span className="inline-flex items-center gap-0.5" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onRate(n)}
          onMouseEnter={() => setHover(n)}
          className="p-0.5 text-cs-text-muted hover:text-cs-orange transition-colors"
          aria-label={`Rate ${n} star${n === 1 ? '' : 's'}`}
        >
          <FiStar className={`text-base ${(hover || value) >= n ? 'text-cs-orange fill-current' : ''}`} />
        </button>
      ))}
    </span>
  );
}
import { MAJORS } from '../majors';
import CollectionLogo from '../components/CollectionLogo';

const DIFF = {
  beginner: { label: 'Beginner', text: 'text-cs-green', ring: 'border-cs-green/50', dot: 'bg-cs-green' },
  intermediate: { label: 'Intermediate', text: 'text-cs-orange', ring: 'border-cs-orange/50', dot: 'bg-cs-orange' },
  advanced: { label: 'Advanced', text: 'text-cs-red', ring: 'border-cs-red/50', dot: 'bg-cs-red' },
};
const dOf = (d) => DIFF[d] || DIFF.beginner;

function SectionBreak({ diff }) {
  const d = dOf(diff);
  return (
    <div className="flex items-center gap-3 my-7 first:mt-0">
      <span className="flex-1 h-px bg-cs-line/10" />
      <span className={`font-mono text-xs uppercase tracking-[0.25em] font-semibold ${d.text}`}>
        {d.label}
      </span>
      <span className="flex-1 h-px bg-cs-line/10" />
    </div>
  );
}

function TopicRow({ to, topic }) {
  return (
    <Link to={to} className="group flex items-center gap-3 px-3.5 py-2 rounded-lg hover:bg-cs-overlay/5 transition-colors">
      <span className="shrink-0">
        {topic.completed ? (
          <span className="w-3.5 h-3.5 rounded-full bg-cs-green/20 text-cs-green grid place-items-center">
            <FiCheck className="text-[9px]" strokeWidth={3} />
          </span>
        ) : (
          <span className="w-3.5 h-3.5 rounded-full border border-cs-line/25 block" />
        )}
      </span>
      <span className="flex-grow min-w-0">
        <span className="block text-sm font-medium text-cs-text group-hover:text-cs-primary transition-colors truncate">
          {topic.title}
        </span>
        {topic.summary && <span className="block text-xs text-cs-text-muted truncate">{topic.summary}</span>}
      </span>
      {topic.has_lesson && !topic.completed && (
        <FiPlay className="text-cs-green/60 shrink-0 text-[11px]" title="Has a hands-on lesson" />
      )}
      <span className="text-[11px] font-mono text-cs-text-muted/60 shrink-0 tabular-nums">{topic.reading_minutes}m</span>
      <FiChevronRight className="text-cs-text-muted/30 group-hover:text-cs-primary transition-colors shrink-0" />
    </Link>
  );
}

function Rung({ node, ring, last, id, children }) {
  return (
    <div id={id} className="relative pl-12 scroll-mt-24">
      {!last && <span className="absolute left-[15px] top-8 -bottom-4 w-px bg-cs-line/10" />}
      <span className={`absolute left-0 top-0.5 w-8 h-8 rounded-full border-2 ${ring} bg-cs-dark grid place-items-center text-[11px] font-mono font-semibold`}>
        {node}
      </span>
      {children}
    </div>
  );
}

function LibraryCollection() {
  const { collection: slug } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [rating, setRating] = useState(null); // { avg, count, mine }

  useEffect(() => {
    setLoading(true);
    docService
      .getCollection(slug)
      .then((res) => {
        setData(res.data);
        setRating({
          avg: res.data.rating_avg || 0,
          count: res.data.rating_count || 0,
          mine: res.data.my_rating || 0,
        });
      })
      .catch((err) => {
        if (err.response?.status === 404) setNotFound(true);
        else console.error('Error loading collection:', err);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  const rate = (n) => {
    docService.rateCollection(slug, n)
      .then((r) => {
        setRating({ avg: r.data.rating_avg, count: r.data.rating_count, mine: r.data.my_rating });
        toast.success('Thanks for rating', `You gave ${n}/5.`);
      })
      .catch(() => toast.error("Couldn't save your rating"));
  };

  const topicsByLevel = useMemo(() => {
    const m = new Map();
    for (const t of data?.topics || []) {
      const k = t.group_level ?? 1;
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(t);
    }
    return m;
  }, [data]);

  const tiers = useMemo(() => {
    if (!data || data.source === 'mirror') return [];
    const order = ['beginner', 'intermediate', 'advanced'];
    const byTier = new Map();
    for (const t of data.topics || []) {
      if ((t.group_level ?? 1) === 0) continue;
      const k = t.group_difficulty || 'beginner';
      if (!byTier.has(k)) byTier.set(k, []);
      byTier.get(k).push(t);
    }
    return order.filter((k) => byTier.has(k)).map((k) => ({ diff: k, topics: byTier.get(k) }));
  }, [data]);

  // "Continue" target: the first not-completed topic (skipping the overview).
  const continueTopic = useMemo(() => {
    for (const t of data?.topics || []) {
      if ((t.group_level ?? 1) === 0) continue;
      if (!t.completed) return t;
    }
    return null;
  }, [data]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-cs-darkest border-t-cs-primary rounded-full animate-spin"></div>
        <p className="text-gray-400">Loading…</p>
      </div>
    );
  }
  if (notFound || !data) {
    return (
      <main className="w-full px-6 lg:px-10 py-16 text-center">
        <p className="text-lg text-gray-400 mb-4">That collection doesn’t exist.</p>
        <Link to="/library" className="btn btn-primary">Back to Library</Link>
      </main>
    );
  }

  const majorLabels = (data.majors || []).map((m) => MAJORS[m]?.label).filter(Boolean);
  const pct = data.trackable > 0 ? Math.round((data.completed / data.trackable) * 100) : 0;
  const isMirror = data.source === 'mirror';
  const overview = (data.topics || []).find((t) => (t.group_level ?? 1) === 0);
  const steps = data.steps || [];
  const firstUnfinished = steps.find((s) => s.done < s.total)?.level ?? steps[0]?.level;
  const lastLevel = steps.length ? steps[steps.length - 1].level : 0;

  const continueLabel =
    data.completed === 0
      ? 'Start learning'
      : data.trackable > 0 && data.completed >= data.trackable
      ? 'Review'
      : 'Continue';

  let prevDiff = null;

  return (
    <main className="w-full px-6 lg:px-10 py-8">
      {/* Sticky header — back link + collection title stay locked while the path scrolls. */}
      <div className="sticky top-0 z-30 -mx-6 lg:-mx-10 px-6 lg:px-10 pt-4 pb-4 -mt-8 mb-8 bg-cs-dark/85 backdrop-blur-xl border-b border-cs-line/[0.07]">
        <Link to="/library" className="inline-flex items-center gap-2 text-sm text-cs-text-dim hover:text-cs-primary mb-4">
          <FiArrowLeft /> Library
        </Link>
        <div className="flex items-start gap-4">
          <span className="w-12 h-12 rounded-xl bg-cs-overlay/5 border border-cs-line/10 flex items-center justify-center text-2xl shrink-0">
            <CollectionLogo slug={data.slug} fallback={data.icon} />
          </span>
          <div className="min-w-0">
            <h1 className="text-3xl font-bold leading-tight">{data.title}</h1>
            <p className="text-cs-text-dim text-sm mt-1 max-w-2xl">{data.description}</p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2.5 text-xs font-mono text-cs-text-muted">
              <span className="inline-flex items-center gap-1.5"><FiUsers className="text-sm" /> {data.learners || 0} learners</span>
              {data.finished > 0 && (
                <span className="inline-flex items-center gap-1.5 text-cs-green"><FiCheckCircle className="text-sm" /> {data.finished} finished</span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <StarRow value={(rating || {}).mine || 0} onRate={rate} />
                <span className="text-cs-text-dim">
                  {rating && rating.count
                    ? `${rating.avg.toFixed(1)} · ${rating.count} rating${rating.count === 1 ? '' : 's'}`
                    : 'be the first to rate'}
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_17rem] gap-10 items-start">
        {/* ---------------- the path ---------------- */}
        <div className="min-w-0">
          {overview && (
            <Link
              to={`/library/${data.slug}/${overview.slug}`}
              className="flex items-center gap-3.5 rounded-xl border border-cs-primary/20 bg-cs-primary/[0.05] px-4 py-3 mb-6 group"
            >
              <span className="w-8 h-8 rounded-full bg-cs-primary/15 text-cs-primary grid place-items-center shrink-0">
                <FiBookOpen className="text-sm" />
              </span>
              <span className="flex-grow min-w-0">
                <span className="block mono-label text-cs-primary/70">start here</span>
                <span className="block font-semibold text-sm group-hover:text-cs-primary transition-colors truncate">
                  {overview.title}
                </span>
              </span>
              <FiChevronRight className="text-cs-primary/60 shrink-0" />
            </Link>
          )}

          {isMirror ? (
            <div className="space-y-4">
              {steps.map((step) => {
                const d = dOf(step.difficulty);
                const items = topicsByLevel.get(step.level) || [];
                const stepPct = step.total > 0 ? Math.round((step.done / step.total) * 100) : 0;
                const done = step.total > 0 && step.done === step.total;
                const showTier = step.difficulty && step.difficulty !== prevDiff;
                prevDiff = step.difficulty || prevDiff;

                return (
                  <React.Fragment key={step.level}>
                    {showTier && <SectionBreak diff={step.difficulty} />}
                    <Rung
                      id={`lvl-${step.level}`}
                      ring={done ? 'border-cs-green bg-cs-green/15 text-cs-green' : d.ring}
                      node={done ? <FiCheck strokeWidth={3} /> : step.level}
                      last={step.level === lastLevel}
                    >
                      <details
                        open={step.level === firstUnfinished}
                        className="rounded-xl border border-cs-line/10 bg-cs-darker/30 overflow-hidden group/step"
                      >
                        <summary className="flex items-center gap-3 px-4 py-3 cursor-pointer list-none [&::-webkit-details-marker]:hidden hover:bg-cs-overlay/5">
                          <span className="flex-grow min-w-0">
                            <span className="block font-semibold text-sm truncate">{step.label}</span>
                            <span className={`text-[10px] font-mono uppercase tracking-wider ${d.text}`}>
                              {step.difficulty}
                            </span>
                          </span>
                          <span className="text-[11px] font-mono text-cs-text-muted tabular-nums shrink-0">
                            {step.done}/{step.total}
                          </span>
                          <span className="w-16 h-1.5 rounded-full bg-cs-overlay/10 overflow-hidden shrink-0">
                            <span className={`block h-full rounded-full ${done ? 'bg-cs-green' : d.dot}`} style={{ width: `${stepPct}%` }} />
                          </span>
                          <FiChevronRight className="text-cs-text-muted/50 shrink-0 transition-transform group-open/step:rotate-90" />
                        </summary>
                        <div className="px-1.5 pb-1.5 pt-0.5 border-t border-cs-line/10 grid md:grid-cols-2 gap-x-2 gap-y-0.5">
                          {items.map((t) => (
                            <TopicRow key={t.slug} to={`/library/${data.slug}/${t.slug}`} topic={t} />
                          ))}
                        </div>
                      </details>
                    </Rung>
                  </React.Fragment>
                );
              })}
            </div>
          ) : (
            <div>
              {tiers.map((tier) => (
                <React.Fragment key={tier.diff}>
                  <SectionBreak diff={tier.diff} />
                  <div className="grid md:grid-cols-2 2xl:grid-cols-3 gap-3">
                    {tier.topics.map((t) => (
                      <Link
                        key={t.slug}
                        to={`/library/${data.slug}/${t.slug}`}
                        className="group flex flex-col rounded-xl border border-cs-line/10 bg-cs-darker/30 px-4 py-3.5 hover:border-cs-primary/40 transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="w-5 h-5 rounded-full border border-cs-line/20 grid place-items-center font-mono text-[10px] text-cs-text-muted shrink-0">
                            {t.group_level}
                          </span>
                          <span className="font-semibold text-sm group-hover:text-cs-primary transition-colors truncate">
                            {t.title}
                          </span>
                        </div>
                        {t.summary && (
                          <span className="text-xs text-cs-text-muted line-clamp-2 flex-grow">{t.summary}</span>
                        )}
                        <span className="text-[11px] font-mono text-cs-text-muted/60 tabular-nums mt-2">
                          {t.reading_minutes} min
                        </span>
                      </Link>
                    ))}
                  </div>
                </React.Fragment>
              ))}
            </div>
          )}
        </div>

        {/* ---------------- info rail ---------------- */}
        <aside className="hidden lg:block sticky top-24 space-y-4">
          <div className="rounded-xl border border-cs-line/10 bg-cs-darker/40 p-4">
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-2xl font-bold font-mono">{pct}%</span>
              <span className="text-[11px] font-mono text-cs-text-muted">
                {data.trackable > 0 ? `${data.completed}/${data.trackable}` : `${data.topics.length} topics`}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-cs-overlay/10 overflow-hidden mb-3">
              <div
                className={`h-full rounded-full ${pct === 100 ? 'bg-cs-green' : 'bg-cs-primary'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="text-[11px] font-mono text-cs-text-muted space-y-0.5">
              <div>{steps.length} levels · beginner → advanced</div>
              <div>{data.topics.length} topics</div>
            </div>
            {continueTopic && (
              <Link
                to={`/library/${data.slug}/${continueTopic.slug}`}
                className="btn btn-primary btn-sm w-full mt-3 font-mono"
              >
                {continueLabel} <FiArrowRight />
              </Link>
            )}
          </div>

          {steps.length > 0 && (
            <div className="rounded-xl border border-cs-line/10 p-3">
              <p className="mono-label mb-2">levels</p>
              <ul className="space-y-0.5 text-sm">
                {steps.map((s) => {
                  const d = dOf(s.difficulty);
                  const done = s.total > 0 && s.done === s.total;
                  return (
                    <li key={s.level}>
                      <a
                        href={`#lvl-${s.level}`}
                        className="flex items-center gap-2 px-2 py-1 rounded-lg text-cs-text-dim hover:text-cs-text hover:bg-cs-overlay/5"
                      >
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${done ? 'bg-cs-green' : d.dot}`} />
                        <span className="flex-grow truncate">{s.label}</span>
                        <span className="text-[10px] font-mono text-cs-text-muted tabular-nums">{s.done}/{s.total}</span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {majorLabels.length > 0 && (
            <p className="text-[11px] text-cs-text-muted px-1">
              On the path for {majorLabels.join(', ')}.
            </p>
          )}
        </aside>
      </div>
    </main>
  );
}

export default LibraryCollection;
