import React, { useEffect, useState } from 'react';
import { FiTrash2, FiSend } from 'react-icons/fi';
import { classService } from '../../services/api';
import Markdown from '../Markdown';
import { Sk } from '../Skeletons';
import { toast } from '../../utils/toast';
import { confirmDialog } from '../../utils/confirm';

export const when = (iso) => {
  if (!iso) return '';
  const d = new Date(String(iso).endsWith('Z') ? iso : `${iso}Z`);
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

// Announcements from the teacher, newest first.
export default function StreamTab({ cid, isTeacher }) {
  const [posts, setPosts] = useState(null);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => classService.posts(cid).then((r) => setPosts(r.data)).catch(() => setPosts([]));
  useEffect(() => { load(); }, [cid]); // eslint-disable-line react-hooks/exhaustive-deps

  const post = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    try {
      await classService.addPost(cid, body);
      setBody('');
      load();
    } catch {
      toast.error('Could not post.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5 max-w-3xl">
      {isTeacher && (
        <form
          onSubmit={post}
          className="rounded-2xl border border-cs-line/15 bg-cs-darker focus-within:border-cs-primary/50 transition-colors"
        >
          <textarea
            rows={2}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Announce something to your class…"
            className="w-full resize-none bg-transparent px-4 pt-3 text-sm outline-none placeholder:text-cs-text-muted"
          />
          <div className="flex justify-end px-3 pb-3">
            <button type="submit" disabled={busy || !body.trim()} className="btn btn-primary btn-sm">
              <FiSend /> {busy ? 'Posting…' : 'Post'}
            </button>
          </div>
        </form>
      )}

      {posts === null && <Sk className="h-28 w-full rounded-2xl" />}
      {posts && posts.length === 0 && (
        <p className="py-10 text-center text-sm text-cs-text-dim">{isTeacher ? 'No announcements yet.' : 'No announcements yet.'}</p>
      )}
      {posts && posts.length > 0 && (
      <div className="card !p-0 divide-y divide-cs-line/10">
      {posts.map((p) => (
        <article key={p.id} className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <span className="w-9 h-9 rounded-full bg-cs-primary/10 text-cs-primary grid place-items-center font-bold shrink-0">
              {p.author.display_name.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm">{p.author.display_name}</p>
              <p className="text-xs text-cs-text-dim">{when(p.created_at)}</p>
            </div>
            {isTeacher && (
              <button
                onClick={async () => {
                  if (!(await confirmDialog({ title: 'Delete this announcement?', message: 'Students will no longer see it.' }))) return;
                  await classService.deletePost(cid, p.id);
                  load();
                }}
                className="p-2 text-cs-text-dim hover:text-cs-red"
                aria-label="Delete"
              >
                <FiTrash2 />
              </button>
            )}
          </div>
          <Markdown text={p.body} />
        </article>
      ))}
      </div>
      )}
    </div>
  );
}
