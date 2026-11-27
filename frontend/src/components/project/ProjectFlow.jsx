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

// Light outlined field used across the project steps (no grey fill).
export const FIELD = 'w-full rounded-lg border border-cs-line/15 bg-transparent px-3.5 py-2.5 text-[0.9375rem] outline-none placeholder:text-cs-text-muted focus:border-cs-primary/60 transition-colors';

const SectionTitle = ({ children, hint }) => (
  <div className="mb-2">
    <h3 className="text-[0.9375rem] font-semibold">{children}</h3>
    {hint && <p className="text-[0.8125rem] text-cs-text-muted">{hint}</p>}
  </div>
);

/** Plan step: a short form on the left, the brief as others will read it on the right. */
export function BriefTab({ brief, setBrief, description, tasks, addTasks, title }) {
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
  const generated = b.requirements?.length > 0;
  const list = generated ? b.requirements : doneWhen;
  const missing = list.filter((t) => !tasks.some((x) => x.text.trim().toLowerCase() === t.trim().toLowerCase()));

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-10 xl:gap-14">
      {/* Left: write it */}
      <div className="space-y-7">
        {generated ? (
          <section>
            <SectionTitle hint="This project came with a brief. Its requirements are your “done when” checks.">Requirements</SectionTitle>
            <ul className="space-y-2">
              {b.requirements.map((r, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm"><FiCheck className="text-cs-green mt-0.5 shrink-0" /> {r}</li>
              ))}
            </ul>
            {b.hints?.length > 0 && (
              <div className="mt-6">
                <SectionTitle>Hints</SectionTitle>
                <ul className="space-y-1.5 text-sm text-cs-text-dim">{b.hints.map((h, i) => <li key={i}>• {h}</li>)}</ul>
              </div>
            )}
          </section>
        ) : (
          <>
            <section>
              <SectionTitle hint="One or two sentences. What is broken, slow or missing today?">What problem does it solve?</SectionTitle>
              <textarea value={b.problem || ''} onChange={(e) => update({ problem: e.target.value })} rows={3}
                placeholder="e.g. Job hunting means checking five sites every morning. This collects new junior Python jobs in one list."
                className={`${FIELD} resize-y leading-6`} />
            </section>
            <section>
              <SectionTitle hint="Knowing who it's for keeps the scope small.">Who is it for?</SectionTitle>
              <input value={b.audience || ''} onChange={(e) => update({ audience: e.target.value })}
                placeholder="e.g. Me and my classmates looking for internships" className={FIELD} />
            </section>
            <section>
              <SectionTitle hint="Small, testable checks. When all are true, it's finished.">Done when…</SectionTitle>
              {doneWhen.length > 0 && (
                <ul className="mb-2 space-y-1">
                  {doneWhen.map((t, i) => (
                    <li key={i} className="group flex items-center gap-2.5 py-1.5 text-sm">
                      <span className="w-4 h-4 rounded-full bg-cs-green/15 text-cs-green grid place-items-center shrink-0"><FiCheck className="text-[0.625rem]" strokeWidth={4} /></span>
                      <span className="flex-1">{t}</span>
                      <button onClick={() => update({ done_when: doneWhen.filter((_, j) => j !== i) })}
                        className="text-cs-text-muted hover:text-cs-red opacity-0 group-hover:opacity-100" aria-label="Remove"><FiX /></button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="relative">
                <input value={item} onChange={(e) => setItem(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addItem()}
                  placeholder="e.g. It saves the results to a CSV file" className={`${FIELD} pr-20`} />
                <button onClick={addItem} disabled={!item.trim()}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 px-3 rounded-md text-sm font-medium text-cs-primary hover:bg-cs-primary/10 disabled:opacity-40">
                  Add
                </button>
              </div>
            </section>
          </>
        )}
      </div>

      {/* Right: how it reads, and the hand-off to Build */}
      <aside className="lg:sticky lg:top-56 self-start">
        <p className="text-xs font-semibold uppercase tracking-wider text-cs-text-muted mb-2">Brief preview</p>
        <div className="rounded-xl border border-cs-line/10 p-6">
          <h3 className="text-lg font-bold">{title || 'Untitled project'}</h3>
          <p className={`mt-2 text-[0.9375rem] leading-7 ${b.problem || description ? 'text-cs-text-dim' : 'text-cs-text-muted italic'}`}>
            {b.problem || description || 'The problem it solves will appear here.'}
          </p>
          {b.audience && <p className="mt-3 text-sm"><span className="text-cs-text-muted">For: </span>{b.audience}</p>}
          <div className="mt-5 pt-4 border-t border-cs-line/10">
            <p className="text-sm font-semibold mb-2">Done when</p>
            {list.length ? (
              <ul className="space-y-1.5">
                {list.map((t, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-cs-text-dim">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-cs-overlay/40 shrink-0" />{t}
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-cs-text-muted italic">Add at least one check.</p>}
          </div>
        </div>
        {list.length > 0 && (
          <button onClick={() => addTasks(missing)} disabled={!missing.length}
            className="mt-4 w-full btn btn-primary btn-sm justify-center disabled:opacity-50">
            <FiCheckSquare /> {missing.length ? `Turn ${missing.length} check${missing.length === 1 ? '' : 's'} into tasks` : 'All checks are tasks'}
          </button>
        )}
      </aside>
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

/** Ship step, full width: links + reflection + ship on the left, README on the right. */
export function ShipTab({ ship, setShip, shipped, onShip, onUnship, readmeInput, stages }) {
  const s = ship || {};
  const update = (patch) => setShip({ ...s, ...patch });
  const [view, setView] = useState(s.readme ? 'preview' : 'write');
  const repoOk = isUrl(s.repo_url);
  const demoBad = s.demo_url && !isUrl(s.demo_url);
  const notReady = ['plan', 'build', 'review'].filter((k) => !stages[k]);
  const urlBox = (bad) => `flex items-center gap-2.5 rounded-lg border px-3.5 h-11 focus-within:border-cs-primary/60 transition-colors ${bad ? 'border-cs-red' : 'border-cs-line/15'}`;

  return (
    <div className="grid lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] gap-8 xl:gap-12">
      {/* Left: links, reflection, ship */}
      <div className="space-y-6">
        {shipped && (
          <div className="flex items-center gap-3 rounded-xl bg-cs-green/10 text-cs-green px-4 py-3 text-sm font-medium">
            <FiCheck strokeWidth={3} /> Shipped · on your portfolio
            <button onClick={onUnship} className="ml-auto inline-flex items-center gap-1.5 text-cs-text-dim hover:text-cs-text font-normal"><FiRotateCcw /> Reopen</button>
          </div>
        )}
        <label className="block">
          <SectionTitle hint="Required. Push your code to GitHub first.">Repository</SectionTitle>
          <span className={urlBox(s.repo_url && !repoOk)}>
            <FiGithub className="text-cs-text-muted shrink-0" />
            <input value={s.repo_url || ''} onChange={(e) => update({ repo_url: e.target.value })}
              placeholder="https://github.com/you/project" className="flex-1 min-w-0 bg-transparent outline-none text-[0.9375rem]" />
          </span>
        </label>
        <label className="block">
          <SectionTitle hint="Optional. A live link people can click.">Live demo</SectionTitle>
          <span className={urlBox(demoBad)}>
            <FiGlobe className="text-cs-text-muted shrink-0" />
            <input value={s.demo_url || ''} onChange={(e) => update({ demo_url: e.target.value })}
              placeholder="https://…" className="flex-1 min-w-0 bg-transparent outline-none text-[0.9375rem]" />
          </span>
        </label>
        <section>
          <SectionTitle hint="Interviewers ask this. Two or three honest lines.">What would you do differently?</SectionTitle>
          <textarea value={s.reflection || ''} onChange={(e) => update({ reflection: e.target.value })} rows={4}
            placeholder="e.g. I'd write tests first. Scraping broke twice when the site changed its HTML."
            className={`${FIELD} resize-y leading-6`} />
        </section>
        {!shipped && (
          <div className="pt-5 border-t border-cs-line/10">
            <button onClick={onShip} disabled={!repoOk || demoBad}
              className="btn btn-primary w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed">
              <FiSend /> Ship it
            </button>
            <p className="mt-2 text-[0.8125rem] text-cs-text-muted text-center">
              {!repoOk ? 'Add a repository link to ship.'
                : notReady.length ? `You can ship now. Still open: ${notReady.join(', ')}.`
                  : 'Marks it Done and adds it to your portfolio.'}
            </p>
          </div>
        )}
      </div>

      {/* Right: README, full height */}
      <section className="flex flex-col min-h-[28rem] lg:h-[calc(100vh-17rem)]">
        <div className="flex flex-wrap items-end gap-3 mb-2">
          <SectionTitle hint="The first thing a recruiter reads. Put it in README.md in your repo.">README</SectionTitle>
          <div className="ml-auto flex items-center gap-1">
            <button onClick={() => { update({ readme: draftReadme({ ...readmeInput, ship: s }) }); setView('write'); }}
              className="h-8 px-3 rounded-lg text-sm text-cs-text-dim hover:text-cs-text hover:bg-cs-overlay/[0.05] inline-flex items-center gap-1.5">
              <FiFileText /> {s.readme ? 'Redraft' : 'Draft for me'}
            </button>
            <span className="inline-flex p-0.5 rounded-lg border border-cs-line/15 text-sm">
              {['write', 'preview'].map((v) => (
                <button key={v} onClick={() => setView(v)}
                  className={`h-7 px-3 rounded-md capitalize ${view === v ? 'bg-cs-overlay/[0.08] font-medium' : 'text-cs-text-dim hover:text-cs-text'}`}>
                  {v}
                </button>
              ))}
            </span>
          </div>
        </div>
        {view === 'preview' ? (
          <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-cs-line/10 px-7 py-6">
            {s.readme ? <Markdown text={s.readme} /> : <p className="text-sm text-cs-text-muted italic">Nothing yet. Click “Draft for me”.</p>}
          </div>
        ) : (
          <textarea value={s.readme || ''} onChange={(e) => update({ readme: e.target.value })}
            placeholder="Click “Draft for me” to start from your brief and tasks."
            className="flex-1 min-h-0 w-full rounded-xl border border-cs-line/15 bg-transparent px-5 py-4 font-mono text-[0.8125rem] leading-6 resize-none outline-none focus:border-cs-primary/60" />
        )}
      </section>
    </div>
  );
}
