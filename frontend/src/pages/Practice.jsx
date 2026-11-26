import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMajor } from '../context/MajorContext';
import { challengeService, lessonService } from '../services/api';
import CodeEditor from '../components/CodeEditor';
import {
  FiArrowRight, FiPlay, FiRefreshCw, FiZap, FiTarget, FiChevronRight,
  FiCheckCircle, FiXCircle, FiHelpCircle, FiCalendar, FiAward, FiX,
  FiChevronDown, FiCheck,
} from 'react-icons/fi';
import { toast } from '../utils/toast';

const BATCH = 10;                 // quick-fire set size
const LANGS = ['python', 'javascript', 'sql'];
const DIFFS = ['beginner', 'intermediate', 'advanced'];
const DIFF_BADGE = {
  beginner: 'badge-outline-green',
  intermediate: 'badge-outline-cyan',
  advanced: 'badge-outline-orange',
};
// Plain coloured word + dot for difficulty (no boxed badges on cards).
const DIFF_COLOR = {
  beginner: 'text-cs-green',
  intermediate: 'text-cs-cyan',
  advanced: 'text-cs-orange',
};
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const LANG_NAMES = { python: 'Python', javascript: 'JavaScript', sql: 'SQL' };

function Difficulty({ level }) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-medium ${DIFF_COLOR[level] || 'text-cs-text-dim'}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {cap(level)}
    </span>
  );
}

function Practice() {
  const { t } = useTranslation();
  const { major, majorData } = useMajor();
  const navigate = useNavigate();
  const [mode, setMode] = useState('browse'); // 'browse' | 'quickfire'

  // ------------------------------------------------------------------ browse
  const [daily, setDaily] = useState(undefined);   // undefined = loading, null = none
  const [stats, setStats] = useState(null);
  const [list, setList] = useState(null);          // null = loading
  const [fLang, setFLang] = useState('');
  const [fDiff, setFDiff] = useState('');
  const [langNames, setLangNames] = useState({});

  useEffect(() => {
    challengeService.daily().then((r) => setDaily(r.data)).catch(() => setDaily(null));
    challengeService.myStats().then((r) => setStats(r.data)).catch(() => {});
    lessonService.getLanguages()
      .then((r) => setLangNames(Object.fromEntries(r.data.map((l) => [l.slug, l.name]))))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setList(null);
    const params = {};
    if (fLang) params.language = fLang;
    if (fDiff) params.difficulty = fDiff;
    challengeService.list(params)
      .then((r) => setList(r.data))
      .catch(() => { setList([]); toast.error('Could not load challenges.'); });
  }, [fLang, fDiff]);

  const langLabel = (slug) => langNames[slug] || slug;

  // --------------------------------------------------------------- quick-fire
  const [items, setItems] = useState(null);
  const [idx, setIdx] = useState(0);
  const [code, setCode] = useState('');
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const [answered, setAnswered] = useState([]);
  const [finished, setFinished] = useState(false);

  const scopeSlugs = useMemo(
    () => (majorData?.tracks || []).join(',') || null,
    [majorData],
  );

  const loadQuickfire = () => {
    setItems(null);
    setIdx(0);
    setResult(null);
    setShowHints(false);
    setAnswered([]);
    setFinished(false);
    lessonService.getPractice(BATCH, scopeSlugs)
      .then((r) => {
        setItems(r.data);
        setCode(r.data[0]?.starter_code || '');
      })
      .catch(() => {
        setItems([]);
        toast.error('Could not load practice exercises.');
      });
  };

  useEffect(() => {
    if (mode === 'quickfire' && items === null) loadQuickfire();
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const current = items?.[idx];

  const runQuickfire = async () => {
    if (!current || running) return;
    setRunning(true);
    try {
      const r = await lessonService.submitExercise(current.exercise_id, code);
      setResult(r.data);
      if (r.data.passed) toast.success('Correct!');
    } catch {
      toast.error('Error running your code.');
    } finally {
      setRunning(false);
    }
  };

  const nextQuickfire = () => {
    setAnswered((a) => [...a, !!result?.passed]);
    setResult(null);
    setShowHints(false);
    if (idx + 1 >= items.length) {
      setFinished(true);
    } else {
      const n = idx + 1;
      setIdx(n);
      setCode(items[n]?.starter_code || '');
    }
  };

  const correct = answered.filter(Boolean).length;

  // -------------------------------------------------------------------- view
  return (
    <main className="w-full px-6 lg:px-10 py-8">
      <div className="sticky top-0 z-30 -mx-6 lg:-mx-10 px-6 lg:px-10 py-4 -mt-8 mb-6 bg-cs-dark/85 backdrop-blur-xl border-b border-cs-line/[0.07]">
        {/* lg:pr-52 reserves the top-right corner for the global notification bell */}
        <div className="flex flex-wrap items-end justify-between gap-4 lg:pr-52">
          <div>
            <span className="mono-label">{t('practice.practice_label')}</span>
            <h1 className="text-3xl font-bold mt-2 flex items-center gap-3">
              <FiTarget className="text-cs-primary" /> {t('practice.practice_title')}
            </h1>
          </div>
          {/* Filters first, mode switch last: the switch never moves when the
              filters hide in Quick-fire. All controls share one height (h-9). */}
          <div className="flex flex-wrap items-center justify-end gap-2">
            {mode === 'browse' && (
              <>
                {(fLang || fDiff) && (
                  <button
                    onClick={() => { setFLang(''); setFDiff(''); }}
                    className="h-9 px-2 text-sm text-cs-text-dim hover:text-cs-text transition-colors inline-flex items-center gap-1"
                  >
                    Clear <FiX />
                  </button>
                )}
                <FilterDropdown label="Language" value={fLang} onChange={setFLang}
                  options={[['', 'All'], ...LANGS.map((s) => [s, LANG_NAMES[s] || langLabel(s)])]} />
                <FilterDropdown label="Level" value={fDiff} onChange={setFDiff}
                  options={[['', 'All'], ...DIFFS.map((d) => [d, cap(d)])]} />
              </>
            )}
            <div className="h-9 inline-flex items-center gap-0.5 p-0.5 rounded-lg border border-cs-line/15 bg-cs-overlay/[0.04]">
              {[['browse', t('practice.challenges')], ['quickfire', t('practice.quickfire')]].map(([m, label]) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`h-full px-3 rounded-md text-sm transition-colors ${
                    mode === m ? 'bg-cs-primary text-cs-btn-text font-semibold' : 'text-cs-text-dim hover:text-cs-text'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {mode === 'browse' && (
        <div className="space-y-5">
          {/* Daily challenge */}
          {daily === undefined && (
            <div className="rounded-2xl border border-cs-line/10 bg-cs-darker/60 p-5 flex flex-col gap-3">
              <span className="skeleton h-3 w-28 rounded" />
              <span className="skeleton h-5 w-2/3 rounded" />
              <span className="skeleton h-4 w-40 rounded" />
            </div>
          )}
          {daily && (
            <div className="card flex flex-col sm:flex-row sm:items-center gap-4">
              <span className="w-12 h-12 rounded-xl bg-cs-primary/10 text-cs-primary grid place-items-center text-xl shrink-0">
                <FiCalendar />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-cs-primary">{t('practice.todays_challenge')}</p>
                <h2 className="text-lg font-bold mt-0.5 truncate">{daily.title}</h2>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-cs-text-dim">
                  <Difficulty level={daily.difficulty} />
                  {daily.topic && <span>{cap(daily.topic)}</span>}
                  <span className="inline-flex items-center gap-1"><FiZap className="text-xs" /> {daily.xp_reward} XP</span>
                </div>
              </div>
              {daily.solved ? (
                <Link to={`/practice/c/${daily.slug}`} className="btn btn-secondary btn-sm shrink-0">
                  <FiCheckCircle className="text-cs-green" /> {t('practice.solved')}
                </Link>
              ) : (
                <Link to={`/practice/c/${daily.slug}`} className="btn btn-primary btn-sm shrink-0">
                  Solve now <FiArrowRight />
                </Link>
              )}
            </div>
          )}

          {/* Stats: one card, four inline numbers */}
          {stats && (
            <div className="card grid grid-cols-2 md:grid-cols-4 gap-y-4 md:divide-x divide-cs-line/10 !py-4">
              <Stat icon={FiCheckCircle} cls="text-cs-green" label={t('practice.solved_label')} value={`${stats.solved}/${stats.total}`} />
              <Stat icon={FiAward} cls="text-cs-primary" label={t('practice.day_streak')} value={stats.daily_streak} />
              {DIFFS.slice(0, 2).map((d) => (
                stats.by_difficulty?.[d] && (
                  <Stat
                    key={d}
                    icon={FiZap}
                    cls={DIFF_COLOR[d]}
                    label={cap(d)}
                    value={`${stats.by_difficulty[d].solved}/${stats.by_difficulty[d].total}`}
                  />
                )
              ))}
            </div>
          )}

          {/* List */}
          {/* Loading skeletons */}
          {list === null && (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-cs-line/10 bg-cs-darker/60 p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="skeleton h-5 w-16 rounded-full" />
                    <span className="skeleton h-4 w-8 rounded" />
                  </div>
                  <span className="skeleton h-4 w-3/4 rounded" />
                  <span className="skeleton h-3 w-1/2 rounded" />
                  <div className="mt-auto pt-2 border-t border-cs-line/8">
                    <span className="skeleton h-3 w-24 rounded" />
                  </div>
                </div>
              ))}
            </div>
          )}
          {list && list.length === 0 && (
            <div className="card text-center py-14">
              <p className="text-4xl mb-3">🗂️</p>
              <p className="text-cs-text-dim mb-4">{t('practice.no_match')}</p>
              <button
                onClick={() => { setFLang(''); setFDiff(''); }}
                className="btn btn-ghost btn-sm"
              >
                {t('practice.clear_filters')}
              </button>
            </div>
          )}
          {list && list.length > 0 && (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {list.map((c) => (
                <Link
                  key={c.slug}
                  to={`/practice/c/${c.slug}`}
                  className="group card !p-5 flex flex-col gap-2 text-cs-text hover:border-cs-primary/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold leading-snug line-clamp-2 group-hover:text-cs-primary transition-colors">
                      {c.title}
                    </p>
                    {c.solved ? (
                      <FiCheckCircle className="text-cs-green shrink-0 mt-0.5" title={t('library.done')} />
                    ) : (
                      <span className="text-xs text-cs-text-dim inline-flex items-center gap-0.5 shrink-0 mt-0.5">
                        <FiZap className="text-[11px]" /> {c.xp_reward}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-cs-text-dim">
                    <Difficulty level={c.difficulty} />
                    <span>{LANG_NAMES[c.language] || c.language}</span>
                    {c.topic && c.topic !== c.language && <span>{cap(c.topic.replace(/-/g, ' '))}</span>}
                    {c.kind === 'debug' && (
                      <span className="px-1.5 py-0.5 rounded bg-cs-orange/10 text-cs-orange font-medium">Debug</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {mode === 'quickfire' && (
        <>
          <p className="text-sm text-cs-text-dim mb-5">
            A shuffled set of {BATCH} short exercises drawn from
            {major ? ' your major’s tracks' : ' all tracks'}. Not graded — just reps.
          </p>

          {items === null && <p className="text-cs-text-muted text-sm">{t('loading_exercises')}</p>}

          {items && items.length === 0 && (
            <div className="card text-center py-16">
              <p className="text-5xl mb-4">🗒️</p>
              <p className="text-cs-text-dim mb-4">{t('practice.no_exercises')}</p>
              <button onClick={loadQuickfire} className="btn btn-ghost btn-sm">{t('practice.try_again')}</button>
            </div>
          )}

          {items && items.length > 0 && !finished && current && (
            <>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-cs-text-muted">
                  {idx + 1} / {items.length} · {langNames[current.language] || current.language}
                </span>
                <div className="h-1.5 flex-1 mx-4 rounded-full bg-cs-overlay/10 overflow-hidden">
                  <div className="h-full bg-gradient-main transition-all duration-300"
                    style={{ width: `${(idx / items.length) * 100}%` }} />
                </div>
                <span className="text-xs text-cs-green">{correct} ✓</span>
              </div>

              <div className="card mb-4">
                <span className="badge badge-cyan mb-3">{current.lesson_title}</span>
                <h2 className="text-xl font-bold mb-2">{current.title}</h2>
                <p className="text-sm text-cs-text-dim">{current.description}</p>
              </div>

              <div className="terminal mb-4">
                <div className="terminal-bar">
                  <span className="terminal-dot bg-cs-red/80" />
                  <span className="terminal-dot bg-cs-orange/80" />
                  <span className="terminal-dot bg-cs-green/80" />
                  <span className="ml-2 text-xs text-cs-text-muted">
                    practice.{current.language === 'javascript' ? 'js' : current.language === 'html-css' ? 'html' : 'py'}
                  </span>
                </div>
                <div className="h-[280px]">
                  <CodeEditor value={code} onChange={setCode} language={current.language} onSubmit={runQuickfire} />
                </div>
              </div>

              {result && (
                <div className={`mb-4 p-4 rounded-xl border ${
                  result.passed ? 'bg-cs-green/10 border-cs-green/30' : 'bg-cs-red/10 border-cs-red/30'
                }`}>
                  <p className={`font-semibold mb-2 flex items-center gap-2 ${result.passed ? 'text-cs-green' : 'text-cs-red'}`}>
                    {result.passed ? <FiCheckCircle /> : <FiXCircle />} {result.message}
                  </p>
                  <div className="space-y-1">
                    {result.results?.map((tc, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        {tc.passed ? <FiCheckCircle className="text-cs-green mt-0.5 shrink-0" /> : <FiXCircle className="text-cs-red mt-0.5 shrink-0" />}
                        <span className={tc.passed ? 'text-cs-green' : 'text-cs-red'}>{tc.description}</span>
                        {!tc.passed && tc.error && (
                          <span className="text-xs text-cs-text-muted font-mono">{tc.error}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {showHints && current.hints?.length > 0 && (
                <div className="mb-4 space-y-2">
                  {current.hints.map((h, i) => (
                    <div key={i} className="p-3 rounded-xl bg-cs-orange/10 border border-cs-orange/20 text-sm text-cs-text-dim">
                      <span className="font-bold text-cs-orange mr-2">Hint {i + 1}:</span>{h}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between gap-3">
                  <button
                    onClick={() => setShowHints((v) => !v)}
                    disabled={!current.hints?.length}
                    className="btn btn-secondary btn-sm disabled:opacity-40"
                  >
                    <FiHelpCircle /> {showHints ? t('practice.hide_hints') : `Hints (${current.hints?.length || 0})`}
                  </button>
                <div className="flex items-center gap-2">
                  <span className="hidden sm:inline text-[10px] text-cs-text-muted">⌘/Ctrl+↵</span>
                  <button onClick={runQuickfire} disabled={running} title="Run (Ctrl+Enter)" className="btn btn-primary btn-sm">
                    <FiPlay /> {running ? t('practice.running') : t('practice.run')}
                  </button>
                  <button onClick={nextQuickfire} className="btn btn-ghost btn-sm">
                    {idx + 1 >= items.length ? t('practice.finish') : t('practice.skip_next')} <FiArrowRight />
                  </button>
                </div>
              </div>
            </>
          )}

          {finished && (
            <div className="card text-center py-14">
              <p className="text-5xl mb-4">{correct === answered.length ? '🎉' : '💪'}</p>
              <h2 className="text-2xl font-bold mb-1">{t('practice.correct', { count: correct, total: answered.length })}</h2>
              <p className="text-cs-text-dim mb-8">
                {correct === answered.length
                  ? t('practice.clean_sweep')
                  : t('practice.nice_work')}
              </p>
              <div className="flex gap-3 justify-center">
                <button onClick={loadQuickfire} className="btn btn-primary btn-sm">
                  <FiRefreshCw /> {t('practice.new_set')}
                </button>
                <button onClick={() => setMode('browse')} className="btn btn-ghost btn-sm">
                  {t('practice.browse_challenges')}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}

function Stat({ icon: Icon, cls, label, value }) {
  return (
    <div className="flex items-center gap-3 md:px-5 md:first:pl-0">
      <Icon className={`text-xl shrink-0 ${cls}`} />
      <div>
        <div className="text-xl font-bold leading-tight">{value}</div>
        <div className="text-xs text-cs-text-dim">{label}</div>
      </div>
    </div>
  );
}

function FilterDropdown({ label, value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const current = options.find(([v]) => v === value)?.[1] || options[0]?.[1] || 'all';
  const active = value !== '';
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`h-9 inline-flex items-center gap-1.5 px-3 rounded-lg border text-sm transition-colors ${
          active
            ? 'border-cs-primary/50 bg-cs-primary/10 text-cs-primary'
            : 'border-cs-line/15 bg-cs-overlay/[0.04] text-cs-text-dim hover:text-cs-text hover:border-cs-primary/30'
        }`}
      >
        <span className="text-cs-text-muted">{label}:</span>
        <span className="font-medium">{current}</span>
        <FiChevronDown className={`text-xs transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-52 rounded-xl border border-cs-line/15 bg-cs-darkest/95 backdrop-blur-xl p-1.5">
            {options.map(([val, text]) => {
              const selected = value === val;
              return (
                <button
                  key={val}
                  type="button"
                  onClick={() => { onChange(val); setOpen(false); }}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-all ${
                    selected
                      ? 'bg-cs-primary/15 text-cs-primary'
                      : 'text-cs-text-dim hover:bg-cs-overlay/[0.06] hover:text-cs-text'
                  }`}
                >
                  <span>{text}</span>
                  {selected && <FiCheck className="text-xs shrink-0" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default Practice;
