import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  FiArrowLeft, FiZap, FiBook, FiCode, FiCheckSquare, FiAward, FiStar,
  FiUser,
} from 'react-icons/fi';
import { communityService } from '../services/api';
import { MAJORS } from '../majors';
import VerifiedBadge from '../components/VerifiedBadge';

function Stat({ icon, value, label, cls = 'text-cs-primary', chip = 'bg-cs-primary/15' }) {
  return (
    <div className="card text-center p-4">
      <div className="flex items-center justify-center gap-3 mb-2">
        <span className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${chip} ${cls}`}>{icon}</span>
      </div>
      <div className="text-2xl font-bold font-mono">{value}</div>
      <div className="text-xs text-cs-text-dim mt-1">{label}</div>
    </div>
  );
}

export default function UserProfile() {
  const { username } = useParams();
  const [data, setData] = useState(null); // null = loading, false = error
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let alive = true;
    setData(null);
    setNotFound(false);
    communityService
      .profile(username)
      .then((r) => alive && setData(r.data))
      .catch(() => alive && setNotFound(true));
    return () => { alive = false; };
  }, [username]);

  const major = data?.major ? MAJORS[data.major] : null;
  const name = data?.display_name || data?.username || '…';

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
      <div className="sticky top-0 z-30 -mx-6 lg:-mx-10 px-6 lg:px-10 pt-4 pb-4 -mt-8 mb-6 bg-cs-dark/85 backdrop-blur-xl border-b border-cs-line/[0.07]">
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
              <h1 className="text-3xl md:text-4xl font-bold truncate">{name}</h1>
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
            {data.headline && <p className="text-sm text-cs-text mt-2">{data.headline}</p>}
          </div>
        </div>
      </div>

      {data.bio && (
        <div className="card mb-6">
          <p className="text-sm text-cs-text-dim leading-relaxed whitespace-pre-wrap">{data.bio}</p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        <Stat icon={<FiZap />} value={data.xp} label="Total XP" cls="text-cs-cyan" chip="bg-cs-cyan/15" />
        <Stat icon={<FiBook />} value={data.lessons_completed} label="Lessons" cls="text-cs-primary" chip="bg-cs-primary/15" />
        <Stat icon={<FiCode />} value={data.challenges_solved} label="Challenges" cls="text-cs-green" chip="bg-cs-green/15" />
        <Stat icon={<FiCheckSquare />} value={data.quizzes_passed} label="Quizzes" cls="text-cs-orange" chip="bg-cs-orange/15" />
        <Stat icon={<FiAward />} value={data.current_streak} label="Day Streak" cls="text-cs-mint" chip="bg-cs-mint/15" />
        <Stat icon={<FiStar />} value={data.rank ? `#${data.rank}` : '—'} label="Rank" cls="text-cs-violet" chip="bg-cs-violet/15" />
      </div>

      <span className="mono-label text-cs-text-dim mb-3 block">// recent projects</span>
      {data.recent_projects && data.recent_projects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {data.recent_projects.map((p) => (
            <Link
              key={p.id}
              to={`/projects/${p.id}`}
              className="card flex items-center gap-3"
            >
              <div className="w-9 h-9 rounded-lg bg-cs-darkest border border-cs-line/15 flex items-center justify-center text-cs-primary shrink-0">
                <FiCode />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-sm font-semibold truncate">{p.title}</p>
                <p className="font-mono text-[11px] text-cs-text-muted truncate capitalize">
                  {p.language || 'unknown'}
                  {p.status ? ` · ${p.status}` : ''}
                </p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="card text-center py-12">
          <FiUser className="text-3xl text-cs-text-muted mx-auto mb-3" />
          <p className="text-cs-text-dim font-mono text-sm">No shared projects yet.</p>
        </div>
      )}
    </main>
  );
}
