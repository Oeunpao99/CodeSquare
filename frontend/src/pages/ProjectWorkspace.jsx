import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  FiStar, FiTrash2, FiDownload, FiPlay, FiPlus, FiCheck, FiX, FiArrowRight, FiCode, FiTerminal, FiZap,
} from 'react-icons/fi';
import SelectMenu from '../components/SelectMenu';
import { toast } from '../utils/toast';
import { projectService } from '../services/api';
import ConfirmDialog from '../components/ConfirmDialog';
import CodeEditor from '../components/CodeEditor';
import Markdown from '../components/Markdown';
import LangLogo from '../components/LangLogo';
import { editorMode, stackFile } from '../projectStacks';
import { useCrumbNames } from '../utils/crumbs';
import { STAGES, stageState, BriefTab, ShipTab } from '../components/project/ProjectFlow';
import FileExplorer, { languageFor } from '../components/project/FileExplorer';

const download = (name, text) => {
  const blob = new Blob([text ?? ''], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** Tasks + notes beside the editor, so building happens on one screen. */
function BuildSide({ tasks, setTasks, notes, setNotes }) {
  const [panel, setPanel] = useState('tasks');
  const [text, setText] = useState('');
  const [previewNotes, setPreviewNotes] = useState(false);
  const done = tasks.filter((t) => t.done).length;
  const add = () => {
    const t = text.trim();
    if (!t) return;
    setTasks((prev) => [...prev, { id: Date.now(), text: t, done: false }]);
    setText('');
  };
  return (
    <aside className="flex flex-col min-h-0 rounded-xl border border-cs-line/10">
      <div className="flex gap-5 px-4 border-b border-cs-line/10">
        {[['tasks', `Tasks${tasks.length ? ` ${done}/${tasks.length}` : ''}`], ['notes', 'Notes']].map(([k, label]) => (
          <button key={k} onClick={() => setPanel(k)}
            className={`relative h-10 text-sm transition-colors ${panel === k ? 'text-cs-primary' : 'text-cs-text-dim hover:text-cs-text'}`}>
            {label}
            {panel === k && <span className="absolute left-0 right-0 bottom-0 h-0.5 bg-cs-primary" />}
          </button>
        ))}
        {panel === 'notes' && notes.trim() && (
          <button onClick={() => setPreviewNotes((v) => !v)} className="ml-auto text-xs text-cs-text-muted hover:text-cs-text">
            {previewNotes ? 'Edit' : 'Preview'}
          </button>
        )}
      </div>

      {panel === 'tasks' ? (
        <div className="flex-1 min-h-0 flex flex-col">
          {tasks.length > 0 && (
            <div className="px-4 pt-3">
              <div className="h-1 rounded-full bg-cs-overlay/[0.1] overflow-hidden">
                <div className="h-full rounded-full bg-cs-green transition-all" style={{ width: `${(done / tasks.length) * 100}%` }} />
              </div>
            </div>
          )}
          <ul className="flex-1 overflow-y-auto py-2">
            {tasks.length === 0 && (
              <li className="px-4 py-6 text-sm text-cs-text-muted text-center">No tasks yet. Add one below, or turn your Plan checks into tasks.</li>
            )}
            {tasks.map((t) => (
              <li key={t.id} className="group flex items-start gap-2.5 px-4 py-2 hover:bg-cs-overlay/[0.03]">
                <button
                  onClick={() => setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)))}
                  aria-label={t.done ? 'Mark not done' : 'Mark done'}
                  className={`mt-0.5 w-4 h-4 rounded border grid place-items-center shrink-0 transition-colors ${
                    t.done ? 'bg-cs-green border-cs-green text-white' : 'border-cs-line/30 hover:border-cs-primary'
                  }`}
                >
                  {t.done && <FiCheck className="text-[0.625rem]" strokeWidth={4} />}
                </button>
                <span className={`flex-1 text-sm leading-5 ${t.done ? 'line-through text-cs-text-muted' : ''}`}>{t.text}</span>
                <button onClick={() => setTasks((prev) => prev.filter((x) => x.id !== t.id))} aria-label="Remove task"
                  className="text-cs-text-muted opacity-0 group-hover:opacity-100 hover:!text-cs-red"><FiX /></button>
              </li>
            ))}
          </ul>
          <div className="p-3 border-t border-cs-line/10 flex gap-2">
            <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()}
              placeholder="Add a task…"
              className="flex-1 min-w-0 h-9 px-3 rounded-lg border border-cs-line/15 bg-transparent text-sm outline-none focus:border-cs-primary/60" />
            <button onClick={add} className="w-9 h-9 rounded-lg grid place-items-center bg-cs-primary text-white" aria-label="Add task"><FiPlus /></button>
          </div>
        </div>
      ) : previewNotes ? (
        <div className="flex-1 overflow-y-auto p-4"><Markdown text={notes} /></div>
      ) : (
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder={'Decisions, links, things you learned…\n\nMarkdown works.'}
          className="flex-1 min-h-0 p-4 bg-transparent font-mono text-[0.8125rem] leading-6 resize-none outline-none" />
      )}
    </aside>
  );
}

/**
 * Shown while the AI review runs. The request is a single call, so the number is
 * an estimate: it eases toward 95% and only reaches 100 when the answer arrives.
 */
const REVIEW_PHASES = [
  [0, 'Reading your code'],
  [25, 'Checking structure and naming'],
  [50, 'Looking for bugs and edge cases'],
  [75, 'Writing feedback'],
];
const FLYERS = [FiCode, FiTerminal, FiZap, FiCheck, FiCode, FiTerminal, FiZap];

function ReviewProgress({ file }) {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const t = setInterval(() => {
      const secs = (Date.now() - started) / 1000;
      setPct(Math.min(95, Math.round(95 * (1 - Math.exp(-secs / 9)))));
    }, 200);
    return () => clearInterval(t);
  }, []);
  const phase = [...REVIEW_PHASES].reverse().find(([at]) => pct >= at)[1];

  return (
    <div className="relative overflow-hidden rounded-xl border border-cs-line/10 bg-cs-primary/[0.04] py-14 px-6 text-center">
      {/* code icons floating up */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {FLYERS.map((Icon, i) => (
          <span key={i} className="absolute bottom-0 class-drift text-cs-primary/40"
            style={{ left: `${8 + i * 13}%`, animationDelay: `${(i * 0.9) % 6}s`, fontSize: `${1 + (i % 3) * 0.35}rem` }}>
            <Icon />
          </span>
        ))}
      </div>

      <div className="relative">
        <span className="w-14 h-14 mx-auto rounded-2xl bg-cs-primary text-white grid place-items-center text-2xl shadow-lg shadow-cs-primary/30 class-bob">
          <FiZap />
        </span>
        <p className="mt-5 text-5xl font-bold tabular-nums">{pct}<span className="text-2xl text-cs-text-muted">%</span></p>
        <p className="mt-2 text-[0.9375rem] font-medium">{phase}…</p>
        <p className="text-sm text-cs-text-muted">Reviewing <span className="font-mono">{file}</span>. This usually takes 10–30 seconds.</p>
        <div className="mt-6 mx-auto max-w-md h-1.5 rounded-full bg-cs-overlay/[0.1] overflow-hidden">
          <div className="h-full rounded-full bg-cs-primary transition-[width] duration-200 ease-out" style={{ width: `${pct}%` }} />
        </div>
        <ol className="mt-5 flex justify-center gap-5 text-xs text-cs-text-muted flex-wrap">
          {REVIEW_PHASES.map(([at, label]) => (
            <li key={at} className={`inline-flex items-center gap-1.5 ${pct >= at ? 'text-cs-text' : ''}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${pct >= at ? 'bg-cs-primary' : 'bg-cs-overlay/25'}`} />{label}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function ProjectWorkspace() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [step, setStep] = useState('plan');
  const [reviewing, setReviewing] = useState(false);
  const [saveState, setSaveState] = useState('saved'); // saved | saving | dirty
  const [exportOpen, setExportOpen] = useState(false);

  // editable state
  const [title, setTitle] = useState('');
  // Files: [{path, content}]. `entry` is the main file; `active` is the one open.
  const [files, setFiles] = useState([]);
  const [entry, setEntry] = useState('');
  const [active, setActive] = useState('');
  const [pendingFileDelete, setPendingFileDelete] = useState(null);
  const code = files.find((f) => f.path === entry)?.content ?? '';
  const activeContent = files.find((f) => f.path === active)?.content ?? '';
  const setActiveContent = (v) => setFiles((fs) => fs.map((f) => (f.path === active ? { ...f, content: v } : f)));
  const [notes, setNotes] = useState('');
  const [tasks, setTasks] = useState([]);
  const [status, setStatus] = useState('active');
  const [pinned, setPinned] = useState(false);
  const [brief, setBrief] = useState(null);
  const [ship, setShip] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(false);
  useCrumbNames(project ? { [String(id)]: title || project.title } : null);

  const loadedRef = useRef(false);
  const saveTimer = useRef(0);

  useEffect(() => {
    loadedRef.current = false;
    setLoading(true);
    projectService
      .get(id)
      .then((res) => {
        const p = res.data;
        setProject(p);
        setTitle(p.title);
        const fs = p.files?.length ? p.files : [{ path: stackFile(p.language), content: p.code || '' }];
        const main = p.entry && fs.some((f) => f.path === p.entry) ? p.entry : fs[0].path;
        setFiles(fs);
        setEntry(main);
        setActive(main);
        setNotes(p.notes || '');
        setTasks(p.tasks || []);
        setStatus(p.status || 'active');
        setPinned(!!p.pinned);
        setBrief(p.brief || null);
        setShip(p.ship || null);
        // open the first unfinished step
        const st = stageState({ brief: p.brief, code: p.code, tasks: p.tasks || [], review: p.ai_review, ship: p.ship, status: p.status });
        setStep((STAGES.find((x) => !st[x.id]) || STAGES[1]).id);
        setTimeout(() => { loadedRef.current = true; }, 0);
      })
      .catch((err) => {
        if (err.response?.status === 404) setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const patch = useCallback(
    async (body) => {
      setSaveState('saving');
      try {
        await projectService.update(id, body);
        setSaveState('saved');
      } catch (e) {
        setSaveState('dirty');
        toast.error(e.response?.data?.detail || 'Autosave failed');
      }
    },
    [id]
  );

  // debounced autosave
  useEffect(() => {
    if (!loadedRef.current) return;
    setSaveState('dirty');
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      patch({ title, files, entry, code, notes, tasks, status, pinned, brief, ship });
    }, 800);
    return () => clearTimeout(saveTimer.current);
  }, [title, files, entry, notes, tasks, status, pinned, brief, ship, patch]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- file operations
  const createFile = (path) => {
    if (files.some((f) => f.path === path)) { setActive(path); return; }
    setFiles((fs) => [...fs, { path, content: '' }]);
    setActive(path);
  };
  const renameFile = (from, to) => {
    if (files.some((f) => f.path === to)) { toast.error('A file with that name already exists'); return; }
    setFiles((fs) => fs.map((f) => (f.path === from ? { ...f, path: to } : f)));
    if (entry === from) setEntry(to);
    if (active === from) setActive(to);
  };
  const deleteFile = (path) => {
    const rest = files.filter((f) => f.path !== path);
    if (!rest.length) return;
    setFiles(rest);
    if (entry === path) setEntry(rest[0].path);
    if (active === path) setActive(entry !== path ? entry : rest[0].path);
  };

  const removeProject = async () => {
    try {
      await projectService.remove(id);
      navigate('/projects');
    } catch {
      toast.error('Could not delete.');
    }
  };

  const runReview = async () => {
    if (!activeContent.trim()) return toast.error('This file is empty. Write some code first.');
    setReviewing(true);
    setStep('review');
    try {
      await patch({ files, entry, code });
      const res = await projectService.review(id, { path: active });
      setProject(res.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Review failed.');
    } finally {
      setReviewing(false);
    }
  };

  const addTasks = (texts) => {
    if (!texts.length) return;
    setTasks((t) => [...t, ...texts.map((text, i) => ({ id: Date.now() + i, text, done: false }))]);
    toast.success(`${texts.length} task${texts.length === 1 ? '' : 's'} added`, 'You’ll find them next to the code in Build.');
  };

  const review = project?.ai_review;
  const stages = stageState({ brief, code, tasks, review, ship, status });
  const file = active || stackFile(project?.language);
  const stepIndex = STAGES.findIndex((s) => s.id === step);
  const nextStep = STAGES[stepIndex + 1];

  // "Done" means shipped, so it goes through the Ship step.
  const changeStatus = (v) => {
    if (v === 'done' && !ship?.repo_url) {
      setStep('ship');
      toast.error('Add your repository link first', 'Then press Ship it.');
      return;
    }
    setStatus(v);
  };
  const shipIt = () => {
    setShip((x) => ({ ...(x || {}), shipped_at: x?.shipped_at || new Date().toISOString() }));
    setStatus('done');
    toast.success('Shipped!', 'Added to your portfolio.');
  };

  if (loading) {
    return (
      <main className="w-full px-6 lg:px-10 py-8">
        <div className="skeleton h-10 w-80 rounded-lg" />
        <div className="skeleton h-12 w-full rounded-lg mt-6" />
        <div className="skeleton h-96 w-full rounded-xl mt-6" />
      </main>
    );
  }
  if (notFound || !project) {
    return (
      <main className="w-full px-6 lg:px-10 py-16 text-center">
        <p className="text-lg text-cs-text-dim mb-4">That project doesn’t exist.</p>
        <Link to="/projects" className="btn btn-primary">Back to Projects</Link>
      </main>
    );
  }

  return (
    <main className="w-full pb-10">
      {/* Header: title + actions, then the four steps as the only navigation */}
      <div className="sticky top-[3.75rem] lg:top-14 z-30 bg-cs-dark/90 backdrop-blur-xl border-b border-cs-line/10 px-6 lg:px-10 pt-5">
        <div className="flex items-center gap-3 flex-wrap">
          <LangLogo name={project.language} className="text-2xl shrink-0" />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Project title"
            className="bg-transparent text-2xl font-bold outline-none border-b border-transparent hover:border-cs-line/20 focus:border-cs-primary/60 min-w-0 flex-grow"
          />
          <span className="text-xs text-cs-text-muted w-14 text-right">
            {saveState === 'saving' ? 'Saving…' : saveState === 'dirty' ? 'Unsaved' : 'Saved'}
          </span>
          <SelectMenu
            value={status}
            onChange={changeStatus}
            ariaLabel="Project status"
            align="right"
            buttonClassName="h-8 px-2.5 text-sm min-w-[7.5rem]"
            options={[
              { value: 'active', label: 'Active', dot: 'rgb(var(--cs-primary))' },
              { value: 'done', label: 'Done (shipped)', dot: 'rgb(var(--cs-green))' },
              { value: 'archived', label: 'Archived', dot: 'rgb(var(--cs-overlay) / 0.35)' },
            ]}
          />
          <button onClick={() => setPinned((v) => !v)} title={pinned ? 'Unpin' : 'Pin to top'} aria-label="Pin"
            className={`w-8 h-8 rounded-lg grid place-items-center hover:bg-cs-overlay/[0.05] ${pinned ? 'text-cs-orange' : 'text-cs-text-muted'}`}>
            <FiStar className={pinned ? 'fill-current' : ''} />
          </button>
          <div className="relative">
            <button onClick={() => setExportOpen((v) => !v)} title="Export" aria-label="Export"
              className="w-8 h-8 rounded-lg grid place-items-center text-cs-text-muted hover:text-cs-text hover:bg-cs-overlay/[0.05]">
              <FiDownload />
            </button>
            {exportOpen && (
              <div className="absolute right-0 mt-1 w-44 rounded-lg border border-cs-line/15 bg-cs-darkest shadow-xl z-40 py-1 text-sm"
                onMouseLeave={() => setExportOpen(false)}>
                <button className="w-full text-left px-3 py-2 hover:bg-cs-overlay/5" onClick={() => { download(file.split('/').pop(), activeContent); setExportOpen(false); }}>
                  Download {file.split('/').pop()}
                </button>
                <button className="w-full text-left px-3 py-2 hover:bg-cs-overlay/5" onClick={() => { download('notes.md', notes); setExportOpen(false); }}>
                  Download notes.md
                </button>
                {ship?.readme && (
                  <button className="w-full text-left px-3 py-2 hover:bg-cs-overlay/5" onClick={() => { download('README.md', ship.readme); setExportOpen(false); }}>
                    Download README.md
                  </button>
                )}
              </div>
            )}
          </div>
          <button onClick={() => setPendingDelete(true)} title="Delete project" aria-label="Delete project"
            className="w-8 h-8 rounded-lg grid place-items-center text-cs-text-muted hover:text-cs-red hover:bg-cs-overlay/[0.05]">
            <FiTrash2 />
          </button>
        </div>
        {project.track_slug && (
          <Link to={`/learn/${project.track_slug}`} className="inline-block text-xs text-cs-text-muted hover:text-cs-primary">
            Part of the {project.track_slug} track
          </Link>
        )}

        <nav className="mt-4 flex gap-8 overflow-x-auto" aria-label="Project steps">
          {STAGES.map((s, i) => {
            const active = step === s.id;
            const done = stages[s.id];
            return (
              <button key={s.id} onClick={() => setStep(s.id)}
                className={`relative h-12 inline-flex items-center gap-2 whitespace-nowrap text-[0.9375rem] transition-colors ${
                  active ? 'text-cs-text font-semibold' : 'text-cs-text-dim hover:text-cs-text'
                }`}>
                <span className={`w-5 h-5 rounded-full grid place-items-center text-[0.6875rem] font-bold ${
                  done ? 'bg-cs-green text-white' : active ? 'bg-cs-primary text-white' : 'bg-cs-overlay/[0.08] text-cs-text-dim'
                }`}>
                  {done ? <FiCheck strokeWidth={4} /> : i + 1}
                </span>
                {s.label}
                {s.id === 'build' && tasks.length > 0 && (
                  <span className="text-xs font-normal text-cs-text-muted">{tasks.filter((x) => x.done).length}/{tasks.length}</span>
                )}
                {active && <span className="absolute left-0 right-0 bottom-0 h-0.5 bg-cs-primary" />}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="px-6 lg:px-10 pt-6">
        {/* What this step is for */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-5">
          <p className="text-sm text-cs-text-dim">
            <span className="text-cs-text-muted">Step {stepIndex + 1} of 4 · </span>{STAGES[stepIndex].todo}
          </p>
          {stages[step] && step !== 'ship' && nextStep && (
            <button onClick={() => setStep(nextStep.id)} className="ml-auto inline-flex items-center gap-1.5 text-sm font-medium text-cs-primary hover:underline">
              Next: {nextStep.label} <FiArrowRight />
            </button>
          )}
        </div>

        {step === 'plan' && (
          <BriefTab brief={brief} setBrief={setBrief} description={project.description} tasks={tasks} addTasks={addTasks} title={title} />
        )}

        {step === 'build' && (
          <div className="grid lg:grid-cols-[15rem_minmax(0,1fr)_18rem] gap-4 h-[calc(100vh-17rem)] min-h-[28rem]">
            <div className="hidden lg:flex flex-col min-h-0 rounded-xl border border-cs-line/10 bg-cs-overlay/[0.02]">
              <FileExplorer
                files={files}
                active={active}
                entry={entry}
                onOpen={setActive}
                onCreate={createFile}
                onRename={renameFile}
                onDelete={(p) => setPendingFileDelete(p)}
                onSetEntry={(p) => { setEntry(p); toast.success('Main file set', p); }}
              />
            </div>
            <div className="rounded-xl border border-cs-line/10 bg-cs-darkest overflow-hidden flex flex-col min-h-0">
              <div className="flex items-center gap-2 px-4 h-11 border-b border-cs-line/10">
                <span className="font-mono text-xs text-cs-text-muted truncate">
                  {active.split('/').map((part, i, arr) => (
                    <span key={i} className={i === arr.length - 1 ? 'text-cs-text' : ''}>{part}{i < arr.length - 1 ? ' / ' : ''}</span>
                  ))}
                </span>
                {active === entry && <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-cs-orange">main</span>}
                {/* phones: file picker instead of the explorer */}
                <select value={active} onChange={(e) => setActive(e.target.value)} className="lg:hidden ml-2 max-w-[10rem] bg-transparent text-xs border border-cs-line/15 rounded px-1">
                  {files.map((f) => <option key={f.path} value={f.path}>{f.path}</option>)}
                </select>
                <button onClick={runReview} disabled={reviewing} className="btn btn-ghost btn-sm ml-auto" title="AI review of this file">
                  <FiPlay /> {reviewing ? 'Reviewing…' : 'AI review'}
                </button>
              </div>
              <div className="flex-1 min-h-0">
                <CodeEditor key={active} compact value={activeContent} onChange={setActiveContent} language={languageFor(active)} onSubmit={() => { if (!reviewing) runReview(); }} />
              </div>
            </div>
            <BuildSide tasks={tasks} setTasks={setTasks} notes={notes} setNotes={setNotes} />
          </div>
        )}

        {step === 'review' && (
          <div className="max-w-5xl">
            {reviewing ? (
              <ReviewProgress file={file} />
            ) : review ? (
              <>
                <div className="flex items-end gap-4">
                  <span className={`text-5xl font-bold tabular-nums ${review.score >= 70 ? 'text-cs-green' : 'text-cs-orange'}`}>
                    {Math.round(review.score)}<span className="text-cs-text-muted text-lg font-medium">/100</span>
                  </span>
                  <button onClick={runReview} disabled={reviewing} className="btn btn-ghost btn-sm ml-auto">
                    <FiPlay /> {reviewing ? 'Reviewing…' : 'Run again'}
                  </button>
                </div>
                <div className="h-1.5 bg-cs-overlay/[0.1] rounded-full overflow-hidden mt-3 mb-6">
                  <div className={`h-full rounded-full ${review.score >= 70 ? 'bg-cs-green' : 'bg-cs-orange'}`} style={{ width: `${review.score}%` }} />
                </div>
                <p className="text-[0.9375rem] leading-7 text-cs-text-dim whitespace-pre-wrap">{review.feedback}</p>
                <div className="grid sm:grid-cols-2 gap-8 mt-7">
                  {review.suggestions?.length > 0 && (
                    <section>
                      <h3 className="text-sm font-semibold mb-2">Improve</h3>
                      <ul className="space-y-2 text-sm text-cs-text-dim">
                        {review.suggestions.map((s, i) => <li key={i} className="flex gap-2"><span className="text-cs-orange">•</span>{s}</li>)}
                      </ul>
                      <button onClick={() => addTasks(review.suggestions)} className="mt-3 text-sm text-cs-primary hover:underline">Add these as tasks</button>
                    </section>
                  )}
                  {review.improvements?.length > 0 && (
                    <section>
                      <h3 className="text-sm font-semibold mb-2">Done well</h3>
                      <ul className="space-y-2 text-sm text-cs-text-dim">
                        {review.improvements.map((s, i) => <li key={i} className="flex gap-2"><FiCheck className="text-cs-green mt-0.5 shrink-0" />{s}</li>)}
                      </ul>
                    </section>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-14 rounded-xl border border-dashed border-cs-line/20">
                <p className="text-cs-text-dim mb-4">Get feedback on your code like a pull-request review: what works, what to fix.</p>
                <button onClick={runReview} disabled={reviewing || !code.trim()} className="btn btn-primary btn-sm disabled:opacity-50">
                  <FiPlay /> {reviewing ? 'Reviewing…' : 'Run AI review'}
                </button>
                {!code.trim() && <p className="text-xs text-cs-text-muted mt-3">Write some code in Build first.</p>}
              </div>
            )}
          </div>
        )}

        {step === 'ship' && (
          <ShipTab
            ship={ship}
            setShip={setShip}
            shipped={stages.ship}
            stages={stages}
            onShip={shipIt}
            onUnship={() => setStatus('active')}
            readmeInput={{ title, description: project.description, language: project.language, brief, tasks }}
          />
        )}
      </div>

      {pendingFileDelete && (
        <ConfirmDialog
          title="Delete file"
          message={`Delete ${pendingFileDelete}? You can't undo this.`}
          onConfirm={() => deleteFile(pendingFileDelete)}
          onClose={() => setPendingFileDelete(null)}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Delete project"
          message={`Delete “${title}”? This can't be undone.`}
          onConfirm={removeProject}
          onClose={() => setPendingDelete(false)}
        />
      )}
    </main>
  );
}

export default ProjectWorkspace;
