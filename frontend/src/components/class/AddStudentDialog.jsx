import React, { useEffect, useState } from 'react';
import { FiSearch, FiCheck, FiUserPlus } from 'react-icons/fi';
import { classService } from '../../services/api';
import { MAJORS } from '../../majors';
import Dialog from './Dialog';
import { toast } from '../../utils/toast';

/**
 * Teacher searches the user directory (same people as the Dev Directory) and
 * adds students directly. The student gets a bell notification.
 */
export default function AddStudentDialog({ cid, onClose, onAdded }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null); // null = nothing searched yet
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState({}); // user_id -> true
  const [busy, setBusy] = useState(null);

  // Debounced search as you type.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResults(null); return undefined; }
    setLoading(true);
    const t = setTimeout(() => {
      classService.candidates(cid, term)
        .then((r) => setResults(r.data))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q, cid]);

  const add = async (u) => {
    setBusy(u.user_id);
    try {
      const r = await classService.addMember(cid, u.user_id);
      setAdded((a) => ({ ...a, [u.user_id]: true }));
      onAdded(r.data);
      toast.success(`${u.display_name} added`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not add them.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog
      title="Add students"
      onClose={onClose}
      footer={<button onClick={onClose} className="btn btn-primary">Done</button>}
    >
      <p className="text-sm text-cs-text-dim mb-4">
        Search by name, username or email. They’ll get a notification and can open the class right away.
      </p>
      <div className="relative">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-cs-text-muted" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="e.g. sokha or sokha@email.com"
          className="input w-full pl-9"
        />
      </div>

      <div className="mt-4 min-h-[8rem]">
        {results === null && !loading && (
          <p className="py-8 text-center text-sm text-cs-text-dim">Type at least 2 letters to search.</p>
        )}
        {loading && <p className="py-8 text-center text-sm text-cs-text-dim">Searching…</p>}
        {!loading && results && results.length === 0 && (
          <p className="py-8 text-center text-sm text-cs-text-dim">No one found (people already in the class are hidden).</p>
        )}
        {!loading && results && results.length > 0 && (
          <ul className="divide-y divide-cs-line/10">
            {results.map((u) => {
              const major = u.major ? MAJORS[u.major] : null;
              const done = added[u.user_id];
              return (
                <li key={u.user_id} className="flex items-center gap-3 py-3">
                  <span className="w-10 h-10 rounded-full bg-cs-primary/10 text-cs-primary grid place-items-center font-bold overflow-hidden shrink-0">
                    {u.avatar ? <img src={u.avatar} alt="" className="w-full h-full object-cover" /> : u.display_name.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{u.display_name} <span className="text-cs-text-dim font-normal">@{u.username}</span></p>
                    <p className="text-xs text-cs-text-dim truncate">
                      {major ? major.label : 'No major'}{u.headline ? ` · ${u.headline}` : ''}
                    </p>
                  </div>
                  {done ? (
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-cs-green"><FiCheck /> Added</span>
                  ) : (
                    <button onClick={() => add(u)} disabled={busy === u.user_id} className="btn btn-secondary btn-sm">
                      <FiUserPlus /> {busy === u.user_id ? 'Adding…' : 'Add'}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Dialog>
  );
}
