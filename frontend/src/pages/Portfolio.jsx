import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { projectService } from '../services/api';
import LangLogo from '../components/LangLogo';
import {
  FiGlobe, FiArrowRight, FiCheckSquare, FiStar, FiArrowUpRight,
  FiFolder,
} from 'react-icons/fi';

function scoreCls(s) {
  if (s >= 80) return 'text-cs-green';
  if (s >= 60) return 'text-cs-cyan';
  return 'text-cs-orange';
}

function Portfolio() {
  const [items, setItems] = useState(null);   // null = loading

  useEffect(() => {
    projectService.portfolio().then((r) => setItems(r.data)).catch(() => setItems([]));
  }, []);

  return (
    <main className="w-full px-6 lg:px-10 py-8">
      <div className="sticky top-0 z-30 -mx-6 lg:-mx-10 px-6 lg:px-10 pt-4 pb-4 -mt-8 mb-6 bg-cs-dark/85 backdrop-blur-xl border-b border-cs-line/[0.07]">
        <span className="mono-label text-cs-primary">// portfolio</span>
        <h1 className="text-3xl font-bold mt-2 flex items-center gap-3">
          <FiGlobe className="text-cs-primary" /> Portfolio
        </h1>
        <p className="text-sm text-cs-text-dim mt-1">
          Your finished projects · {items ? items.length : 0} {items && items.length === 1 ? 'entry' : 'entries'}
        </p>
      </div>

      {items === null && <p className="text-cs-text-muted font-mono text-sm">scanning ~/projects…</p>}

      {items && items.length === 0 && (
        <div className="card border-cs-primary/15 flex flex-col items-center justify-center py-16 text-center">
          <div className="font-mono text-sm text-cs-primary mb-4 flex items-center gap-2">
            <span className="inline-block w-2 h-4 bg-cs-primary/70 animate-blink" />
            <span>$ ls --done</span>
          </div>
          <p className="font-mono text-3xl mb-3 text-cs-text-muted select-none">// empty: 0 files</p>
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
