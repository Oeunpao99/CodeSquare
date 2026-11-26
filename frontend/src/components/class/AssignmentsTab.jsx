import React, { useEffect, useState } from 'react';
import {
  FiPlus, FiTrash2, FiEye, FiEyeOff, FiUpload, FiDownload, FiClipboard, FiChevronDown, FiCheckCircle,
} from 'react-icons/fi';
import { classService } from '../../services/api';
import Markdown from '../Markdown';
import { Sk } from '../Skeletons';
import Dialog from './Dialog';
import FileDrop from './FileDrop';
import { when } from './StreamTab';
import { toast } from '../../utils/toast';
import { confirmDialog } from '../../utils/confirm';

const utc = (iso) => (iso ? new Date(String(iso).endsWith('Z') ? iso : `${iso}Z`) : null);
const fmtSize = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round((n || 0) / 1024))} KB`);

async function saveBlob(promise, name) {
  try {
    const r = await promise;
    const url = URL.createObjectURL(r.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = name || 'file';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch {
    toast.error('Could not download the file.');
  }
}

// Status pill for one student's submission.
function statusOf(a, sub) {
  if (sub?.grade != null) return { label: `Graded ${sub.grade}/${a.max_points}`, cls: 'bg-cs-green text-white' };
  if (sub) {
    const late = a.due_at && utc(sub.submitted_at) > utc(a.due_at);
    return { label: late ? 'Handed in late' : 'Handed in', cls: late ? 'bg-cs-orange text-white' : 'bg-cs-primary text-white' };
  }
  if (a.due_at && utc(a.due_at) < new Date()) return { label: 'Missing', cls: 'bg-cs-red text-white' };
  return { label: 'Not handed in', cls: 'bg-cs-overlay/10 text-cs-text-dim' };
}

// ------------------------------------------------------------- teacher: create
function NewAssignment({ cid, onClose, onSaved }) {
  const [f, setF] = useState({ title: '', instructions: '', due_at: '', max_points: 100, published: true });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await classService.createAssignment(cid, {
        ...f,
        max_points: Number(f.max_points) || 100,
        due_at: f.due_at ? new Date(f.due_at).toISOString().slice(0, 19) : null,
      });
      toast.success('Assignment created');
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.detail?.[0]?.msg || 'Could not create it.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      title="New assignment"
      onClose={onClose}
      footer={<>
        <button onClick={onClose} className="btn btn-ghost">Cancel</button>
        <button onClick={save} disabled={busy || !f.title.trim()} className="btn btn-primary">{busy ? 'Saving…' : 'Create'}</button>
      </>}
    >
      <div className="space-y-4">
        <label className="block text-sm">
          <span className="font-medium">Title</span>
          <input autoFocus value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Lab 1 — Importing data" className="input w-full mt-1.5" />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Instructions</span>
          <textarea rows={5} value={f.instructions} onChange={(e) => setF({ ...f, instructions: e.target.value })}
            placeholder="What to build and how to hand it in (Markdown supported)" className="input w-full mt-1.5" />
        </label>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="font-medium">Due <span className="text-cs-text-dim font-normal">(optional)</span></span>
            <input type="datetime-local" value={f.due_at} onChange={(e) => setF({ ...f, due_at: e.target.value })} className="input w-full mt-1.5" />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Points</span>
            <input type="number" min={1} max={1000} value={f.max_points} onChange={(e) => setF({ ...f, max_points: e.target.value })} className="input w-full mt-1.5" />
          </label>
        </div>
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.published} onChange={(e) => setF({ ...f, published: e.target.checked })} />
          Visible to students
        </label>
      </div>
    </Dialog>
  );
}

// ------------------------------------------------------------ teacher: review
function GradeRow({ cid, a, s, onChanged }) {
  const sub = s.submission;
  const [grade, setGrade] = useState(sub?.grade ?? '');
  const [feedback, setFeedback] = useState(sub?.feedback ?? '');
  const [busy, setBusy] = useState(false);
  const st = statusOf(a, sub);

  const save = async () => {
    setBusy(true);
    try {
      await classService.grade(cid, sub.id, Number(grade), feedback);
      toast.success(`Graded ${s.display_name}`);
      onChanged();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not save the grade.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="py-4 space-y-3">
      <div className="flex items-center gap-3">
        <span className="flex-1 min-w-0 font-semibold truncate">{s.display_name}</span>
        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${st.cls}`}>{st.label}</span>
      </div>
      {sub && (
        <>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {sub.file_name && (
              <button onClick={() => saveBlob(classService.submissionBlob(cid, sub.id), sub.file_name)} className="btn btn-ghost btn-sm">
                <FiDownload /> {sub.file_name} · {fmtSize(sub.file_size)}
              </button>
            )}
            <span className="text-xs text-cs-text-dim">Handed in {when(sub.submitted_at)}</span>
          </div>
          {sub.text && <p className="text-sm rounded-lg bg-cs-overlay/[0.04] p-3 whitespace-pre-line">{sub.text}</p>}
          <div className="flex flex-wrap items-start gap-2">
            <div className="flex items-center gap-1.5">
              <input type="number" min={0} max={a.max_points} value={grade} onChange={(e) => setGrade(e.target.value)}
                className="input w-20 !py-2 text-center" aria-label="Grade" />
              <span className="text-sm text-cs-text-dim">/ {a.max_points}</span>
            </div>
            <input value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Feedback for the student"
              className="input flex-1 min-w-[12rem] !py-2" />
            <button onClick={save} disabled={busy || grade === ''} className="btn btn-primary btn-sm">{busy ? 'Saving…' : 'Save grade'}</button>
            {sub.grade != null && (
              <button
                onClick={async () => { await classService.returnWork(cid, sub.id); toast.success('Returned for redo'); onChanged(); }}
                className="btn btn-ghost btn-sm" title="Clear the grade so the student can hand in again"
              >
                Return for redo
              </button>
            )}
          </div>
        </>
      )}
    </li>
  );
}

function Review({ cid, aid, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const load = () => classService.submissions(cid, aid).then((r) => setData(r.data));
  useEffect(() => { load(); }, [cid, aid]); // eslint-disable-line react-hooks/exhaustive-deps
  const done = data ? data.students.filter((s) => s.submission).length : 0;
  return (
    <Dialog wide title={data ? data.assignment.title : 'Submissions'} onClose={onClose}>
      {!data ? <Sk className="h-48 w-full" /> : (
        <>
          <p className="text-sm text-cs-text-dim">
            {done} of {data.students.length} handed in · {data.assignment.max_points} points
            {data.assignment.due_at && ` · due ${when(data.assignment.due_at)}`}
          </p>
          <ul className="divide-y divide-cs-line/10">
            {data.students.map((s) => (
              <GradeRow key={`${s.user_id}-${s.submission?.id}-${s.submission?.grade}`} cid={cid} a={data.assignment} s={s}
                onChanged={() => { load(); onChanged(); }} />
            ))}
          </ul>
          {data.students.length === 0 && <p className="text-sm text-cs-text-dim mt-4">No students in the class yet.</p>}
        </>
      )}
    </Dialog>
  );
}

// ----------------------------------------------------------- student: hand in
function HandIn({ cid, a, onDone }) {
  const sub = a.submission;
  const [file, setFile] = useState(null);
  const [text, setText] = useState(sub?.text || '');
  const [pct, setPct] = useState(null);
  const [error, setError] = useState('');
  const graded = sub?.grade != null;

  const send = async (e) => {
    e.preventDefault();
    setPct(0);
    setError('');
    try {
      await classService.submit(cid, a.id, file, text, (ev) => ev.total && setPct(Math.round((ev.loaded / ev.total) * 100)));
      toast.success(sub ? 'Resubmitted' : 'Handed in');
      setFile(null);
      onDone();
    } catch (err) {
      const d = err.response?.data?.detail;
      const msg = (Array.isArray(d) ? d[0]?.msg : d)
        || (err.response ? `Hand-in failed (error ${err.response.status}).` : 'Can’t reach the server. Check your connection and try again.');
      setError(msg);
      toast.error(msg);
    } finally {
      setPct(null);
    }
  };

  if (graded) {
    return (
      <div className="rounded-xl bg-cs-green/10 p-4 text-sm">
        <p className="font-semibold flex items-center gap-1.5"><FiCheckCircle className="text-cs-green" /> {sub.grade} / {a.max_points} points</p>
        {sub.feedback && <p className="mt-1">{sub.feedback}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={send} className="space-y-3">
      {sub && (
        <p className="text-sm text-cs-text-dim">
          Handed in {when(sub.submitted_at)}{sub.file_name ? ` · ${sub.file_name}` : ''}. You can replace it until it’s graded.
        </p>
      )}
      <FileDrop file={file} onFile={setFile} disabled={pct !== null} hint="e.g. .pbix, .xlsx, .pdf" />
      <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment for your instructor (optional)" className="input w-full" />
      {pct !== null && (
        <div className="h-2 rounded-full bg-cs-overlay/10 overflow-hidden"><div className="h-full bg-cs-primary rounded-full" style={{ width: `${pct}%` }} /></div>
      )}
      {error && <p role="alert" className="rounded-lg bg-cs-red/10 text-cs-red text-sm px-3 py-2">{error}</p>}
      <button type="submit" disabled={pct !== null || (!file && !text.trim() && !sub)} className="btn btn-primary btn-sm">
        {pct !== null ? `Uploading ${pct}%` : sub ? 'Resubmit' : 'Hand in'}
      </button>
    </form>
  );
}

// ------------------------------------------------------------------------ tab
export default function AssignmentsTab({ cid, isTeacher }) {
  const [list, setList] = useState(null);
  const [creating, setCreating] = useState(false);
  const [review, setReview] = useState(null);
  const [open, setOpen] = useState({});

  const load = () => classService.assignments(cid).then((r) => setList(r.data)).catch(() => setList([]));
  useEffect(() => { load(); }, [cid]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      {isTeacher && <button onClick={() => setCreating(true)} className="btn btn-primary"><FiPlus /> New assignment</button>}

      {list === null && <Sk className="h-24 w-full rounded-2xl" />}
      {list && list.length === 0 && (
        <p className="py-10 text-center text-sm text-cs-text-dim">
          {isTeacher ? 'Create an assignment for students to hand in their work.' : 'No assignments yet.'}
        </p>
      )}

      {(list || []).map((a) => {
        const st = isTeacher ? null : statusOf(a, a.submission);
        const expanded = open[a.id] ?? (!isTeacher && !a.submission);
        return (
          <section key={a.id} className="card !p-0 overflow-hidden">
            <header className="flex items-center gap-4 px-5 py-4">
              <span className="w-10 h-10 rounded-xl bg-cs-primary/10 text-cs-primary grid place-items-center shrink-0"><FiClipboard /></span>
              <button onClick={() => setOpen({ ...open, [a.id]: !expanded })} className="min-w-0 flex-1 text-left">
                <p className="font-semibold truncate">{a.title}</p>
                <p className="text-xs text-cs-text-dim">
                  {a.due_at ? `Due ${when(a.due_at)}` : 'No due date'} · {a.max_points} points
                  {isTeacher && ` · ${a.submitted} handed in · ${a.graded} graded`}
                </p>
              </button>
              {st && <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0 ${st.cls}`}>{st.label}</span>}
              {isTeacher && (
                <>
                  {!a.published && <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-cs-overlay/10 text-cs-text-dim">Draft</span>}
                  <button onClick={() => setReview(a.id)} className="btn btn-secondary btn-sm">Review & grade</button>
                  <button
                    onClick={async () => { await classService.updateAssignment(cid, a.id, { published: !a.published }); load(); }}
                    className="p-2 text-cs-text-dim hover:text-cs-primary" title={a.published ? 'Hide from students' : 'Show to students'} aria-label="Toggle visibility"
                  >
                    {a.published ? <FiEyeOff /> : <FiEye />}
                  </button>
                  <button
                    onClick={async () => {
                      if (!(await confirmDialog({ title: `Delete "${a.title}"?`, message: 'The assignment, all hand-ins and their grades will be deleted.' }))) return;
                      await classService.deleteAssignment(cid, a.id); load();
                    }}
                    className="p-2 text-cs-text-dim hover:text-cs-red" title="Delete" aria-label="Delete"
                  >
                    <FiTrash2 />
                  </button>
                </>
              )}
              <button onClick={() => setOpen({ ...open, [a.id]: !expanded })} className="p-1 text-cs-text-dim" aria-label="Expand">
                <FiChevronDown className={expanded ? 'rotate-180' : ''} />
              </button>
            </header>
            {expanded && (
              <div className="px-5 pb-5 pt-1 space-y-4 border-t border-cs-line/10">
                {a.instructions ? <div className="pt-3"><Markdown text={a.instructions} /></div> : <p className="pt-3 text-sm text-cs-text-dim">No instructions.</p>}
                {!isTeacher && <HandIn cid={cid} a={a} onDone={load} />}
              </div>
            )}
          </section>
        );
      })}

      {creating && <NewAssignment cid={cid} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); load(); }} />}
      {review && <Review cid={cid} aid={review} onClose={() => setReview(null)} onChanged={load} />}
    </div>
  );
}
