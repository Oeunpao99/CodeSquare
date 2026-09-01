import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { progressService } from '../services/api';
import {
  FiActivity, FiZap, FiAward, FiBookOpen, FiTarget, FiArrowRight,
  FiRefreshCw,
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

function Progress() {
  const [summary, setSummary] = useState(null);
  const [skills, setSkills] = useState(null);

  useEffect(() => {
    progressService.getSummary().then((r) => setSummary(r.data)).catch(() => setSummary(false));
    progressService.getSkills().then((r) => setSkills(r.data)).catch(() => setSkills(false));
  }, []);

  const tiles = summary && [
    { label: 'total_xp', value: summary.total_xp, icon: FiZap, cls: 'text-cs-primary' },
    { label: 'day_streak', value: summary.current_streak, icon: FiAward, cls: 'text-cs-green' },
    { label: 'lessons_done', value: summary.total_lessons_completed, icon: FiBookOpen, cls: 'text-cs-cyan' },
    { label: 'challenges_solved', value: summary.challenges_solved ?? 0, icon: FiTarget, cls: 'text-cs-orange' },
  ];

  const skillMeta = (sk) => {
    const bits = [];
    if (sk.lessons_total > 0) bits.push(`${sk.lessons_done}/${sk.lessons_total} lessons`);
    if (sk.challenges_total > 0) bits.push(`${sk.challenges_done}/${sk.challenges_total} challenges`);
    if (sk.projects > 0) bits.push(`${sk.projects} project${sk.projects > 1 ? 's' : ''}`);
    return bits.join(' · ');
  };

  return (
    <main className="w-full px-6 lg:px-10 py-8">
      <div className="sticky top-0 z-30 -mx-6 lg:-mx-10 px-6 lg:px-10 pt-4 pb-4 -mt-8 mb-6 bg-cs-dark/85 backdrop-blur-xl border-b border-cs-line/[0.07]">
        <span className="mono-label text-cs-primary"> progress</span>
        <h1 className="text-3xl font-bold mt-2 flex items-center gap-3">
          <FiActivity className="text-cs-primary" /> Progress
        </h1>
      </div>

      {/* Stat tiles */}
      {tiles && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {tiles.map((s) => (
            <div key={s.label} className="rounded-xl bg-cs-darker/60 border border-cs-line/10 p-4 relative overflow-hidden">
              <div className={`text-lg mb-1.5 ${s.cls}`}><s.icon /></div>
              <div className="font-mono text-2xl font-bold leading-tight">{s.value}</div>
              <div className="text-[11px] font-mono text-cs-text-muted mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="max-w-none grid lg:grid-cols-[1.6fr_1fr] gap-6 items-start">
        {/* Skills */}
        <div className="card">
          <span className="mono-label text-cs-text-dim"> skills</span>
          <div className="mt-3">
            {skills === null && <p className="text-cs-text-muted font-mono text-sm">loading skill profile…</p>}
            {skills && skills.skills?.length === 0 && (
              <p className="text-sm text-cs-text-dim font-mono">no data — complete a lesson or challenge to start building your skill profile.</p>
            )}
            {skills && skills.skills?.length > 0 && (
              <div className="divide-y divide-cs-line/10">
                {skills.skills.map((sk) => (
                  <div key={sk.key} className="py-3">
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
                      <span className="font-mono text-xs text-cs-text-dim w-10 text-right shrink-0">{sk.score}</span>
                    </div>
                    {skillMeta(sk) && (
                      <p className="mt-1 font-mono text-[11px] text-cs-text-muted">{skillMeta(sk)}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {summary && summary.weak_concepts?.length > 0 && (
            <div className="card border-cs-orange/25">
              <span className="mono-label text-cs-orange"> worth another look</span>
              <div className="mt-3 rounded-lg bg-cs-darkest/60 border border-cs-line/10 p-3 space-y-1.5">
                {summary.weak_concepts.map((w, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm font-mono">
                    <span className="text-cs-orange shrink-0 mt-0.5">!</span>
                    <span className="text-cs-text-dim">{w}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {summary && summary.recommended_action && (
            <div className="card border-cs-primary/25">
              <span className="mono-label text-cs-primary flex items-center gap-1.5">
                <FiRefreshCw className="text-[10px]" /> next
              </span>
              <p className="text-sm mt-3 font-mono text-cs-text-dim">{summary.recommended_action}</p>
              <div className="flex mt-4">
                <Link to="/practice" className="btn btn-primary btn-sm"><FiTarget /> Practice <FiArrowRight /></Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default Progress;
