import React, { useEffect, useMemo, useState } from 'react';
import SelectMenu from '../components/SelectMenu';
import { Link, useNavigate } from 'react-router-dom';
import {
  FiPlus, FiStar, FiTrash2, FiCode, FiZap, FiCheckSquare, FiClipboard, FiX, FiSearch, FiGithub,
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

const STAGE_LABEL = {
  plan: ['Planning', 'text-cs-text-muted'],
  build: ['Building', 'text-cs-primary'],
  review: ['In review', 'text-cs-orange'],
  ship: ['Ready to ship', 'text-cs-violet'],
  shipped: ['Shipped', 'text-cs-green'],
};

// "github.com/owner/repo" from a repository URL.
const repoName = (url) => {
  try {
    const u = new URL(url);
    return (u.hostname.replace(/^www\./, '') === 'github.com' ? '' : `${u.hostname}/`) + u.pathname.replace(/^\/|\.git$|\/$/g, '');
  } catch { return url; }
};

function ProjectCard({ p, onPin, onDelete }) {
  const [label, cls] = p.status === 'archived' ? ['Archived', 'text-cs-text-muted'] : (STAGE_LABEL[p.stage] || STAGE_LABEL.plan);
  const blurb = p.description || (p.snippet ? 'Code in progress.' : 'No description yet. Add the problem it solves on the Brief.');
  return (
    <Link to={`/projects/${p.id}`}
      className="group rounded-lg border border-cs-line/10 p-5 flex flex-col min-h-[15rem] text-cs-text hover:bg-cs-overlay/[0.03] hover:border-cs-line/25 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <span className="w-9 h-9 rounded-lg grid place-items-center bg-cs-overlay/[0.05] text-2xl">
          <LangLogo name={p.language} />
        </span>
        <span className={`text-[0.8125rem] ${cls}`}>{label}</span>
      </div>
      <h3 className="mt-4 text-[1.0625rem] font-semibold truncate">{p.title}</h3>
      <p className="mt-2.5 text-sm text-cs-text-dim leading-relaxed line-clamp-3">{blurb}</p>

      <div className="mt-auto pt-5">
        <div className="pt-4 border-t border-cs-line/10 flex items-center gap-3 text-sm text-cs-text-dim">
          {p.repo_url ? (
            <button type="button" title={p.repo_url}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.open(p.repo_url, '_blank', 'noopener'); }}
              className="min-w-0 inline-flex items-center gap-2 hover:text-cs-primary">
              <FiGithub className="shrink-0" /> <span className="truncate">{repoName(p.repo_url)}</span>
            </button>
          ) : (
            <span className="min-w-0 inline-flex items-center gap-2 text-cs-text-muted">
              <FiGithub className="shrink-0" /> <span className="truncate">Not on GitHub yet</span>
            </span>
          )}
          <span className="ml-auto flex items-center gap-3 shrink-0">
            {p.task_total > 0 && (
              <span className="inline-flex items-center gap-1.5" title="Tasks done"><FiCheckSquare /> {p.task_done}/{p.task_total}</span>
            )}
            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(); }}
              className="text-cs-text-muted opacity-0 group-hover:opacity-100 hover:!text-cs-red transition" title="Delete" aria-label="Delete">
              <FiTrash2 />
            </button>
            <button type="button" onClick={(e) => onPin(p, e)} title={p.pinned ? 'Unpin' : 'Pin to top'} aria-label={p.pinned ? 'Unpin' : 'Pin'}
              className={p.pinned ? 'text-cs-orange' : 'text-cs-text-muted hover:text-cs-text'}>
              <FiStar className={p.pinned ? 'fill-current' : ''} />
            </button>
          </span>
        </div>
      </div>
    </Link>
  );
}

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
            <SelectMenu
              value={trackSlug}
              onChange={setTrackSlug}
              ariaLabel="Link to a track"
              className="w-full mb-5"
              buttonClassName="w-full h-10 px-3 text-sm"
              menuClassName="w-full max-w-none"
              options={[{ value: '', label: 'None' }, ...tracks.map((t) => ({ value: t.slug, label: t.name }))]}
            />
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
  const [sort, setSort] = useState('recent');
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
  const TABS = [['all', 'All'], ['active', 'Active'], ['done', 'Shipped'], ['archived', 'Archived']];
  const count = (f) => (f === 'all' ? projects.length : projects.filter((x) => x.status === f).length);
  const STAGE_ORDER = { plan: 0, build: 1, review: 2, ship: 3, shipped: 4 };
  const shown = projects
    .filter((x) => (filter === 'all' || x.status === filter)
      && (!q || `${x.title} ${x.language} ${x.description || ''} ${x.repo_url || ''}`.toLowerCase().includes(q)))
    .sort((x, y) => (sort === 'name' ? x.title.localeCompare(y.title)
      : sort === 'progress' ? (STAGE_ORDER[y.stage] ?? 0) - (STAGE_ORDER[x.stage] ?? 0)
        : (y.pinned - x.pinned) || (new Date(y.updated_at) - new Date(x.updated_at))));

  return (
    <main className="w-full px-6 lg:px-10 py-8">
      {/* Hero */}
      <section className="text-center pt-2 pb-7">
        <h1 className="text-3xl md:text-4xl font-semibold">Your projects</h1>
        <p className="mt-2 text-cs-text-dim">Plan, build and ship projects you can show employers.</p>
        <div className="mt-5 flex items-center justify-center gap-2">
          <button onClick={() => setShowNew(true)} className="btn btn-primary btn-sm"><FiPlus /> New project</button>
          <Link to="/projects/generate" className="btn btn-ghost btn-sm"><FiZap /> Generate with AI</Link>
        </div>
      </section>

      {/* Search + sort */}
      <div className="flex gap-3">
        <label className="flex-1 h-11 flex items-center gap-2 px-4 rounded-lg border border-cs-line/15 bg-cs-overlay/[0.02] focus-within:border-cs-primary/50 transition-colors">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search your projects"
            className="flex-1 min-w-0 bg-transparent outline-none text-[0.9375rem] placeholder:text-cs-text-muted" />
          {search
            ? <button type="button" onClick={() => setSearch('')} className="text-cs-text-muted hover:text-cs-text" aria-label="Clear search"><FiX /></button>
            : <FiSearch className="text-cs-text-muted text-lg" />}
        </label>
        <SelectMenu value={sort} onChange={setSort} align="right" ariaLabel="Sort projects"
          buttonClassName="h-11 px-4 text-[0.9375rem] min-w-[11rem] bg-cs-overlay/[0.02]"
          options={[
            { value: 'recent', label: 'Recently updated' },
            { value: 'progress', label: 'Most progress' },
            { value: 'name', label: 'Name' },
          ]} />
      </div>

      {/* Tabs */}
      <div className="mt-5 flex flex-wrap gap-x-8 border-b border-cs-line/10">
        {TABS.map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`relative h-11 px-0.5 text-[0.9375rem] transition-colors ${filter === k ? 'text-cs-primary' : 'text-cs-text-dim hover:text-cs-text'}`}>
            {label}<span className="ml-1.5 text-xs text-cs-text-muted">{loading ? '' : count(k)}</span>
            {filter === k && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-cs-primary" />}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-6 grid sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton h-60 rounded-lg" />)}
        </div>
      ) : shown.length === 0 ? (
        <div className="text-center py-20">
          <FiClipboard className="text-3xl text-cs-text-muted mx-auto mb-3" />
          <p className="text-cs-text-dim mb-4">
            {projects.length === 0 ? 'No projects yet. Start one and ship it to your portfolio.'
              : search ? `No projects match “${search}”.` : 'Nothing here yet.'}
          </p>
          {projects.length === 0 && (
            <button onClick={() => setShowNew(true)} className="btn btn-primary btn-sm"><FiPlus /> Create your first project</button>
          )}
        </div>
      ) : (
        <div className="mt-6 grid sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
          {shown.map((x) => <ProjectCard key={x.id} p={x} onPin={togglePin} onDelete={() => setPendingDelete(x.id)} />)}
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
