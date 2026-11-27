import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { communityService } from '../services/api';
import ProfileShareButton from '../components/ProfileShareButton';
import VerifiedBadge from '../components/VerifiedBadge';
import { MAJORS } from '../majors';

export default function PublicUserProfile() {
  const { username } = useParams();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const link = '/u/' + encodeURIComponent(username);

  useEffect(() => {
    const controller = new AbortController();
    setProfile(null);
    setError('');
    communityService.publicProfile(username, controller.signal)
      .then(({ data }) => { if (!controller.signal.aborted) setProfile(data); })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setError(error.response?.status === 404 ? 'Profile not found.' : 'Could not load this profile.');
        }
      });
    return () => controller.abort();
  }, [username]);

  const name = profile?.display_name || profile?.username;
  const major = MAJORS[profile?.major]?.label;

  return <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-6 p-5 sm:p-10">
    <Link to="/" className="flex w-fit items-center gap-2 font-semibold">
      <img src="/logo.png" alt="" className="h-7 w-auto" /> CodeSquare
    </Link>
    <article className="card p-6 sm:p-8">
      {!profile ? <p role="status" className="text-cs-text-dim">{error || 'Loading profile…'}</p> : <>
        <div className="flex flex-wrap items-center gap-4">
          <span className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-2xl bg-cs-primary/15 text-3xl font-bold text-cs-primary">
            {profile.avatar ? <img src={profile.avatar} alt="" className="size-full object-cover" /> : name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <span className="truncate">{name}</span>{profile.verified && <VerifiedBadge />}
            </h1>
            <p className="text-sm text-cs-text-muted">@{profile.username}</p>
          </div>
        </div>
        {profile.headline && <p className="mt-4 font-medium">{profile.headline}</p>}
        {major && <p className="mt-1.5 text-sm font-medium text-cs-primary">{major}</p>}
        {profile.bio && <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-cs-text-dim">{profile.bio}</p>}
        <div className="mt-6 flex flex-wrap gap-2">
          <Link to="/auth" state={{ returnTo: link }} className="btn btn-primary btn-sm">Sign in to connect</Link>
          <ProfileShareButton username={profile.username} />
        </div>
      </>}
    </article>
  </main>;
}
