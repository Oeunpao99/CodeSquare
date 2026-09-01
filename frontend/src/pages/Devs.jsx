import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiUsers, FiSearch, FiZap, FiBook, FiCode,
  FiMessageSquare, FiUserPlus, FiAward, FiX,
} from 'react-icons/fi';
import { communityService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { MAJORS } from '../majors';
import VerifiedBadge from '../components/VerifiedBadge';

const PAGE = 24;

const CrownIcon = ({ className = '' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M3.2 7.2l4.3 3.3L12 5.6l4.5 4.9 4.3-3.3-1.7 9.3H4.9L3.2 7.2z" />
    <rect x="4.6" y="18.6" width="14.8" height="2" rx="1" />
  </svg>
);

const MAJOR_KEYS = ['ai-engineer', 'backend-engineer', 'frontend-developer', 'devops', 'data-scientist', 'automation-engineer'];

export default function Devs() {
  const { user: me } = useAuth();
  const [q, setQ] = useState('');
  const [major, setMajor] = useState('');
  const [input, setInput] = useState('');
  const [devs, setDevs] = useState(null); // null = loading, false = error
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const offsetRef = useRef(0);

  const load = useCallback(async (reset) => {
    if (reset) { offsetRef.current = 0; setDevs(null); }
    try {
      const r = await communityService.devs({
        q: q || undefined, major: major || undefined,
        limit: PAGE, offset: reset ? 0 : offsetRef.current,
      });
      setTotal(r.data.total);
      setHasMore(offsetRef.current + r.data.devs.length < r.data.total);
      offsetRef.current += r.data.devs.length;
      setDevs((prev) => (reset || !prev ? r.data.devs : [...prev, ...r.data.devs]));
    } catch {
      setDevs((prev) => prev || false);
    }
  }, [q, major]);

  useEffect(() => { load(true); }, [load]);

  const more = async () => { setLoadingMore(true); await load(false); setLoadingMore(false); };

  const submitSearch = (e) => { e.preventDefault(); setQ(input.trim()); };

  const clearFilters = () => { setQ(''); setInput(''); setMajor(''); };

  return (
    <main className="w-full px-6 lg:px-10 py-8">
      {/* Sticky header */}
      <div className="sticky top-0 z-30 -mx-6 lg:-mx-10 px-6 lg:px-10 pt-4 pb-4 -mt-8 mb-6 bg-cs-dark/85 backdrop-blur-xl border-b border-cs-line/[0.07]">
        <div className="flex items-start justify-between gap-4 flex-wrap lg:pr-14">
          <div>
            <span className="mono-label text-cs-primary"> dev directory</span>
            <h1 className="text-3xl font-bold mt-2 flex items-center gap-3">
              <FiUsers className="text-cs-primary" /> Developer Directory
            </h1>
            <p className="text-sm text-cs-text-dim mt-1">
              Find developers, mentors and students — then follow their posts, projects and activity.
            </p>
          </div>
          {total > 0 && (
            <span className="font-mono text-xs text-cs-text-muted shrink-0">
              {total} dev{total === 1 ? '' : 's'} found
            </span>
          )}
        </div>

        {/* Search + filters */}
        <form onSubmit={submitSearch} className="mt-4 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-cs-text-muted text-sm" />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="search by name, handle, or headline…"
              className="w-full rounded-lg bg-cs-darkest/70 border border-cs-line/15 pl-9 pr-3 py-2 text-sm font-mono outline-none focus:border-cs-primary/50"
            />
          </div>
          <select
            value={major}
            onChange={(e) => setMajor(e.target.value)}
            className="rounded-lg bg-cs-darkest/70 border border-cs-line/15 px-3 py-2 text-sm font-mono outline-none focus:border-cs-primary/50 text-cs-text-dim"
          >
            <option value="">all majors</option>
            {MAJOR_KEYS.map((k) => (
              <option key={k} value={k}>{MAJORS[k]?.label || k}</option>
            ))}
            {Object.keys(MAJORS).filter((k) => !MAJOR_KEYS.includes(k)).map((k) => (
              <option key={k} value={k}>{MAJORS[k]?.label || k}</option>
            ))}
          </select>
          <button type="submit" className="btn btn-primary btn-sm">Search</button>
          {(q || major) && (
            <button type="button" onClick={clearFilters} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-cs-line/15 text-cs-text-muted hover:text-cs-text text-xs font-mono">
              clear <FiX />
            </button>
          )}
        </form>
      </div>

      {/* Loading skeletons */}
      {devs === null && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-cs-line/10 bg-cs-darker p-5 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-cs-darkest" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-32 bg-cs-darkest rounded" />
                  <div className="h-3 w-24 bg-cs-darkest rounded" />
                </div>
              </div>
              <div className="h-3 bg-cs-darkest rounded mt-4" />
              <div className="h-3 bg-cs-darkest rounded mt-2 w-2/3" />
            </div>
          ))}
        </div>
      )}

      {devs === false && (
        <div className="card text-center py-14 border-cs-red/20">
          <p className="text-cs-text-dim font-mono text-sm">Couldn't load the directory.</p>
        </div>
      )}

      {Array.isArray(devs) && devs.length === 0 && (
        <div className="card text-center py-14">
          <FiUsers className="text-3xl text-cs-text-muted mx-auto mb-3" />
          <p className="text-cs-text-dim font-mono text-sm">No developers match that search.</p>
        </div>
      )}

      {Array.isArray(devs) && devs.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {devs.map((d) => {
            const majorData = d.major ? MAJORS[d.major] : null;
            const champion = d.rank === 1;
            return (
              <Link
                key={d.username}
                to={`/u/${d.username}`}
                className="group relative rounded-2xl border border-cs-line/10 bg-cs-darker/60 overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-cs-primary/30 hover:bg-cs-darker"
              >
                <div className="p-5">
                  <div className="flex items-center justify-between gap-2">
                    {champion ? (
                      <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold tracking-[0.2em] uppercase text-cs-gold">
                        <CrownIcon className="text-xs" /> champion · #1
                      </span>
                    ) : (
                      <span className="inline-flex items-center font-mono text-[11px] font-semibold tracking-[0.2em] text-cs-text-dim uppercase">
                        <span className="text-cs-primary">#</span>{String(d.rank).padStart(4, '0')}
                      </span>
                    )}
                    {majorData ? (
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border font-mono text-[11px] font-semibold"
                        style={{ borderColor: `${majorData.color}40`, color: majorData.color, background: `${majorData.color}14` }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: majorData.color }} />
                        {majorData.label}
                      </span>
                    ) : (
                      <span className="font-mono text-[11px] text-cs-text-dim/80">no major</span>
                    )}
                  </div>

                  <div className="flex items-center gap-3.5 mt-4">
                    <span
                      className="relative w-14 h-14 rounded-2xl bg-cs-darkest border border-cs-line/15 flex items-center justify-center font-mono font-bold text-lg text-cs-primary overflow-hidden shrink-0 transition-colors"
                      style={majorData ? { boxShadow: `0 0 0 1px ${majorData.color}2a` } : undefined}
                    >
                      {d.avatar
                        ? <img src={d.avatar} alt="" className="w-full h-full object-cover" />
                        : <span>{(d.display_name || d.username).charAt(0).toUpperCase()}</span>}
                      <span className="absolute bottom-1 right-1 w-3 h-3 rounded-full bg-cs-green ring-2 ring-cs-darker" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-mono text-[15px] font-semibold truncate flex items-center gap-1.5">
                        {d.display_name || d.username}
                        {d.verified && <VerifiedBadge size="h-4 w-4" />}
                      </p>
                      <p className="font-mono text-xs font-semibold text-cs-text-dim truncate mt-0.5">
                        @{d.username}
                        {d.is_staff && <span className="text-cs-violet"> · dev team</span>}
                      </p>
                    </div>
                  </div>

                  {d.headline ? (
                    <p className="mt-4 text-xs font-medium text-cs-text-dim line-clamp-2 leading-relaxed">{d.headline}</p>
                  ) : (
                    <p className="mt-4 font-mono text-xs text-cs-text-dim/80">no headline yet</p>
                  )}

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {[
                      { label: 'xp',       value: d.xp,                cls: 'text-cs-cyan' },
                      { label: 'lessons',  value: d.lessons_completed, cls: 'text-cs-primary' },
                      { label: 'challenges', value: d.challenges_solved, cls: 'text-cs-green' },
                    ].map((s) => (
                      <div key={s.label} className="rounded-lg border border-cs-line/10 bg-cs-darkest/40 px-2 py-2 text-center">
                        <div className={`font-mono text-lg font-bold leading-none ${s.cls}`}>{s.value}</div>
                        <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-cs-text-dim mt-1.5">{s.label}</div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 pt-3 border-t border-cs-line/8 flex items-center gap-4 text-cs-text-dim">
                    <span className="inline-flex items-center gap-1 text-xs font-mono"><FiUserPlus className="text-cs-mint" /> {d.follower_count}</span>
                    <span className="inline-flex items-center gap-1 text-xs font-mono"><FiMessageSquare className="text-cs-orange" /> {d.post_count}</span>
                    <span className="inline-flex items-center gap-1 text-xs font-mono"><FiAward className="text-cs-violet" /> {d.credits ?? 0}</span>
                    <span className="ml-auto font-mono text-[11px] text-cs-primary/0 group-hover:text-cs-primary transition-colors font-semibold">view →</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {hasMore && (
        <button
          onClick={more}
          disabled={loadingMore}
          className="btn btn-secondary btn-sm w-full justify-center mt-4"
        >
          {loadingMore ? 'Loading…' : `Load more (${total - offsetRef.current} remaining)`}
        </button>
      )}
    </main>
  );
}