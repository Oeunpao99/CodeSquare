import React, { useState } from 'react';
import {
  FiCheck, FiPlus, FiX, FiClipboard, FiTool, FiZap, FiSend, FiGithub, FiGlobe,
  FiFileText, FiArrowRight, FiCheckSquare, FiRotateCcw,
} from 'react-icons/fi';
import Markdown from '../Markdown';

// The four stages every project goes through, the way real developers work:
// define it → build it → get feedback → ship it.
export const STAGES = [
  { id: 'plan', label: 'Plan', icon: FiClipboard, tab: 'brief', todo: 'Write the problem and what “done” means.' },
  { id: 'build', label: 'Build', icon: FiTool, tab: 'tasks', todo: 'Write the code and tick off every task.' },
  { id: 'review', label: 'Review', icon: FiZap, tab: 'review', todo: 'Run an AI review and fix what it finds.' },
  { id: 'ship', label: 'Ship', icon: FiSend, tab: 'ship', todo: 'Add your GitHub link and ship it to your portfolio.' },
];

export function stageState({ brief, code, tasks, review, ship, status }) {
  const doneWhen = brief?.done_when || [];
  return {
    plan: !!brief?.requirements?.length || (!!(brief?.problem || '').trim() && doneWhen.length > 0),
    build: !!(code || '').trim() && tasks.length > 0 && tasks.every((t) => t.done),
    review: !!review,
    ship: status === 'done' && !!ship?.repo_url,
  };
}

/** Plan → Build → Review → Ship progress bar. Each step opens its tab. */
export function Stepper({ state, onOpen }) {
  const next = STAGES.find((s) => !state[s.id]);
  return (
    <div className="mt-4">
      <ol className="flex items-center gap-2">
        {STAGES.map((s, i) => {
          const done = state[s.id];
          const current = next?.id === s.id;
          return (
            <li key={s.id} className="flex items-center gap-2 flex-1 min-w-0">
              <button
                type="button"
                onClick={() => onOpen(s.tab)}
                className={`flex items-center gap-2 min-w-0 rounded-lg px-2 py-1 -mx-2 hover:bg-cs-overlay/[0.05] transition-colors ${
                  current ? 'text-cs-text' : done ? 'text-cs-text-dim' : 'text-cs-text-muted'
                }`}
              >
                <span className={`w-7 h-7 rounded-full grid place-items-center shrink-0 text-sm transition-colors ${
                  done ? 'bg-cs-green text-white' : current ? 'bg-cs-primary text-white ring-4 ring-cs-primary/15' : 'border border-cs-line/20'
                }`}>
                  {done ? <FiCheck strokeWidth={3} /> : <s.icon />}
                </span>
                <span className={`text-sm truncate ${current ? 'font-semibold' : 'font-medium'}`}>{s.label}</span>
              </button>
              {i < STAGES.length - 1 && (
                <span className={`flex-1 h-0.5 rounded-full min-w-4 ${done ? 'bg-cs-green' : 'bg-cs-overlay/[0.1]'}`} />
              )}
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-[0.8125rem] text-cs-text-dim">
        {next
          ? <>Next: {next.todo} <button onClick={() => onOpen(next.tab)} className="text-cs-primary hover:underline">Go <FiArrowRight className="inline -mt-0.5" /></button></>
          : <span className="text-cs-green font-medium">Shipped. This project is on your portfolio.</span>}
      </p>
    </div>
  );
}

const SectionTitle = ({ children, hint }) => (
  <div className="mb-2">
    <h3 className="text-[0.9375rem] font-semibold">{children}</h3>
    {hint && <p className="text-[0.8125rem] text-cs-text-muted">{hint}</p>}
  </div>
);

/** Plan step. AI projects show their generated brief; blank ones get a short form. */
export function BriefTab({ brief, setBrief, description, tasks, addTasks }) {
  const [item, setItem] = useState('');
  const b = brief || {};
  const doneWhen = b.done_when || [];
  const update = (patch) => setBrief({ ...b, ...patch });
  const addItem = () => {
    const t = item.trim();
    if (!t) return;
    update({ done_when: [...doneWhen, t] });
    setItem('');
  };
  const list = b.requirements?.length ? b.requirements : doneWhen;
  const missing = list.filter((t) => !tasks.some((x) => x.text.trim().toLowerCase() === t.trim().toLowerCase()));

  return (
    <div className="max-w-3xl space-y-7">
      {b.requirements?.length > 0 && (
        <section>
          {description && <p className="text-cs-text-dim mb-4">{description}</p>}
          {b.estimated_time && <span className="badge badge-cyan mb-4 inline-block">{b.estimated_time}</span>}
          <SectionTitle hint="Generated with the project. These are your “done when” checks.">Requirements</SectionTitle>
          <ul className="space-y-1.5">
            {b.requirements.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-cs-text-dim"><FiCheck className="text-cs-green mt-0.5 shrink-0" /> {r}</li>
            ))}
          </ul>
          {b.hints?.length > 0 && (
            <div className="mt-5">
              <SectionTitle>Hints</SectionTitle>
              <ul className="space-y-1 text-sm text-cs-text-dim">{b.hints.map((h, i) => <li key={i}>• {h}</li>)}</ul>
            </div>
          )}
        </section>
      )}

      {!b.requirements?.length && (
        <>
          <section>
            <SectionTitle hint="One or two sentences. What is broken, slow or missing today?">What problem does it solve?</SectionTitle>
            <textarea value={b.problem || ''} onChange={(e) => update({ problem: e.target.value })} rows={3}
              placeholder="e.g. Job hunting means checking five sites every morning. This collects new junior Python jobs in one list."
              className="input w-full resize-y" />
          </section>
          <section>
            <SectionTitle hint="Who would use it? Knowing this keeps the scope small.">Who is it for?</SectionTitle>
            <input value={b.audience || ''} onChange={(e) => update({ audience: e.target.value })}
              placeholder="e.g. Me and my classmates looking for internships" className="input w-full" />
          </section>
          <section>
            <SectionTitle hint="Small, testable checks. When all are true, the project is finished.">Done when…</SectionTitle>
            {doneWhen.length > 0 && (
              <ul className="mb-2 rounded-xl border border-cs-line/10 divide-y divide-cs-line/10">
                {doneWhen.map((t, i) => (
                  <li key={i} className="group flex items-center gap-3 px-4 py-2.5 text-sm">
                    <FiCheck className="text-cs-green shrink-0" />
                    <span className="flex-1">{t}</span>
                    <button onClick={() => update({ done_when: doneWhen.filter((_, j) => j !== i) })}
                      className="text-cs-text-muted hover:text-cs-red opacity-0 group-hover:opacity-100" aria-label="Remove"><FiX /></button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <input value={item} onChange={(e) => setItem(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addItem()}
                placeholder="e.g. It saves the results to a CSV file" className="input flex-1" />
              <button onClick={addItem} className="btn btn-ghost btn-sm"><FiPlus /> Add</button>
            </div>
          </section>
        </>
      )}

      {list.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button onClick={() => addTasks(missing)} disabled={!missing.length} className="btn btn-primary btn-sm">
            <FiCheckSquare /> {missing.length ? `Turn ${missing.length} into tasks` : 'All added as tasks'}
          </button>
          <span className="text-[0.8125rem] text-cs-text-muted">Each check becomes a task you tick off while building.</span>
        </div>
      )}
    </div>
  );
}

export function draftReadme({ title, description, language, brief, tasks, ship }) {
  const b = brief || {};
  const features = (b.requirements?.length ? b.requirements : b.done_when || []).length
    ? (b.requirements?.length ? b.requirements : b.done_when)
    : tasks.filter((t) => t.done).map((t) => t.text);
  const lines = [`# ${title}`, ''];
  lines.push(description || b.problem || 'A short sentence on what this project does.', '');
  if (b.problem && description) lines.push('## Why', '', b.problem, '');
  if (b.audience) lines.push('## Who it’s for', '', b.audience, '');
  if (features.length) lines.push('## Features', '', ...features.map((f) => `- ${f}`), '');
  lines.push('## Tech', '', `- ${language}`, '');
  lines.push('## Run it locally', '', '```bash', 'git clone ' + (ship?.repo_url || '<your-repo-url>'), '# then: install dependencies and run', '```', '');
  if (ship?.demo_url) lines.push('## Live demo', '', ship.demo_url, '');
  lines.push('## What I learned', '', ship?.reflection || '- ', '');
  return lines.join('\n');
}

const isUrl = (v) => /^https?:\/\/\S+\.\S+/i.test((v || '').trim());

/** Ship step: links, README, reflection, then one button to ship. */
export function ShipTab({ ship, setShip, shipped, onShip, onUnship, readmeInput, stages }) {
  const s = ship || {};
  const update = (patch) => setShip({ ...s, ...patch });
  const [preview, setPreview] = useState(false);
  const repoOk = isUrl(s.repo_url);
  const demoBad = s.demo_url && !isUrl(s.demo_url);
  const notReady = ['plan', 'build', 'review'].filter((k) => !stages[k]);

  return (
    <div className="max-w-3xl space-y-7">
      {shipped && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-cs-green/10 text-cs-green px-4 py-3 text-sm font-medium">
          <FiCheck strokeWidth={3} /> Shipped. It’s on your portfolio and counts toward Job Readiness.
          <button onClick={onUnship} className="ml-auto inline-flex items-center gap-1.5 text-cs-text-dim hover:text-cs-text font-normal"><FiRotateCcw /> Reopen</button>
        </div>
      )}

      <section className="grid sm:grid-cols-2 gap-4">
        <label className="block">
          <SectionTitle hint="Required. Push your code to GitHub first.">Repository</SectionTitle>
          <span className={`flex items-center gap-2 input ${s.repo_url && !repoOk ? '!border-cs-red' : ''}`}>
            <FiGithub className="text-cs-text-muted shrink-0" />
            <input value={s.repo_url || ''} onChange={(e) => update({ repo_url: e.target.value })}
              placeholder="https://github.com/you/project" className="flex-1 min-w-0 bg-transparent outline-none" />
          </span>
        </label>
        <label className="block">
          <SectionTitle hint="Optional. A live link people can click.">Live demo</SectionTitle>
          <span className={`flex items-center gap-2 input ${demoBad ? '!border-cs-red' : ''}`}>
            <FiGlobe className="text-cs-text-muted shrink-0" />
            <input value={s.demo_url || ''} onChange={(e) => update({ demo_url: e.target.value })}
              placeholder="https://…" className="flex-1 min-w-0 bg-transparent outline-none" />
          </span>
        </label>
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-2 mb-2">
          <SectionTitle hint="The first thing a recruiter reads. Copy it into README.md in your repo.">README</SectionTitle>
          <div className="flex items-center gap-2">
            <button onClick={() => update({ readme: draftReadme({ ...readmeInput, ship: s }) })} className="btn btn-ghost btn-sm">
              <FiFileText /> {s.readme ? 'Redraft' : 'Draft for me'}
            </button>
            {s.readme && (
              <button onClick={() => setPreview((v) => !v)} className="btn btn-ghost btn-sm">{preview ? 'Edit' : 'Preview'}</button>
            )}
          </div>
        </div>
        {preview && s.readme ? (
          <div className="rounded-xl border border-cs-line/10 p-5 max-h-[28rem] overflow-y-auto"><Markdown text={s.readme} /></div>
        ) : (
          <textarea value={s.readme || ''} onChange={(e) => update({ readme: e.target.value })} rows={10}
            placeholder="Click “Draft for me” to start from your brief and tasks."
            className="input w-full font-mono text-[0.8125rem] leading-6 resize-y" />
        )}
      </section>

      <section>
        <SectionTitle hint="Interviewers ask this. Two or three honest lines are enough.">What would you do differently?</SectionTitle>
        <textarea value={s.reflection || ''} onChange={(e) => update({ reflection: e.target.value })} rows={3}
          placeholder="e.g. I'd write tests first. Scraping broke twice when the site changed its HTML."
          className="input w-full resize-y" />
      </section>

      {!shipped && (
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-cs-line/10">
          <button onClick={onShip} disabled={!repoOk || demoBad} className="btn btn-primary mt-4 disabled:opacity-50 disabled:cursor-not-allowed">
            <FiSend /> Ship it
          </button>
          <span className="text-[0.8125rem] text-cs-text-muted mt-4">
            {!repoOk ? 'Add a repository link to ship.'
              : notReady.length ? `You can ship now, but ${notReady.join(', ')} ${notReady.length === 1 ? 'isn’t' : 'aren’t'} finished yet.`
                : 'Marks it Done and adds it to your portfolio.'}
          </span>
        </div>
      )}
    </div>
  );
}
