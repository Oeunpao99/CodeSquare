import React, { useEffect, useRef, useState } from 'react';
import {
  FiPlus, FiTrash2, FiLock, FiEye, FiEyeOff, FiZap, FiFileText, FiKey, FiFolder,
  FiCheckSquare, FiCpu, FiAlertTriangle, FiShield, FiX,
} from 'react-icons/fi';
import { toast } from '../utils/toast';
import { noteService } from '../services/api';
import { formatDateTime } from '../utils/datetime';
import ConfirmDialog from '../components/ConfirmDialog';

// How long a revealed secret stays on screen before it auto-hides.
const REVEAL_TTL_MS = 45_000;

function apiError(e, fallback) {
  return e?.response?.data?.detail || fallback;
}

// Modal: re-enter the account password to decrypt one stored secret. The PIN this
// page used before was cosmetic (a hash in localStorage); the real gate is the
// server checking the account password on POST /notes/{id}/secret.
function RevealDialog({ onSubmit, onClose, busy }) {
  const [pw, setPw] = useState('');
  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-cs-dark/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md card-dev p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-lg bg-cs-orange/15 text-cs-orange flex items-center justify-center text-lg">
              <FiLock />
            </span>
            <h2 className="text-lg font-bold">Reveal secret</h2>
          </div>
          <button onClick={onClose} className="text-cs-text-muted hover:text-cs-text"><FiX /></button>
        </div>
        <p className="text-sm text-cs-text-dim mb-4">
          Enter your <b>account password</b> to decrypt this value. The reveal is logged on the note
          and rate-limited.
        </p>
        <input
          type="password"
          autoFocus
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && pw && onSubmit(pw)}
          placeholder="account password"
          className="input w-full font-mono mb-5"
        />
        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className="btn btn-ghost font-mono">cancel</button>
          <button
            onClick={() => onSubmit(pw)}
            disabled={!pw || busy}
            className="btn btn-primary font-mono"
          >
            {busy ? 'checking…' : '$ reveal'}
          </button>
        </div>
      </div>
    </div>
  );
}

function VaultBanner() {
  return (
    <div className="card border-cs-orange/30 p-4 mb-6 flex items-start gap-3">
      <span className="w-9 h-9 rounded-lg bg-cs-orange/15 text-cs-orange flex items-center justify-center shrink-0">
        <FiAlertTriangle />
      </span>
      <div className="min-w-0">
        <div className="font-bold font-mono text-sm"> credential vault not configured</div>
        <p className="text-xs text-cs-text-dim mt-1">
          Storing credential values is disabled until the server has a dedicated{' '}
          <span className="font-mono text-cs-orange">NOTE_SECRET_KEY</span> (≥ 32 random chars, not the
          JWT key). Plain notes and project ideas still work. Ask whoever runs the backend to set it and
          restart.
        </p>
      </div>
    </div>
  );
}

function SecretInput({ value, onChange, disabled }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={disabled ? 'vault not configured' : 'value to encrypt'}
        className="input w-full font-mono pr-10 disabled:opacity-50"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-cs-text-muted hover:text-cs-text"
      >
        {show ? <FiEyeOff /> : <FiEye />}
      </button>
    </div>
  );
}

function NoteCard({ n, active, onSelect, onDelete, busy }) {
  const k = n.kind || 'note';
  const Icon = k === 'credential' ? FiKey : k === 'project' ? FiFolder : FiFileText;
  const iconCls =
    k === 'credential' ? 'text-cs-orange bg-cs-orange/10'
    : k === 'project' ? 'text-cs-cyan bg-cs-cyan/10'
    : 'text-cs-primary bg-cs-primary/10';

  return (
    <div
      onClick={() => onSelect(n.id)}
      className={`card cursor-pointer group p-3 transition-all ${
        active ? 'border-cs-primary/40 shadow-[0_0_20px_-10px_rgb(var(--cs-primary)/0.5)]' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconCls}`}>
          <Icon className="text-base" />
        </span>
        <div className="min-w-0 flex-grow">
          <div className="font-bold text-sm truncate">{n.title || 'Untitled'}</div>
          {n.snippet ? (
            <p className="text-[11px] text-cs-text-dim truncate mt-0.5">{n.snippet}</p>
          ) : (
            <p className="text-[11px] text-cs-text-muted italic mt-0.5">empty</p>
          )}
          <div className="flex items-center gap-2 mt-1.5 text-[10px] font-mono text-cs-text-muted">
            {k === 'credential' && <span className="px-1.5 py-0.5 rounded border border-cs-orange/25 text-cs-orange bg-cs-orange/5">credential</span>}
            {n.has_secret && <span className="text-cs-orange">◉ secret</span>}
            {n.has_suggestion && <span className="text-cs-cyan">◈ ai plan</span>}
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); if (onDelete) onDelete(n.id); }}
          disabled={busy}
          className="opacity-0 group-hover:opacity-100 text-cs-text-muted hover:text-cs-red transition-opacity shrink-0"
          title="Delete"
        >
          <FiTrash2 />
        </button>
      </div>
    </div>
  );
}

function AiStructure({ suggestion }) {
  if (!suggestion) return null;
  return (
    <div className="card mt-4">
      <div className="flex items-center gap-2 font-mono text-xs tracking-[0.18em] uppercase text-cs-cyan mb-3">
        <FiCpu /> ai_project_plan
      </div>
      <div className="mb-3">
        <div className="mono-label mb-1.5">stack</div>
        <div className="flex flex-wrap gap-1.5">
          {suggestion.stack.map((s) => (
            <span key={s} className="px-2.5 py-1 rounded-md text-xs font-mono border border-cs-primary/25 bg-cs-primary/10 text-cs-primary">
              {s}
            </span>
          ))}
        </div>
      </div>
      <div className="mb-3">
        <div className="mono-label mb-1.5">structure</div>
        <pre className="terminal p-3 text-[12px] leading-relaxed overflow-x-auto">{suggestion.structure}</pre>
      </div>
      <div>
        <div className="mono-label mb-1.5">steps</div>
        <ol className="space-y-1.5">
          {suggestion.steps.map((s, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-cs-text-dim">
              <FiCheckSquare className="text-cs-green mt-0.5 shrink-0" />
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function Editor({
  note, busy, onSave, onConvert, converting, onCreate,
  onReveal, revealedId, revealedValue, vaultOk,
}) {
  const [form, setForm] = useState({ kind: 'note', title: '', content: '', secret: '' });
  useEffect(() => {
    if (!note) return;
    setForm({
      kind: note.kind || 'note',
      title: note.title || '',
      content: note.content || '',
      secret: '',
    });
  }, [note && note.id]);

  const kind = form.kind;
  const isCred = kind === 'credential';
  const isRevealed = revealedId === note?.id;

  const copySecret = async () => {
    if (revealedValue == null) return;
    try {
      await navigator.clipboard.writeText(revealedValue);
      toast.success('Copied', 'Secret copied to clipboard.');
    } catch {
      toast.error('Could not copy', 'Copy it manually instead.');
    }
  };

  if (!note) {
    return (
      <div className="card p-8 text-center">
        <span className="w-14 h-14 rounded-xl bg-cs-primary/10 border border-cs-primary/30 text-cs-primary text-2xl flex items-center justify-center mx-auto mb-4">
          <FiFileText />
        </span>
        <h2 className="text-lg font-bold mb-1">Your scratchpad</h2>
        <p className="text-sm text-cs-text-dim max-w-md mx-auto mb-6">
          Jot down a project idea as markdown, let the AI turn it into a real build
          plan, or keep a credential you don’t want to forget.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <button onClick={() => onCreate('note')} className="btn btn-ghost font-mono">
            <FiFileText /> note
          </button>
          <button onClick={() => onCreate('project')} className="btn btn-secondary font-mono">
            <FiPlus /> requirement
          </button>
          <button
            onClick={() => onCreate('credential')}
            disabled={!vaultOk}
            title={vaultOk ? '' : 'Credential vault not configured'}
            className="btn btn-primary font-mono disabled:opacity-40"
          >
            <FiKey /> credential
          </button>
        </div>
      </div>
    );
  }

  const save = () => {
    const body = {
      kind: form.kind,
      title: form.title.trim() || 'Untitled',
      content: form.content.trim(),
    };
    if (isCred && form.secret) body.secret = form.secret;
    onSave(body);
    setForm((f) => ({ ...f, secret: '' }));
  };

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {[
            { id: 'note', label: 'note' },
            { id: 'project', label: 'project' },
            { id: 'credential', label: 'credential', disabled: !vaultOk },
          ].map((opt) => (
            <button
              key={opt.id}
              disabled={opt.disabled}
              onClick={() => setForm((f) => ({ ...f, kind: opt.id }))}
              className={`px-3 py-1.5 rounded-lg border text-xs font-mono transition-colors disabled:opacity-40 ${
                kind === opt.id
                  ? 'border-cs-primary bg-cs-primary/10 text-cs-primary'
                  : 'border-cs-line/15 text-cs-text-dim hover:text-cs-text'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <input
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          className="input w-full mb-3"
          placeholder={isCred ? 'Service / site, e.g. "PT-B-login"' : 'Note title'}
        />

        {isCred ? (
          <div className="space-y-3">
            <div>
              <div className="mono-label mb-1.5"> username / host (plaintext)</div>
              <input
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                className="input w-full"
                placeholder="e.g. admin@company.com · db.example.com:5432"
              />
            </div>

            {note.has_secret && (
              <div>
                <div className="mono-label mb-1.5"> stored secret</div>
                {isRevealed ? (
                  <div className="flex items-center gap-2 border border-cs-orange/30 bg-cs-orange/10 rounded-lg px-3 py-2.5">
                    <span className="font-mono text-sm text-cs-orange break-all flex-grow min-w-0">{revealedValue}</span>
                    <button onClick={copySecret} className="btn btn-ghost btn-sm font-mono shrink-0">copy</button>
                  </div>
                ) : (
                  <button
                    onClick={onReveal}
                    className="w-full flex items-center justify-center gap-2 border border-cs-line/15 rounded-lg px-3 py-2.5 font-mono text-sm text-cs-text-dim hover:text-cs-orange hover:border-cs-orange/40 transition-colors"
                  >
                    <FiLock /> reveal value (asks for your password)
                  </button>
                )}
                {note.revealed_at && !isRevealed && (
                  <p className="text-[11px] text-cs-text-muted mt-1">
                    last revealed {formatDateTime(note.revealed_at)}
                  </p>
                )}
              </div>
            )}

            <div>
              <div className="mono-label mb-1.5">
                {note.has_secret ? 'replace secret' : 'secret value'}
                <span className="text-cs-text-muted"> — encrypted with the server vault key</span>
              </div>
              <SecretInput
                value={form.secret}
                onChange={(e) => setForm((f) => ({ ...f, secret: e.target.value }))}
                disabled={!vaultOk}
              />
              {note.has_secret && !form.secret && (
                <p className="text-[11px] text-cs-text-muted mt-1">Leave blank to keep the current secret.</p>
              )}
            </div>

            <p className="text-[11px] text-cs-text-muted flex items-start gap-1.5 pt-1">
              <FiShield className="mt-0.5 shrink-0" />
              Values are AES-encrypted at rest with a key the server holds. Don’t store anything you
              couldn’t rotate — for production secrets, keep the real value in a dedicated manager and
              note only <i>where</i> it lives.
            </p>
          </div>
        ) : (
          <div>
            <div className="mono-label mb-1.5"> markdown</div>
            <textarea
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              className="input w-full min-h-[220px] font-mono text-sm leading-relaxed resize-y"
              placeholder="Jot down the idea / requirements — the AI can convert this into a project plan."
            />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 mt-4">
          <button onClick={save} disabled={busy} className="btn btn-primary font-mono">
            {busy ? 'saving…' : `$ write`}
          </button>
          {!isCred && (note.content || form.content).trim() && (
            <button onClick={onConvert} disabled={converting} className="btn btn-secondary font-mono">
              <FiZap /> {converting ? 'converting…' : 'ai: convert to project'}
            </button>
          )}
        </div>
      </div>

      {!isCred && <AiStructure suggestion={note.ai_suggestion} />}
    </div>
  );
}

function Notes() {
  const [list, setList] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);
  const [revealed, setRevealed] = useState(null);      // { id, value }
  const [revealTarget, setRevealTarget] = useState(null); // note id awaiting password
  const [revealBusy, setRevealBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [vaultOk, setVaultOk] = useState(true);        // assume ok until told otherwise
  const revealTimer = useRef(null);

  const load = () => noteService.list().then((r) => setList(r.data)).catch(() => {});

  useEffect(() => {
    load().finally(() => setLoading(false));
    noteService.vaultStatus()
      .then((r) => setVaultOk(!!r.data.configured))
      .catch(() => setVaultOk(false));
    return () => { if (revealTimer.current) clearTimeout(revealTimer.current); };
  }, []);

  useEffect(() => {
    if (activeId == null) { setDetail(null); return; }
    noteService.get(activeId).then((r) => setDetail(r.data)).catch(() => {});
    // switching notes hides any revealed secret
    setRevealed(null);
    if (revealTimer.current) clearTimeout(revealTimer.current);
  }, [activeId]);

  const create = async (kind) => {
    if (kind === 'credential' && !vaultOk) {
      toast.error('Vault not configured', 'Set NOTE_SECRET_KEY on the server first.');
      return;
    }
    try {
      const r = await noteService.create({
        kind,
        title: kind === 'credential' ? 'New credential' : 'Untitled',
        content: '',
      });
      await load();
      setActiveId(r.data.id);
      toast.success('Note created');
    } catch (e) {
      toast.error('Could not create', apiError(e));
    }
  };

  const save = async (body) => {
    setSaving(true);
    try {
      const r = await noteService.update(activeId, body);
      setDetail(r.data);
      await load();
      toast.success('Saved');
    } catch (e) {
      toast.error('Could not save', apiError(e));
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async (id) => {
    try {
      await noteService.remove(id);
      if (id === activeId) setActiveId(null);
      await load();
      toast.success('Deleted');
    } catch {
      toast.error('Could not delete');
    }
  };

  // Toggle off if already shown; otherwise open the password dialog.
  const startReveal = (id) => {
    if (revealed && revealed.id === id) {
      setRevealed(null);
      if (revealTimer.current) clearTimeout(revealTimer.current);
      return;
    }
    setRevealTarget(id);
  };

  const submitReveal = async (password) => {
    setRevealBusy(true);
    try {
      const r = await noteService.reveal(revealTarget, password);
      setRevealed({ id: revealTarget, value: r.data.secret });
      setRevealTarget(null);
      if (revealTimer.current) clearTimeout(revealTimer.current);
      revealTimer.current = setTimeout(() => setRevealed(null), REVEAL_TTL_MS);
      toast.success('Revealed', 'Auto-hides in 45s.');
    } catch (e) {
      const code = e?.response?.status;
      toast.error(
        code === 403 ? 'Wrong password'
        : code === 429 ? 'Slow down'
        : code === 503 ? 'Vault not configured'
        : 'Could not reveal',
        apiError(e),
      );
    } finally {
      setRevealBusy(false);
    }
  };

  const convert = async () => {
    setConverting(true);
    try {
      const r = await noteService.convert(activeId);
      setDetail(r.data);
      await load();
      toast.success('Project plan ready');
    } catch (e) {
      toast.error('Could not convert', apiError(e));
    } finally {
      setConverting(false);
    }
  };

  return (
    <main className="w-full px-6 lg:px-10 py-8">
      <div className="sticky top-0 z-30 bg-cs-dark/85 backdrop-blur-xl border-b border-cs-line/[0.07] -mx-6 lg:-mx-10 px-6 lg:px-10 pt-4 pb-5 -mt-8 mb-6">
        <div className="flex flex-wrap items-end justify-between gap-4 lg:pr-14">
          <div>
            <span className="mono-label"> codesquare_note</span>
            <h1 className="text-3xl font-bold mt-2 flex items-center gap-3">
              <FiFileText className="text-cs-primary" /> Notes
            </h1>
            <p className="text-cs-text-dim mt-1 text-sm">
              Scratchpad · project requirements{vaultOk ? ' · credentials' : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => create('project')} className="btn btn-secondary font-mono">
              <FiPlus /> requirement
            </button>
            <button
              onClick={() => create('credential')}
              disabled={!vaultOk}
              title={vaultOk ? '' : 'Credential vault not configured'}
              className="btn btn-primary font-mono disabled:opacity-40"
            >
              <FiKey /> credential
            </button>
          </div>
        </div>
      </div>

      {!vaultOk && <VaultBanner />}

      <div className="grid lg:grid-cols-[minmax(0,340px)_1.4fr] gap-6 items-start">
        <div className="lg:sticky lg:top-36 self-start lg:max-h-[calc(100vh-10rem)] lg:overflow-y-auto pr-1">
          <p className="mono-label text-cs-text-muted mb-2 px-1"> recent activity</p>
          <div className="space-y-2">
            {loading ? (
              <div className="card p-6 text-cs-text-dim">loading…</div>
            ) : list.length === 0 ? (
              <div className="card text-center py-10">
                <FiFileText className="text-3xl text-cs-text-muted mx-auto mb-3" />
                <p className="text-cs-text-dim text-sm">No notes yet.</p>
                <p className="text-xs text-cs-text-muted mt-1">Create a requirement note or credential.</p>
              </div>
            ) : (
              list.map((n) => (
                <NoteCard
                  key={n.id}
                  n={n}
                  active={n.id === activeId}
                  onSelect={setActiveId}
                  onDelete={setPendingDelete}
                />
              ))
            )}
          </div>
        </div>

        <div>
          <Editor
            note={detail}
            busy={saving}
            onSave={save}
            onConvert={convert}
            converting={converting}
            onCreate={create}
            onReveal={() => startReveal(activeId)}
            revealedId={revealed?.id}
            revealedValue={revealed?.value}
            vaultOk={vaultOk}
          />
        </div>
      </div>

      {revealTarget != null && (
        <RevealDialog
          busy={revealBusy}
          onSubmit={submitReveal}
          onClose={() => setRevealTarget(null)}
        />
      )}

      {pendingDelete != null && (
        <ConfirmDialog
          title="Delete note"
          message={list.find((n) => n.id === pendingDelete)?.title
            ? `Delete “${list.find((n) => n.id === pendingDelete).title}”? This can't be undone.`
            : 'Delete this note? This can’t be undone.'}
          onConfirm={() => doDelete(pendingDelete)}
          onClose={() => setPendingDelete(null)}
        />
      )}
    </main>
  );
}

export default Notes;
