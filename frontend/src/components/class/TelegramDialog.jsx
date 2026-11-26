import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FiExternalLink, FiSend, FiLoader, FiPlus, FiTrash2 } from 'react-icons/fi';
import { classService } from '../../services/api';
import Dialog from './Dialog';
import { Sk } from '../Skeletons';
import { confirmDialog } from '../../utils/confirm';
import { toast } from '../../utils/toast';

// Telegram paper-plane mark (brand blue).
export function TelegramIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="12" fill="#229ED9" />
      <path fill="#fff" d="M5.4 11.7l11.1-4.3c.5-.2 1 .1.8.9l-1.9 8.9c-.1.6-.5.8-1 .5l-2.9-2.1-1.4 1.3c-.2.2-.3.3-.6.3l.2-3 5.4-4.9c.2-.2 0-.3-.3-.1l-6.7 4.2-2.9-.9c-.6-.2-.6-.6.2-.8z" />
    </svg>
  );
}

const day = (iso) => (iso ? new Date(String(iso).endsWith('Z') ? iso : `${iso}Z`).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '');

/**
 * Connect one or more Telegram groups to the class. Every new announcement,
 * material, week, assignment and quiz is posted to all of them by the bot.
 */
export default function TelegramDialog({ cid, onClose, onChange }) {
  const [st, setSt] = useState(null);
  const [adding, setAdding] = useState(false);   // the "add a group" steps are showing
  const [waiting, setWaiting] = useState(false); // auto-detecting after Telegram was opened
  const [busy, setBusy] = useState(false);
  const checking = useRef(false);

  const update = useCallback((data) => { setSt(data); onChange?.(data); }, [onChange]);

  useEffect(() => {
    classService.telegram(cid).then((r) => update(r.data)).catch(() => setSt({ available: false, groups: [] }));
  }, [cid]); // eslint-disable-line react-hooks/exhaustive-deps

  // Quiet check; only the manual "Check now" shows an error.
  const check = useCallback(async (manual = false) => {
    if (checking.current) return;
    checking.current = true;
    if (manual) setBusy(true);
    try {
      const r = await classService.telegramVerify(cid);
      update(r.data);
      setAdding(false);
      setWaiting(false);
      if (r.data.already_connected) toast(`“${r.data.just_added}” is already connected`);
      else toast.success(`Connected to “${r.data.just_added}”`);
    } catch (err) {
      if (manual) toast.error(err.response?.data?.detail || 'Not connected yet.');
    } finally {
      checking.current = false;
      if (manual) setBusy(false);
    }
  }, [cid, update]);

  // On open, finish a connection started earlier (bot may already be in the group).
  const triedOnOpen = useRef(false);
  useEffect(() => {
    if (st?.available && st.pending && !triedOnOpen.current) {
      triedOnOpen.current = true;
      check(false);
    }
  }, [st, check]);

  // Auto-detect: every 3 s for up to 3 minutes, and right away on returning to the tab.
  useEffect(() => {
    if (!waiting) return undefined;
    const started = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - started > 3 * 60 * 1000) { setWaiting(false); return; }
      check(false);
    }, 3000);
    const onFocus = () => check(false);
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(timer); window.removeEventListener('focus', onFocus); };
  }, [waiting, check]);

  const openTelegram = async () => {
    setBusy(true);
    try {
      const r = await classService.telegramLink(cid);
      setWaiting(true);
      window.open(r.data.url, '_blank', 'noopener');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not start the connection.');
    } finally {
      setBusy(false);
    }
  };

  const test = async (g) => {
    try {
      await classService.telegramTest(cid, g.id);
      toast.success(`Test sent to “${g.title}”`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not send.');
    }
  };

  const remove = async (g) => {
    if (!(await confirmDialog({ title: `Remove “${g.title}”?`, message: 'This group will stop receiving class alerts. You can add it again later.', confirmLabel: 'Remove' }))) return;
    const r = await classService.telegramRemove(cid, g.id);
    update(r.data);
  };

  const groups = st?.groups || [];
  const showSteps = st?.available && (adding || groups.length === 0);

  let footer = <button onClick={onClose} className="btn btn-primary">Done</button>;
  if (showSteps && groups.length > 0) {
    footer = (
      <>
        <button onClick={() => { setAdding(false); setWaiting(false); }} className="btn btn-ghost">Back</button>
        {waiting && <button onClick={() => check(true)} disabled={busy} className="btn btn-secondary">{busy ? 'Checking…' : 'Check now'}</button>}
      </>
    );
  } else if (showSteps && waiting) {
    footer = (
      <>
        <button onClick={onClose} className="btn btn-ghost">Cancel</button>
        <button onClick={() => check(true)} disabled={busy} className="btn btn-secondary">{busy ? 'Checking…' : 'Check now'}</button>
      </>
    );
  }

  return (
    <Dialog title="Telegram group alerts" onClose={onClose} footer={footer}>
      {!st && <Sk className="h-32 w-full" />}

      {st && !st.available && (
        <div className="text-sm space-y-2">
          <p className="font-semibold">Telegram isn’t set up on this server yet.</p>
          <p className="text-cs-text-dim">
            An administrator needs to create a bot with @BotFather and add its token as
            <code className="mx-1">TELEGRAM_BOT_TOKEN</code> in the server settings.
          </p>
        </div>
      )}

      {/* Connected groups */}
      {st?.available && groups.length > 0 && !adding && (
        <div className="space-y-4">
          <p className="text-sm text-cs-text-dim">
            New announcements, materials, weeks, assignments and quizzes are posted to
            {groups.length === 1 ? ' this group' : ` all ${groups.length} groups`} by @{st.bot_username}.
          </p>
          <ul className="rounded-xl border border-cs-line/10 divide-y divide-cs-line/10">
            {groups.map((g) => (
              <li key={g.id} className="flex items-center gap-3 px-4 py-3">
                <TelegramIcon className="w-9 h-9 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{g.title}</p>
                  <p className="text-xs text-cs-text-dim">Connected {day(g.connected_at)}</p>
                </div>
                <button onClick={() => test(g)} className="btn btn-ghost btn-sm" title="Send a test message"><FiSend /> Test</button>
                <button onClick={() => remove(g)} className="p-2 rounded-lg text-cs-text-dim hover:text-cs-red" title="Remove group" aria-label={`Remove ${g.title}`}>
                  <FiTrash2 />
                </button>
              </li>
            ))}
          </ul>
          <button onClick={() => setAdding(true)} className="btn btn-secondary btn-sm"><FiPlus /> Add another group</button>
        </div>
      )}

      {/* Add a group */}
      {showSteps && (
        <div className="space-y-4">
          {groups.length === 0 && (
            <div className="flex items-center gap-3">
              <TelegramIcon className="w-10 h-10 shrink-0" />
              <p className="text-sm text-cs-text-dim">Post class updates to your students’ Telegram groups automatically. You can connect more than one.</p>
            </div>
          )}
          <ol className="space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-cs-primary text-white grid place-items-center text-xs font-bold shrink-0">1</span>
              <div className="flex-1">
                <p>Open Telegram and choose the group. You need to be an admin of it.</p>
                <button onClick={openTelegram} disabled={busy} className="btn btn-primary btn-sm mt-2">
                  <FiExternalLink /> {waiting ? 'Open Telegram again' : 'Connect Telegram group'}
                </button>
              </div>
            </li>
            <li className="flex gap-3">
              <span className={`w-6 h-6 rounded-full grid place-items-center text-xs font-bold shrink-0 ${waiting ? 'bg-cs-primary text-white' : 'bg-cs-overlay/10 text-cs-text-dim'}`}>2</span>
              <div className={waiting ? '' : 'text-cs-text-dim'}>
                <p>Add <strong>@{st.bot_username}</strong> to the group. It connects automatically.</p>
                {waiting && (
                  <p className="mt-2 inline-flex items-center gap-2 text-cs-primary font-medium">
                    <FiLoader className="animate-spin" /> Waiting for the bot to join your group…
                  </p>
                )}
              </div>
            </li>
          </ol>
        </div>
      )}
    </Dialog>
  );
}
