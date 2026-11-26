import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FiPlus, FiStar, FiTrash2, FiCode, FiZap, FiCheckSquare, FiClipboard, FiX, FiSearch,
} from 'react-icons/fi';
import { toast } from '../utils/toast';
import { projectService, lessonService } from '../services/api';
import { useMajor } from '../context/MajorContext';
import LangLogo from '../components/LangLogo';
import ConfirmDialog from '../components/ConfirmDialog';
import { stacksForMajor } from '../projectStacks';
import { timeAgo } from '../utils/datetime';

const STATUS = {
  active: { label: 'Active', cls: 'text-cs-primary bg-cs-primary/10', text: 'text-cs-primary' },
  done: { label: 'Done', cls: 'text-cs-green bg-cs-green/10', text: 'text-cs-green' },
  archived: { label: 'Archived', cls: 'text-cs-text-muted bg-cs-overlay/10', text: 'text-cs-text-muted' },
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

        <button onClick={create} disabled={busy} className="btn btn-primary w-full">
          {busy ? 'Working…' : 'Create project'}
        </button>
        <p className="text-xs text-cs-text-muted text-center mt-3">
          Want a brief and starter code?{' '}
          <Link to="/projects/generate" className="text-cs-primary">generate with AI →</Link>
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
  const [search, setSearch] = useState('');
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

  const q = search.trim().toLowerCase();
  const shown = projects.filter((p) => (filter === 'all' || p.status === filter)
    && (!q || `${p.title} ${p.language}`.toLowerCase().includes(q)));
  const count = (f) => (f === 'all' ? projects.length : projects.filter((p) => p.status === f).length);

  if (loading) {
    return (
      <main className="w-full px-6 lg:px-10 py-8">
        <div className="skeleton h-12 rounded-xl mb-5" />
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-[9rem] rounded-lg" />)}
        </div>
      </main>
    );
  }

  return (
    <main className="w-full px-6 lg:px-10 py-8">
      <section className="rounded-xl border border-cs-line/10 px-5 pt-2 pb-6">
        {/* Status tabs + actions */}
        <div className="flex flex-wrap items-center gap-x-7 border-b border-cs-line/10">
          {['all', 'active', 'done', 'archived'].map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`relative h-12 px-0.5 text-[0.9375rem] capitalize transition-colors ${filter === f ? 'text-cs-primary' : 'text-cs-text-dim hover:text-cs-text'}`}>
              {f}<span className="ml-1.5 text-xs text-cs-text-muted">{count(f)}</span>
              {filter === f && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-cs-primary" />}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2 py-2">
            <Link to="/projects/generate" className="btn btn-ghost btn-sm"><FiZap /> Generate with AI</Link>
            <button onClick={() => setShowNew(true)} className="btn btn-primary btn-sm"><FiPlus /> New project</button>
          </div>
        </div>

        {/* Search */}
        {projects.length > 0 && (
          <label className="mt-5 mb-5 h-10 flex items-center gap-2 px-3 rounded-lg border border-cs-line/15 focus-within:border-cs-primary/50 transition-colors">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search projects"
              className="flex-1 min-w-0 bg-transparent outline-none text-[0.9375rem] placeholder:text-cs-text-muted" />
            {search
              ? <button type="button" onClick={() => setSearch('')} className="text-cs-text-muted hover:text-cs-text"><FiX /></button>
              : <FiSearch className="text-cs-text-muted" />}
          </label>
        )}

        {shown.length === 0 ? (
          <div className="text-center py-16">
            <FiClipboard className="text-3xl text-cs-text-muted mx-auto mb-3" />
            <p className="text-cs-text-dim mb-4">
              {projects.length === 0 ? 'No projects yet.' : search ? `No projects match “${search}”.` : `No ${filter} projects.`}
            </p>
            {projects.length === 0 && (
              <button onClick={() => setShowNew(true)} className="btn btn-primary btn-sm"><FiPlus /> Create your first project</button>
            )}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {shown.map((p) => {
              const st = STATUS[p.status] || STATUS.active;
              const pct = p.task_total ? Math.round((p.task_done / p.task_total) * 100) : 0;
              return (
                <Link key={p.id} to={`/projects/${p.id}`}
                  className="group rounded-lg border border-cs-line/10 p-5 text-cs-text hover:bg-cs-overlay/[0.03] hover:border-cs-line/20 transition-colors flex flex-col">
                  <div className="flex items-center gap-3">
                    <LangLogo name={p.language} className="text-xl shrink-0" />
                    <p className="text-base font-bold flex-1 min-w-0 truncate">{p.title}</p>
                    <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPendingDelete(p.id); }}
                      className="shrink-0 text-cs-text-muted opacity-0 group-hover:opacity-100 hover:!text-cs-red transition"
                      title="Delete">
                      <FiTrash2 />
                    </button>
                    <button onClick={(e) => togglePin(p, e)}
                      className={`shrink-0 transition ${p.pinned ? 'text-cs-orange' : 'text-cs-text-muted opacity-0 group-hover:opacity-100 hover:text-cs-text'}`}
                      title={p.pinned ? 'Unpin' : 'Pin'}>
                      <FiStar className={p.pinned ? 'fill-current' : ''} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-3 mt-4 text-sm text-cs-text-dim">
                    <span className="truncate capitalize">
                      {p.language}{p.has_review && <span className="normal-case text-cs-cyan"> · AI reviewed</span>}
                    </span>
                    <span className={`shrink-0 font-medium ${st.text}`}>{st.label}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 mt-2 text-sm text-cs-text-dim">
                    <span>{p.task_total > 0 ? `${p.task_done}/${p.task_total} tasks` : p.snippet ? 'Has code' : 'No code yet'}</span>
                    <span className="text-xs text-cs-text-muted">{timeAgo(p.updated_at)}</span>
                  </div>
                  <div className="mt-3 h-1.5 rounded-full bg-cs-overlay/[0.12] overflow-hidden">
                    <div className={`h-full rounded-full ${pct === 100 ? 'bg-cs-green' : 'bg-cs-primary'}`} style={{ width: `${pct}%` }} />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

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
