import React, { useState, useRef, useEffect } from 'react';
import { FiSend, FiPlus, FiTrash2, FiX, FiClock, FiMessageSquare } from 'react-icons/fi';
import AiIcon from './AiIcon';
import Markdown from './Markdown';
import { aiService, usageService, tutorService } from '../services/api';

/* --------------------------------- chat --------------------------------- */

const GREETING = {
  role: 'ai',
  content:
    "Hi — I'm CodeSquareAgent. Ask a question, paste an error, or share broken code and I'll help you fix it. I can write full examples too.",
};

const QUICK = [
  { label: 'Give an example', send: 'Show me a short, complete example.' },
  { label: 'Fix my code', prefill: "Fix this — here's the code and the error:\n\n" },
  { label: 'Explain more', send: 'Can you explain that in more detail, with a code sample?' },
];

// Slash commands — typed into the chat box, handled locally (never sent to the
// model). `arg` (optional) hints the completion; `aliases` also match.
const SLASH = [
  { name: 'session', desc: 'Browse & switch to a past chat', aliases: ['sessions', 'resume', 'history'] },
  { name: 'new', desc: 'Start a fresh chat', aliases: ['clear', 'reset'] },
  { name: 'usage', desc: 'Show AI token usage — session & weekly', arg: '[free|pro]' },
  { name: 'plan', desc: 'Switch plan', arg: '<free|pro>' },
  { name: 'help', desc: 'List these commands' },
];

// Rough client-side token budget for one chat's live context. Small on purpose
// so the donut is meaningful and auto-compact keeps replies snappy.
const CONTEXT_BUDGET = 16000;
const AUTO_COMPACT_AT = 0.9;   // fraction full → auto-compact
const KEEP_RECENT = 4;         // turns left untouched when compacting
const estTokens = (s) => Math.ceil((s || '').length / 4);

function ContextDonut({ pct, onClick, busy }) {
  const r = 9;
  const c = 2 * Math.PI * r;
  const p = Math.min(1, Math.max(0, pct));
  const remaining = Math.round((1 - p) * 100);
  const color = p >= 0.9 ? 'rgb(var(--cs-red))' : p >= 0.7 ? 'rgb(var(--cs-orange))' : 'rgb(var(--cs-primary))';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      title={`${remaining}% context left · click to compact${busy ? ' (working…)' : ''}`}
      className="h-11 w-11 shrink-0 rounded-lg border border-cs-line/15 bg-cs-overlay/[0.04] flex items-center justify-center hover:border-cs-primary/40 transition-colors disabled:opacity-50"
      aria-label={`Context ${remaining}% remaining — compact`}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" className={busy ? 'animate-spin' : ''}>
        <circle cx="12" cy="12" r={r} fill="none" stroke="rgb(var(--cs-line) / 0.2)" strokeWidth="3" />
        <circle
          cx="12" cy="12" r={r} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - p)}
          transform="rotate(-90 12 12)"
          style={{ transition: 'stroke-dashoffset .4s ease, stroke .3s' }}
        />
      </svg>
    </button>
  );
}

function timeAgo(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const findSlash = (name) =>
  SLASH.find((c) => c.name === name || (c.aliases || []).includes(name));

// 10-cell text meter for rendering usage inside a chat bubble.
const meter = (pct) => {
  const filled = Math.round(Math.min(100, Math.max(0, pct)) / 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
};

function fmtCountdown(secs) {
  if (!secs || secs <= 0) return 'now';
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function usageMarkdown(u) {
  const line = (w) =>
    `\`${w.label.padEnd(16)}\` ${meter(w.percent)} **${w.percent}%**  ` +
    `${(w.used || 0).toLocaleString()} / ${(w.limit || 0).toLocaleString()} · frees up in ${fmtCountdown(w.resets_in_seconds)}`;
  return (
    `**Plan:** ${u.plan_label}\n\n` +
    `${line(u.session)}\n\n${line(u.weekly)}\n\n` +
    `${u.calls_this_week} AI call${u.calls_this_week === 1 ? '' : 's'} this week · limits are soft (nothing blocked)`
  );
}

function AITutor({ language, context, embedded = false, persist = false }) {
  const [messages, setMessages] = useState([GREETING]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [menuIdx, setMenuIdx] = useState(0);
  const [showSessions, setShowSessions] = useState(false);
  const [sessions, setSessions] = useState(null);   // null = not loaded
  const [compacting, setCompacting] = useState(false);
  const scrollRef = useRef(null);
  const taRef = useRef(null);
  const rafRef = useRef(0);
  const sessionRef = useRef(null);                  // current saved-chat id (persist mode)

  const pushSys = (content) =>
    setMessages((prev) => [...prev, { role: 'ai', sys: true, content }]);

  // Create the saved session lazily — only once the user actually sends something.
  const ensureSession = async () => {
    if (!persist) return null;
    if (sessionRef.current) return sessionRef.current;
    try {
      const r = await tutorService.createSession();
      sessionRef.current = r.data.id;
      return r.data.id;
    } catch {
      return null;
    }
  };

  const loadSessions = () => {
    setSessions(null);
    tutorService.sessions().then((r) => setSessions(r.data)).catch(() => setSessions([]));
  };

  const openSession = async (id) => {
    try {
      const r = await tutorService.getSession(id);
      const turns = (r.data.turns || []).map((t) => ({
        role: t.role === 'user' ? 'user' : 'ai',
        content: t.content,
      }));
      setMessages([GREETING, ...turns]);
      sessionRef.current = id;
      setShowSessions(false);
    } catch {
      pushSys("Couldn't open that chat.");
    }
  };

  const removeSession = async (id, e) => {
    e.stopPropagation();
    try {
      await tutorService.deleteSession(id);
      setSessions((prev) => (prev || []).filter((s) => s.id !== id));
      if (sessionRef.current === id) sessionRef.current = null;
    } catch { /* ignore */ }
  };

  const newChat = () => {
    setMessages([GREETING]);
    sessionRef.current = null;
    setShowSessions(false);
  };

  // --- context window meter + auto-compact ---
  const realMsgs = messages.filter((m) => m !== GREETING && !m.streaming);
  const ctxTokens = realMsgs.reduce((n, m) => n + estTokens(m.content), 0);
  const ctxPct = Math.min(1, ctxTokens / CONTEXT_BUDGET);

  const compact = async (auto = false) => {
    if (compacting || loading) return;
    const items = messages.filter((m) => m !== GREETING && !m.streaming && !m.sys);
    if (items.length <= KEEP_RECENT + 1) {
      if (!auto) pushSys('Not much to compact yet.');
      return;
    }
    const older = items.slice(0, -KEEP_RECENT);
    const recentIds = new Set(items.slice(-KEEP_RECENT));
    setCompacting(true);
    try {
      const turns = older.map((m) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      }));
      const r = await tutorService.compact(turns, sessionRef.current, KEEP_RECENT);
      const summary = (r.data.summary || '').trim();
      setMessages((prev) => {
        const keep = prev.filter((m) => recentIds.has(m) || m.streaming);
        return [
          GREETING,
          {
            role: 'ai',
            sys: true,
            content: summary
              ? `📦 **Compacted** — earlier turns summarised to save context.\n\n${summary}`
              : '📦 **Compacted** — earlier turns dropped to save context.',
          },
          ...keep,
        ];
      });
    } catch {
      if (!auto) pushSys("Couldn't compact right now.");
    } finally {
      setCompacting(false);
    }
  };

  // Auto-compact once the window is ~full.
  useEffect(() => {
    const streaming = messages[messages.length - 1]?.streaming;
    if (ctxPct >= AUTO_COMPACT_AT && !compacting && !loading && !streaming) {
      compact(true);
    }
  }, [ctxPct, compacting, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Slash-command menu: shown while typing "/word" (before the first space).
  const slashQuery = /^\/(\S*)$/.exec(input);
  const slashMenu = slashQuery
    ? SLASH.filter((c) => c.name.startsWith(slashQuery[1].toLowerCase()))
    : [];
  useEffect(() => { setMenuIdx(0); }, [input]);

  const runSlash = async (raw) => {
    const [cmd, ...rest] = raw.slice(1).trim().split(/\s+/);
    const arg = rest.join(' ').trim().toLowerCase();
    const def = findSlash((cmd || '').toLowerCase());
    setInput('');
    if (taRef.current) taRef.current.style.height = 'auto';

    if (!def) {
      pushSys(`Unknown command \`/${cmd}\`. Type \`/help\` for the list.`);
      return;
    }
    const name = def.name;

    if (name === 'new') {
      newChat();
      return;
    }
    if (name === 'session') {
      if (arg === 'new') { newChat(); return; }
      setShowSessions(true);
      loadSessions();
      return;
    }
    if (name === 'help') {
      pushSys(
        'Commands:\n' +
        SLASH.map((c) => `- \`/${c.name}${c.arg ? ' ' + c.arg : ''}\` — ${c.desc}`).join('\n'),
      );
      return;
    }
    if (name === 'plan' || (name === 'usage' && arg)) {
      const target = arg || rest[0];
      if (!['free', 'pro'].includes(target)) {
        pushSys('Usage: `/plan free` or `/plan pro`.');
        return;
      }
      try {
        const r = await usageService.setPlan(target);
        pushSys(`Switched to **${r.data.plan_label}**.\n\n${usageMarkdown(r.data)}`);
      } catch (e) {
        pushSys(`Couldn't switch plan${e?.response?.data?.detail ? ` — ${e.response.data.detail}` : ''}.`);
      }
      return;
    }
    if (name === 'usage') {
      try {
        const r = await usageService.get();
        pushSys(usageMarkdown(r.data));
      } catch {
        pushSys("Couldn't read usage right now.");
      }
      return;
    }
  };

  useEffect(() => {
    const streaming = messages[messages.length - 1]?.streaming;
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: streaming ? 'auto' : 'smooth',
    });
  }, [messages, loading]);

  const grow = () => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  };

  const insertSlash = () => {
    setInput((v) => (v.startsWith('/') ? v : '/'));
    requestAnimationFrame(() => taRef.current?.focus());
  };

  // Size the field correctly on first paint (and when input is cleared).
  useEffect(() => {
    grow();
  }, [input]);

  // Stop the reveal loop if we unmount mid-stream.
  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const ask = async (text) => {
    const msg = text.trim();
    if (!msg || loading) return;
    if (msg.startsWith('/')) { runSlash(msg); return; }
    const next = [...messages, { role: 'user', content: msg }];
    setMessages(next);
    setInput('');
    if (taRef.current) taRef.current.style.height = 'auto';
    setLoading(true);

    const history = next
      .filter((m) => m !== GREETING)
      .slice(-8)
      .map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }));

    // Placeholder bubble; it fills in as tokens arrive.
    setMessages((prev) => [...prev, { role: 'ai', content: '', streaming: true }]);

    let acc = '';          // raw markdown accumulated from the stream
    let shown = 0;         // chars of `acc` revealed so far
    let streamDone = false;
    let finished = false;

    const patchLast = (patch) =>
      setMessages((prev) => {
        const copy = prev.slice();
        const i = copy.length - 1;
        if (copy[i] && copy[i].role === 'ai') copy[i] = { ...copy[i], ...patch };
        return copy;
      });

    const finish = () => {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(rafRef.current);
      patchLast({
        content: acc || "I couldn't reach the tutor. Try again in a moment.",
        streaming: false,
      });
      setLoading(false);
    };

    // Reveal on rAF (not per network chunk): step scales with how far behind we
    // are, and always runs to the next whitespace so words never split.
    const tick = () => {
      if (shown < acc.length) {
        const backlog = acc.length - shown;
        const step = backlog > 160 ? 14 : backlog > 60 ? 7 : backlog > 15 ? 3 : 1;
        let end = Math.min(acc.length, shown + step);
        while (end < acc.length && !/\s/.test(acc[end])) end++;
        shown = end;
        patchLast({ content: acc.slice(0, shown) });
      }
      if (!streamDone || shown < acc.length) rafRef.current = requestAnimationFrame(tick);
      else finish();
    };

    try {
      const sid = await ensureSession();
      const token = localStorage.getItem('token');
      const resp = await fetch('/api/ai/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: msg, context, language, history, session_id: sid }),
      });
      if (!resp.ok || !resp.body) throw new Error('stream unavailable');

      rafRef.current = requestAnimationFrame(tick);

      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const frames = buf.split('\n\n');
        buf = frames.pop() || '';
        for (const frame of frames) {
          const line = frame.split('\n').find((l) => l.startsWith('data: '));
          if (!line) continue;
          let evt;
          try { evt = JSON.parse(line.slice(6)); } catch { continue; }
          if (evt.kind === 'token') acc += evt.token;
          else if (evt.kind === 'reply' || evt.kind === 'done') acc = evt.response || acc;
        }
      }
      streamDone = true;
    } catch {
      // Couldn't open the stream — fall back to the one-shot endpoint.
      if (!acc) {
        try {
          const res = await aiService.chat(msg, context, language, history, sessionRef.current);
          acc = res.data.response || '';
        } catch {
          acc = "I couldn't reach the tutor. Try again in a moment — and paste the exact error text when you do.";
        }
      }
      streamDone = true;
      finish();
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    ask(input);
  };

  const pickSlash = (c) => {
    // Commands that take an arg: fill "/cmd " and wait. Others: run now.
    if (c.arg && c.arg.startsWith('<')) {
      setInput(`/${c.name} `);
      requestAnimationFrame(() => taRef.current?.focus());
    } else {
      runSlash(`/${c.name}`);
    }
  };

  const onKeyDown = (e) => {
    if (slashMenu.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMenuIdx((i) => (i + 1) % slashMenu.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMenuIdx((i) => (i - 1 + slashMenu.length) % slashMenu.length); return; }
      if (e.key === 'Tab') { e.preventDefault(); setInput(`/${slashMenu[menuIdx].name} `); return; }
      if (e.key === 'Escape') { e.preventDefault(); setInput(''); return; }
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); pickSlash(slashMenu[menuIdx]); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      ask(input);
    }
  };

  const quick = (q) => {
    if (q.send) {
      ask(q.send);
    } else {
      setInput(q.prefill || '');
      requestAnimationFrame(() => {
        taRef.current?.focus();
        grow();
      });
    }
  };

  return (
    <div className={`relative flex flex-col ${embedded ? 'h-full' : 'h-[440px]'}`}>
      {/* Session history — /session */}
      {showSessions && (
        <div className="absolute inset-0 z-30 flex flex-col bg-cs-darkest/95 backdrop-blur-xl">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-cs-line/10">
            <FiClock className="text-cs-primary" />
            <span className="font-mono text-sm font-semibold flex-grow">Past chats</span>
            <button
              onClick={newChat}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono text-cs-primary border border-cs-primary/40 hover:bg-cs-primary/10 transition-colors"
            >
              <FiPlus /> new chat
            </button>
            <button onClick={() => setShowSessions(false)} className="p-1.5 text-cs-text-muted hover:text-cs-text">
              <FiX />
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
            {sessions === null && (
              <p className="text-cs-text-muted font-mono text-sm px-1 py-4">loading…</p>
            )}
            {sessions && sessions.length === 0 && (
              <p className="text-cs-text-muted font-mono text-sm px-1 py-4">
                No saved chats yet. Ask something and it’ll show up here.
              </p>
            )}
            {(sessions || []).map((s) => (
              <button
                key={s.id}
                onClick={() => openSession(s.id)}
                className={`w-full text-left rounded-lg border p-3 transition-colors group ${
                  sessionRef.current === s.id
                    ? 'border-cs-primary/50 bg-cs-primary/[0.06]'
                    : 'border-cs-line/15 hover:border-cs-primary/40 hover:bg-cs-overlay/[0.04]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <FiMessageSquare className="text-cs-text-muted shrink-0 text-xs" />
                  <span className="font-mono text-sm font-semibold truncate flex-grow">{s.title}</span>
                  <span className="font-mono text-[10px] text-cs-text-muted shrink-0">{timeAgo(s.updated_at)}</span>
                  <span
                    onClick={(e) => removeSession(s.id, e)}
                    className="opacity-0 group-hover:opacity-100 text-cs-text-muted hover:text-cs-red transition-all shrink-0"
                    title="Delete chat"
                  >
                    <FiTrash2 className="text-xs" />
                  </span>
                </div>
                <p className="text-[11px] text-cs-text-dim truncate mt-1 pl-5">{s.preview}</p>
                <p className="text-[10px] text-cs-text-muted font-mono mt-0.5 pl-5">{s.turns} messages</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {!embedded && (
        <div className="flex items-center gap-3 px-4 py-3 border-b border-cs-primary/20 bg-cs-overlay/[0.05]">
          <div className="w-8 h-8 rounded-md bg-gradient-main flex items-center justify-center">
            <AiIcon className="text-cs-dark text-lg" />
          </div>
          <div className="flex-grow">
            <div className="font-mono text-sm font-semibold text-cs-text">
              <span className="text-cs-mint select-none">❯&nbsp;</span>codesquare_agent --live
            </div>
            <div className="text-[11px] text-cs-green flex items-center gap-1.5 font-mono">
              <span className="w-1.5 h-1.5 bg-cs-green rounded-full animate-pulse"></span>
              ready for input
            </div>
          </div>
        </div>
      )}

      <div ref={scrollRef} className={`flex-grow overflow-y-auto p-4 space-y-4 ${embedded ? 'min-h-0' : ''}`}>
        {messages.map((msg, index) =>
          msg.role === 'user' ? (
            <div key={index} className="flex justify-end">
              <div className="max-w-[88%] w-fit rounded-lg px-4 py-2.5 text-[13px] leading-6 font-mono whitespace-pre-wrap bg-cs-primary/15 text-cs-primary border border-cs-primary/30 shadow-[0_0_18px_-10px_rgb(var(--cs-primary)/0.7)]">
                <span className="text-cs-mint font-bold select-none">❯&nbsp;</span>
                {msg.content}
              </div>
            </div>
          ) : msg.sys ? (
            <div key={index} className="flex justify-start">
              <div className="max-w-full w-full text-sm rounded-lg border border-cs-line/15 bg-cs-overlay/[0.04] px-4 py-3">
                <div className="flex items-center gap-1.5 mb-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-cs-text-muted">
                  <span>// system</span>
                </div>
                <Markdown text={msg.content} className="space-y-1 text-cs-text-dim" />
              </div>
            </div>
          ) : (
            <div key={index} className="flex justify-start">
              <div className="max-w-full w-full text-sm">
                <div className="flex items-center gap-1.5 mb-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-cs-cyan">
                  <AiIcon className="text-xs" /> <span>// codesquare_agent</span>
                </div>
                <>
                  <Markdown text={msg.content} size="text-[13px]" className="space-y-1 leading-6 text-cs-text-dim" />
                  {msg.streaming && (
                    <span className="inline-block w-1.5 h-3.5 ml-0.5 align-middle bg-cs-cyan/70 animate-blink" />
                  )}
                </>
              </div>
            </div>
          )
        )}
        {loading && !messages[messages.length - 1]?.streaming && (
          <div className="flex items-center gap-1.5 text-cs-cyan text-sm font-mono pl-1">
            <span>❯</span>
            <span className="inline-block w-2 h-4 bg-cs-primary/70 animate-blink" />
          </div>
        )}
      </div>

      <div className="border-t border-cs-line/10 p-3 space-y-2 relative">
        {/* Slash-command menu — appears while typing "/…" */}
        {slashMenu.length > 0 && (
          <div className="absolute bottom-full left-3 right-3 mb-2 rounded-lg border border-cs-line/20 bg-cs-darkest overflow-hidden z-20">
            <div className="px-3 py-1.5 border-b border-cs-line/10 font-mono text-[10px] uppercase tracking-[0.18em] text-cs-text-muted">
              // commands
            </div>
            {slashMenu.map((c, i) => (
              <button
                key={c.name}
                type="button"
                onMouseEnter={() => setMenuIdx(i)}
                onClick={() => pickSlash(c)}
                className={`w-full flex items-baseline gap-2 px-3 py-2 text-left transition-colors ${
                  i === menuIdx ? 'bg-cs-primary/12' : 'hover:bg-cs-overlay/[0.05]'
                }`}
              >
                <span className="font-mono text-sm text-cs-primary shrink-0">
                  /{c.name}
                  {c.arg && <span className="text-cs-text-muted"> {c.arg}</span>}
                </span>
                <span className="font-mono text-[11px] text-cs-text-muted truncate">{c.desc}</span>
              </button>
            ))}
            <div className="px-3 py-1.5 border-t border-cs-line/10 font-mono text-[10px] text-cs-text-muted/70">
              ↑↓ select · Tab complete · ↵ run
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          {QUICK.map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={() => quick(q)}
              disabled={loading}
              className="px-2.5 py-1 rounded-md text-[11px] font-mono text-cs-text-dim glass border border-cs-line/15 hover:text-cs-primary hover:border-cs-primary/40 hover:shadow-[0_0_14px_-8px_rgb(var(--cs-primary)/0.6)] disabled:opacity-40 transition-all"
            >
              <span className="text-cs-green select-none">$ </span>{q.label}
            </button>
          ))}
        </div>
        <form onSubmit={onSubmit} className="flex gap-2 items-end">
          {/* Input pill — grows upward as you type; the $ hugs the first line. */}
          <div className="flex-grow flex items-start gap-2 px-3.5 py-2.5 bg-cs-overlay/[0.05] border border-cs-line/15 rounded-xl focus-within:border-cs-primary/50 transition-colors shadow-[inset_0_1px_0_rgb(var(--cs-line)/0.05)]">
            <span className="text-cs-green font-mono text-[13px] select-none shrink-0 leading-6">$</span>
            <textarea
              ref={taRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="ask, paste an error, or type / for commands…"
              className="flex-grow resize-none block bg-transparent outline-none border-none font-mono text-[13px] leading-6 text-cs-text placeholder:text-cs-text-muted/50 py-0"
              style={{ maxHeight: '200px' }}
            />
          </div>

          {/* Actions — donut, slash, run — kept together, pinned to the bottom. */}
          <div className="flex items-center gap-1.5 shrink-0">
            {realMsgs.length > 1 && (
              <ContextDonut pct={ctxPct} busy={compacting} onClick={() => compact(false)} />
            )}
            <button
              type="button"
              onClick={insertSlash}
              title="Slash commands"
              className="h-11 w-9 flex items-center justify-center rounded-lg border border-cs-line/15 bg-cs-overlay/[0.04] font-mono text-base text-cs-text-dim hover:text-cs-primary hover:border-cs-primary/40 transition-colors"
            >
              /
            </button>
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="h-11 px-4 flex items-center justify-center gap-1.5 bg-cs-primary/15 text-cs-primary border border-cs-primary/40 rounded-lg font-mono text-sm disabled:opacity-40 hover:bg-cs-primary/25 hover:shadow-[0_0_18px_-8px_rgb(var(--cs-primary)/0.8)] transition-all"
            >
              <FiSend className="text-cs-primary" /> <span className="hidden sm:inline">run</span>
            </button>
          </div>
        </form>
        <p className="text-[10px] text-cs-text-muted/70 mt-1 font-mono">Shift+Enter for a new line · ❯ send · <span className="text-cs-primary">/session</span> <span className="text-cs-primary">/new</span> <span className="text-cs-primary">/usage</span></p>
      </div>
    </div>
  );
}

export default AITutor;
