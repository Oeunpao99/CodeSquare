import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { careerService } from '../services/api';
import {
  FiBriefcase, FiArrowRight, FiCheckCircle, FiCircle, FiTrendingUp,
  FiTerminal, FiZap,
} from 'react-icons/fi';

const LEVEL_CLS = {
  Novice: 'text-cs-text-muted border-cs-line/20 bg-cs-overlay/[0.05]',
  Learning: 'text-cs-orange border-cs-orange/30 bg-cs-orange/10',
  Proficient: 'text-cs-cyan border-cs-cyan/30 bg-cs-cyan/10',
  Strong: 'text-cs-green border-cs-green/30 bg-cs-green/10',
};

const LEVEL_BAR = {
  Novice: 'rgb(var(--cs-text-muted) / 0.4)',
  Learning: 'rgb(var(--cs-orange) / 0.9)',
  Proficient: '#22d3ee',
  Strong: '#4ade80',
};

function Bar({ value, color = 'rgb(var(--cs-primary))', className = '', glow = true }) {
  return (
    <div className={`h-2 rounded-full bg-cs-overlay/10 overflow-hidden ${className}`}>
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{
          width: `${Math.max(2, value)}%`,
          background: `linear-gradient(90deg, ${color}66, ${color})`,
          boxShadow: glow ? `0 0 12px -2px ${color}` : undefined,
        }}
      />
    </div>
  );
}

function Career() {
  const [data, setData] = useState(null);   // null = loading, false = error

  useEffect(() => {
    careerService.getReadiness().then((r) => setData(r.data)).catch(() => setData(false));
  }, []);

  if (data === null) {
    return (
      <main className="w-full px-6 lg:px-10 py-8">
        <p className="text-cs-text-muted font-mono text-sm">mounting /career…</p>
      </main>
    );
  }

  const noMajor = data && !data.major;

  return (
    <main className="w-full px-6 lg:px-10 py-8">
      <div className="sticky top-0 z-30 -mx-6 lg:-mx-10 px-6 lg:px-10 pt-4 pb-4 -mt-8 mb-6 bg-cs-dark/85 backdrop-blur-xl border-b border-cs-line/[0.07]">
        <span className="mono-label text-cs-primary">// career</span>
        <h1 className="text-3xl font-bold mt-2 flex items-center gap-3">
          <FiTerminal className="text-cs-primary" /> Job Readiness
        </h1>
      </div>

      {noMajor && (
        <div className="card text-center py-14 border-cs-primary/20">
          <p className="text-4xl mb-3">🎯</p>
          <p className="text-cs-text-dim mb-6 max-w-sm mx-auto font-mono text-sm">
            pick_a_major() — CodeSphere will score how close you are to job-ready
            and tell you exactly what to work on.
          </p>
          <Link to="/profile" className="btn btn-primary btn-sm">Choose a major</Link>
        </div>
      )}

      {data && data.major && (
        <div className="max-w-none grid lg:grid-cols-[1.6fr_1fr] gap-6 items-start">
          {/* Left column */}
          <div className="space-y-6">
            {/* Overall */}
            <div className="card border-cs-primary/30 relative overflow-hidden">
              <div className="flex items-end justify-between mb-3 gap-4 flex-wrap">
                <div>
                  <span className="mono-label text-cs-primary flex items-center gap-1.5">
                    <FiZap className="text-[11px]" /> {data.major_label}
                  </span>
                  <p className="text-sm text-cs-text-dim font-mono">overall job readiness</p>
                </div>
                <div className="text-right">
                  <span className="font-mono text-5xl font-bold text-cs-primary leading-none flex items-end">
                    {data.overall}<span className="text-xl text-cs-text-muted">%</span>
                  </span>
                </div>
              </div>
              <Bar value={data.overall} className="h-3" />
              {data.overall >= 75 && (
                <p className="mt-3 text-sm text-cs-green flex items-center gap-1.5 font-mono">
                  <FiTrendingUp /> You’re close — polish the focus areas below.
                </p>
              )}
            </div>

            {/* Target skills — terminal table */}
            <div className="card">
              <span className="mono-label text-cs-text-dim">// skills that make you job-ready</span>
              <div className="mt-3 rounded-lg border border-cs-line/10 overflow-hidden">
                {data.target_skills.map((sk, i) => (
                  <div key={sk.key} className={`px-4 py-3 ${i > 0 ? 'border-t border-cs-line/10' : ''}`}>
                    <div className="flex items-center justify-between gap-3 mb-1.5">
                      <span className="font-mono text-sm font-semibold text-cs-text truncate">{sk.label}</span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold uppercase tracking-wide border shrink-0 ${LEVEL_CLS[sk.level] || LEVEL_CLS.Novice}`}>
                        {sk.level}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Bar
                        value={sk.score}
                        color={LEVEL_BAR[sk.level]}
                        glow={false}
                        className="flex-1 h-1.5"
                      />
                      <span className="font-mono text-xs text-cs-text-dim w-8 text-right shrink-0">{sk.score}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-6">
            {/* Components */}
            <div className="card">
              <span className="mono-label text-cs-text-dim">// readiness breakdown</span>
              <div className="mt-3 grid grid-cols-1 gap-3">
                {data.components.map((c) => (
                  <div key={c.key} className="rounded-lg border border-cs-line/10 bg-cs-overlay/[0.03] p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-cs-text-muted font-mono">{c.label}</span>
                      <span className="font-mono text-sm font-bold text-cs-primary">{c.score}<span className="text-[10px] text-cs-text-muted">%</span></span>
                    </div>
                    <Bar value={c.score} className="h-1.5" />
                  </div>
                ))}
              </div>
            </div>

            {/* Focus next */}
            {data.focus?.length > 0 && (
              <div className="card">
                <span className="mono-label text-cs-text-dim">// focus next on</span>
                <div className="mt-3 flex flex-wrap gap-2">
                  {data.focus.map((f) => (
                    <span key={f} className="px-2.5 py-1 rounded-md text-xs font-mono text-cs-orange bg-cs-orange/10 border border-cs-orange/30">
                      <span className="text-cs-text-muted select-none">$&nbsp;</span>{f}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Plan */}
            {data.next_steps?.length > 0 && (
              <div className="card border-cs-primary/25">
                <span className="mono-label text-cs-primary">// your plan</span>
                <div className="mt-3 rounded-lg bg-cs-darkest/60 border border-cs-line/10 p-3 space-y-1.5">
                  {data.next_steps.map((s, i) => {
                    const action = /(finish|solve|build|keep)/i.test(s);
                    return (
                      <div key={i} className="flex items-start gap-2.5 text-sm font-mono">
                        <span
                          className={`shrink-0 mt-0.5 ${action ? 'text-cs-text-muted' : 'text-cs-green'}`}
                          style={{ fontFamily: 'monospace' }}
                        >
                          {action ? '>' : '✔'}
                        </span>
                        <span className={action ? 'text-cs-text-dim' : 'text-cs-text'}>{s}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-2 mt-4 flex-wrap">
                  <Link to="/practice" className="btn btn-primary btn-sm"><FiZap /> Go practice <FiArrowRight /></Link>
                  <Link to="/roadmap" className="btn btn-ghost btn-sm">View roadmap</Link>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

export default Career;
