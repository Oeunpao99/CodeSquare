import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { careerService } from '../services/api';
import { FiBriefcase, FiArrowRight, FiTrendingUp, FiZap, FiChevronRight } from 'react-icons/fi';
import { Sk } from '../components/Skeletons';
import { LEVEL_COLOR, LEVEL_PILL, PILL_BASE } from '../utils/levels';


function Bar({ value, color = 'rgb(var(--cs-primary))', className = 'h-1.5' }) {
  return (
    <div className={`rounded-full bg-cs-overlay/10 overflow-hidden ${className}`}>
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${Math.max(2, value)}%`, background: color }}
      />
    </div>
  );
}

// Wide banner per major (backend/scripts/gen_career_banners.py). Hidden if missing.
function MajorBanner({ major, label }) {
  const [ok, setOk] = useState(true);
  if (!ok) return null;
  return (
    <div className="relative -mx-6 -mt-6 mb-6 aspect-[5/1] overflow-hidden rounded-t-2xl bg-cs-overlay/5">
      <img
        src={`/banners/career/${major}.webp`}
        alt=""
        onError={() => setOk(false)}
        className="w-full h-full object-cover"
      />
      <span className="absolute left-5 bottom-4 px-3 py-1 rounded-full bg-cs-dark/90 backdrop-blur text-sm font-semibold text-cs-text shadow-sm">
        {label}
      </span>
    </div>
  );
}

function CareerSkeleton() {
  return (
    <div className="w-full space-y-6" aria-busy="true">
      <div className="card overflow-hidden space-y-4">
        <Sk className="-mx-6 -mt-6 mb-2 aspect-[5/1] w-[calc(100%+3rem)] rounded-none" />
        <div className="flex justify-between"><Sk className="h-5 w-40" /><Sk className="h-10 w-20" /></div>
        <Sk className="h-2.5 w-full rounded-full" />
        <div className="flex gap-6"><Sk className="h-4 w-28" /><Sk className="h-4 w-28" /><Sk className="h-4 w-28" /></div>
      </div>
      <div className="card space-y-5">
        {Array.from({ length: 5 }).map((_, i) => <Sk key={i} className="h-6 w-full" />)}
      </div>
    </div>
  );
}

function Career() {
  const [data, setData] = useState(null); // null = loading, false = error

  useEffect(() => {
    careerService.getReadiness().then((r) => setData(r.data)).catch(() => setData(false));
  }, []);

  const noMajor = data && !data.major;
  // Older API builds only send plain-text next_steps; show those without buttons.
  const actions = data?.actions?.length
    ? data.actions
    : (data?.next_steps || [])
        .filter((s) => /(finish|solve|build|keep)/i.test(s))
        .map((text) => ({ text, to: '/roadmap', cta: 'Open' }));

  return (
    <main className="w-full px-6 lg:px-10 py-8">
      <div className="sticky top-0 z-30 -mx-6 lg:-mx-10 px-6 lg:px-10 lg:pr-52 pt-4 pb-4 -mt-8 mb-6 bg-cs-dark/85 backdrop-blur-xl border-b border-cs-line/[0.07]">
        <span className="mono-label">Career</span>
        <h1 className="text-3xl font-bold mt-2 flex items-center gap-3">
          <FiBriefcase className="text-cs-primary" /> Job Readiness
        </h1>
      </div>

      {data === null && <CareerSkeleton />}

      {data === false && (
        <p className="text-cs-text-dim text-sm">Couldn’t load your readiness right now. Please try again.</p>
      )}

      {noMajor && (
        <div className="card text-center py-14 max-w-xl">
          <p className="text-4xl mb-3">🎯</p>
          <p className="text-cs-text-dim mb-6 max-w-sm mx-auto text-sm">
            Choose a career major and CodeSquare will score how close you are to job-ready,
            and tell you exactly what to work on next.
          </p>
          <Link to="/profile" className="btn btn-primary btn-sm">Choose a major</Link>
        </div>
      )}

      {data && data.major && (
        <div className="w-full space-y-6">
          {/* 1 — Overall score + breakdown */}
          <section className="card overflow-hidden">
            <MajorBanner major={data.major} label={data.major_label} />
            <div className="flex items-end justify-between gap-4 flex-wrap mb-4">
              <div>
                <p className="text-sm font-semibold text-cs-primary flex items-center gap-1.5">
                  <FiZap className="text-xs" /> {data.major_label}
                </p>
                <p className="text-cs-text-dim text-sm mt-0.5">Overall job readiness</p>
              </div>
              <p className="text-5xl font-bold leading-none">
                {data.overall}
                <span className="text-xl text-cs-text-muted">%</span>
              </p>
            </div>
            <Bar value={data.overall} className="h-2.5" />

            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-cs-text-dim">
              {data.components.map((c) => (
                <span key={c.key}>
                  {c.label} <strong className="text-cs-text">{c.score}%</strong>
                </span>
              ))}
            </div>

            {data.overall >= 75 && (
              <p className="mt-3 text-sm text-cs-green flex items-center gap-1.5">
                <FiTrendingUp /> You’re close to job-ready — tighten the weak spots below.
              </p>
            )}
          </section>

          {/* 2 — Skills */}
          <section className="card">
            <h2 className="text-lg font-bold mb-4">Skills</h2>
            <div className="space-y-4">
              {data.target_skills.map((sk) => (
                <div key={sk.key} className="grid grid-cols-[1fr_auto_2.5rem] sm:grid-cols-[minmax(0,10rem)_5.5rem_1fr_2.5rem] items-center gap-x-3 gap-y-1.5">
                  <span className="text-sm font-medium truncate">{sk.label}</span>
                  <span className={`${PILL_BASE} justify-self-start ${LEVEL_PILL[sk.level] || LEVEL_PILL.Novice}`}>
                    {sk.level}
                  </span>
                  <Bar value={sk.score} color={LEVEL_COLOR[sk.level]} className="h-1.5 col-span-3 order-last sm:col-span-1 sm:order-none" />
                  <span className="text-sm text-cs-text-dim text-right tabular-nums">{sk.score}</span>
                </div>
              ))}
            </div>
          </section>

          {/* 3 — Next steps (focus areas + plan, merged) */}
          {actions.length > 0 && (
            <section className="card">
              <h2 className="text-lg font-bold mb-3">Next steps</h2>
              <ul className="divide-y divide-cs-line/10">
                {actions.map((a) => (
                  <li key={a.text} className="flex items-center gap-3 py-3">
                    <FiChevronRight className="text-cs-primary shrink-0" />
                    <span className="flex-1 text-sm">{a.text}</span>
                    <Link to={a.to} className="btn btn-secondary btn-sm shrink-0">
                      {a.cta} <FiArrowRight />
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2 mt-4 flex-wrap">
                <Link to="/practice" className="btn btn-primary btn-sm"><FiZap /> Go practice</Link>
                <Link to="/roadmap" className="btn btn-ghost btn-sm">View roadmap</Link>
              </div>
            </section>
          )}
        </div>
      )}
    </main>
  );
}

export default Career;
