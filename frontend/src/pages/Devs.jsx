import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiUsers, FiSearch, FiX, FiUserPlus, FiZap, FiChevronDown, FiMessageSquare } from 'react-icons/fi';
import SelectMenu from '../components/SelectMenu';
import { communityService } from '../services/api';
import { MAJORS, MAJOR_KEYS } from '../majors';
import VerifiedBadge from '../components/VerifiedBadge';
import { Sk } from '../components/Skeletons';

const PAGE = 24;

const CrownIcon = ({ className = '' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M3.2 7.2l4.3 3.3L12 5.6l4.5 4.9 4.3-3.3-1.7 9.3H4.9L3.2 7.2z" />
    <rect x="4.6" y="18.6" width="14.8" height="2" rx="1" />
  </svg>
);

function DevCard({ d }) {
  const majorData = d.major ? MAJORS[d.major] : null;
  const name = d.display_name || d.username;
  return (
    <Link to={`/u/${d.username}`}
      className="group rounded-xl border border-cs-line/10 p-5 flex flex-col text-cs-text hover:bg-cs-overlay/[0.03] hover:border-cs-line/25 transition-colors">
      <div className="flex items-center gap-4">
        <span className="relative shrink-0">
          <span className="block w-14 h-14 rounded-full overflow-hidden bg-cs-primary/10 text-cs-primary grid place-items-center text-lg font-bold">
            {d.avatar ? <img src={d.avatar} alt="" className="w-full h-full object-cover" /> : name.charAt(0).toUpperCase()}
          </span>
          {d.verified && <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-cs-dark p-px"><VerifiedBadge size="h-4 w-4" /></span>}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 min-w-0">
            <span className="font-semibold truncate group-hover:text-cs-primary transition-colors">{name}</span>
            {d.rank === 1 && (
              <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-cs-gold/15 text-cs-gold text-[0.6875rem] font-bold px-2 py-0.5">
                <CrownIcon className="w-3 h-3" /> Top dev
              </span>
            )}
            {d.is_staff && (
              <span className="shrink-0 rounded-full bg-cs-violet/15 text-cs-violet text-[0.6875rem] font-semibold px-2 py-0.5">Dev team</span>
            )}
          </p>
          <p className="text-sm text-cs-text-dim truncate mt-0.5">{d.headline || `@${d.username}`}</p>
        </div>
        <span className="self-start text-xs text-cs-text-muted tabular-nums shrink-0" title="Leaderboard rank">#{d.rank}</span>
      </div>

      <div className="mt-4 pt-3.5 border-t border-cs-line/10 flex items-center gap-3 text-sm text-cs-text-dim">
        {majorData ? (
          <span className="inline-flex items-center gap-1.5 min-w-0 truncate" style={{ color: majorData.color }}>
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: majorData.color }} />
            <span className="truncate">{majorData.label}</span>
          </span>
        ) : <span className="truncate text-cs-text-muted">@{d.username}</span>}
        <span className="ml-auto inline-flex items-center gap-3.5 shrink-0">
          <span className="inline-flex items-center gap-1" title="XP"><FiZap className="text-cs-orange" /> {d.xp.toLocaleString()}</span>
          <span className="inline-flex items-center gap-1" title="Followers"><FiUserPlus /> {d.follower_count}</span>
        </span>
      </div>
    </Link>
  );
}

export default function Devs() {
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  const [major, setMajor] = useState('');
  const [sort, setSort] = useState('rank');
  const [devs, setDevs] = useState(null); // null = loading, false = error
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const offsetRef = useRef(0);

  // search as you type
  useEffect(() => {
    const t = setTimeout(() => setQ(input.trim()), 300);
    return () => clearTimeout(t);
  }, [input]);

  const load = useCallback(async (reset) => {
    if (reset) { offsetRef.current = 0; setDevs(null); }
    try {
      const r = await communityService.devs({
        q: q || undefined, major: major || undefined, sort,
        limit: PAGE, offset: reset ? 0 : offsetRef.current,
      });
      setTotal(r.data.total);
      setHasMore(offsetRef.current + r.data.devs.length < r.data.total);
      offsetRef.current += r.data.devs.length;
      setDevs((prev) => (reset || !prev ? r.data.devs : [...prev, ...r.data.devs]));
    } catch {
      setDevs((prev) => prev || false);
    }
  }, [q, major, sort]);

  useEffect(() => { load(true); }, [load]);

  const more = async () => { setLoadingMore(true); await load(false); setLoadingMore(false); };

  const tabs = [['', 'All'], ...MAJOR_KEYS.map((k) => [k, MAJORS[k]?.label || k])];

  return (
    <main className="w-full px-6 lg:px-10 py-8">
      {/* Hero */}
      <section className="text-center pt-2 pb-7">
        <h1 className="text-3xl md:text-4xl font-semibold">People</h1>
        <p className="mt-2 text-cs-text-dim">Find developers learning alongside you, and follow their progress.</p>
        <Link to="/messages" className="btn btn-secondary btn-sm mt-4 inline-flex"><FiMessageSquare /> Messages</Link>
      </section>

      {/* Search + sort */}
      <div className="flex gap-3">
        <label className="flex-1 h-11 flex items-center gap-2 px-4 rounded-lg border border-cs-line/15 bg-cs-overlay/[0.02] focus-within:border-cs-primary/50 transition-colors">
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Search by name, handle or headline"
            aria-label="Search people"
            className="flex-1 min-w-0 bg-transparent outline-none text-[0.9375rem] placeholder:text-cs-text-muted" />
          {input
            ? <button type="button" onClick={() => setInput('')} className="text-cs-text-muted hover:text-cs-text" aria-label="Clear search"><FiX /></button>
            : <FiSearch className="text-cs-text-muted text-lg" />}
        </label>
        <SelectMenu value={sort} onChange={setSort} align="right" ariaLabel="Sort people"
          buttonClassName="h-11 px-4 text-[0.9375rem] min-w-[11rem] bg-cs-overlay/[0.02]"
          options={[
            { value: 'rank', label: 'Top ranked' },
            { value: 'followers', label: 'Most followed' },
            { value: 'newest', label: 'Newest' },
            { value: 'name', label: 'Name' },
          ]} />
      </div>

      {/* Major tabs */}
      <div className="mt-5 flex gap-x-7 border-b border-cs-line/10 overflow-x-auto">
        {tabs.map(([k, label]) => (
          <button key={k || 'all'} onClick={() => setMajor(k)}
            className={`relative h-11 px-0.5 text-[0.9375rem] whitespace-nowrap transition-colors ${major === k ? 'text-cs-primary' : 'text-cs-text-dim hover:text-cs-text'}`}>
            {label}
            {major === k && devs && <span className="ml-1.5 text-xs text-cs-text-muted">{total}</span>}
            {major === k && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-cs-primary" />}
          </button>
        ))}
      </div>

      {devs === null && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-cs-line/10 p-5">
              <div className="flex items-center gap-4">
                <Sk className="w-14 h-14 rounded-full" />
                <div className="flex-1 space-y-2"><Sk className="h-4 w-32" /><Sk className="h-3 w-48" /></div>
              </div>
              <Sk className="h-3.5 w-full mt-5" />
            </div>
          ))}
        </div>
      )}

      {devs === false && (
        <p className="text-center text-cs-text-dim text-sm py-16">Couldn’t load the directory. Try again in a moment.</p>
      )}

      {Array.isArray(devs) && devs.length === 0 && (
        <div className="text-center py-16">
          <FiUsers className="text-3xl text-cs-text-muted mx-auto mb-3" />
          <p className="text-cs-text-dim text-sm">No one matches that yet.</p>
        </div>
      )}

      {Array.isArray(devs) && devs.length > 0 && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {devs.map((d) => <div key={d.username} className="flex flex-col gap-2">
            <DevCard d={d} />
            {!d.is_me && <Link to={'/messages/' + encodeURIComponent(d.username)}
              aria-label={'Message ' + (d.display_name || d.username)}
              className="btn btn-secondary btn-sm self-end"><FiMessageSquare /> Message</Link>}
          </div>)}
        </div>
      )}

      {hasMore && (
        <div className="mt-8 flex justify-center">
          <button onClick={more} disabled={loadingMore}
            className="inline-flex items-center gap-2 h-9 px-5 rounded-full border border-cs-line/15 text-sm font-medium hover:border-cs-primary/50 hover:text-cs-primary transition-colors disabled:opacity-60">
            {loadingMore ? 'Loading…' : <>Load more <FiChevronDown /></>}
            <span className="text-xs text-cs-text-muted">{total - offsetRef.current} more</span>
          </button>
        </div>
      )}
    </main>
  );
}
