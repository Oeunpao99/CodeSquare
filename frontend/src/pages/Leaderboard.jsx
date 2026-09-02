import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { communityService } from '../services/api';
import { MAJORS } from '../majors';
import VerifiedBadge from '../components/VerifiedBadge';
import {
  FiAward, FiTerminal, FiZap, FiChevronUp,
} from 'react-icons/fi';

const MEDAL = ['#F5C518', '#B8C0C8', '#CD7F42']; // gold / silver / bronze

function Row({ r, highlight }) {
  const major = r.major ? MAJORS[r.major]?.label : null;
  const medal = r.rank <= 3 ? MEDAL[r.rank - 1] : null;
  return (
    <Link
      to={`/u/${r.username}`}
      className={`flex items-center gap-4 p-4 rounded-xl border transition-colors group ${
        highlight
          ? 'border-cs-text-muted/20 bg-cs-primary/[0.07]'
          : 'border-cs-text-muted/15 bg-cs-darker/40 hover:border-cs-text-muted/30 hover:bg-cs-overlay/[0.05]'
      }`}
    >
      <span
        className={`w-9 shrink-0 text-center font-mono text-base font-bold ${
          medal ? '' : 'text-cs-text-muted'
        }`}
        style={medal ? { color: medal } : undefined}
      >
        {r.rank}
      </span>
      <span className="w-12 h-12 rounded-xl bg-cs-darkest border border-cs-primary/25 flex items-center justify-center font-mono font-bold text-cs-primary overflow-hidden shrink-0">
        {r.avatar_url
          ? <img src={r.avatar_url} alt={r.username} className="w-full h-full object-cover" />
          : <span>{r.username?.charAt(0).toUpperCase()}</span>}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-sm font-semibold truncate">
          <span className="inline-flex items-center gap-1">
            <span className="truncate group-hover:text-cs-primary transition-colors">{r.username}</span>
            {r.verified && <VerifiedBadge size="h-4 w-4" />}
          </span>
          {highlight && <span className="text-cs-primary font-normal"> · you</span>}
        </p>
        <p className="font-mono text-[11px] text-cs-text-muted truncate">{major || '—'}</p>
      </div>
      <span
        className="inline-flex items-center gap-1.5 font-mono text-sm font-bold text-cs-primary shrink-0 bg-cs-primary/10 border border-cs-primary/20 rounded-lg px-2.5 py-1"
      >
        <FiZap className="text-[11px]" /> {r.xp.toLocaleString()} <span className="text-[10px] font-medium text-cs-text-muted">xp</span>
      </span>
    </Link>
  );
}

function Leaderboard() {
  const [data, setData] = useState(null); // null = loading, false = error

  useEffect(() => {
    communityService.leaderboard().then((r) => setData(r.data)).catch(() => setData(false));
  }, []);

  return (
    <main className="w-full px-6 lg:px-10 py-8">
      <div className="sticky top-0 z-30 -mx-6 lg:-mx-10 px-6 lg:px-10 pt-4 pb-4 -mt-8 mb-6 bg-cs-dark/85 backdrop-blur-xl border-b border-cs-line/[0.07]">
        <span className="mono-label text-cs-primary"> community</span>
        <h1 className="text-3xl font-bold mt-2 flex items-center gap-3">
          <FiTerminal className="text-cs-primary" /> Leaderboard
        </h1>
        <p className="text-sm text-cs-text-dim mt-1">
          Ranked by total XP — completed lessons + solved challenges.
        </p>
      </div>

      {data === null && (
        <p className="text-cs-text-muted font-mono text-sm">mounting /leaderboard…</p>
      )}
      {data === false && (
        <div className="card text-center py-14 border-cs-red/20">
          <p className="text-cs-text-dim font-mono text-sm">Couldn’t load the leaderboard. Try again in a bit.</p>
        </div>
      )}

      {data && data.total_ranked === 0 && (
        <div className="card text-center py-14 border-cs-primary/20">
          <p className="text-4xl mb-3">🏁</p>
          <p className="text-cs-text-dim mb-6 max-w-sm mx-auto font-mono text-sm">
            No one’s on the board yet. Finish a lesson or solve a challenge to be first.
          </p>
          <Link to="/practice" className="btn btn-primary btn-sm"><FiZap /> Go practice</Link>
        </div>
      )}

      {data && data.total_ranked > 0 && (
        <div>
          <div className="flex flex-col gap-2.5">
            {data.top.map((r) => (
              <Row key={r.user_id} r={r} highlight={r.is_me} />
            ))}
          </div>

          {data.me && (
            <>
              <div className="flex items-center justify-center py-3 text-cs-text-muted">
                <FiChevronUp />
              </div>
              <Row r={data.me} highlight />
              <p className="text-center font-mono text-[11px] text-cs-text-muted mt-3">
                {data.total_ranked} learners ranked
              </p>
            </>
          )}

          {!data.me && (
            <p className="text-center font-mono text-[11px] text-cs-text-muted mt-3">
              {data.total_ranked} learner{data.total_ranked === 1 ? '' : 's'} ranked
            </p>
          )}
        </div>
      )}
    </main>
  );
}

export default Leaderboard;
