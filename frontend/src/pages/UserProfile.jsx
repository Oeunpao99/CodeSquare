import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  FiArrowLeft, FiZap, FiBook, FiCode, FiCheckSquare, FiAward, FiStar,
  FiUser, FiUsers, FiUserPlus, FiUserCheck, FiActivity, FiMessageSquare,
  FiGithub, FiGlobe, FiLinkedin, FiFileText, FiChevronLeft, FiChevronRight,
} from 'react-icons/fi';
import { communityService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { MAJORS } from '../majors';
import VerifiedBadge from '../components/VerifiedBadge';
import { toast } from '../utils/toast';
import { formatDate } from '../utils/datetime';
import PostCard from '../components/PostCard';

// --- deterministic heatmap helpers (mirrors Profile.jsx) ---
function seeded(i, j) {
  const x = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return x - Math.floor(x);
}
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const LEVEL_STYLES = ['bg-level-0', 'bg-level-1', 'bg-level-2', 'bg-level-3', 'bg-level-4'];

const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const monIndex = (date) => (date.getDay() + 6) % 7;
const levelFor = (v) => (v <= 0 ? 0 : v <= 1 ? 1 : v <= 3 ? 2 : v <= 6 ? 3 : 4);

// Build a minimal, fully-synthetic "activity streak" grid so other users' profiles
// read like a living board without exposing per-day lesson details.
function buildYearGrid(total, year) {
  const density = Math.min(0.8, 0.1 + total * 0.05);
  const today = startOfDay(new Date());
  const start = startOfDay(new Date(year, 0, 1));
  start.setDate(start.getDate() - monIndex(start));
  const end = startOfDay(new Date(year, 11, 31));
  end.setDate(end.getDate() + (6 - monIndex(end)));

  const grid = [];
  const monthLabel = [];
  let lastMonth = -1;
  for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 7)) {
    const col = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(cursor);
      date.setDate(date.getDate() + d);
      const inYear = date.getFullYear() === year;
      const future = date > today;
      const daysAgo = Math.round((today - date) / 86400000);
      let level = 0;
      if (inYear && !future) {
        const recency = 1 - Math.min(1, daysAgo / 365);
        const threshold = density * (0.4 + recency * 0.8);
        const r = seeded(Math.floor(date.getTime() / 86400000), date.getDay());
        if (r < threshold) level = r < threshold * 0.3 ? 1 : r < threshold * 0.6 ? 2 : r < threshold * 0.85 ? 3 : 4;
      }
      col.push({ level, pad: !inYear, future: future && inYear, today: date.getTime() === today.getTime() });
    }
    const m = new Date(cursor).getMonth();
    monthLabel.push(m !== lastMonth ? m : null);
    lastMonth = m;
    grid.push(col);
  }
  return { grid, monthLabel };
}

// --- small presentational bits ---
// One metric at a time, switchable — cleaner than a wall of stat cards.
function StatSwitcher({ stats }) {
  const [i, setI] = useState(0);
  const go = (d) => setI((p) => (p + d + stats.length) % stats.length);
  const s = stats[i];
  return (
    <div
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') go(-1);
        if (e.key === 'ArrowRight') go(1);
      }}
      className="rounded-2xl border border-cs-line/10 bg-cs-darker p-5 mb-8 outline-none focus-visible:ring-1 focus-visible:ring-cs-primary/40"
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => go(-1)}
          aria-label="Previous stat"
          className="shrink-0 w-10 h-10 rounded-lg border border-cs-line/15 bg-cs-darkest/60 flex items-center justify-center text-cs-text-muted hover:text-cs-primary hover:border-cs-primary/40 transition-colors"
        >
          <FiChevronLeft />
        </button>

        <div className="flex-1 flex items-center justify-center gap-4 text-center">
          <span className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0 ${s.chip} ${s.cls}`}>{s.icon}</span>
          <div className="min-w-0">
            <div className="text-3xl font-bold font-mono leading-tight">{s.value}</div>
            <div className="text-xs text-cs-text-dim mt-0.5">{s.label}</div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => go(1)}
          aria-label="Next stat"
          className="shrink-0 w-10 h-10 rounded-lg border border-cs-line/15 bg-cs-darkest/60 flex items-center justify-center text-cs-text-muted hover:text-cs-primary hover:border-cs-primary/40 transition-colors"
        >
          <FiChevronRight />
        </button>
      </div>

      <div className="flex items-center justify-center gap-1.5 mt-4">
        {stats.map((st, j) => (
          <button
            key={st.label}
            type="button"
            onClick={() => setI(j)}
            aria-label={st.label}
            title={st.label}
            className={`h-1.5 rounded-full transition-all ${
              j === i ? `w-5 ${st.cls} bg-current` : 'w-1.5 bg-cs-line/15 hover:bg-cs-line/30'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function FollowerChip({ icon, count, label, onClick }) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 ${onClick ? 'hover:text-cs-primary' : ''} transition-colors`}
    >
      <span className="font-mono text-sm font-bold text-cs-text">{count}</span>
      <span className="font-mono text-xs text-cs-text-muted inline-flex items-center gap-1">{icon} {label}</span>
    </Comp>
  );
}

export default function UserProfile() {
  const { username } = useParams();
  const { user: me } = useAuth();
  const [data, setData] = useState(null); // null = loading, false = error
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState('posts'); // posts | projects | activity
  const [busyFollow, setBusyFollow] = useState(false);

  const [posts, setPosts] = useState(null);     // null = loading, false = error, [] = none
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const PAGE = 10;

  const loadPosts = useCallback(async (reset) => {
    const nextOffset = reset ? 0 : offset;
    if (reset) { setPosts(null); setHasMore(false); }
    try {
      const r = await communityService.userPosts(username, { limit: PAGE, offset: nextOffset });
      setHasMore(r.data.has_more);
      setOffset(nextOffset + r.data.posts.length);
      setPosts((prev) => (reset || !prev ? r.data.posts : [...prev, ...r.data.posts]));
    } catch {
      setPosts((prev) => prev || false);
    }
  }, [username, offset]);

  useEffect(() => {
    let alive = true;
    setData(null);
    setNotFound(false);
    setTab('posts');
    setPosts(null); setHasMore(false); setOffset(0);
    communityService
      .profile(username)
      .then((r) => alive && setData(r.data))
      .catch(() => alive && setNotFound(true));
    if (username) loadPosts(true);
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  const toggleFollow = async () => {
    if (busyFollow || !data || data.is_me) return;
    setBusyFollow(true);
    try {
      const r = data.is_following
        ? await communityService.unfollow(username)
        : await communityService.follow(username);
      setData((prev) => ({
        ...prev,
        is_following: r.data.following,
        follower_count: r.data.follower_count,
      }));
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not update follow.');
    } finally {
      setBusyFollow(false);
    }
  };

  const loadMore = async () => { setLoadingMore(true); await loadPosts(false); setLoadingMore(false); };

  const dropPost = (id) => setPosts((prev) => (prev || []).filter((x) => x.id !== id));

  const major = data?.major ? MAJORS[data.major] : null;
  const name = data?.display_name || data?.username || '…';
  const isMe = !!data?.is_me;

  const selectedYear = new Date().getFullYear();
  const heat = useMemo(
    () => (data ? buildYearGrid(data.xp || 0, selectedYear) : { grid: [], monthLabel: [] }),
    [data, selectedYear],
  );

  if (notFound) {
    return (
      <main className="w-full px-6 lg:px-10 py-16">
        <div className="max-w-md mx-auto card text-center py-14 border-cs-orange/25">
          <p className="font-mono text-5xl mb-4 text-cs-text-muted select-none">404</p>
          <p className="text-cs-text-dim mb-6 font-mono">user_not_found: /u/{username}</p>
          <Link to="/community" className="btn btn-primary btn-sm">Back to Community</Link>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="w-full px-6 lg:px-10 py-8">
        <p className="text-cs-text-muted font-mono text-sm">loading /u/{username}…</p>
      </main>
    );
  }

  return (
    <main className="w-full px-6 lg:px-10 py-8">
      {/* Sticky profile header */}
      <div className="sticky top-0 z-30 -mx-6 lg:-mx-10 px-6 lg:px-10 pt-4 pb-0 -mt-8 mb-6 bg-cs-dark/85 backdrop-blur-xl border-b border-cs-line/[0.07]">
        <Link to="/community" className="inline-flex items-center gap-2 text-sm font-mono text-cs-text-dim hover:text-cs-primary mb-3">
          <FiArrowLeft /> ../community
        </Link>

        <div className="flex items-center gap-5 flex-wrap">
          <div className="w-20 h-20 rounded-full bg-gradient-main flex items-center justify-center text-3xl font-bold overflow-hidden shrink-0 border-2 border-cs-primary/40 shadow-[0_0_28px_-6px_rgb(var(--cs-primary)/0.5)]">
            {data.avatar
              ? <img src={data.avatar} alt={name} className="w-full h-full object-cover" />
              : <span>{(name).charAt(0).toUpperCase()}</span>}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl md:text-3xl font-bold truncate">{name}</h1>
              {data.verified && <VerifiedBadge />}
              {data.is_staff && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-cs-violet/40 bg-cs-violet/10 text-cs-violet font-mono text-[10px] uppercase tracking-wide">
                  <FiAward className="text-[11px]" /> dev team
                </span>
              )}
            </div>
            <p className="text-xs md:text-sm text-cs-text-dim mt-1">
              <span className="font-mono text-cs-text-muted">@{data.username}</span>
              {major ? <span className="text-cs-mint"> · {major.label}</span> : null}
              {data.rank ? <span className="text-cs-text-muted"> · rank #{data.rank}</span> : null}
              {data.joined && <span className="text-cs-text-muted"> · joined {new Date(data.joined).getFullYear()}</span>}
            </p>

            {/* follower / following counts */}
            <div className="flex items-center gap-4 mt-2">
              <FollowerChip icon={<FiUsers className="text-[11px]" />} count={data.follower_count} label="followers" />
              <FollowerChip icon={<FiUserPlus className="text-[11px]" />} count={data.following_count} label="following" />
            </div>
          </div>

          {/* Follow button (hidden on own profile) */}
          {!isMe && (
            <button
              onClick={toggleFollow}
              disabled={busyFollow}
              className={`btn btn-sm shrink-0 ${
                data.is_following ? 'btn-secondary' : 'btn-primary'
              }`}
            >
              {data.is_following ? <><FiUserCheck /> following</> : <><FiUserPlus /> follow</>}
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mt-4 pb-2 -mb-px overflow-x-auto">
          {[
            { id: 'posts', label: 'posts', icon: <FiMessageSquare /> },
            { id: 'projects', label: 'projects', icon: <FiCode /> },
            { id: 'activity', label: 'activity', icon: <FiActivity /> },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-t-lg border-b-2 font-mono text-sm whitespace-nowrap transition-colors ${
                tab === t.id
                  ? 'border-cs-primary text-cs-primary'
                  : 'border-transparent text-cs-text-dim hover:text-cs-text'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bio */}
      {tab !== 'activity' && data.bio && (
        <div className="rounded-2xl border border-cs-line/10 bg-cs-darker p-5 mb-6">
          <p className="text-sm text-cs-text-dim leading-relaxed whitespace-pre-wrap">{data.bio}</p>
          {(data.github_url || data.website_url || data.linkedin_url) && (
            <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-cs-line/8">
              {data.github_url && (
                <a href={data.github_url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 text-xs font-mono text-cs-text-muted hover:text-cs-primary transition-colors">
                  <FiGithub /> github
                </a>
              )}
              {data.website_url && (
                <a href={data.website_url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 text-xs font-mono text-cs-text-muted hover:text-cs-primary transition-colors">
                  <FiGlobe /> website
                </a>
              )}
              {data.linkedin_url && (
                <a href={data.linkedin_url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 text-xs font-mono text-cs-text-muted hover:text-cs-primary transition-colors">
                  <FiLinkedin /> linkedin
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {/* Stats — switchable single-metric view */}
      <StatSwitcher
        key={username}
        stats={[
          { icon: <FiZap />, value: data.xp, label: 'Total XP', cls: 'text-cs-cyan', chip: 'bg-cs-cyan/15' },
          { icon: <FiBook />, value: data.lessons_completed, label: 'Lessons', cls: 'text-cs-primary', chip: 'bg-cs-primary/15' },
          { icon: <FiCode />, value: data.challenges_solved, label: 'Challenges', cls: 'text-cs-green', chip: 'bg-cs-green/15' },
          { icon: <FiCheckSquare />, value: data.quizzes_passed, label: 'Quizzes', cls: 'text-cs-orange', chip: 'bg-cs-orange/15' },
          { icon: <FiUsers />, value: data.credits ?? 0, label: 'Contribution', cls: 'text-cs-mint', chip: 'bg-cs-mint/15' },
          { icon: <FiAward />, value: data.current_streak, label: 'Day Streak', cls: 'text-cs-violet', chip: 'bg-cs-violet/15' },
          { icon: <FiStar />, value: data.rank ? `#${data.rank}` : '—', label: 'Rank', cls: 'text-cs-violet', chip: 'bg-cs-violet/15' },
        ]}
      />

      {/* ---- TAB: POSTS ---- */}
      {tab === 'posts' && (
        <div>
          <span className="mono-label text-cs-text-dim mb-3 block"> recent posts</span>
          {posts === null && (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="post-card animate-pulse">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-cs-darkest" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-40 bg-cs-darkest rounded" />
                      <div className="h-2.5 w-24 bg-cs-darkest rounded" />
                    </div>
                  </div>
                  <div className="h-3 bg-cs-darkest rounded mb-2" />
                  <div className="h-3 bg-cs-darkest rounded mb-2" />
                  <div className="h-3 w-2/3 bg-cs-darkest rounded" />
                </div>
              ))}
            </div>
          )}
          {posts === false && (
            <div className="card text-center py-14 border-cs-red/20">
              <p className="text-cs-text-dim font-mono text-sm">Couldn't load {name}'s posts.</p>
            </div>
          )}
          {Array.isArray(posts) && posts.length === 0 && (
            <div className="card text-center py-14">
              <FiMessageSquare className="text-3xl text-cs-text-muted mx-auto mb-3" />
              <p className="text-cs-text-dim font-mono text-sm">
                {isMe ? 'You haven’t posted anything yet.' : `${name} hasn’t posted anything yet.`}
              </p>
            </div>
          )}
          {Array.isArray(posts) && posts.length > 0 && (
            <div className="space-y-3">
              {posts.map((p) => (
                <PostCard key={p.id} post={p} onDelete={isMe ? dropPost : undefined} />
              ))}
              {hasMore && (
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="btn btn-secondary btn-sm w-full justify-center"
                >
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ---- TAB: PROJECTS ---- */}
      {tab === 'projects' && (
        <div>
          <span className="mono-label text-cs-text-dim mb-3 block"> shared projects</span>
          {data.recent_projects && data.recent_projects.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {data.recent_projects.map((p) => (
                <Link
                  key={p.id}
                  to={`/projects/${p.id}`}
                  className="rounded-2xl border border-cs-line/10 bg-cs-darker p-4 transition-colors hover:border-cs-primary/30"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-cs-darkest border border-cs-line/15 flex items-center justify-center text-cs-primary shrink-0">
                      <FiCode />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-sm font-semibold truncate">{p.title}</p>
                      <p className="font-mono text-[11px] text-cs-text-muted truncate capitalize">
                        {p.language || 'unknown'}
                        {p.status ? ` · ${p.status}` : ''}
                      </p>
                    </div>
                  </div>
                  {p.updated_at && (
                    <p className="mt-3 pt-3 border-t border-cs-line/8 font-mono text-[11px] text-cs-text-muted">
                      updated {formatDate(p.updated_at)}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          ) : (
            <div className="card text-center py-12">
              <FiCode className="text-3xl text-cs-text-muted mx-auto mb-3" />
              <p className="text-cs-text-dim font-mono text-sm">
                {isMe ? 'You haven’t shared any projects yet.' : 'No shared projects yet.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ---- TAB: ACTIVITY ---- */}
      {tab === 'activity' && (
        <div className="space-y-6">
          {data.bio && (
            <div className="rounded-2xl border border-cs-line/10 bg-cs-darker p-5">
              <p className="text-sm text-cs-text-dim leading-relaxed whitespace-pre-wrap">{data.bio}</p>
              {(data.github_url || data.website_url || data.linkedin_url) && (
                <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-cs-line/8">
                  {data.github_url && (
                    <a href={data.github_url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 text-xs font-mono text-cs-text-muted hover:text-cs-primary transition-colors">
                      <FiGithub /> github
                    </a>
                  )}
                  {data.website_url && (
                    <a href={data.website_url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 text-xs font-mono text-cs-text-muted hover:text-cs-primary transition-colors">
                      <FiGlobe /> website
                    </a>
                  )}
                  {data.linkedin_url && (
                    <a href={data.linkedin_url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 text-xs font-mono text-cs-text-muted hover:text-cs-primary transition-colors">
                      <FiLinkedin /> linkedin
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          {/* contribution heatmap */}
          <div className="rounded-2xl border border-cs-line/10 bg-cs-darker p-5 overflow-hidden">
            <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2"><FiActivity /> Coding activity · {selectedYear}</h3>
                <p className="text-xs text-cs-text-muted mt-0.5">Estimated from total XP — {data.xp} XP earned</p>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-cs-text-muted">
                Less
                {[0, 1, 2, 3, 4].map((lvl) => (
                  <span key={lvl} className={`w-3 h-3 rounded-[3px] border border-cs-line/10 ${LEVEL_STYLES[lvl]}`} />
                ))}
                More
              </div>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[680px]">
                <div className="flex gap-[3px] mb-1.5" style={{ marginLeft: '1.75rem' }}>
                  {heat.monthLabel.map((m, i) => (
                    <div key={i} className="w-2.5 text-[10px] text-cs-text-muted whitespace-nowrap">{m != null ? MONTHS[m] : ''}</div>
                  ))}
                </div>
                <div className="flex">
                  <div className="flex flex-col gap-[3px] mr-2 text-[9px] text-cs-text-muted pr-1 w-7">
                    {['Mon', '', 'Wed', '', 'Fri', '', 'Sun'].map((d, i) => (
                      <div key={i} className="h-2.5 flex items-center leading-none">{d}</div>
                    ))}
                  </div>
                  <div className="flex gap-[3px]">
                    {heat.grid.map((col, w) => (
                      <div key={w} className="flex flex-col gap-[3px]">
                        {col.map((cell, d) => (
                          <div
                            key={d}
                            className={`w-2.5 h-2.5 rounded-[3px] ${cell.pad ? 'invisible' : LEVEL_STYLES[cell.level]} ${cell.future ? 'opacity-40' : ''} ${cell.today ? 'ring-1 ring-cs-primary scale-125' : ''}`}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* skills-ish footer card */}
          <div className="rounded-2xl border border-cs-line/10 bg-cs-darker p-5 flex flex-wrap items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-cs-darkest border border-cs-line/15 flex items-center justify-center text-cs-primary shrink-0">
              <FiFileText />
            </span>
            <p className="text-sm text-cs-text-dim">
              {isMe
                ? 'This is your public profile — what other learners see when they follow you.'
                : `Follow ${name} to keep up with their posts and projects.`}
            </p>
            {!isMe && (
              <button onClick={toggleFollow} disabled={busyFollow} className={`btn btn-sm ml-auto ${data.is_following ? 'btn-secondary' : 'btn-primary'}`}>
                {data.is_following ? <><FiUserCheck /> following</> : <><FiUserPlus /> follow</>}
              </button>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
