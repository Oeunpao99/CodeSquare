import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { FiX, FiCheck, FiClock, FiAlertCircle, FiEdit2 } from 'react-icons/fi';
import { teacherService } from '../services/api';
import { Sk } from './Skeletons';
import { toast } from '../utils/toast';

// Applied -> In review -> Approved, with the current step highlighted.
function Steps({ status }) {
  const steps = ['Applied', 'In review', 'Approved'];
  const current = status === 'approved' ? 2 : 1;
  return (
    <ol className="flex items-center gap-2 mb-6">
      {steps.map((label, i) => {
        const done = i < current || status === 'approved';
        const active = i === current && status !== 'approved';
        return (
          <React.Fragment key={label}>
            <li className="flex items-center gap-2 shrink-0">
              <span
                className={`w-7 h-7 rounded-full grid place-items-center text-xs font-bold ${
                  done ? 'bg-cs-green text-white' : active ? 'bg-cs-orange text-white' : 'bg-cs-overlay/10 text-cs-text-dim'
                }`}
              >
                {done ? <FiCheck /> : active ? <FiClock /> : i + 1}
              </span>
              <span className={`text-sm ${done || active ? 'font-semibold' : 'text-cs-text-dim'}`}>{label}</span>
            </li>
            {i < steps.length - 1 && (
              <span className={`flex-1 h-0.5 rounded-full ${i < current ? 'bg-cs-green' : 'bg-cs-overlay/10'}`} />
            )}
          </React.Fragment>
        );
      })}
    </ol>
  );
}

function Summary({ profile }) {
  const rows = [
    ['Name', profile.full_name],
    ['Organisation', profile.organization],
    ['Teaches', profile.subject],
  ].filter(([, v]) => v);
  return (
    <dl className="rounded-xl bg-cs-overlay/[0.04] divide-y divide-cs-line/10 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="flex gap-4 px-4 py-2.5">
          <dt className="w-28 shrink-0 text-cs-text-dim">{k}</dt>
          <dd className="font-medium min-w-0 break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * "Join as Instructor" dialog, opened from Settings. Shows the application form,
 * or the current status (pending / approved / rejected) if the user applied.
 * Rendered in a portal so it always centres on the screen.
 */
export default function TeacherApplyModal({ onClose, onStatus }) {
  const [profile, setProfile] = useState(undefined); // undefined = loading, null = never applied
  const [form, setForm] = useState({ full_name: '', organization: '', subject: '', bio: '' });
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    teacherService.me()
      .then((r) => {
        setProfile(r.data);
        if (r.data) setForm({ full_name: r.data.full_name, organization: r.data.organization, subject: r.data.subject, bio: r.data.bio });
      })
      .catch(() => setProfile(null));
  }, []);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await teacherService.apply(form);
      setProfile(r.data);
      setEditing(false);
      onStatus?.(r.data.status);
      toast.success('Application sent');
    } catch (err) {
      const d = err.response?.data?.detail;
      toast.error((Array.isArray(d) ? d[0]?.msg : d) || 'Could not send the application.');
    } finally {
      setBusy(false);
    }
  };

  const status = profile?.status;
  const showForm = profile === null || editing || status === 'rejected';

  return createPortal(
    <div className="fixed inset-0 z-[100] grid place-items-center p-4 bg-black/50 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Join as Instructor"
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-cs-line/10 bg-cs-dark shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 pt-6">
          <div>
            <h2 className="text-xl font-bold">Join as Instructor</h2>
            <p className="text-sm text-cs-text-dim mt-1">
              Run private classes and share materials week by week. Students join with a class code.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 -mr-1.5 rounded-lg text-cs-text-dim hover:text-cs-text hover:bg-cs-overlay/[0.06]" aria-label="Close">
            <FiX className="text-lg" />
          </button>
        </div>

        <div className="px-6 py-6">
          {profile === undefined && <Sk className="h-44 w-full rounded-xl" />}

          {/* Pending */}
          {status === 'pending' && !editing && (
            <>
              <Steps status="pending" />
              <h3 className="font-bold">Your application is being reviewed</h3>
              <p className="text-sm text-cs-text-dim mt-1 mb-4">
                Once it’s approved, a <strong className="text-cs-text">Create class</strong> button appears in My Classes.
              </p>
              <Summary profile={profile} />
            </>
          )}

          {/* Approved */}
          {status === 'approved' && (
            <>
              <Steps status="approved" />
              <h3 className="font-bold">You’re an approved instructor</h3>
              <p className="text-sm text-cs-text-dim mt-1">Create your first class and share the code with your students.</p>
            </>
          )}

          {/* Rejected */}
          {status === 'rejected' && (
            <div className="flex gap-3 rounded-xl bg-cs-red/10 p-4 mb-5">
              <FiAlertCircle className="text-cs-red text-xl shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold">Your application wasn’t approved</p>
                {profile.review_note && <p className="text-cs-text-dim mt-1">Reviewer’s note: {profile.review_note}</p>}
                <p className="text-cs-text-dim mt-1">Update the details below and apply again.</p>
              </div>
            </div>
          )}

          {/* Form */}
          {showForm && profile !== undefined && (
            <form id="teacher-apply" onSubmit={submit} className="space-y-4">
              <label className="block text-sm">
                <span className="font-medium">Full name</span>
                <input autoFocus required minLength={2} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="input w-full mt-1.5" />
              </label>
              <div className="grid sm:grid-cols-2 gap-4">
                <label className="block text-sm">
                  <span className="font-medium">School or organisation</span>
                  <input value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} placeholder="Proseth Institute" className="input w-full mt-1.5" />
                </label>
                <label className="block text-sm">
                  <span className="font-medium">What do you teach?</span>
                  <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Power BI" className="input w-full mt-1.5" />
                </label>
              </div>
              <label className="block text-sm">
                <span className="font-medium">About you <span className="text-cs-text-dim font-normal">(optional)</span></span>
                <textarea rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  placeholder="Your teaching experience and the classes you plan to run" className="input w-full mt-1.5" />
              </label>
            </form>
          )}
        </div>

        {/* Footer actions */}
        {profile !== undefined && (
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-cs-line/10 bg-cs-overlay/[0.03] rounded-b-2xl">
            {status === 'pending' && !editing && (
              <>
                <button onClick={() => setEditing(true)} className="btn btn-ghost"><FiEdit2 /> Edit application</button>
                <button onClick={onClose} className="btn btn-primary">Done</button>
              </>
            )}
            {status === 'approved' && (
              <>
                <button onClick={onClose} className="btn btn-ghost">Close</button>
                <Link to="/classes" onClick={onClose} className="btn btn-primary">Go to My Classes</Link>
              </>
            )}
            {showForm && (
              <>
                <button type="button" onClick={editing ? () => setEditing(false) : onClose} className="btn btn-ghost">Cancel</button>
                <button type="submit" form="teacher-apply" disabled={busy} className="btn btn-primary">
                  {busy ? 'Sending…' : editing ? 'Save changes' : 'Send application'}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
