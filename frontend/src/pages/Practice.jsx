import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMajor } from '../context/MajorContext';
import { challengeService, lessonService } from '../services/api';
import CodeEditor from '../components/CodeEditor';
import {
  FiArrowRight, FiPlay, FiRefreshCw, FiZap, FiTarget, FiChevronRight,
  FiCheckCircle, FiXCircle, FiHelpCircle, FiCalendar, FiAward, FiX,
  FiChevronDown, FiCheck, FiSearch,
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
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all'); // all | todo | solved

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
  const q = search.trim().toLowerCase();
  const shown = (list || []).filter((c) => (
    (!q || `${c.title} ${c.topic || ''} ${c.language}`.toLowerCase().includes(q))
    && (status === 'all' || (status === 'solved' ? c.solved : !c.solved))
  ));
  const counts = list && {
    all: list.length,
    todo: list.filter((c) => !c.solved).length,
    solved: list.filter((c) => c.solved).length,
  };

  return (
    <main className="w-full px-6 lg:px-10 py-8 space-y-6">
      {/* Daily challenge: slim bar */}
      {mode === 'browse' && daily === undefined && <div className="skeleton h-16 rounded-xl" />}
      {mode === 'browse' && daily && (
        <div className="rounded-xl border border-cs-line/10 bg-cs-overlay/[0.03] px-5 py-4 flex flex-wrap items-center gap-4">
          <FiCalendar className="text-cs-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[0.9375rem] truncate">
              <span className="font-semibold">Today’s challenge</span>
              <span className="text-cs-text-dim"> · {daily.title}</span>
            </p>
          </div>
          <span className="text-sm text-cs-text-dim inline-flex items-center gap-3">
            <Difficulty level={daily.difficulty} />
            <span className="inline-flex items-center gap-1"><FiZap className="text-xs" /> {daily.xp_reward} XP</span>
          </span>
          <Link to={`/practice/c/${daily.slug}`} className={`btn btn-sm shrink-0 ${daily.solved ? 'btn-secondary' : 'btn-primary'}`}>
            {daily.solved ? <><FiCheckCircle className="text-cs-green" /> {t('practice.solved')}</> : <>Solve now <FiArrowRight /></>}
          </Link>
        </div>
      )}

      <section className="rounded-xl border border-cs-line/10 px-5 pt-2 pb-6">
        {/* Mode tabs */}
        <div className="flex items-center gap-7 border-b border-cs-line/10">
          {[['browse', t('practice.challenges'), FiTarget], ['quickfire', t('practice.quickfire'), FiZap]].map(([m, label, Icon]) => (
            <button key={m} onClick={() => setMode(m)}
              className={`relative h-12 px-0.5 inline-flex items-center gap-2 text-[0.9375rem] transition-colors ${mode === m ? 'text-cs-primary' : 'text-cs-text-dim hover:text-cs-text'}`}>
              <Icon /> {label}
              {mode === m && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-cs-primary" />}
            </button>
          ))}
          {stats && (
            <span className="text-sm text-cs-text-dim ml-auto hidden sm:inline-flex items-center gap-4">
              <span className="inline-flex items-center gap-1.5"><FiCheckCircle className="text-cs-green" /> {stats.solved}/{stats.total} solved</span>
              <span className="inline-flex items-center gap-1.5"><FiAward className="text-cs-primary" /> {stats.daily_streak} day streak</span>
            </span>
          )}
        </div>

        {mode === 'browse' && (
          <>
            {/* Search + filters */}
            <div className="flex flex-wrap items-center gap-2 mt-5">
              <label className="flex-1 min-w-[14rem] h-10 flex items-center gap-2 px-3 rounded-lg border border-cs-line/15 focus-within:border-cs-primary/50 transition-colors">
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search challenges"
                  className="flex-1 min-w-0 bg-transparent outline-none text-[0.9375rem] placeholder:text-cs-text-muted" />
                {search
                  ? <button type="button" onClick={() => setSearch('')} className="text-cs-text-muted hover:text-cs-text"><FiX /></button>
                  : <FiSearch className="text-cs-text-muted" />}
              </label>
              <FilterDropdown label="Language" value={fLang} onChange={setFLang}
                options={[['', 'All'], ...LANGS.map((s) => [s, LANG_NAMES[s] || langLabel(s)])]} />
              <FilterDropdown label="Level" value={fDiff} onChange={setFDiff}
                options={[['', 'All'], ...DIFFS.map((d) => [d, cap(d)])]} />
              {(fLang || fDiff || search) && (
                <button onClick={() => { setFLang(''); setFDiff(''); setSearch(''); }}
                  className="h-10 px-2 text-sm text-cs-text-dim hover:text-cs-text inline-flex items-center gap-1">
                  Clear <FiX />
                </button>
              )}
            </div>

            {/* Status tabs */}
            <div className="flex gap-7 mt-4 mb-5 border-b border-cs-line/10">
              {[['all', 'All'], ['todo', 'To do'], ['solved', 'Solved']].map(([k, label]) => (
                <button key={k} onClick={() => setStatus(k)}
                  className={`relative h-11 px-0.5 text-[0.9375rem] transition-colors ${status === k ? 'text-cs-primary' : 'text-cs-text-dim hover:text-cs-text'}`}>
                  {label}{counts && <span className="ml-1.5 text-xs text-cs-text-muted">{counts[k]}</span>}
                  {status === k && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-cs-primary" />}
                </button>
              ))}
            </div>

            {list === null && (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-[8.5rem] rounded-lg" />)}
              </div>
            )}
            {list && shown.length === 0 && (
              <div className="text-center py-14">
                <p className="text-cs-text-dim mb-4">{t('practice.no_match')}</p>
                <button onClick={() => { setFLang(''); setFDiff(''); setSearch(''); setStatus('all'); }} className="btn btn-ghost btn-sm">
                  {t('practice.clear_filters')}
                </button>
              </div>
            )}
            {shown.length > 0 && (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {shown.map((c) => {
                  const step = DIFFS.indexOf(c.difficulty) + 1;
                  return (
                    <Link key={c.slug} to={`/practice/c/${c.slug}`}
                      className="group rounded-lg border border-cs-line/10 p-5 text-cs-text hover:bg-cs-overlay/[0.03] hover:border-cs-line/20 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-base font-bold leading-snug line-clamp-1">{c.title}</p>
                        {c.solved
                          ? <span className="text-sm text-cs-green inline-flex items-center gap-1 shrink-0"><FiCheckCircle /> Solved</span>
                          : <span className="text-[0.9375rem] shrink-0">{c.xp_reward} XP</span>}
                      </div>
                      <div className="flex items-center justify-between gap-3 mt-4 text-sm text-cs-text-dim">
                        <span className="truncate">
                          {LANG_NAMES[c.language] || c.language}
                          {c.topic && c.topic !== c.language && <> · {cap(c.topic.replace(/-/g, ' '))}</>}
                        </span>
                        {c.kind === 'debug' && <span className="text-cs-orange shrink-0">Debug</span>}
                      </div>
                      <div className="flex items-center justify-between gap-3 mt-2 text-sm">
                        <span className="text-cs-text-dim">{cap(c.difficulty)}</span>
                        <span className="flex gap-1" title={cap(c.difficulty)}>
                          {DIFFS.map((d, i) => (
                            <span key={d} className={`w-5 h-2 rounded-full ${i < step ? 'bg-cs-primary' : 'bg-cs-overlay/[0.12]'}`} />
                          ))}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </>
        )}

        {mode === 'quickfire' && <div className="mt-5">
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
                <div className="h-[17.5rem]">
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
                  <span className="hidden sm:inline text-[0.625rem] text-cs-text-muted">⌘/Ctrl+↵</span>
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
        </div>}
      </section>
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
        className={`h-10 inline-flex items-center gap-1.5 px-3 rounded-lg border text-[0.9375rem] transition-colors ${
          active
            ? 'border-cs-primary/50 text-cs-text'
            : 'border-cs-line/15 text-cs-text hover:border-cs-line/30'
        }`}
      >
        <span className="text-cs-text-muted">{label}:</span>
        <span className="font-medium">{current}</span>
        <FiChevronDown className={`text-xs transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-[calc(100%+0.375rem)] z-50 w-52 rounded-xl border border-cs-line/15 bg-cs-darkest/95 backdrop-blur-xl p-1.5">
            {options.map(([val, text]) => {
              const selected = value === val;
              return (
                <button
                  key={val}
                  type="button"
                  onClick={() => { onChange(val); setOpen(false); }}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-all ${
                    selected
                      ? 'bg-cs-overlay/[0.09] text-cs-text font-medium'
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
