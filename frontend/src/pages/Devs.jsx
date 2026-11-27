import React, { useCallback, useEffect, useRef, useState } from 'react';
import SelectMenu from '../components/SelectMenu';
import { Link } from 'react-router-dom';
import {
  FiUsers, FiSearch, FiZap, FiBook, FiCode,
  FiMessageSquare, FiUserPlus, FiAward, FiX,
} from 'react-icons/fi';
import { communityService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { MAJORS } from '../majors';
import VerifiedBadge from '../components/VerifiedBadge';
import { Sk } from '../components/Skeletons';

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
      <div className="sticky top-[3.75rem] lg:top-14 z-30 -mx-6 lg:-mx-10 px-6 lg:px-10 pt-4 pb-4 -mt-8 mb-6 bg-cs-dark/85 backdrop-blur-xl border-b border-cs-line/[0.07]">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
          </div>
          {total > 0 && (
            <span className="text-sm text-cs-text-dim shrink-0 self-end">
              {total} dev{total === 1 ? '' : 's'} found
            </span>
          )}
        </div>

        {/* Search + filters */}
        <form onSubmit={submitSearch} className="mt-4 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[13.75rem]">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-cs-text-muted text-sm" />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Search by name, handle or headline…"
              className="input w-full h-10 !py-0 pl-9 pr-3 text-sm"
            />
          </div>
          <SelectMenu
            value={major}
            onChange={setMajor}
            ariaLabel="Filter by major"
            buttonClassName="h-10 px-3 text-sm"
            options={[
              { value: '', label: 'All majors' },
              ...[...MAJOR_KEYS, ...Object.keys(MAJORS).filter((k) => !MAJOR_KEYS.includes(k))]
                .map((k) => ({ value: k, label: MAJORS[k]?.label || k })),
            ]}
          />
          <button type="submit" className="btn btn-primary h-10 !py-0">Search</button>
          {(q || major) && (
            <button type="button" onClick={clearFilters} className="h-10 inline-flex items-center gap-1.5 px-2 text-cs-text-dim hover:text-cs-text text-sm">
              Clear <FiX />
            </button>
          )}
        </form>
      </div>

      {/* Loading skeletons */}
      {devs === null && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card !p-5 space-y-4">
              <div className="flex items-center gap-3">
                <Sk className="w-12 h-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Sk className="h-4 w-32" />
                  <Sk className="h-3 w-24" />
                </div>
              </div>
              <Sk className="h-3.5 w-full" />
              <Sk className="h-3.5 w-2/3" />
            </div>
          ))}
        </div>
      )}

      {devs === false && (
        <div className="card text-center py-14 border-cs-red/20">
          <p className="text-cs-text-dim text-sm">Couldn't load the directory.</p>
        </div>
      )}

      {Array.isArray(devs) && devs.length === 0 && (
        <div className="card text-center py-14">
          <FiUsers className="text-3xl text-cs-text-muted mx-auto mb-3" />
          <p className="text-cs-text-dim text-sm">No developers match that search.</p>
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
                className="group card !p-5 flex flex-col gap-3 text-cs-text hover:border-cs-primary/40 transition-colors"
              >
                {/* who */}
                <div className="flex items-center gap-3">
                  <span className="w-12 h-12 rounded-full bg-cs-primary/10 text-cs-primary grid place-items-center font-bold text-lg overflow-hidden shrink-0">
                    {d.avatar
                      ? <img src={d.avatar} alt="" className="w-full h-full object-cover" />
                      : (d.display_name || d.username).charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate flex items-center gap-1.5 group-hover:text-cs-primary transition-colors">
                      {d.display_name || d.username}
                      {d.verified && <VerifiedBadge size="h-4 w-4" />}
                    </p>
                    <p className="text-sm text-cs-text-dim truncate">
                      @{d.username}
                      {d.is_staff && <span className="text-cs-violet"> · Dev team</span>}
                    </p>
                  </div>
                  {champion ? (
                    <span className="inline-flex items-center gap-1 text-sm font-bold text-cs-gold shrink-0" title="Leaderboard #1">
                      <CrownIcon className="w-4 h-4" /> #1
                    </span>
                  ) : (
                    <span className="text-sm text-cs-text-dim shrink-0 tabular-nums" title="Leaderboard rank">#{d.rank}</span>
                  )}
                </div>

                {/* major + headline */}
                {majorData && (
                  <p className="text-sm font-medium inline-flex items-center gap-1.5" style={{ color: majorData.color }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: majorData.color }} />
                    {majorData.label}
                  </p>
                )}
                {d.headline && (
                  <p className="text-sm text-cs-text-dim line-clamp-2">{d.headline}</p>
                )}

                {/* stats: one plain line */}
                <div className="mt-auto pt-3 border-t border-cs-line/10 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-cs-text-dim">
                  <span><strong className="text-cs-text">{d.xp.toLocaleString()}</strong> XP</span>
                  <span><strong className="text-cs-text">{d.lessons_completed}</strong> lessons</span>
                  <span><strong className="text-cs-text">{d.challenges_solved}</strong> challenges</span>
                  <span className="ml-auto inline-flex items-center gap-3 text-xs">
                    <span className="inline-flex items-center gap-1" title="Followers"><FiUserPlus /> {d.follower_count}</span>
                    <span className="inline-flex items-center gap-1" title="Posts"><FiMessageSquare /> {d.post_count}</span>
                  </span>
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