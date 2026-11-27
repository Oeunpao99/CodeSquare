import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Dialog from './class/Dialog';
import { communityService } from '../services/api';

export default function FollowListDialog({ username, direction, onClose }) {
  const [people, setPeople] = useState(null);
  const [before, setBefore] = useState(null);
  const [nextBefore, setNextBefore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    communityService.followList(username, direction, before, controller.signal).then(({ data }) => {
      if (controller.signal.aborted) return;
      setPeople((current) => before ? [...(current ?? []), ...data.people] : data.people);
      setNextBefore(data.next_before);
    }).catch((error) => {
      if (controller.signal.aborted) return;
      const privateList = error.response?.status === 403;
      if (privateList) {
        setPeople(null);
        setNextBefore(null);
      }
      setError(privateList ? 'This list is private.' : 'Could not load this list.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [username, direction, before, attempt]);

  return <Dialog side title={direction === 'followers' ? 'Followers' : 'Following'} onClose={onClose}>
    {loading && !people && <p className="text-sm text-cs-text-muted">Loading…</p>}
    {!error && people?.length === 0 && <p className="text-sm text-cs-text-muted">
      {direction === 'followers' ? 'No followers yet.' : 'No one followed yet.'}
    </p>}
    {people?.length > 0 && <ul className="divide-y divide-cs-line/10">
      {people.map((person) => <li key={person.username}>
        <Link to={'/u/' + encodeURIComponent(person.username)} onClick={onClose}
          className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-cs-overlay/[0.06]">
          <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-cs-primary/10 text-cs-primary">
            {person.avatar ? <img src={person.avatar} alt="" className="size-full object-cover" /> :
              (person.display_name || person.username).charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{person.display_name || person.username}</span>
            <span className="block truncate text-xs text-cs-text-muted">@{person.username}</span>
          </span>
        </Link>
      </li>)}
    </ul>}
    {error && <p role="alert" className="mt-2 text-sm text-cs-text-muted">{error}</p>}
    {error === 'Could not load this list.' ?
      <button type="button" className="btn btn-secondary btn-sm mt-3" onClick={() => setAttempt((value) => value + 1)}>Try again</button>
      : nextBefore && <button type="button" className="btn btn-secondary btn-sm mt-3"
        disabled={loading} onClick={() => setBefore(nextBefore)}>{loading ? 'Loading…' : 'Load more'}</button>}
  </Dialog>;
}
