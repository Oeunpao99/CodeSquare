import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { communityService } from '../services/api';
import { MAJORS } from '../majors';
import {
  FiAward, FiTerminal, FiZap, FiCheckCircle, FiCode, FiChevronUp,
} from 'react-icons/fi';

const MEDAL = ['#F5C518', '#B8C0C8', '#CD7F42']; // gold / silver / bronze

function Row({ r, highlight }) {
  const major = r.major ? MAJORS[r.major]?.label : null;
  const medal = r.rank <= 3 ? MEDAL[r.rank - 1] : null;
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 border-t border-cs-line/10 first:border-t-0 ${
        highlight ? 'bg-cs-primary/[0.07]' : 'hover:bg-cs-overlay/[0.04]'
      } transition-colors`}
    >
      <span
        className="w-8 shrink-0 text-center font-mono text-sm font-bold"
        style={{ color: medal || 'rgb(var(--cs-text-muted))' }}
      >
        {r.rank}
      </span>
      <span className="w-9 h-9 rounded-lg bg-cs-darkest border border-cs-primary/25 flex items-center justify-center font-mono font-bold text-cs-primary overflow-hidden shrink-0">
        {r.avatar_url
          ? <img src={r.avatar_url} alt={r.username} className="w-full h-full object-cover" />
          : <span>{r.username?.charAt(0).toUpperCase()}</span>}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-sm font-semibold truncate">
          {r.username}
          {highlight && <span className="text-cs-primary font-normal"> · you</span>}
        </p>
        {major && <p className="font-mono text-[11px] text-cs-text-muted truncate">{major}</p>}
      </div>
      <span className="hidden sm:inline-flex items-center gap-1 font-mono text-[11px] text-cs-text-muted shrink-0" title="lessons completed">
        <FiCheckCircle className="text-[11px]" /> {r.lessons_completed}
      </span>
      <span className="hidden sm:inline-flex items-center gap-1 font-mono text-[11px] text-cs-text-muted shrink-0" title="challenges solved">
        <FiCode className="text-[11px]" /> {r.challenges_solved}
      </span>
      <span className="inline-flex items-center gap-1 font-mono text-sm font-bold text-cs-primary shrink-0 w-20 justify-end">
        <FiZap className="text-[11px]" /> {r.xp.toLocaleString()}
      </span>
    </div>
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
        <span className="mono-label text-cs-primary">// community</span>
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
          <div className="rounded-xl border border-cs-line/15 bg-cs-darker/50 overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-2 bg-cs-line/[0.04] font-mono text-[10px] uppercase tracking-[0.18em] text-cs-text-muted">
              <span className="w-8 text-center shrink-0">#</span>
              <span className="w-9 shrink-0" />
              <span className="flex-1">learner</span>
              <span className="hidden sm:inline w-[52px] text-right">lsn</span>
              <span className="hidden sm:inline w-[52px] text-right">chl</span>
              <span className="w-20 text-right">xp</span>
            </div>
            {data.top.map((r) => (
              <Row key={r.user_id} r={r} highlight={r.is_me} />
            ))}
          </div>

          {data.me && (
            <>
              <div className="flex items-center justify-center py-2 text-cs-text-muted">
                <FiChevronUp />
              </div>
              <div className="rounded-xl border border-cs-primary/30 bg-cs-darker/50 overflow-hidden">
                <Row r={data.me} highlight />
              </div>
              <p className="text-center font-mono text-[11px] text-cs-text-muted mt-2">
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
