import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { quizService, lessonService } from '../services/api';
import {
  FiHelpCircle, FiCheckCircle, FiZap, FiAward, FiBarChart2,
  FiChevronDown, FiCheck, FiX,
} from 'react-icons/fi';
import { toast } from '../utils/toast';

const LANGS = ['python', 'javascript', 'sql'];
const DIFFS = ['beginner', 'intermediate', 'advanced'];
const DIFF_BADGE = {
  beginner: 'badge-outline-green',
  intermediate: 'badge-outline-cyan',
  advanced: 'badge-outline-orange',
};

function Quizzes() {
  const [list, setList] = useState(null);       // null = loading
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

  const langLabel = (slug) => langNames[slug] || slug;

  return (
    <main className="w-full px-6 lg:px-10 py-8">
      <div className="sticky top-0 z-30 -mx-6 lg:-mx-10 px-6 lg:px-10 py-4 -mt-8 mb-6 bg-cs-dark/85 backdrop-blur-xl border-b border-cs-line/[0.07]">
        <span className="mono-label"> practice</span>
        <h1 className="text-3xl font-bold mt-2 flex items-center gap-3">
          <FiHelpCircle className="text-cs-primary" /> Quizzes
        </h1>

        <div className="flex flex-wrap items-center gap-3 mt-4 pt-3 border-t border-cs-line/10">
          <span className="mono-label text-cs-text-dim px-1"> filter</span>
          <FilterDropdown label="lang" value={fLang} onChange={setFLang}
            options={[['', 'all'], ...LANGS.map((s) => [s, langLabel(s)])]} />
          <FilterDropdown label="level" value={fDiff} onChange={setFDiff}
            options={[['', 'all'], ...DIFFS.map((d) => [d, d])]} />
          {topics.length > 0 && (
            <FilterDropdown label="topic" value={fTopic} onChange={setFTopic}
              options={[['', 'all'], ...topics.map((t) => [t, t])]} />
          )}
          {(fLang || fDiff || fTopic) && (
            <button
              onClick={() => { setFLang(''); setFDiff(''); setFTopic(''); }}
              className="font-mono text-[11px] text-cs-primary hover:text-cs-mint transition-colors ml-auto inline-flex items-center gap-1"
            >
              clear <FiX className="text-xs" />
            </button>
          )}
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Stat icon={FiCheckCircle} cls="text-cs-green" label="Passed" value={`${stats.passed}/${stats.total}`} />
          <Stat icon={FiBarChart2} cls="text-cs-cyan" label="Avg best score" value={`${stats.avg_score}%`} />
          <Stat icon={FiAward} cls="text-cs-primary" label="Quizzes" value={stats.total} />
        </div>
      )}

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
          <p className="text-cs-text-dim mb-4">No quizzes match these filters.</p>
          <button
            onClick={() => { setFLang(''); setFDiff(''); setFTopic(''); }}
            className="btn btn-ghost btn-sm"
          >
            Clear filters
          </button>
        </div>
      )}

      {list && list.length > 0 && (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {list.map((z) => (
            <Link
              key={z.slug}
              to={`/quizzes/${z.slug}`}
              className="group relative rounded-2xl border border-cs-line/10 bg-cs-darker/60 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-cs-primary/30 hover:bg-cs-darker flex flex-col gap-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`badge-outline ${DIFF_BADGE[z.difficulty] || 'badge-outline-cyan'} shrink-0`}>
                  {z.difficulty}
                </span>
                {z.passed ? (
                  <span className="font-mono text-[11px] text-cs-green inline-flex items-center gap-1 shrink-0">
                    <FiCheckCircle className="text-xs" /> passed
                  </span>
                ) : (
                  <span className="font-mono text-xs text-cs-primary inline-flex items-center gap-0.5 shrink-0">
                    <FiZap className="text-[10px]" /> {z.xp_reward}
                  </span>
                )}
              </div>

              <p className="font-semibold leading-snug line-clamp-1 group-hover:text-cs-primary transition-colors">
                {z.title}
              </p>

              <div className="mt-auto pt-2 border-t border-cs-line/8 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px]">
                <span className="text-cs-text-muted">
                  {z.question_count} question{z.question_count === 1 ? '' : 's'}
                </span>
                {z.topic && (
                  <span className="text-cs-text-dim inline-flex items-center gap-1.5">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-cs-cyan/70" />
                    {z.topic}
                  </span>
                )}
                <span className="ml-auto" />
                {z.best_score > 0 && !z.passed && (
                  <span className="text-cs-orange">best {z.best_score}%</span>
                )}
                {z.language && (
                  <span className="text-cs-text-muted">{z.language}</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}

function Stat({ icon: Icon, cls, label, value }) {
  return (
    <div className="rounded-xl bg-cs-darker/60 border border-cs-line/10 p-3">
      <div className={`text-lg mb-1 ${cls}`}><Icon /></div>
      <div className="text-xl font-bold leading-tight">{value}</div>
      <div className="text-xs text-cs-text-muted capitalize">{label}</div>
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
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border font-mono text-xs transition-all ${
          active
            ? 'border-cs-primary/50 bg-cs-primary/10 text-cs-primary'
            : 'border-cs-line/15 bg-cs-overlay/[0.04] text-cs-text-dim hover:text-cs-text hover:border-cs-primary/30'
        }`}
      >
        <span className="uppercase tracking-[0.18em] text-[10px] text-cs-text-muted">{label}</span>
        <span className="font-medium">{current}</span>
        <FiChevronDown className={`text-xs transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-[calc(100%+6px)] z-50 w-52 rounded-xl border border-cs-line/15 bg-cs-darkest/95 backdrop-blur-xl p-1.5">
            {options.map(([val, text]) => {
              const selected = value === val;
              return (
                <button
                  key={val}
                  type="button"
                  onClick={() => { onChange(val); setOpen(false); }}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg font-mono text-xs transition-all ${
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
