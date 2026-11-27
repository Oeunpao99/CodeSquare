import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { progressService } from '../services/api';
import {
  FiZap, FiAward, FiBookOpen, FiTarget, FiArrowRight, FiGitBranch, FiCpu,
} from 'react-icons/fi';
import {
  SiPython, SiJavascript, SiHtml5, SiFastapi, SiPostgresql, SiPowerbi, SiGnubash,
} from 'react-icons/si';
import { LEVEL_COLOR } from '../utils/levels';
import { useAuth } from '../context/AuthContext';

// Logo + brand colour per skill bucket (keys from backend/majors.py).
const SKILL_ICON = {
  python: [SiPython, '#3776AB'],
  javascript: [SiJavascript, '#E5C100'],
  web: [SiHtml5, '#E34F26'],
  backend: [SiFastapi, '#009688'],
  sql: [SiPostgresql, '#4169E1'],
  bi: [SiPowerbi, '#E8B000'],
  shell: [SiGnubash, '#4EAA25'],
  'problem-solving': [FiTarget, '#F97316'],
  dsa: [FiGitBranch, '#8B5CF6'],
  'ai-llm': [FiCpu, '#10B981'],
};
const skillIcon = (key) => SKILL_ICON[key] || [FiZap, '#3B82F6'];

// Ring gauge for the banner (average skill score).
function Ring({ value }) {
  const r = 46; const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 120 120" className="w-32 h-32 -rotate-90">
      <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="10" />
      <circle cx="60" cy="60" r={r} fill="none" stroke="#fff" strokeWidth="10" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(100, value) / 100)}
        style={{ transition: 'stroke-dashoffset 1.2s ease-out' }} />
    </svg>
  );
}

function Bar({ value, color = 'rgb(var(--cs-primary))', className = '' }) {
  return (
    <div className={`h-2 rounded-full bg-cs-overlay/10 overflow-hidden ${className}`}>
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{
          width: `${Math.max(2, value)}%`,
          background: color,
        }}
      />
    </div>
  );
}

function Progress() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [skills, setSkills] = useState(null);

  useEffect(() => {
    progressService.getSummary().then((r) => setSummary(r.data)).catch(() => setSummary(false));
    progressService.getSkills().then((r) => setSkills(r.data)).catch(() => setSkills(false));
  }, []);

  const tiles = summary && [
    { label: 'Total XP', value: summary.total_xp, icon: FiZap, cls: 'text-cs-primary' },
    { label: 'Day streak', value: summary.current_streak, icon: FiAward, cls: 'text-cs-green' },
    { label: 'Lessons done', value: summary.total_lessons_completed, icon: FiBookOpen, cls: 'text-cs-cyan' },
    { label: 'Challenges solved', value: summary.challenges_solved ?? 0, icon: FiTarget, cls: 'text-cs-orange' },
  ];

  const skillMeta = (sk) => {
    const bits = [];
    if (sk.lessons_total > 0) bits.push(`${sk.lessons_done}/${sk.lessons_total} lessons`);
    if (sk.challenges_total > 0) bits.push(`${sk.challenges_done}/${sk.challenges_total} challenges`);
    if (sk.projects > 0) bits.push(`${sk.projects} project${sk.projects > 1 ? 's' : ''}`);
    return bits.join(' · ');
  };

  // 4-step meter like a capacity gauge: Novice 1, Learning 2, Proficient 3, Strong 4
  const LEVELS = ['Novice', 'Learning', 'Proficient', 'Strong'];
  const list = skills?.skills || [];
  const avg = list.length ? Math.round(list.reduce((a, k) => a + (k.score || 0), 0) / list.length) : 0;
  const strong = list.filter((k) => k.level === 'Strong').length;

  return (
    <main className="w-full px-6 lg:px-10 py-8 space-y-6">

      {/* Banner: greeting, totals, next step, average skill ring */}
      <section className="relative overflow-hidden rounded-2xl bg-cs-primary text-white">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          {Object.values(SKILL_ICON).slice(0, 7).map(([Icon], i) => (
            <span key={i} className="absolute bottom-0 class-drift text-white/20"
              style={{ left: `${30 + i * 8}%`, animationDelay: `${(i * 1.1) % 7}s`, fontSize: `${1.2 + (i % 3) * 0.4}rem` }}>
              <Icon />
            </span>
          ))}
          <span className="absolute -right-10 -top-16 w-64 h-64 rounded-full bg-white/[0.06]" />
          <span className="absolute right-40 -bottom-24 w-56 h-56 rounded-full bg-white/[0.05]" />
        </div>
        <div className="relative px-7 py-7 flex flex-col md:flex-row md:items-center gap-6">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white/75">Your progress</p>
            <h1 className="mt-1 text-3xl font-bold truncate">Keep going, {user?.display_name || user?.username}!</h1>
            {summary && (
              <p className="mt-2 text-white/85">
                {Number(summary.total_xp || 0).toLocaleString()} XP · {summary.total_lessons_completed} lessons · {summary.challenges_solved ?? 0} challenges solved
                {summary.current_streak > 0 ? ` · ${summary.current_streak}-day streak` : ''}
              </p>
            )}
            {summary?.recommended_action && (
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-lg bg-white/15 px-3 py-2 text-sm">
                  <FiTarget className="shrink-0" /> <span className="font-semibold">Next step:</span> {summary.recommended_action}
                </span>
                <Link to="/practice" className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-white text-cs-primary text-sm font-semibold hover:bg-white/90">
                  {t('progress.practice')} <FiArrowRight />
                </Link>
              </div>
            )}
          </div>
          {list.length > 0 && (
            <div className="flex items-center gap-4 shrink-0">
              <div className="relative">
                <Ring value={avg} />
                <div className="absolute inset-0 grid place-items-center text-center">
                  <div>
                    <p className="text-3xl font-bold leading-none">{avg}</p>
                    <p className="text-[0.6875rem] text-white/75 mt-1">skill avg</p>
                  </div>
                </div>
              </div>
              <div className="text-sm text-white/85 leading-6">
                <p><span className="font-bold text-white">{strong}</span> of {list.length} skills strong</p>
                <Link to="/career" className="inline-flex items-center gap-1 font-semibold text-white hover:underline">Job readiness <FiArrowRight /></Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Stats */}
      {tiles && (
        <section className="rounded-xl border border-cs-line/10">
          <h2 className="px-5 pt-5 text-lg font-semibold">Overview</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5">
            {tiles.map((s) => (
              <div key={s.label} className="rounded-lg border border-cs-line/10 p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-cs-text-dim">{s.label}</span>
                  <s.icon className={s.cls} />
                </div>
                <div className="text-3xl font-bold mt-3 leading-none">{s.value}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Worth another look */}
      {summary && summary.weak_concepts?.length > 0 && (
        <section className="rounded-xl border border-cs-line/10 p-5">
          <h2 className="text-lg font-semibold">Worth another look</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {summary.weak_concepts.map((w, i) => (
              <span key={i} className="px-3 py-1.5 rounded-lg border border-cs-line/10 text-sm text-cs-text-dim">{w}</span>
            ))}
          </div>
        </section>
      )}

      {/* Skills */}
      <section className="rounded-xl border border-cs-line/10">
        <h2 className="px-5 pt-5 text-lg font-semibold">Skills</h2>
        <div className="p-5">
          {skills === null && <p className="text-cs-text-muted text-sm">{t('progress.loading_skills')}</p>}
          {skills === false && <p className="text-sm text-cs-text-dim">Couldn’t load your skills. Try again in a bit.</p>}
          {skills && skills.skills?.length === 0 && (
            <p className="text-sm text-cs-text-dim">{t('progress.no_skill_data')}</p>
          )}
          {skills && skills.skills?.length > 0 && (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {skills.skills.map((sk) => {
                const step = Math.max(1, LEVELS.indexOf(sk.level) + 1);
                const [Icon, color] = skillIcon(sk.key);
                return (
                  <div key={sk.key} className="rounded-lg border border-cs-line/10 p-5 hover:bg-cs-overlay/[0.03] transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="w-10 h-10 rounded-xl grid place-items-center text-xl shrink-0" style={{ background: `${color}1f`, color }}>
                        <Icon />
                      </span>
                      <span className="flex-1 min-w-0 text-base font-bold truncate">{sk.label}</span>
                      <span className="text-[0.9375rem] shrink-0">{sk.score}<span className="text-cs-text-muted">/100</span></span>
                    </div>
                    <div className="flex items-center justify-between gap-3 mt-3 text-sm text-cs-text-dim">
                      <span className="truncate">{skillMeta(sk) || 'Not started'}</span>
                      <span className="shrink-0">{sk.level}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 mt-2">
                      <Bar value={sk.score} color={LEVEL_COLOR[sk.level]} className="flex-1 h-1.5" />
                      <div className="flex gap-1 shrink-0" title={sk.level}>
                        {LEVELS.map((l, i) => (
                          <span key={l} className="w-5 h-2 rounded-full"
                            style={{ background: i < step ? LEVEL_COLOR[sk.level] : 'rgb(var(--cs-overlay) / 0.12)' }} />
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

export default Progress;
