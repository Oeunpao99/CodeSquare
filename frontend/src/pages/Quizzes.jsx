import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { quizService, lessonService } from '../services/api';
import {
  FiHelpCircle, FiCheckCircle, FiZap, FiAward, FiBarChart2,
  FiChevronDown, FiCheck, FiX,
} from 'react-icons/fi';
import { toast } from '../utils/toast';
import { Sk } from '../components/Skeletons';

const LANGS = ['python', 'javascript', 'sql'];
const DIFFS = ['beginner', 'intermediate', 'advanced'];
const LANG_NAMES = { python: 'Python', javascript: 'JavaScript', sql: 'SQL', git: 'Git' };
// Plain coloured word + dot for difficulty (same as Practice).
const DIFF_COLOR = {
  beginner: 'text-cs-green',
  intermediate: 'text-cs-cyan',
  advanced: 'text-cs-orange',
};
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const pretty = (s) => cap(String(s || '').replace(/-/g, ' '));

function Difficulty({ level }) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-medium ${DIFF_COLOR[level] || 'text-cs-text-dim'}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {cap(level)}
    </span>
  );
}

function Quizzes() {
  const [list, setList] = useState(null); // null = loading
  const [stats, setStats] = useState(null);
  const [topics, setTopics] = useState([]);
  const [langNames, setLangNames] = useState({});
  const [fLang, setFLang] = useState('');
  const [fDiff, setFDiff] = useState('');
  const [fTopic, setFTopic] = useState('');

  useEffect(() => {
    quizService.myStats().then((r) => setStats(r.data)).catch(() => {});
    quizService.topics().then((r) => setTopics(r.data || [])).catch(() => {});
    lessonService.getLanguages()
      .then((r) => setLangNames(Object.fromEntries(r.data.map((l) => [l.slug, l.name]))))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setList(null);
    const params = {};
    if (fLang) params.language = fLang;
    if (fDiff) params.difficulty = fDiff;
    if (fTopic) params.topic = fTopic;
    quizService.list(params)
      .then((r) => setList(r.data))
      .catch(() => { setList([]); toast.error('Could not load quizzes.'); });
  }, [fLang, fDiff, fTopic]);

  const langLabel = (slug) => LANG_NAMES[slug] || langNames[slug] || slug;
  const anyFilter = fLang || fDiff || fTopic;
  const clearAll = () => { setFLang(''); setFDiff(''); setFTopic(''); };

  return (
    <main className="w-full px-6 lg:px-10 py-8">
      <div className="sticky top-0 z-30 -mx-6 lg:-mx-10 px-6 lg:px-10 py-4 -mt-8 mb-6 bg-cs-dark/85 backdrop-blur-xl border-b border-cs-line/[0.07]">
        <div className="flex flex-wrap items-end justify-between gap-4 lg:pr-52">
          <div>
            <span className="mono-label">Practice</span>
            <h1 className="text-3xl font-bold mt-2 flex items-center gap-3">
              <FiHelpCircle className="text-cs-primary" /> Quizzes
            </h1>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {anyFilter && (
              <button
                onClick={clearAll}
                className="h-9 px-2 text-sm text-cs-text-dim hover:text-cs-text transition-colors inline-flex items-center gap-1"
              >
                Clear <FiX />
              </button>
            )}
            <FilterDropdown label="Language" value={fLang} onChange={setFLang}
              options={[['', 'All'], ...LANGS.map((s) => [s, langLabel(s)])]} />
            <FilterDropdown label="Level" value={fDiff} onChange={setFDiff}
              options={[['', 'All'], ...DIFFS.map((d) => [d, cap(d)])]} />
            {topics.length > 0 && (
              <FilterDropdown label="Topic" value={fTopic} onChange={setFTopic}
                options={[['', 'All'], ...topics.map((t) => [t, pretty(t)])]} />
            )}
          </div>
        </div>
      </div>

      <div className="space-y-5">
        {/* Stats: one card, three inline numbers */}
        {stats && (
          <div className="card grid grid-cols-3 gap-y-4 divide-x divide-cs-line/10 !py-4">
            <Stat icon={FiCheckCircle} cls="text-cs-green" label="Passed" value={`${stats.passed}/${stats.total}`} />
            <Stat icon={FiBarChart2} cls="text-cs-cyan" label="Average best score" value={`${stats.avg_score}%`} />
            <Stat icon={FiAward} cls="text-cs-primary" label="Quizzes" value={stats.total} />
          </div>
        )}

        {list === null && (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card !p-5 space-y-3">
                <Sk className="h-5 w-3/4" />
                <Sk className="h-3.5 w-1/2" />
              </div>
            ))}
          </div>
        )}

        {list && list.length === 0 && (
          <div className="card text-center py-14">
            <p className="text-4xl mb-3">🗂️</p>
            <p className="text-cs-text-dim mb-4">No quizzes match these filters.</p>
            <button onClick={clearAll} className="btn btn-ghost btn-sm">Clear filters</button>
          </div>
        )}

        {list && list.length > 0 && (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {list.map((z) => (
              <Link
                key={z.slug}
                to={`/quizzes/${z.slug}`}
                className="group card !p-5 flex flex-col gap-2 text-cs-text hover:border-cs-primary/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold leading-snug line-clamp-2 group-hover:text-cs-primary transition-colors">
                    {z.title}
                  </p>
                  {z.passed ? (
                    <FiCheckCircle className="text-cs-green shrink-0 mt-0.5" title="Passed" />
                  ) : (
                    <span className="text-xs text-cs-text-dim inline-flex items-center gap-0.5 shrink-0 mt-0.5">
                      <FiZap className="text-[11px]" /> {z.xp_reward}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-cs-text-dim">
                  <Difficulty level={z.difficulty} />
                  {z.language && <span>{langLabel(z.language)}</span>}
                  <span>{z.question_count} question{z.question_count === 1 ? '' : 's'}</span>
                  {z.best_score > 0 && !z.passed && (
                    <span className="text-cs-orange font-medium">Best {z.best_score}%</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function Stat({ icon: Icon, cls, label, value }) {
  return (
    <div className="flex items-center gap-3 px-3 md:px-5 first:pl-0">
      <Icon className={`text-xl shrink-0 ${cls}`} />
      <div className="min-w-0">
        <div className="text-xl font-bold leading-tight">{value}</div>
        <div className="text-xs text-cs-text-dim truncate">{label}</div>
      </div>
    </div>
  );
}

function FilterDropdown({ label, value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const current = options.find(([v]) => v === value)?.[1] || options[0]?.[1] || 'All';
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
          <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-52 max-h-72 overflow-y-auto rounded-xl border border-cs-line/15 bg-cs-darkest p-1.5 shadow-xl">
            {options.map(([val, text]) => {
              const selected = value === val;
              return (
                <button
                  key={val}
                  type="button"
                  onClick={() => { onChange(val); setOpen(false); }}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-colors ${
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

export default Quizzes;
