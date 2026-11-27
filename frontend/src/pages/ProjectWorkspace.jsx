import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SelectMenu from '../components/SelectMenu';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  FiStar, FiTrash2, FiDownload, FiPlay, FiPlus, FiCheck,
  FiX, FiCode, FiFileText, FiClipboard, FiCheckSquare, FiZap, FiSend,
} from 'react-icons/fi';
import { toast } from '../utils/toast';
import { projectService } from '../services/api';
import ConfirmDialog from '../components/ConfirmDialog';
import CodeEditor from '../components/CodeEditor';
import Markdown from '../components/Markdown';
import LangLogo from '../components/LangLogo';
import { editorMode, stackFile } from '../projectStacks';
import { useCrumbNames } from '../utils/crumbs';
import { STAGES, stageState, Stepper, BriefTab, ShipTab } from '../components/project/ProjectFlow';

// Tabs follow the order of the work: plan, build, review, ship.
const TABS = [
  { id: 'brief', label: 'Brief', icon: FiClipboard },
  { id: 'tasks', label: 'Tasks', icon: FiCheckSquare },
  { id: 'code', label: 'Code', icon: FiCode },
  { id: 'notes', label: 'Notes', icon: FiFileText },
  { id: 'review', label: 'Review', icon: FiZap },
  { id: 'ship', label: 'Ship', icon: FiSend },
];

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

function ProjectWorkspace() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState('code');
  const [reviewing, setReviewing] = useState(false);
  const [saveState, setSaveState] = useState('saved'); // saved | saving | dirty
  const [exportOpen, setExportOpen] = useState(false);

  // editable state
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [notes, setNotes] = useState('');
  const [tasks, setTasks] = useState([]);
  const [status, setStatus] = useState('active');
  const [pinned, setPinned] = useState(false);
  const [brief, setBrief] = useState(null);
  const [ship, setShip] = useState(null);
  const [newTask, setNewTask] = useState('');
  useCrumbNames(project ? { [String(id)]: title || project.title } : null);
  const [pendingDelete, setPendingDelete] = useState(false);

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
        setCode(p.code || '');
        setNotes(p.notes || '');
        setTasks(p.tasks || []);
        setStatus(p.status || 'active');
        setPinned(!!p.pinned);
        setBrief(p.brief || null);
        setShip(p.ship || null);
        // open the first unfinished step
        const st = stageState({ brief: p.brief, code: p.code, tasks: p.tasks || [], review: p.ai_review, ship: p.ship, status: p.status });
        const next = STAGES.find((x) => !st[x.id]);
        setTab(!next ? 'code' : next.id === 'build' ? ((p.tasks || []).length ? 'code' : 'tasks') : next.tab);
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

  // debounced autosave of the frequently-edited fields
  useEffect(() => {
    if (!loadedRef.current) return;
    setSaveState('dirty');
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      patch({ title, code, notes, tasks, status, pinned, brief, ship });
    }, 800);
    return () => clearTimeout(saveTimer.current);
  }, [title, code, notes, tasks, status, pinned, brief, ship, patch]);

  const removeProject = async () => {
    try {
      await projectService.remove(id);
      navigate('/projects');
    } catch {
      toast.error('Could not delete.');
    }
  };

  const runReview = async () => {
    if (!code.trim()) return toast.error('Write some code first.');
    setReviewing(true);
    try {
      const res = await projectService.review(id);
      setProject(res.data);
      setTab('review');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Review failed.');
    } finally {
      setReviewing(false);
    }
  };

  const addTask = () => {
    const text = newTask.trim();
    if (!text) return;
    setTasks((t) => [...t, { id: Date.now(), text, done: false }]);
    setNewTask('');
  };

  const addTasks = (texts) => {
    if (!texts.length) return;
    setTasks((t) => [...t, ...texts.map((text, i) => ({ id: Date.now() + i, text, done: false }))]);
    toast.success(`${texts.length} task${texts.length === 1 ? '' : 's'} added`);
    setTab('tasks');
  };

  const review = project?.ai_review;
  const stages = stageState({ brief, code, tasks, review, ship, status });
  const shipped = stages.ship;

  // "Done" means shipped, so it goes through the Ship step.
  const changeStatus = (v) => {
    if (v === 'done' && !ship?.repo_url) {
      setTab('ship');
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
  const file = useMemo(() => stackFile(project?.language), [project]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-cs-darkest border-t-cs-primary rounded-full animate-spin"></div>
        <p className="text-cs-text-dim">Loading…</p>
      </div>
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
      {/* locked header */}
      <div className="sticky top-[3.75rem] lg:top-14 z-30 bg-cs-dark/85 backdrop-blur-xl border-b border-cs-line/10 px-4 lg:px-6 pt-4 pb-3">
        <div className="flex items-center gap-3 flex-wrap">
          <LangLogo name={project.language} className="text-2xl shrink-0" />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="bg-transparent text-3xl font-bold outline-none border-b border-transparent focus:border-cs-line/20 min-w-0 flex-grow"
          />
          <SelectMenu
            value={status}
            onChange={changeStatus}
            ariaLabel="Project status"
            buttonClassName="h-8 px-2.5 text-sm min-w-[7.5rem]"
            options={[
              { value: 'active', label: 'Active', dot: 'rgb(var(--cs-primary))' },
              { value: 'done', label: 'Done (shipped)', dot: 'rgb(var(--cs-green))' },
              { value: 'archived', label: 'Archived', dot: 'rgb(var(--cs-overlay) / 0.35)' },
            ]}
          />
          <button
            onClick={() => setPinned((v) => !v)}
            className={pinned ? 'text-cs-orange' : 'text-cs-text-muted hover:text-cs-text-muted'}
            title={pinned ? 'Unpin' : 'Pin'}
          >
            <FiStar className={pinned ? 'fill-current' : ''} />
          </button>

          <div className="relative">
            <button
              onClick={() => setExportOpen((v) => !v)}
              className="btn btn-ghost btn-sm"
            >
              <FiDownload /> Export
            </button>
            {exportOpen && (
              <div
                className="absolute right-0 mt-1 w-44 rounded-lg border border-cs-line/15 bg-cs-darkest shadow-xl z-40 py-1 text-sm"
                onMouseLeave={() => setExportOpen(false)}
              >
                <button className="w-full text-left px-3 py-2 hover:bg-cs-overlay/5" onClick={() => { download(file, code); setExportOpen(false); }}>
                  Download {file}
                </button>
                <button className="w-full text-left px-3 py-2 hover:bg-cs-overlay/5" onClick={() => { download('notes.md', notes); setExportOpen(false); }}>
                  Download notes.md
                </button>
              </div>
            )}
          </div>

          <button onClick={() => setPendingDelete(true)} className="text-cs-text-muted hover:text-cs-red" title="Delete project">
            <FiTrash2 />
          </button>

          <span className="text-[0.6875rem] text-cs-text-muted w-14 text-right">
            {saveState === 'saving' ? 'saving…' : saveState === 'dirty' ? 'unsaved' : 'saved'}
          </span>
        </div>

        {project.track_slug && (
          <Link to={`/learn/${project.track_slug}`} className="inline-block mt-1 text-xs text-cs-primary hover:underline">
            Part of the {project.track_slug} track
          </Link>
        )}

        <Stepper state={stages} onOpen={setTab} />

        <div className="flex gap-6 mt-3 -mb-3 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative h-11 inline-flex items-center gap-1.5 px-0.5 text-[0.9375rem] whitespace-nowrap transition-colors ${
                tab === t.id ? 'text-cs-primary' : 'text-cs-text-dim hover:text-cs-text'
              }`}
            >
              <t.icon className="text-sm" /> {t.label}
              {t.id === 'tasks' && tasks.length > 0 && (
                <span className="text-xs text-cs-text-muted">
                  {tasks.filter((x) => x.done).length}/{tasks.length}
                </span>
              )}
              {tab === t.id && <span className="absolute left-0 right-0 bottom-0 h-0.5 bg-cs-primary" />}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 lg:px-6 pt-6">
        {tab === 'code' && (
          <div className="rounded-xl border border-cs-line/15 bg-cs-darkest overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-cs-line/15 bg-cs-overlay/[0.03]">
              <span className="font-mono text-xs text-cs-text-muted">{file}</span>
              <button onClick={runReview} disabled={reviewing} className="btn btn-primary btn-sm">
                <FiPlay /> {reviewing ? 'Reviewing…' : 'AI Review'}
              </button>
            </div>
            <div className="h-[calc(100vh-18rem)] min-h-[22.5rem]">
              <CodeEditor
                value={code}
                onChange={setCode}
                language={editorMode(project.language)}
                onSubmit={() => { if (!reviewing) runReview(); }}
              />
            </div>
          </div>
        )}

        {tab === 'notes' && (
          <div className="grid lg:grid-cols-2 gap-4">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={'# Notes\n\nMarkdown works — headings, **bold**, `code`, lists and ```fenced``` blocks.'}
              className="w-full h-[calc(100vh-18rem)] min-h-[22.5rem] p-4 rounded-xl bg-cs-darkest border border-cs-line/15 font-mono text-[0.8125rem] leading-6 resize-none outline-none focus:border-cs-primary/50"
            />
            <div className="h-[calc(100vh-18rem)] min-h-[22.5rem] overflow-y-auto p-4 rounded-xl border border-cs-line/10 bg-cs-darker">
              {notes.trim()
                ? <Markdown text={notes} />
                : <p className="text-sm text-cs-text-muted italic">Preview appears here.</p>}
            </div>
          </div>
        )}

        {tab === 'brief' && (
          <BriefTab brief={brief} setBrief={setBrief} description={project.description} tasks={tasks} addTasks={addTasks} />
        )}

        {tab === 'ship' && (
          <ShipTab
            ship={ship}
            setShip={setShip}
            shipped={shipped}
            stages={stages}
            onShip={shipIt}
            onUnship={() => setStatus('active')}
            readmeInput={{ title, description: project.description, language: project.language, brief, tasks }}
          />
        )}

        {tab === 'tasks' && (
          <div className="max-w-2xl">
            <div className="flex gap-2 mb-4">
              <input
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTask()}
                placeholder="Add a task…"
                className="input flex-grow"
              />
              <button onClick={addTask} className="btn btn-primary btn-sm"><FiPlus /></button>
            </div>
            {tasks.length === 0 ? (
              <p className="text-sm text-cs-text-muted">
                No tasks yet. Add them here, or write your "done when" checks on the{' '}
                <button onClick={() => setTab('brief')} className="text-cs-primary hover:underline">Brief</button> and turn them into tasks.
              </p>
            ) : (
              <ul className="rounded-xl border border-cs-line/10 divide-y divide-cs-line/10 overflow-hidden">
                {tasks.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 px-4 py-2.5 group">
                    <button
                      onClick={() => setTasks((prev) => prev.map((x) => x.id === t.id ? { ...x, done: !x.done } : x))}
                      className={`w-4 h-4 rounded border grid place-items-center shrink-0 ${
                        t.done ? 'bg-cs-green/20 border-cs-green text-cs-green' : 'border-cs-line/25'
                      }`}
                    >
                      {t.done && <FiCheck className="text-[0.625rem]" strokeWidth={3} />}
                    </button>
                    <span className={`flex-grow text-sm ${t.done ? 'line-through text-cs-text-muted' : 'text-cs-text-dim'}`}>
                      {t.text}
                    </span>
                    <button
                      onClick={() => setTasks((prev) => prev.filter((x) => x.id !== t.id))}
                      className="text-cs-text-muted group-hover:text-cs-text-muted hover:!text-cs-red shrink-0"
                    >
                      <FiX />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === 'review' && (
          <div className="max-w-3xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">AI Review</h3>
              <button onClick={runReview} disabled={reviewing} className="btn btn-primary btn-sm">
                <FiPlay /> {reviewing ? 'Reviewing…' : review ? 'Re-run' : 'Run review'}
              </button>
            </div>
            {review ? (
              <div className="card-dev">
                <div className="flex items-center gap-3 mb-4">
                  <span className={`text-3xl font-bold ${review.score >= 70 ? 'text-cs-green' : 'text-cs-orange'}`}>
                    {Math.round(review.score)}<span className="text-cs-text-muted text-base">/100</span>
                  </span>
                </div>
                <div className="h-2 bg-cs-dark rounded-full overflow-hidden mb-5">
                  <div
                    className={`h-full rounded-full ${review.score >= 70 ? 'bg-cs-green' : 'bg-cs-orange'}`}
                    style={{ width: `${review.score}%` }}
                  />
                </div>
                <p className="text-sm text-cs-text-dim mb-5 whitespace-pre-wrap">{review.feedback}</p>
                {review.suggestions?.length > 0 && (
                  <>
                    <h4 className="mono-label text-cs-orange mb-2"> improve</h4>
                    <ul className="space-y-1 text-sm text-cs-text-dim mb-4">
                      {review.suggestions.map((s, i) => <li key={i}>• {s}</li>)}
                    </ul>
                  </>
                )}
                {review.improvements?.length > 0 && (
                  <>
                    <h4 className="mono-label text-cs-green mb-2"> nailed it</h4>
                    <ul className="space-y-1 text-sm text-cs-text-dim">
                      {review.improvements.map((s, i) => <li key={i}>• {s}</li>)}
                    </ul>
                  </>
                )}
              </div>
            ) : (
              <p className="text-sm text-cs-text-muted italic">
                No review yet. Write some code and hit “Run review”.
              </p>
            )}
          </div>
        )}
      </div>

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
