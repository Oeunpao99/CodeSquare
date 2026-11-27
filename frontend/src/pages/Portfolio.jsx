import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { projectService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import LangLogo from '../components/LangLogo';
import {
  FiGlobe, FiArrowRight, FiCheckSquare, FiStar, FiArrowUpRight,
  FiFolder, FiGithub, FiLinkedin, FiEdit3, FiCamera } from 'react-icons/fi';

const PROFILE_LINKS = [
  { key: 'github_url', label: 'GitHub', icon: <FiGithub /> },
  { key: 'website_url', label: 'Website', icon: <FiGlobe /> },
  { key: 'linkedin_url', label: 'LinkedIn', icon: <FiLinkedin /> },
];

function scoreCls(s) {
  if (s >= 80) return 'text-cs-green';
  if (s >= 60) return 'text-cs-cyan';
  return 'text-cs-orange';
}

function Portfolio() {
  const { user } = useAuth();
  const [items, setItems] = useState(null);   // null = loading

  useEffect(() => {
    projectService.portfolio().then((r) => setItems(r.data)).catch(() => setItems([]));
  }, []);

  const links = PROFILE_LINKS.filter((l) => user?.[l.key]);

  return (
    <main className="w-full px-6 lg:px-10 py-8">

      {/* identity card — pulled from your profile */}
      <div className="card border-cs-primary/15 mb-6 flex flex-col sm:flex-row gap-5">
        {/* Profile photo; without one, the same plain initial as the top bar, linking to add a photo */}
        <Link
          to="/profile"
          title={user?.avatar ? 'Change photo' : 'Add a profile photo'}
          className="group relative w-20 h-20 rounded-full overflow-hidden grid place-items-center text-3xl font-bold bg-cs-primary/10 text-cs-primary ring-1 ring-cs-line/10 shrink-0"
        >
          {user?.avatar
            ? <img src={user.avatar} alt="" className="w-full h-full object-cover" />
            : <span>{(user?.display_name || user?.username)?.charAt(0).toUpperCase()}</span>}
          <span className="absolute inset-0 grid place-items-center bg-black/45 text-white opacity-0 group-hover:opacity-100 transition-opacity">
            <FiCamera className="text-xl" />
          </span>
        </Link>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold">{user?.display_name || user?.username}</h2>
          {user?.headline && <p className="text-sm text-cs-primary mt-0.5">{user.headline}</p>}
          {user?.bio && <p className="text-sm text-cs-text-dim mt-2 max-w-2xl whitespace-pre-line">{user.bio}</p>}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {links.map((l) => (
              <a
                key={l.key} href={user[l.key]} target="_blank" rel="noreferrer noopener"
                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md glass glass-hover text-cs-text-dim hover:text-cs-primary"
              >
                {l.icon} {l.label}
              </a>
            ))}
            <Link
              to="/profile"
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md text-cs-text-muted hover:text-cs-primary"
            >
              <FiEdit3 /> edit
            </Link>
          </div>
        </div>
      </div>

      {items === null && <p className="text-cs-text-muted text-sm">Loading your projects…</p>}

      {items && items.length === 0 && (
        <div className="card border-cs-primary/15 flex flex-col items-center justify-center py-16 text-center">
          <div className="text-sm text-cs-primary mb-4 flex items-center gap-2">
            <span>Finished projects</span>
          </div>
          <p className="text-3xl mb-3 text-cs-text-muted select-none">Nothing here yet</p>
          <p className="text-cs-text-dim mb-6 max-w-sm mx-auto text-sm">
            Finish a project and set its status to <span className="text-cs-green">done</span> in the
            workspace — it auto-appears here.
          </p>
          <Link to="/projects" className="btn btn-primary btn-sm"><FiArrowRight /> Go to Projects</Link>
        </div>
      )}

      {items && items.length > 0 && (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((p) => (
            <Link
              key={p.id}
              to={`/projects/${p.id}`}
              className="card card-code hover:border-cs-primary/50 transition-all hover:-translate-y-0.5 flex flex-col gap-3 group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <LangLogo name={p.language} className="text-lg shrink-0" />
                  <span className="font-semibold truncate">{p.title}</span>
                </div>
                <FiArrowUpRight className="text-cs-text-muted group-hover:text-cs-primary shrink-0" />
              </div>

              {p.description && (
                <p className="text-sm text-cs-text-dim line-clamp-2">{p.description}</p>
              )}

              {p.snippet && (
                <pre className={`text-[0.6875rem] leading-4 font-mono text-cs-text-muted bg-cs-darkest/80 rounded-lg p-3 max-h-20 overflow-hidden border border-cs-line/10 ${
                  p.language === 'python' ? 'text-emerald-300/80' : p.language === 'javascript' ? 'text-yellow-200/80' : 'text-sky-300/80'
                }`}>
                  {p.snippet}
                </pre>
              )}

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-auto pt-2 text-[0.6875rem] border-t border-cs-line/10 text-cs-text-muted">
                <span className="inline-flex items-center gap-1">
                  <FiFolder className="text-cs-primary" /> {p.language}
                </span>
                {p.track_slug && <span className="text-cs-text-dim">./{p.track_slug}</span>}
                {p.task_total > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <FiCheckSquare /> {p.task_done}/{p.task_total}
                  </span>
                )}
                {[[p.repo_url, FiGithub, 'Code'], [p.demo_url, FiGlobe, 'Demo']].filter(([u]) => u).map(([u, Icon, label]) => (
                  <button key={label} type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.open(u, '_blank', 'noopener'); }}
                    className="inline-flex items-center gap-1 text-cs-text-dim hover:text-cs-primary">
                    <Icon /> {label}
                  </button>
                ))}
                {typeof p.review_score === 'number' && (
                  <span className={`inline-flex items-center gap-1 ${scoreCls(p.review_score)} ml-auto`}>
                    <FiStar /> {Math.round(p.review_score)}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}

export default Portfolio;
