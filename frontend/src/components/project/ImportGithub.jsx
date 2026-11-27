import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiGithub, FiSearch, FiStar, FiCheck, FiArrowRight, FiLoader, FiX } from 'react-icons/fi';
import Dialog from '../class/Dialog';
import LangLogo from '../LangLogo';
import { githubService } from '../../services/api';
import { toast } from '../../utils/toast';
import { timeAgo } from '../../utils/datetime';

const errText = (e, fallback) => {
  const d = e?.response?.data?.detail;
  return typeof d === 'string' ? d : d?.message || fallback;
};

// Small ring + percent shown on the Import button while a repo downloads.
// The import is one request, so the number is an estimate that eases toward
// 95% and jumps to 100% when the server answers.
function ProgressRing({ pct }) {
  const r = 7; const c = 2 * Math.PI * r;
  return (
    <span className="inline-flex items-center gap-1.5 tabular-nums">
      <svg viewBox="0 0 18 18" className="w-4 h-4 -rotate-90" aria-hidden>
        <circle cx="9" cy="9" r={r} fill="none" stroke="currentColor" strokeOpacity=".3" strokeWidth="2.5" />
        <circle cx="9" cy="9" r={r} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} style={{ transition: 'stroke-dashoffset 200ms linear' }} />
      </svg>
      {pct}%
    </span>
  );
}

/** "Import from GitHub": connect and pick a repo, or paste a public repo link. */
export default function ImportGithub({ onClose }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [repos, setRepos] = useState(null);
  const [q, setQ] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(null); // full_name or 'url' being imported
  const [pct, setPct] = useState(0);
  useEffect(() => {
    if (!busy) { setPct(0); return undefined; }
    const started = Date.now();
    setPct(1);
    const t = setInterval(() => {
      const secs = (Date.now() - started) / 1000;
      setPct(Math.max(1, Math.min(95, Math.round(95 * (1 - Math.exp(-secs / 6))))));
    }, 150);
    return () => clearInterval(t);
  }, [busy]);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    githubService.status().then((r) => {
      setStatus(r.data);
      if (r.data.connected) {
        githubService.repos().then((x) => setRepos(x.data)).catch((e) => { setRepos([]); toast.error(errText(e, 'Could not load your repos.')); });
      }
    }).catch(() => setStatus({ oauth_enabled: false, connected: false }));
  }, []);

  const connect = async () => {
    setConnecting(true);
    try {
      const r = await githubService.connect();
      window.location.href = r.data.url;
    } catch (e) {
      toast.error(errText(e, 'Could not start GitHub sign-in.'));
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    await githubService.disconnect().catch(() => {});
    setStatus((s) => ({ ...s, connected: false, username: null }));
    setRepos(null);
  };

  const doImport = async (repo, key) => {
    setBusy(key);
    try {
      const r = await githubService.importRepo(repo);
      setPct(100);
      await new Promise((res) => setTimeout(res, 350)); // let the ring reach 100%
      toast.success('Imported', `${r.data.files ?? 1} file${r.data.files === 1 ? '' : 's'} from GitHub${r.data.entry ? ` · main file ${r.data.entry}` : ''}`);
      onClose();
      navigate(`/projects/${r.data.id}?step=build`);
    } catch (e) {
      const d = e?.response?.data?.detail;
      if (e?.response?.status === 409 && d?.project_id) {
        toast.error('Already imported', 'Opening that project.');
        onClose();
        navigate(`/projects/${d.project_id}?step=build`);
      } else {
        toast.error(errText(e, 'Import failed.'));
      }
    } finally {
      setBusy(null);
    }
  };

  const shown = (repos || []).filter((r) => !q || `${r.name} ${r.description || ''} ${r.language || ''}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <Dialog title="Import from GitHub" onClose={onClose} wide>
      {/* Connected account / connect */}
      {status === null ? (
        <div className="h-24 grid place-items-center text-cs-text-muted"><FiLoader className="animate-spin" /></div>
      ) : status.connected ? (
        <>
          <div className="flex items-center gap-3 mb-4 text-sm">
            <span className="w-8 h-8 rounded-full bg-cs-overlay/[0.06] grid place-items-center"><FiGithub /></span>
            <span>Connected as <b>@{status.username || 'github'}</b></span>
            <button onClick={disconnect} className="ml-auto text-cs-text-muted hover:text-cs-red">Disconnect</button>
          </div>
          <label className="h-10 flex items-center gap-2 px-3 rounded-lg border border-cs-line/15 focus-within:border-cs-primary/50 mb-3">
            <FiSearch className="text-cs-text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your repositories"
              className="flex-1 min-w-0 bg-transparent outline-none text-sm" />
            {q && <button onClick={() => setQ('')} className="text-cs-text-muted"><FiX /></button>}
          </label>
          <ul className="max-h-[22rem] overflow-y-auto rounded-xl border border-cs-line/10 divide-y divide-cs-line/10">
            {repos === null && Array.from({ length: 4 }).map((_, i) => <li key={i} className="p-4"><div className="skeleton h-10 rounded" /></li>)}
            {repos && shown.length === 0 && (
              <li className="p-6 text-center text-sm text-cs-text-muted">{q ? 'No repository matches.' : 'No public repositories yet.'}</li>
            )}
            {shown.map((r) => (
              <li key={r.full_name} className="flex items-center gap-3 px-4 py-3">
                <span className="w-8 h-8 rounded-lg bg-cs-overlay/[0.05] grid place-items-center text-lg shrink-0">
                  {r.language ? <LangLogo name={r.language} /> : <FiGithub />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{r.name}</p>
                  <p className="text-xs text-cs-text-muted truncate">
                    {[r.language, r.stars ? `★ ${r.stars}` : null, r.updated_at ? `updated ${timeAgo(r.updated_at)}` : null].filter(Boolean).join(' · ')}
                    {r.description ? ` · ${r.description}` : ''}
                  </p>
                </div>
                {r.imported_project_id ? (
                  <button onClick={() => { onClose(); navigate(`/projects/${r.imported_project_id}?step=build`); }}
                    className="btn btn-ghost btn-sm shrink-0 text-cs-green"><FiCheck /> Imported</button>
                ) : (
                  <button onClick={() => doImport(r.full_name, r.full_name)} disabled={!!busy} className="btn btn-primary btn-sm shrink-0">
                    {busy === r.full_name ? <ProgressRing pct={pct} /> : 'Import'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className="text-center py-3">
          <span className="w-14 h-14 rounded-2xl bg-[#24292f] text-white grid place-items-center text-3xl mx-auto"><FiGithub /></span>
          <h3 className="mt-3 font-semibold">Bring your GitHub work into CodeSquare</h3>
          <p className="mt-1 text-sm text-cs-text-dim max-w-md mx-auto">
            We copy the description, README, links and main file into a new project. Read-only: we never change your repos.
          </p>
          {status.oauth_enabled ? (
            <button onClick={connect} disabled={connecting}
              className="mt-4 inline-flex items-center gap-2 h-10 px-5 rounded-lg bg-[#24292f] text-white text-sm font-semibold hover:bg-black disabled:opacity-60">
              <FiGithub /> {connecting ? 'Opening GitHub…' : 'Connect GitHub'}
            </button>
          ) : (
            <p className="mt-4 text-xs text-cs-text-muted">Connecting an account isn’t set up on this server yet. Paste a public repo link below.</p>
          )}
        </div>
      )}

      {/* Paste a link (always available) */}
      <div className="mt-6 pt-5 border-t border-cs-line/10">
        <p className="text-sm font-semibold mb-2">{status?.connected ? 'Or import any public repo' : 'Import a public repo by link'}</p>
        <form onSubmit={(e) => { e.preventDefault(); if (url.trim()) doImport(url.trim(), 'url'); }} className="flex flex-col sm:flex-row gap-2">
          <span className="flex-1 min-w-0 flex items-center gap-2 input">
            <FiGithub className="text-cs-text-muted shrink-0" />
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://github.com/owner/repo"
              className="flex-1 min-w-0 bg-transparent outline-none" />
          </span>
          <button type="submit" disabled={!url.trim() || !!busy} className="btn btn-primary btn-sm disabled:opacity-50">
            {busy === 'url' ? <ProgressRing pct={pct} /> : <>Import <FiArrowRight /></>}
          </button>
        </form>
      </div>
    </Dialog>
  );
}
