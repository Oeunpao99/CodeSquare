import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { projectService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import LangLogo from '../components/LangLogo';
import {
  FiGlobe, FiArrowRight, FiCheckSquare, FiStar, FiArrowUpRight,
  FiFolder, FiGithub, FiLinkedin, FiEdit3,
} from 'react-icons/fi';

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
      <div className="sticky top-0 z-30 -mx-6 lg:-mx-10 px-6 lg:px-10 pt-4 pb-4 -mt-8 mb-6 bg-cs-dark/85 backdrop-blur-xl border-b border-cs-line/[0.07]">
        <span className="mono-label text-cs-primary"> portfolio</span>
        <h1 className="text-3xl font-bold mt-2 flex items-center gap-3">
          <FiGlobe className="text-cs-primary" /> Portfolio
        </h1>
        <p className="text-sm text-cs-text-dim mt-1">
          Your finished projects · {items ? items.length : 0} {items && items.length === 1 ? 'entry' : 'entries'}
        </p>
      </div>

      {/* identity card — pulled from your profile */}
      <div className="card border-cs-primary/15 mb-6 flex flex-col sm:flex-row gap-5">
        <div className="w-20 h-20 rounded-full overflow-hidden bg-gradient-main border-2 border-cs-primary/40 flex items-center justify-center text-3xl font-bold text-cs-dark shrink-0">
          {user?.avatar
            ? <img src={user.avatar} alt="" className="w-full h-full object-cover" />
            : <span>{(user?.display_name || user?.username)?.charAt(0).toUpperCase()}</span>}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold">{user?.display_name || user?.username}</h2>
          {user?.headline && <p className="text-sm text-cs-primary font-mono mt-0.5">{user.headline}</p>}
          {user?.bio && <p className="text-sm text-cs-text-dim mt-2 max-w-2xl whitespace-pre-line">{user.bio}</p>}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {links.map((l) => (
              <a
                key={l.key} href={user[l.key]} target="_blank" rel="noreferrer noopener"
                className="inline-flex items-center gap-1.5 font-mono text-xs px-2.5 py-1 rounded-md glass glass-hover text-cs-text-dim hover:text-cs-primary"
              >
                {l.icon} {l.label}
              </a>
            ))}
            <Link
              to="/profile"
              className="inline-flex items-center gap-1.5 font-mono text-xs px-2.5 py-1 rounded-md text-cs-text-muted hover:text-cs-primary"
            >
              <FiEdit3 /> edit
            </Link>
          </div>
        </div>
      </div>

      {items === null && <p className="text-cs-text-muted font-mono text-sm">scanning ~/projects…</p>}

      {items && items.length === 0 && (
        <div className="card border-cs-primary/15 flex flex-col items-center justify-center py-16 text-center">
          <div className="font-mono text-sm text-cs-primary mb-4 flex items-center gap-2">
            <span className="inline-block w-2 h-4 bg-cs-primary/70 animate-blink" />
            <span>$ ls --done</span>
          </div>
          <p className="font-mono text-3xl mb-3 text-cs-text-muted select-none"> empty: 0 files</p>
          <p className="text-cs-text-dim mb-6 max-w-sm mx-auto font-mono text-sm">
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
                  <span className="font-semibold truncate font-mono">{p.title}</span>
                </div>
                <FiArrowUpRight className="text-cs-text-muted group-hover:text-cs-primary shrink-0" />
              </div>

              {p.description && (
                <p className="text-sm text-cs-text-dim line-clamp-2">{p.description}</p>
              )}

              {p.snippet && (
                <pre className={`text-[11px] leading-4 font-mono text-cs-text-muted bg-cs-darkest/80 rounded-lg p-3 max-h-20 overflow-hidden border border-cs-line/10 ${
                  p.language === 'python' ? 'text-emerald-300/80' : p.language === 'javascript' ? 'text-yellow-200/80' : 'text-sky-300/80'
                }`}>
                  {p.snippet}
                </pre>
              )}

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-auto pt-2 font-mono text-[11px] border-t border-cs-line/10 text-cs-text-muted">
                <span className="inline-flex items-center gap-1">
                  <FiFolder className="text-cs-primary" /> {p.language}
                </span>
                {p.track_slug && <span className="text-cs-text-dim">./{p.track_slug}</span>}
                {p.task_total > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <FiCheckSquare /> {p.task_done}/{p.task_total}
                  </span>
                )}
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
