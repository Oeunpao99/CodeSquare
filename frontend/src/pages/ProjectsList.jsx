import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FiPlus, FiStar, FiTrash2, FiCode, FiZap, FiCheckSquare, FiClipboard, FiX,
} from 'react-icons/fi';
import { toast } from '../utils/toast';
import { projectService, lessonService } from '../services/api';
import { useMajor } from '../context/MajorContext';
import LangLogo from '../components/LangLogo';
import ConfirmDialog from '../components/ConfirmDialog';
import { stacksForMajor } from '../projectStacks';
import { timeAgo } from '../utils/datetime';

const STATUS = {
  active: { label: 'Active', cls: 'text-cs-primary bg-cs-primary/10' },
  done: { label: 'Done', cls: 'text-cs-green bg-cs-green/10' },
  archived: { label: 'Archived', cls: 'text-cs-text-muted bg-cs-overlay/10' },
};

function NewProjectModal({ onClose, onCreated, languageOptions, tracks }) {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [language, setLanguage] = useState(languageOptions[0]?.id || 'python');
  const [trackSlug, setTrackSlug] = useState('');
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    try {
      const res = await projectService.create({
        title: title.trim() || 'Untitled project',
        language,
        track_slug: trackSlug || null,
      });
      onCreated();
      navigate(`/projects/${res.data.id}`);
    } catch {
      toast.error('Could not create the project.');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-cs-dark/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg card-dev max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold">New blank project</h2>
          <button onClick={onClose} className="text-cs-text-muted hover:text-cs-text"><FiX /></button>
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && create()}
          placeholder="Project title"
          className="input w-full mb-4"
          autoFocus
        />

        <p className="mono-label mb-2"> language</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {languageOptions.map((o) => (
            <button
              key={o.id}
              onClick={() => setLanguage(o.id)}
              className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                language === o.id
                  ? 'border-cs-primary bg-cs-primary/10 text-cs-primary'
                  : 'border-cs-line/15 text-cs-text-dim hover:border-cs-primary/40'
              }`}
            >
              {o.name}
            </button>
          ))}
        </div>

        {tracks.length > 0 && (
          <>
            <p className="mono-label mb-2"> link to a track (optional)</p>
            <select
              value={trackSlug}
              onChange={(e) => setTrackSlug(e.target.value)}
              className="input w-full mb-5"
            >
              <option value="">— none —</option>
              {tracks.map((t) => (
                <option key={t.slug} value={t.slug}>{t.name}</option>
              ))}
            </select>
          </>
        )}

        <button onClick={create} disabled={busy} className="btn btn-primary w-full font-mono">
          {busy ? 'Working…' : '$ create project'}
        </button>
        <p className="text-xs text-cs-text-muted text-center mt-3">
          Want a brief and starter code?{' '}
          <Link to="/projects/generate" className="text-cs-primary font-mono">generate with AI →</Link>
        </p>
      </div>
    </div>
  );
}

function ProjectsList() {
  const { majorData } = useMajor();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [tracks, setTracks] = useState([]);
  const [filter, setFilter] = useState('all');
  const [pendingDelete, setPendingDelete] = useState(null);

  const languageOptions = useMemo(() => stacksForMajor(majorData), [majorData]);

  const load = () => {
    projectService
      .list()
      .then((res) => setProjects(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    lessonService.getLanguages().then((r) => setTracks(r.data || [])).catch(() => {});
  }, []);

  const togglePin = async (p, e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await projectService.update(p.id, { pinned: !p.pinned });
      load();
    } catch { /* ignore */ }
  };

  const doDelete = async (id) => {
    try {
      await projectService.remove(id);
      setProjects((prev) => prev.filter((x) => x.id !== id));
      toast.success('Project deleted');
    } catch {
      toast.error('Could not delete.');
    }
  };

  const shown = projects.filter((p) => filter === 'all' || p.status === filter);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-cs-darkest border-t-cs-primary rounded-full animate-spin"></div>
        <p className="text-gray-400">Loading your projects...</p>
      </div>
    );
  }

  return (
    <main className="w-full px-6 lg:px-10 py-8">
      <div className="sticky top-0 z-30 -mx-6 lg:-mx-10 px-6 lg:px-10 lg:pr-14 pt-4 pb-4 -mt-8 mb-6 bg-cs-dark/85 backdrop-blur-xl border-b border-cs-line/[0.07] flex items-start justify-between gap-4 flex-wrap">
        <div>
          <span className="mono-label"> workspace</span>
          <h1 className="text-3xl font-bold mt-2 flex items-center gap-3">
            <FiCode className="text-cs-primary" /> Projects
          </h1>
          <p className="text-cs-text-dim mt-1">Code, notes, tasks and AI reviews — all saved.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/projects/generate" className="btn btn-ghost font-mono">
            <FiZap /> Generate with AI
          </Link>
          <button onClick={() => setShowNew(true)} className="btn btn-primary font-mono">
            <FiPlus /> New project
          </button>
        </div>
      </div>

      {projects.length > 0 && (
        <div className="flex gap-2 mb-6">
          {['all', 'active', 'done', 'archived'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-mono capitalize transition-colors ${
                filter === f
                  ? 'bg-cs-primary/15 text-cs-primary border border-cs-primary/30'
                  : 'text-cs-text-dim border border-cs-line/10 hover:text-cs-text'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <div className="card-dev text-center py-16">
          <FiClipboard className="text-4xl text-cs-text-muted mx-auto mb-4" />
          <p className="text-cs-text-dim mb-4">
            {projects.length === 0 ? 'No projects yet.' : `No ${filter} projects.`}
          </p>
          <button onClick={() => setShowNew(true)} className="btn btn-primary btn-sm font-mono">
            <FiPlus /> Create your first project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {shown.map((p) => {
            const st = STATUS[p.status] || STATUS.active;
            return (
              <Link
                key={p.id}
                to={`/projects/${p.id}`}
                className="card group relative flex flex-col"
              >
                <div className="flex items-center gap-3 mb-3">
                  <LangLogo name={p.language} className="text-2xl shrink-0" />
                  <h3 className="font-bold text-[15px] flex-grow min-w-0 truncate">{p.title}</h3>
                  <button
                    onClick={(e) => togglePin(p, e)}
                    className={`shrink-0 ${p.pinned ? 'text-cs-orange' : 'text-cs-text-muted/40 hover:text-cs-text-muted'}`}
                    title={p.pinned ? 'Unpin' : 'Pin'}
                  >
                    <FiStar className={p.pinned ? 'fill-current' : ''} />
                  </button>
                </div>

                {p.snippet ? (
                  <pre className="text-[11px] font-mono text-cs-text-muted bg-cs-darkest rounded-lg p-2.5 mb-3 overflow-hidden line-clamp-3 whitespace-pre-wrap">
                    {p.snippet}
                  </pre>
                ) : (
                  <p className="text-xs text-cs-text-muted italic mb-3">No code yet</p>
                )}

                <div className="flex items-center gap-2 flex-wrap text-[11px] font-mono mt-auto">
                  <span className={`px-2 py-0.5 rounded ${st.cls}`}>{st.label}</span>
                  {p.task_total > 0 && (
                    <span className="inline-flex items-center gap-1 text-cs-text-muted">
                      <FiCheckSquare /> {p.task_done}/{p.task_total}
                    </span>
                  )}
                  {p.has_review && (
                    <span className="inline-flex items-center gap-1 text-cs-cyan"><FiZap /> reviewed</span>
                  )}
                  <span className="text-cs-text-muted ml-auto">{timeAgo(p.updated_at)}</span>
                </div>

                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPendingDelete(p.id); }}
                  className="absolute top-3 right-9 text-cs-text-muted/0 group-hover:text-cs-text-muted/60 hover:!text-cs-red transition-colors"
                  title="Delete"
                >
                  <FiTrash2 />
                </button>
              </Link>
            );
          })}
        </div>
      )}

      {showNew && (
        <NewProjectModal
          onClose={() => setShowNew(false)}
          onCreated={() => setShowNew(false)}
          languageOptions={languageOptions}
          tracks={tracks}
        />
      )}

      {pendingDelete != null && (
        <ConfirmDialog
          title="Delete project"
          message={projects.find((p) => p.id === pendingDelete)?.title
            ? `Delete “${projects.find((p) => p.id === pendingDelete).title}”? This can't be undone.`
            : 'Delete this project? This can’t be undone.'}
          onConfirm={() => doDelete(pendingDelete)}
          onClose={() => setPendingDelete(null)}
        />
      )}
    </main>
  );
}

export default ProjectsList;
