import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  FiArrowLeft, FiStar, FiTrash2, FiDownload, FiPlay, FiPlus, FiCheck,
  FiX, FiCode, FiFileText, FiClipboard, FiCheckSquare, FiZap,
} from 'react-icons/fi';
import { toast } from '../utils/toast';
import { projectService } from '../services/api';
import ConfirmDialog from '../components/ConfirmDialog';
import CodeEditor from '../components/CodeEditor';
import Markdown from '../components/Markdown';
import LangLogo from '../components/LangLogo';
import { editorMode, stackFile } from '../projectStacks';

const TABS = [
  { id: 'code', label: 'Code', icon: FiCode },
  { id: 'notes', label: 'Notes', icon: FiFileText },
  { id: 'brief', label: 'Brief', icon: FiClipboard },
  { id: 'tasks', label: 'Tasks', icon: FiCheckSquare },
  { id: 'review', label: 'Review', icon: FiZap },
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
  const [newTask, setNewTask] = useState('');
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
      } catch {
        setSaveState('dirty');
        toast.error('Autosave failed');
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
      patch({ title, code, notes, tasks, status, pinned });
    }, 800);
    return () => clearTimeout(saveTimer.current);
  }, [title, code, notes, tasks, status, pinned, patch]);

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

  const brief = project?.brief;
  const review = project?.ai_review;
  const file = useMemo(() => stackFile(project?.language), [project]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-cs-darkest border-t-cs-primary rounded-full animate-spin"></div>
        <p className="text-gray-400">Loading…</p>
      </div>
    );
  }
  if (notFound || !project) {
    return (
      <main className="w-full px-6 lg:px-10 py-16 text-center">
        <p className="text-lg text-gray-400 mb-4">That project doesn’t exist.</p>
        <Link to="/projects" className="btn btn-primary">Back to Projects</Link>
      </main>
    );
  }

  return (
    <main className="w-full pb-10">
      {/* locked header */}
      <div className="sticky top-0 z-30 bg-cs-dark/85 backdrop-blur-xl border-b border-cs-line/10 px-4 lg:px-6 pt-4 pb-3">
        <Link to="/projects" className="inline-flex items-center gap-2 text-xs font-mono text-cs-text-muted hover:text-cs-text mb-2">
          <FiArrowLeft /> Projects
        </Link>
        <div className="flex items-center gap-3 flex-wrap">
          <LangLogo name={project.language} className="text-2xl shrink-0" />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="bg-transparent text-xl font-bold outline-none border-b border-transparent focus:border-cs-line/20 min-w-0 flex-grow"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="text-xs font-mono bg-cs-overlay/5 border border-cs-line/15 rounded-lg px-2 py-1"
          >
            <option value="active">active</option>
            <option value="done">done</option>
            <option value="archived">archived</option>
          </select>
          <button
            onClick={() => setPinned((v) => !v)}
            className={pinned ? 'text-cs-orange' : 'text-cs-text-muted/50 hover:text-cs-text-muted'}
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

          <button onClick={() => setPendingDelete(true)} className="text-cs-text-muted/60 hover:text-cs-red" title="Delete project">
            <FiTrash2 />
          </button>

          <span className="text-[11px] font-mono text-cs-text-muted w-14 text-right">
            {saveState === 'saving' ? 'saving…' : saveState === 'dirty' ? 'unsaved' : 'saved'}
          </span>
        </div>

        {project.track_slug && (
          <Link to={`/learn/${project.track_slug}`} className="inline-block mt-1.5 text-[11px] font-mono text-cs-primary hover:text-cs-cyan">
            ↳ part of the {project.track_slug} track
          </Link>
        )}

        <div className="flex gap-1 mt-3">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === t.id ? 'bg-cs-primary/10 text-cs-primary' : 'text-cs-text-dim hover:text-cs-text'
              }`}
            >
              <t.icon className="text-xs" /> {t.label}
              {t.id === 'tasks' && tasks.length > 0 && (
                <span className="text-[10px] font-mono text-cs-text-muted">
                  {tasks.filter((x) => x.done).length}/{tasks.length}
                </span>
              )}
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
            <div className="h-[calc(100vh-18rem)] min-h-[360px]">
              <CodeEditor value={code} onChange={setCode} language={editorMode(project.language)} />
            </div>
          </div>
        )}

        {tab === 'notes' && (
          <div className="grid lg:grid-cols-2 gap-4">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={'# Notes\n\nMarkdown works — headings, **bold**, `code`, lists and ```fenced``` blocks.'}
              className="w-full h-[calc(100vh-18rem)] min-h-[360px] p-4 rounded-xl bg-cs-darkest border border-cs-line/15 font-mono text-[13px] leading-6 resize-none outline-none focus:border-cs-primary/50"
            />
            <div className="h-[calc(100vh-18rem)] min-h-[360px] overflow-y-auto p-4 rounded-xl border border-cs-line/10 bg-cs-darker">
              {notes.trim()
                ? <Markdown text={notes} />
                : <p className="text-sm text-cs-text-muted italic">Preview appears here.</p>}
            </div>
          </div>
        )}

        {tab === 'brief' && (
          <div className="max-w-3xl">
            {brief && (brief.requirements?.length || brief.hints?.length) ? (
              <div className="card-dev">
                {project.description && <p className="text-cs-text-dim mb-5">{project.description}</p>}
                {brief.estimated_time && (
                  <span className="badge badge-cyan mb-4 inline-block">{brief.estimated_time}</span>
                )}
                {brief.requirements?.length > 0 && (
                  <>
                    <h3 className="mono-label mb-2">// requirements</h3>
                    <ul className="space-y-1.5 mb-5">
                      {brief.requirements.map((r, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-cs-text-dim">
                          <FiCheck className="text-cs-green mt-0.5 shrink-0" /> {r}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {brief.hints?.length > 0 && (
                  <>
                    <h3 className="mono-label text-cs-orange mb-2">// hints</h3>
                    <ul className="space-y-1 text-sm text-cs-text-dim">
                      {brief.hints.map((h, i) => <li key={i}>• {h}</li>)}
                    </ul>
                  </>
                )}
              </div>
            ) : (
              <p className="text-sm text-cs-text-muted italic">
                No brief — this is a blank project. Create one from an AI brief to get requirements and hints.
              </p>
            )}
          </div>
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
              <p className="text-sm text-cs-text-muted italic">No tasks yet.</p>
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
                      {t.done && <FiCheck className="text-[10px]" strokeWidth={3} />}
                    </button>
                    <span className={`flex-grow text-sm ${t.done ? 'line-through text-cs-text-muted' : 'text-cs-text-dim'}`}>
                      {t.text}
                    </span>
                    <button
                      onClick={() => setTasks((prev) => prev.filter((x) => x.id !== t.id))}
                      className="text-cs-text-muted/0 group-hover:text-cs-text-muted/60 hover:!text-cs-red shrink-0"
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
                  <span className={`text-3xl font-bold font-mono ${review.score >= 70 ? 'text-cs-green' : 'text-cs-orange'}`}>
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
                    <h4 className="mono-label text-cs-orange mb-2">// improve</h4>
                    <ul className="space-y-1 text-sm text-cs-text-dim mb-4">
                      {review.suggestions.map((s, i) => <li key={i}>• {s}</li>)}
                    </ul>
                  </>
                )}
                {review.improvements?.length > 0 && (
                  <>
                    <h4 className="mono-label text-cs-green mb-2">// nailed it</h4>
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
