import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { progressService } from '../services/api';
import {
  FiActivity, FiZap, FiAward, FiBookOpen, FiTarget, FiArrowRight,
  FiRefreshCw,
} from 'react-icons/fi';
import { LEVEL_COLOR } from '../utils/levels';

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

  return (
    <main className="w-full px-6 lg:px-10 py-8 space-y-6">

      {/* Next step banner */}
      {summary && summary.recommended_action && (
        <div className="rounded-xl border border-cs-line/10 bg-cs-overlay/[0.03] px-5 py-4 flex flex-wrap items-center gap-4">
          <FiRefreshCw className="text-cs-primary shrink-0" />
          <p className="flex-1 min-w-0 text-[0.9375rem]">
            <span className="font-semibold">Next step</span>
            <span className="text-cs-text-dim"> · {summary.recommended_action}</span>
          </p>
          <Link to="/practice" className="btn btn-primary btn-sm">{t('progress.practice')} <FiArrowRight /></Link>
        </div>
      )}

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
                return (
                  <div key={sk.key} className="rounded-lg border border-cs-line/10 p-5 hover:bg-cs-overlay/[0.03] transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-base font-bold truncate">{sk.label}</span>
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
