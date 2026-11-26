import React, { useEffect, useState } from 'react';
import { FiCheck, FiX } from 'react-icons/fi';
import { adminService } from '../../services/adminApi';
import { promptDialog } from '../../utils/confirm';
import { contactLabel } from '../../utils/contact';

const TABS = [['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['', 'All']];
const STATUS_CLS = {
  pending: 'bg-cs-orange text-white',
  approved: 'bg-cs-green text-white',
  rejected: 'bg-cs-red text-white',
};

// Review teacher applications. Approving lets the user create classes.
export default function AdminTeachers() {
  const [status, setStatus] = useState('pending');
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = () => {
    setRows(null);
    adminService.teachers(status).then((r) => setRows(r.data)).catch(() => setRows([]));
  };
  useEffect(load, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const review = async (row, approve) => {
    const note = approve ? null : await promptDialog({
      title: `Reject ${row.full_name}?`,
      message: 'Add a reason. The applicant sees it and can apply again.',
      placeholder: 'Reason (optional)',
      confirmLabel: 'Reject',
      danger: true,
    });
    if (!approve && note === null) return; // cancelled
    setBusy(row.id);
    try {
      await (approve ? adminService.approveTeacher(row.id, note) : adminService.rejectTeacher(row.id, note));
      load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-1">Instructor applications</h1>
      <p className="text-sm text-cs-text-dim mb-6">Approved instructors can create private classes and upload materials.</p>

      <div className="inline-flex gap-0.5 p-0.5 mb-5 rounded-lg border border-cs-line/15 bg-cs-overlay/[0.04]">
        {TABS.map(([k, label]) => (
          <button key={k} onClick={() => setStatus(k)}
            className={`h-9 px-4 rounded-md text-sm ${status === k ? 'bg-cs-overlay/[0.09] text-cs-text font-medium' : 'text-cs-text-dim hover:text-cs-text'}`}>
            {label}
          </button>
        ))}
      </div>

      {rows === null && <p className="text-sm text-cs-text-dim">Loading…</p>}
      {rows && rows.length === 0 && <p className="text-sm text-cs-text-dim">No applications here.</p>}

      <div className="space-y-3">
        {(rows || []).map((t) => (
          <div key={t.id} className="card !p-5 flex flex-col md:flex-row gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-bold">{t.full_name}</p>
                <span className="text-sm text-cs-text-dim">@{t.username} · {contactLabel(t)}</span>
                <span className={`px-2 py-0.5 rounded-full text-[0.6875rem] font-semibold ${STATUS_CLS[t.status] || ''}`}>{t.status}</span>
              </div>
              <p className="text-sm mt-1">
                {[t.organization, t.subject].filter(Boolean).join(' · ') || <span className="text-cs-text-dim">No organisation or subject given</span>}
              </p>
              {t.bio && <p className="text-sm text-cs-text-dim mt-2 whitespace-pre-line">{t.bio}</p>}
              {t.review_note && <p className="text-xs text-cs-text-dim mt-2">Note: {t.review_note}</p>}
              <p className="text-xs text-cs-text-muted mt-2">Applied {new Date(t.created_at + 'Z').toLocaleString()}</p>
            </div>
            <div className="flex md:flex-col gap-2 shrink-0">
              {t.status !== 'approved' && (
                <button disabled={busy === t.id} onClick={() => review(t, true)} className="btn btn-primary btn-sm"><FiCheck /> Approve</button>
              )}
              {t.status !== 'rejected' && (
                <button disabled={busy === t.id} onClick={() => review(t, false)} className="btn btn-ghost btn-sm"><FiX /> Reject</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
