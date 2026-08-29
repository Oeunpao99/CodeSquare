import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { quizService, lessonService } from '../services/api';
import {
  FiHelpCircle, FiChevronRight, FiCheckCircle, FiZap, FiAward, FiBarChart2,
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
        <span className="mono-label">// practice</span>
        <h1 className="text-3xl font-bold mt-2 flex items-center gap-3">
          <FiHelpCircle className="text-cs-primary" /> Quizzes
        </h1>

        <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-cs-line/10">
          <span className="mono-label text-cs-text-dim px-1">// filter</span>
          <FilterTabs label="lang" value={fLang} onChange={setFLang}
            options={[['', 'all'], ...LANGS.map((s) => [s, langLabel(s)])]} />
          <FilterTabs label="level" value={fDiff} onChange={setFDiff}
            options={[['', 'all'], ...DIFFS.map((d) => [d, d])]} />
          {topics.length > 0 && (
            <FilterTabs label="topic" value={fTopic} onChange={setFTopic}
              options={[['', 'all'], ...topics.map((t) => [t, t])]} />
          )}
          {(fLang || fDiff || fTopic) && (
            <button
              onClick={() => { setFLang(''); setFDiff(''); setFTopic(''); }}
              className="font-mono text-[10px] text-cs-primary hover:text-cs-mint transition-colors ml-auto px-1"
            >
              clear ✕
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

      {list === null && <p className="text-cs-text-muted font-mono text-sm">Loading quizzes…</p>}

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
        <div className="rounded-xl border border-cs-line/10 bg-cs-darker/40 overflow-hidden">
          {list.map((z, i) => (
            <Link
              key={z.slug}
              to={`/quizzes/${z.slug}`}
              className={`flex items-center gap-3 px-4 py-3 hover:bg-cs-overlay/[0.06] transition-colors group ${
                i > 0 ? 'border-t border-cs-line/10' : ''
              }`}
            >
              <span className={`badge-outline ${DIFF_BADGE[z.difficulty] || 'badge-outline-cyan'} shrink-0`}>
                {z.difficulty}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate group-hover:text-cs-primary transition-colors">
                  {z.title}
                </p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                  <span className="font-mono text-[11px] text-cs-text-muted">
                    {z.question_count} question{z.question_count === 1 ? '' : 's'}
                  </span>
                  {z.topic && <span className="font-mono text-[11px] text-cs-text-muted">{z.topic}</span>}
                  {z.language && (
                    <span className="font-mono text-[11px] text-cs-text-dim inline-flex items-center gap-1">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-cs-cyan/70" /> {z.language}
                    </span>
                  )}
                  {z.best_score > 0 && !z.passed && (
                    <span className="font-mono text-[11px] text-cs-orange">best {z.best_score}%</span>
                  )}
                </div>
              </div>
              <span className="font-mono text-xs text-cs-primary inline-flex items-center gap-0.5 shrink-0">
                <FiZap className="text-[10px]" /> {z.xp_reward}
              </span>
              {z.passed
                ? <FiCheckCircle className="text-cs-green shrink-0" />
                : <FiChevronRight className="text-cs-text-muted group-hover:text-cs-primary shrink-0" />}
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

function FilterTabs({ label, value, onChange, options }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-cs-line/15 bg-cs-overlay/[0.03] px-1.5 py-1">
      <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-cs-text-muted px-1">
        {label}
      </span>
      <div className="flex gap-0.5">
        {options.map(([val, text]) => {
          const active = value === val;
          return (
            <button
              key={val}
              onClick={() => onChange(val)}
              className={`px-2 py-0.5 rounded-md font-mono text-xs transition-all ${
                active
                  ? 'bg-cs-primary/15 text-cs-primary shadow-[0_0_12px_-6px_rgb(var(--cs-primary)/0.6)]'
                  : 'text-cs-text-dim hover:text-cs-text hover:bg-cs-overlay/10'
              }`}
            >
              {text}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default Quizzes;
