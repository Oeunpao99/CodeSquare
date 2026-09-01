import { useEffect, useRef, useState } from "react";
import {
  FiAlertTriangle,
  FiArrowLeft,
  FiBold,
  FiBookOpen,
  FiCalendar,
  FiCheckSquare,
  FiCode,
  FiCpu,
  FiEdit3,
  FiEye,
  FiEyeOff,
  FiFileText,
  FiFolder,
  FiGrid,
  FiHash,
  FiItalic,
  FiKey,
  FiList,
  FiLock,
  FiMenu,
  FiMinus,
  FiPlus,
  FiShield,
  FiStar,
  FiTerminal,
  FiTrash2,
  FiX,
  FiZap,
} from "react-icons/fi";
import ConfirmDialog from "../components/ConfirmDialog";
import Markdown from "../components/Markdown";
import { noteService } from "../services/api";
import { formatDateTime } from "../utils/datetime";
import { toast } from "../utils/toast";

// How long a revealed secret stays on screen before it auto-hides.
const REVEAL_TTL_MS = 45_000;

const KIND_META = {
  note: {
    label: "scratchpad",
    plural: "scratchpads",
    icon: FiFileText,
    cls: "text-cs-primary",
    spine: "bg-cs-primary/70",
    chip: "bg-cs-primary/10 text-cs-primary border-cs-primary/25",
  },
  project: {
    label: "requirement",
    plural: "requirements",
    icon: FiFolder,
    cls: "text-cs-cyan",
    spine: "bg-cs-cyan/70",
    chip: "bg-cs-cyan/10 text-cs-cyan border-cs-cyan/25",
  },
  credential: {
    label: "credential",
    plural: "credentials",
    icon: FiKey,
    cls: "text-cs-orange",
    spine: "bg-cs-orange/70",
    chip: "bg-cs-orange/10 text-cs-orange border-cs-orange/25",
  },
};

// Fly-out directions for the mini stars burst when a note is favourited.
const FAV_SPARKS = [
  { dx: "-18px", dy: "-15px", rot: "170deg", delay: "0ms" },
  { dx: "16px", dy: "-17px", rot: "-150deg", delay: "25ms" },
  { dx: "-21px", dy: "6px", rot: "130deg", delay: "45ms" },
  { dx: "20px", dy: "7px", rot: "-120deg", delay: "15ms" },
  { dx: "1px", dy: "-24px", rot: "210deg", delay: "35ms" },
];

const PADS = [
  { id: "all", label: "all" },
  { id: "note", label: "scratchpad" },
  { id: "project", label: "requirements" },
  { id: "credential", label: "credentials" },
];

function apiError(e, fallback) {
  return e?.response?.data?.detail || fallback;
}

// --- multi-page notes ---------------------------------------------------------
// A note's body is still ONE string on the server. "Pages" are slices of it
// separated by a marker line, so multi-page notes save through the existing
// single `content` field with no backend change. A plain note (no marker) is
// read back as a single horizontally-ruled page.
const PAGE_MARK_SRC = "<!--page:(lines|grid)-->\\n?";

function parsePages(raw) {
  const s = raw || "";
  const re = new RegExp(PAGE_MARK_SRC, "g");
  const marks = [];
  let m;
  while ((m = re.exec(s))) {
    marks.push({ ruling: m[1], from: m.index, body: m.index + m[0].length });
  }
  if (!marks.length) return [{ ruling: "lines", text: s }];
  return marks.map((mk, i) => ({
    ruling: mk.ruling,
    text: s
      .slice(mk.body, i + 1 < marks.length ? marks[i + 1].from : s.length)
      .replace(/\n+$/, ""),
  }));
}

function serializePages(pages) {
  if (pages.length === 1 && pages[0].ruling === "lines") return pages[0].text;
  return pages.map((p) => `<!--page:${p.ruling}-->\n${p.text}`).join("\n");
}

// Ruled-paper / graph-paper backgrounds for the writing surface.
const RULING_BG = {
  lines:
    "bg-[linear-gradient(rgb(var(--cs-line)/0.13)_1px,transparent_1px)] [background-size:100%_32px]",
  grid: "bg-[linear-gradient(rgb(var(--cs-line)/0.13)_1px,transparent_1px),linear-gradient(90deg,rgb(var(--cs-line)/0.13)_1px,transparent_1px)] [background-size:100%_32px,32px_100%]",
};

// Modal: re-enter the account password to decrypt one stored secret. The PIN this
// page used before was cosmetic (a hash in localStorage); the real gate is the
// server checking the account password on POST /notes/{id}/secret.
function RevealDialog({ onSubmit, onClose, busy }) {
  const [pw, setPw] = useState("");
  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-cs-dark/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md card-dev p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-lg bg-cs-orange/15 text-cs-orange flex items-center justify-center text-lg">
              <FiLock />
            </span>
            <h2 className="text-lg font-bold">Reveal secret</h2>
          </div>
          <button
            onClick={onClose}
            className="text-cs-text-muted hover:text-cs-text"
          >
            <FiX />
          </button>
        </div>
        <p className="text-sm text-cs-text-dim mb-4">
          Enter your <b>account password</b> to decrypt this value. The reveal
          is logged on the note and rate-limited.
        </p>
        <input
          type="password"
          autoFocus
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && pw && onSubmit(pw)}
          placeholder="account password"
          className="input w-full font-mono mb-5"
        />
        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className="btn btn-ghost font-mono">
            cancel
          </button>
          <button
            onClick={() => onSubmit(pw)}
            disabled={!pw || busy}
            className="btn btn-primary font-mono"
          >
            {busy ? "checking…" : "$ reveal"}
          </button>
        </div>
      </div>
    </div>
  );
}

function VaultBanner() {
  return (
    <div className="card p-4 mb-6 flex items-start gap-3">
      <span className="w-9 h-9 rounded-lg bg-cs-orange/15 text-cs-orange flex items-center justify-center shrink-0">
        <FiAlertTriangle />
      </span>
      <div className="min-w-0">
        <div className="font-bold font-mono text-sm">
          {" "}
          credential vault not configured
        </div>
        <p className="text-xs text-cs-text-dim mt-1">
          Storing credential values is disabled until the server has a dedicated{" "}
          <span className="font-mono text-cs-orange">NOTE_SECRET_KEY</span> (≥
          32 random chars, not the JWT key). Plain notes and project ideas still
          work. Ask whoever runs the backend to set it and restart.
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
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={disabled ? "vault not configured" : "value to encrypt"}
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

// A scrollable timeline of the months you've created notes in — each tile is a
// little volume bar. Doubles as the date filter.
function MonthTimeline({ months, total, max, active, onPick }) {
  const Tile = ({ id, count, sub, isActive, ratio }) => (
    <button
      onClick={() => onPick(id)}
      title={sub === "all" ? "All dates" : sub}
      className={`group relative flex w-[62px] shrink-0 snap-start flex-col items-center gap-1.5 rounded-lg border px-1.5 pt-2 pb-1.5 transition-all duration-200 ${
        isActive
          ? "border-cs-primary/60 bg-cs-primary/10 -translate-y-0.5"
          : "border-cs-line/12 hover:border-cs-primary/30 hover:bg-cs-overlay/[0.03]"
      }`}
    >
      <span
        className={`font-mono text-sm font-bold leading-none tabular-nums ${
          isActive ? "text-cs-primary" : "text-cs-text"
        }`}
      >
        {count}
      </span>
      <span className="flex h-7 w-full items-end justify-center">
        <span
          className={`w-2.5 rounded-sm transition-all duration-500 ${
            isActive
              ? "bg-cs-primary"
              : "bg-cs-line/20 group-hover:bg-cs-primary/40"
          }`}
          style={{ height: `${Math.max(14, ratio * 100)}%` }}
        />
      </span>
      <span
        className={`font-mono text-[8.5px] uppercase tracking-[0.08em] whitespace-nowrap ${
          isActive ? "text-cs-primary" : "text-cs-text-muted"
        }`}
      >
        {sub}
      </span>
    </button>
  );

  return (
    <div className="mb-6">
      <p className="mono-label text-cs-text-muted mb-2 px-1">// created</p>
      <div className="flex snap-x gap-2 overflow-x-auto pb-1">
        <Tile
          id="all"
          count={total}
          sub="all"
          ratio={1}
          isActive={active === "all"}
        />
        {months.map((m) => (
          <Tile
            key={m.key}
            id={m.key}
            count={m.count}
            sub={m.short}
            ratio={m.count / max}
            isActive={active === m.key}
          />
        ))}
      </div>
    </div>
  );
}

function BookCard({ n, active, onSelect, onDelete, onToggleFav, busy }) {
  const k = n.kind || "note";
  const meta = KIND_META[k] || KIND_META.note;
  const Icon = meta.icon;
  const [pop, setPop] = useState(false);

  return (
    <div
      onClick={() => onSelect(n.id)}
      className={`group relative cursor-pointer overflow-hidden rounded-lg bg-cs-darker/70 pl-4 p-3 transition-all duration-200 hover:-translate-y-0.5 ${
        active ? "bg-cs-overlay/[0.06]" : "hover:bg-cs-darker"
      }`}
    >
      <span className={`absolute left-0 top-0 bottom-0 w-1 ${meta.spine}`} />
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={`text-xs shrink-0 ${meta.cls}`} />
        <span
          className={`font-mono text-[10px] uppercase tracking-[0.14em] ${meta.cls} truncate`}
        >
          {meta.label}
        </span>
        <span className="flex-grow" />
        {n.has_suggestion && (
          <FiCpu className="text-cs-cyan text-[11px] shrink-0" title="AI plan" />
        )}
        {n.has_secret && (
          <FiKey className="text-cs-orange text-[11px] shrink-0" title="Has secret" />
        )}
        <span className="relative shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              const next = !n.favorite;
              if (next) {
                setPop(true);
                setTimeout(() => setPop(false), 640);
              }
              if (onToggleFav) onToggleFav(n.id, next);
            }}
            className={`block transition-all duration-300 ease-out ${
              n.favorite
                ? "text-cs-green"
                : "text-cs-text-muted opacity-0 group-hover:opacity-100 hover:text-cs-green"
            } ${pop ? "scale-[1.6] -rotate-[72deg]" : "scale-100 rotate-0"}`}
            title={n.favorite ? "Unfavorite" : "Mark as favorite"}
          >
            <FiStar className={`text-sm ${n.favorite ? "fill-current" : ""}`} />
          </button>
          {pop && (
            <span
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
              aria-hidden="true"
            >
              {FAV_SPARKS.map((s, i) => (
                <FiStar
                  key={i}
                  size={9}
                  className="fav-spark absolute text-cs-green fill-current"
                  style={{
                    "--dx": s.dx,
                    "--dy": s.dy,
                    "--rot": s.rot,
                    animationDelay: s.delay,
                  }}
                />
              ))}
            </span>
          )}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (onDelete) onDelete(n.id);
          }}
          disabled={busy}
          className="opacity-0 group-hover:opacity-100 text-cs-text-muted hover:text-cs-red transition-opacity shrink-0"
          title="Delete"
        >
          <FiTrash2 className="text-sm" />
        </button>
      </div>
      <div className="font-semibold text-base truncate leading-tight">
        {n.title || "Untitled"}
      </div>
      <div className="text-xs text-cs-text-dim truncate mt-0.5">
        {n.snippet ? (
          n.snippet
        ) : (
          <span className="italic text-cs-text-muted">empty</span>
        )}
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
            <span
              key={s}
              className="px-2.5 py-1 rounded-md text-xs font-mono border border-cs-primary/25 bg-cs-primary/10 text-cs-primary"
            >
              {s}
            </span>
          ))}
        </div>
      </div>
      <div className="mb-3">
        <div className="mono-label mb-1.5">structure</div>
        <pre className="terminal p-3 text-[12px] leading-relaxed overflow-x-auto">
          {suggestion.structure}
        </pre>
      </div>
      <div>
        <div className="mono-label mb-1.5">steps</div>
        <ol className="space-y-1.5">
          {suggestion.steps.map((s, i) => (
            <li
              key={i}
              className="flex items-start gap-2 text-sm text-cs-text-dim"
            >
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
  note,
  busy,
  onSave,
  onConvert,
  converting,
  onCreate,
  onReveal,
  revealedId,
  revealedValue,
  vaultOk,
}) {
  const [form, setForm] = useState({
    kind: "note",
    title: "",
    content: "",
    secret: "",
  });
  const pageRefs = useRef([]);
  const [activePage, setActivePage] = useState(0);
  const [preview, setPreview] = useState(false);

  const kind = form.kind;
  const isCred = kind === "credential";

  // Pages are a view over the single `content` string. Every edit re-serializes
  // back into form.content so autosave / save / convert stay unchanged.
  const pages = isCred
    ? [{ ruling: "lines", text: "" }]
    : parsePages(form.content);
  const setPages = (next) =>
    setForm((f) => ({ ...f, content: serializePages(next) }));
  const patchPage = (i, patch) =>
    setPages(pages.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  const addPage = (ruling) => {
    setActivePage(pages.length);
    setPreview(false);
    setPages([...pages, { ruling, text: "" }]);
  };
  const removePage = (i) => {
    const next = pages.filter((_, idx) => idx !== i);
    setActivePage((a) => Math.max(0, Math.min(a, next.length - 1)));
    setPages(next.length ? next : [{ ruling: "lines", text: "" }]);
  };

  useEffect(() => {
    if (!note) return;
    setForm({
      kind: note.kind || "note",
      title: note.title || "",
      content: note.content || "",
      secret: "",
    });
    pageRefs.current = [];
    setActivePage(0);
  }, [note && note.id]);
  useEffect(() => setPreview(false), [note && note.id]);

  // Auto-save after 2 seconds of inactivity
  useEffect(() => {
    if (!note || !form.content.trim()) return;
    const timer = setTimeout(() => {
      const body = {
        kind: form.kind,
        title: form.title.trim() || "Untitled",
        content: form.content.trim(),
      };
      if (kind === "credential" && form.secret) body.secret = form.secret;
      onSave(body, { silent: true });
    }, 2000);
    return () => clearTimeout(timer);
  }, [form.content, form.title, note?.id, kind, form.secret, onSave]);

  const isRevealed = revealedId === note?.id;

  const copySecret = async () => {
    if (revealedValue == null) return;
    try {
      await navigator.clipboard.writeText(revealedValue);
      toast.success("Copied", "Secret copied to clipboard.");
    } catch {
      toast.error("Could not copy", "Copy it manually instead.");
    }
  };

  if (!note) {
    return (
      <div className="card py-12 text-center relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-cs-primary/[0.06] blur-2xl" />
        <span className="w-16 h-16 rounded-2xl bg-gradient-main text-cs-dark text-3xl flex items-center justify-center mx-auto mb-5 shadow-[0_0_30px_-8px_rgb(var(--cs-primary)/0.6)]">
          <FiBookOpen />
        </span>
        <h2 className="text-xl font-bold mb-2">
          Open a notebook to start writing
        </h2>
        <p className="text-sm text-cs-text-dim max-w-md mx-auto mb-6">
          Scratchpads for whatever’s on your mind, project requirements the AI
          can shape into a plan, or credentials you don’t want to forget.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            onClick={() => onCreate("note")}
            className="btn btn-ghost font-mono"
          >
            <FiEdit3 /> scratchpad
          </button>
          <button
            onClick={() => onCreate("project")}
            className="btn btn-secondary font-mono"
          >
            <FiPlus /> requirement
          </button>
          <button
            onClick={() => onCreate("credential")}
            disabled={!vaultOk}
            title={vaultOk ? "" : "Credential vault not configured"}
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
      title: form.title.trim() || "Untitled",
      content: form.content.trim(),
    };
    if (isCred && form.secret) body.secret = form.secret;
    onSave(body);
    setForm((f) => ({ ...f, secret: "" }));
  };

  const plain = isCred ? form.content : pages.map((p) => p.text).join("\n");
  const words = plain.trim() ? plain.trim().split(/\s+/).filter(Boolean).length : 0;
  const chars = plain.length;

  // --- rich-text helpers: the doc is markdown; the toolbar just writes it. ---
  const wrap = (open, close, placeholder) => {
    const ta = pageRefs.current[activePage];
    if (!ta) return;
    const s = ta.selectionStart,
      e = ta.selectionEnd,
      v = ta.value;
    const sel = v.slice(s, e);
    let next, newStart, newEnd;
    if (sel) {
      next = v.slice(0, s) + open + sel + close + v.slice(e);
      newStart = s + open.length;
      newEnd = newStart + sel.length;
    } else {
      next = v.slice(0, s) + open + placeholder + close + v.slice(e);
      newStart = s + open.length;
      newEnd = newStart + placeholder.length;
    }
    patchPage(activePage, { text: next });
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(newStart, newEnd);
    });
  };

  const insert = (text) => {
    const ta = pageRefs.current[activePage];
    if (!ta) return;
    const s = ta.selectionStart,
      v = ta.value;
    const next = v.slice(0, s) + text + v.slice(ta.selectionEnd);
    patchPage(activePage, { text: next });
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(s + text.length, s + text.length);
    });
  };

  const linePrefix = (mark, strip) => {
    const ta = pageRefs.current[activePage];
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e, value: v } = ta;
    const ls = v.lastIndexOf("\n", s - 1) + 1;
    const le = v.indexOf("\n", e);
    const end = le === -1 ? v.length : le;
    const block = v.slice(ls, end);
    const lines = block.split("\n");

    let rx;
    if (strip === "#") rx = /^\s*#{1,6}\s+/;
    else if (strip === "-") rx = /^\s*-\s+/;
    else if (strip === "1.") rx = /^\s*\d+\.\s+/;
    else rx = /^\s*[\-*]\s+/;

    const hasAll = lines.every((l) => !l.trim() || rx.test(l.trimStart()));
    const out = lines
      .map((l) => {
        if (!l.trim()) return l;
        if (hasAll) {
          const m = l.trimStart().match(rx);
          return m ? l.replace(m[0], "") : l;
        }
        return mark + l;
      })
      .join("\n");

    const next = v.slice(0, ls) + out + v.slice(end);
    patchPage(activePage, { text: next });
    requestAnimationFrame(() => {
      ta.focus();
      const nl = ls + out.length;
      ta.setSelectionRange(ls, nl);
    });
  };

  const KINDS = [
    { id: "note", label: "scratchpad", icon: FiEdit3 },
    { id: "project", label: "requirement", icon: FiFolder },
    { id: "credential", label: "credential", icon: FiKey },
  ];

  const fmtBtn =
    "p-1.5 rounded-md text-cs-text-muted hover:text-cs-text hover:bg-cs-overlay/[0.08] transition-colors";

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex gap-1 p-1 rounded-xl border border-cs-line/15 bg-cs-overlay/[0.04]">
            {KINDS.map((opt) => (
              <button
                key={opt.id}
                disabled={opt.id === "credential" && !vaultOk}
                onClick={() => setForm((f) => ({ ...f, kind: opt.id }))}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-colors disabled:opacity-40 ${
                  kind === opt.id
                    ? "bg-cs-primary/15 text-cs-primary"
                    : "text-cs-text-dim hover:text-cs-text hover:bg-cs-overlay/[0.06]"
                }`}
              >
                <opt.icon className="text-[11px]" /> {opt.label}
              </button>
            ))}
          </div>
        </div>
        {!isCred && (
          <span className="block font-mono text-[11px] text-cs-text-muted mb-3 px-1">
            {words} word{words === 1 ? "" : "s"} · {chars} chars
          </span>
        )}

        <input
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          className="w-full bg-transparent border-b border-cs-line/10 pb-2 mb-3 text-2xl font-bold outline-none placeholder:text-cs-text-muted/50 focus:border-cs-primary/40"
          placeholder={
            isCred
              ? 'Service / site, e.g. "PT-B-login"'
              : "Give this page a title…"
          }
        />

        {isCred ? (
          <div className="space-y-3">
            <div>
              <div className="mono-label mb-1.5">
                {" "}
                username / host (plaintext)
              </div>
              <input
                value={form.content}
                onChange={(e) =>
                  setForm((f) => ({ ...f, content: e.target.value }))
                }
                className="input w-full"
                placeholder="e.g. admin@company.com · db.example.com:5432"
              />
            </div>

            {note.has_secret && (
              <div>
                <div className="mono-label mb-1.5"> stored secret</div>
                {isRevealed ? (
                  <div className="flex items-center gap-2 border border-cs-orange/30 bg-cs-orange/10 rounded-lg px-3 py-2.5">
                    <span className="font-mono text-sm text-cs-orange break-all flex-grow min-w-0">
                      {revealedValue}
                    </span>
                    <button
                      onClick={copySecret}
                      className="btn btn-ghost btn-sm font-mono shrink-0"
                    >
                      copy
                    </button>
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
                {note.has_secret ? "replace secret" : "secret value"}
                <span className="text-cs-text-muted">
                  {" "}
                  — encrypted with the server vault key
                </span>
              </div>
              <SecretInput
                value={form.secret}
                onChange={(e) =>
                  setForm((f) => ({ ...f, secret: e.target.value }))
                }
                disabled={!vaultOk}
              />
              {note.has_secret && !form.secret && (
                <p className="text-[11px] text-cs-text-muted mt-1">
                  Leave blank to keep the current secret.
                </p>
              )}
            </div>

            <p className="text-[11px] text-cs-text-muted flex items-start gap-1.5 pt-1">
              <FiShield className="mt-0.5 shrink-0" />
              Values are AES-encrypted at rest with a key the server holds.
              Don’t store anything you couldn’t rotate — for production secrets,
              keep the real value in a dedicated manager and note only{" "}
              <i>where</i> it lives.
            </p>
          </div>
        ) : (
          <div>
            <div className="flex flex-wrap items-center gap-1 mb-2">
              <button
                title="Bold"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => wrap("**", "**", "bold")}
                className={fmtBtn}
              >
                <FiBold className="text-xs" />
              </button>
              <button
                title="Italic"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => wrap("*", "*", "italics")}
                className={fmtBtn}
              >
                <FiItalic className="text-xs" />
              </button>
              <button
                title="Inline code"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => wrap("`", "`", "code")}
                className={fmtBtn}
              >
                <FiCode className="text-xs" />
              </button>
              <button
                title="Code block"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() =>
                  wrap("\n```python\n", "\n```\n", 'print("hello")')
                }
                className={fmtBtn}
              >
                <FiTerminal className="text-xs" />
              </button>
              <span className="w-px h-4 bg-cs-line/15 mx-1" />
              <button
                title="Heading"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => linePrefix("## ", "")}
                className={fmtBtn}
              >
                <FiHash className="text-xs" />
              </button>
              <button
                title="Bullet list"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => linePrefix("- ", "")}
                className={fmtBtn}
              >
                <FiList className="text-xs" />
              </button>
              <button
                title="Numbered list"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => linePrefix("1. ", "")}
                className={`${fmtBtn} text-[11px] font-bold w-6`}
              >
                1.
              </button>
              <button
                title="Divider"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insert("\n\n---\n\n")}
                className={fmtBtn}
              >
                <FiMinus className="text-xs" />
              </button>
              <span className="flex-grow" />
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setPreview((p) => !p)}
                className={`p-1.5 rounded-md text-[11px] font-mono inline-flex items-center gap-1.5 transition-colors ${
                  preview
                    ? "bg-cs-primary/15 text-cs-primary"
                    : "text-cs-text-muted hover:text-cs-text"
                }`}
              >
                {preview ? (
                  <>
                    <FiEdit3 className="text-xs" /> edit
                  </>
                ) : (
                  <>
                    <FiBookOpen className="text-xs" /> preview
                  </>
                )}
              </button>
            </div>

            {preview ? (
              <div className="space-y-8">
                {pages.map((p, i) => (
                  <div
                    key={i}
                    className="w-full min-h-[1123px] rounded-lg border border-cs-line/10 bg-cs-darkest/30 px-10 pt-8"
                  >
                    {pages.length > 1 && (
                      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-cs-text-muted mb-2">
                        page {i + 1}
                      </div>
                    )}
                    {p.text.trim() ? (
                      <Markdown text={p.text} />
                    ) : (
                      <p className="text-cs-text-muted italic text-sm">
                        Page {i + 1} is empty.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-8">
                {pages.map((p, i) => (
                  <div key={i} className="w-full">
                    <div className="flex items-center gap-2 px-1 mb-1">
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-cs-text-muted">
                        page {i + 1}
                      </span>
                      <span className="flex gap-0.5">
                        <button
                          title="Horizontal ruled lines"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => patchPage(i, { ruling: "lines" })}
                          className={`${fmtBtn} ${
                            p.ruling === "lines" ? "text-cs-primary" : ""
                          }`}
                        >
                          <FiMenu className="text-xs" />
                        </button>
                        <button
                          title="Grid template"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => patchPage(i, { ruling: "grid" })}
                          className={`${fmtBtn} ${
                            p.ruling === "grid" ? "text-cs-primary" : ""
                          }`}
                        >
                          <FiGrid className="text-xs" />
                        </button>
                      </span>
                      <span className="flex-grow" />
                      {pages.length > 1 && (
                        <button
                          onClick={() => removePage(i)}
                          className="text-cs-text-muted hover:text-cs-red transition-colors"
                          title="Remove this page"
                        >
                          <FiTrash2 className="text-xs" />
                        </button>
                      )}
                    </div>
                    <textarea
                      ref={(el) => (pageRefs.current[i] = el)}
                      value={p.text}
                      onFocus={() => setActivePage(i)}
                      onChange={(e) => patchPage(i, { text: e.target.value })}
                      className={`block w-full min-h-[1040px] resize-y rounded-lg border border-cs-line/10 bg-cs-darkest/30 px-10 pt-8 text-[15px] leading-8 text-cs-text outline-none placeholder:text-cs-text-muted/40 [background-attachment:local] ${
                        RULING_BG[p.ruling] || RULING_BG.lines
                      }`}
                      placeholder={
                        i === 0
                          ? "Just start writing — whatever’s on your mind."
                          : "Keep going on page " + (i + 1) + "…"
                      }
                    />
                  </div>
                ))}

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-cs-text-muted">
                    add page
                  </span>
                  <button
                    onClick={() => addPage("lines")}
                    className="btn btn-ghost btn-sm font-mono"
                  >
                    <FiMenu /> lines
                  </button>
                  <button
                    onClick={() => addPage("grid")}
                    className="btn btn-ghost btn-sm font-mono"
                  >
                    <FiGrid /> grid
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 mt-4">
          <button
            onClick={save}
            disabled={busy}
            className="btn btn-primary font-mono"
          >
            {busy ? "saving…" : "$ write"}
          </button>
          {!isCred && (note.content || form.content).trim() && (
            <button
              onClick={onConvert}
              disabled={converting}
              className="btn btn-secondary font-mono"
            >
              <FiZap /> {converting ? "converting…" : "ai: convert to project"}
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
  const [pad, setPad] = useState("all");
  const [month, setMonth] = useState("all"); // "all" | "YYYY-MM" of created_at
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);
  const [revealed, setRevealed] = useState(null); // { id, value }
  const [revealTarget, setRevealTarget] = useState(null); // note id awaiting password
  const [revealBusy, setRevealBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [vaultOk, setVaultOk] = useState(true); // assume ok until told otherwise
  const revealTimer = useRef(null);
  // True once an autosave has run for the open note; drives the single "Saved"
  // toast shown when the user goes back to the list (autosaves stay silent).
  const savedSinceOpen = useRef(false);

  const load = () =>
    noteService
      .list()
      .then((r) => setList(r.data))
      .catch(() => {});

  useEffect(() => {
    load().finally(() => setLoading(false));
    noteService
      .vaultStatus()
      .then((r) => setVaultOk(!!r.data.configured))
      .catch(() => setVaultOk(false));
    return () => {
      if (revealTimer.current) clearTimeout(revealTimer.current);
    };
  }, []);

  useEffect(() => {
    if (activeId == null) {
      setDetail(null);
      return;
    }
    noteService
      .get(activeId)
      .then((r) => setDetail(r.data))
      .catch(() => {});
    // switching notes hides any revealed secret
    setRevealed(null);
    savedSinceOpen.current = false;
    if (revealTimer.current) clearTimeout(revealTimer.current);
  }, [activeId]);

  // Back to the list — surface one "Saved" if autosave ran while editing.
  const closeEditor = () => {
    if (savedSinceOpen.current) toast.success("Saved");
    setActiveId(null);
  };

  const create = async (kind) => {
    if (kind === "credential" && !vaultOk) {
      toast.error(
        "Vault not configured",
        "Set NOTE_SECRET_KEY on the server first.",
      );
      return;
    }
    try {
      const r = await noteService.create({
        kind,
        title: kind === "credential" ? "New credential" : "Untitled",
        content: "",
      });
      await load();
      setActiveId(r.data.id);
      toast.success("Note created");
    } catch (e) {
      toast.error("Could not create", apiError(e));
    }
  };

  const save = async (body, { silent = false } = {}) => {
    setSaving(true);
    try {
      const r = await noteService.update(activeId, body);
      setDetail(r.data);
      await load();
      if (silent) savedSinceOpen.current = true;
      else toast.success("Saved");
    } catch (e) {
      toast.error("Could not save", apiError(e));
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async (id) => {
    setPendingDelete(null);
    try {
      await noteService.remove(id);
      if (id === activeId) setActiveId(null);
      await load();
      toast.success("Deleted");
    } catch {
      toast.error("Could not delete");
    }
  };

  const toggleFav = async (id, next) => {
    // Optimistic — flip it in the list, reconcile from the server response.
    setList((cur) =>
      cur.map((n) => (n.id === id ? { ...n, favorite: next } : n)),
    );
    try {
      await noteService.favorite(id, next);
      await load();
    } catch {
      toast.error("Could not update favorite");
      load();
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
      toast.success("Revealed", "Auto-hides in 45s.");
    } catch (e) {
      const code = e?.response?.status;
      toast.error(
        code === 403
          ? "Wrong password"
          : code === 429
            ? "Slow down"
            : code === 503
              ? "Vault not configured"
              : "Could not reveal",
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
      toast.success("Project plan ready");
    } catch (e) {
      toast.error("Could not convert", apiError(e));
    } finally {
      setConverting(false);
    }
  };

  // Month filter — options come from every note's created_at, newest first.
  const monthKey = (iso) => (iso || "").slice(0, 7);
  const monthLabel = (key) => {
    const [y, m] = key.split("-");
    return new Date(Number(y), Number(m) - 1, 1).toLocaleString("en-US", {
      month: "short",
      year: "numeric",
    });
  };
  const monthShort = (key) => {
    const [y, m] = key.split("-");
    const mon = new Date(Number(y), Number(m) - 1, 1)
      .toLocaleString("en-US", { month: "short" })
      .toUpperCase();
    return `${mon} '${y.slice(2)}`;
  };
  const monthOptions = [...new Set(list.map((n) => monthKey(n.created_at)))]
    .filter(Boolean)
    .sort()
    .reverse();
  const monthMeta = monthOptions.map((key) => ({
    key,
    label: monthLabel(key),
    short: monthShort(key),
    count: list.filter((n) => monthKey(n.created_at) === key).length,
  }));
  const maxMonthCount = Math.max(1, ...monthMeta.map((m) => m.count));
  const activeMonth = monthOptions.includes(month) ? month : "all";
  const visible =
    activeMonth === "all"
      ? list
      : list.filter((n) => monthKey(n.created_at) === activeMonth);

  const inPad = (n) => pad === "all" || (n.kind || "note") === pad;
  const kindGroups =
    pad === "all"
      ? Object.keys(KIND_META)
          .map((k) => ({
            k,
            items: visible.filter((n) => (n.kind || "note") === k),
          }))
          .filter((g) => g.items.length)
      : [{ k: pad, items: visible.filter((n) => (n.kind || "note") === pad) }];
  const favItems = visible.filter((n) => n.favorite && inPad(n));
  const groups = favItems.length
    ? [{ k: "favorite", items: favItems }, ...kindGroups]
    : kindGroups;

  const activeMeta = list.find((n) => n.id === activeId);

  return (
    <main className="w-full px-6 lg:px-10 py-8">
      {activeId == null ? (
        <>
          <div className="sticky top-0 z-30 bg-cs-dark/85 backdrop-blur-xl border-b border-cs-line/[0.07] -mx-6 lg:-mx-10 px-6 lg:px-10 pt-4 pb-5 -mt-8 mb-6">
            <div className="flex flex-wrap items-end justify-between gap-4 lg:pr-14">
              <div>
                <span className="mono-label"> codesquare_note</span>
                <h1 className="text-3xl font-bold mt-2 flex items-center gap-3">
                  <FiFileText className="text-cs-primary" /> Notes
                </h1>
                <p className="text-cs-text-dim mt-1 text-sm">
                  Scratchpad · project requirements
                  {vaultOk ? " · credentials" : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => create("note")}
                  className="btn btn-ghost font-mono"
                >
                  <FiEdit3 /> quick note
                </button>
                <button
                  onClick={() => create("project")}
                  className="btn btn-secondary font-mono"
                >
                  <FiPlus /> requirement
                </button>
                <button
                  onClick={() => create("credential")}
                  disabled={!vaultOk}
                  title={vaultOk ? "" : "Credential vault not configured"}
                  className="btn btn-primary font-mono disabled:opacity-40"
                >
                  <FiKey /> credential
                </button>
              </div>
            </div>
          </div>

          {!vaultOk && <VaultBanner />}

          <div className="flex flex-wrap items-center gap-1.5 mb-4">
            {PADS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPad(p.id)}
                className={`px-3 py-1.5 rounded-lg font-mono text-xs border transition-colors ${
                  pad === p.id
                    ? "border-cs-primary/50 bg-cs-primary/10 text-cs-primary"
                    : "border-cs-line/12 text-cs-text-dim hover:text-cs-text"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {monthOptions.length > 0 && (
            <MonthTimeline
              months={monthMeta}
              total={list.length}
              max={maxMonthCount}
              active={activeMonth}
              onPick={setMonth}
            />
          )}

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <div
                  key={i}
                  className="h-24 rounded-lg border border-cs-line/10 bg-cs-darker/50 overflow-hidden"
                >
                  <span className="skeleton block h-full w-full" />
                </div>
              ))}
            </div>
          ) : list.length === 0 ? (
            <div className="card text-center py-16">
              <FiBookOpen className="text-3xl text-cs-text-muted mx-auto mb-3" />
              <p className="text-cs-text-dim">No notebooks yet.</p>
              <p className="text-[11px] text-cs-text-muted mt-1">
                Use “quick note” above to start one.
              </p>
            </div>
          ) : groups.length === 0 ? (
            <div className="card text-center py-16">
              <FiCalendar className="text-3xl text-cs-text-muted mx-auto mb-3" />
              <p className="text-cs-text-dim">
                {activeMonth === "all"
                  ? "Nothing here."
                  : `Nothing from ${monthLabel(activeMonth)}.`}
              </p>
              {(activeMonth !== "all" || pad !== "all") && (
                <button
                  onClick={() => {
                    setMonth("all");
                    setPad("all");
                  }}
                  className="text-[11px] text-cs-primary hover:text-cs-cyan font-mono mt-1"
                >
                  clear filters
                </button>
              )}
            </div>
          ) : (
            groups.map(({ k, items }) => {
              const m =
                k === "favorite"
                  ? {
                      plural: "favorites",
                      icon: FiStar,
                      chip: "bg-cs-green/10 text-cs-green border-cs-green/25",
                    }
                  : KIND_META[k] || KIND_META.note;
              const Icon = m.icon;
              return (
                <div key={k} className="mb-8">
                  <div className="flex items-center gap-1.5 px-1 mb-3">
                    <span
                      className={`w-5 h-5 rounded grid place-items-center border ${m.chip}`}
                    >
                      <Icon className="text-[10px]" />
                    </span>
                    <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-cs-text-muted">
                      {m.plural}
                    </span>
                    <span className="flex-grow" />
                    <span className="font-mono text-[10px] text-cs-text-muted">
                      {items.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                    {items.map((n) => (
                      <BookCard
                        key={`${k}-${n.id}`}
                        n={n}
                        active={false}
                        onSelect={setActiveId}
                        onDelete={setPendingDelete}
                        onToggleFav={toggleFav}
                      />
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </>
      ) : (
        <>
          <div className="sticky top-0 z-30 bg-cs-dark/85 backdrop-blur-xl border-b border-cs-line/[0.07] -mx-6 lg:-mx-10 px-6 lg:px-10 pt-4 pb-4 -mt-8 mb-6">
            <div className="flex items-center justify-between gap-3 lg:pr-14">
              <button
                onClick={closeEditor}
                className="btn btn-ghost btn-sm font-mono"
              >
                <FiArrowLeft /> all notes
              </button>
              <span className="font-mono text-[11px] text-cs-text-muted truncate">
                {activeMeta?.title || "Untitled"}
              </span>
            </div>
          </div>

          <div className="w-full">
            {detail == null ? (
              <div className="card p-5 space-y-4">
                <span className="skeleton block h-8 w-1/3" />
                <span className="skeleton block h-64 w-full rounded-xl" />
              </div>
            ) : (
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
            )}
          </div>
        </>
      )}

      {revealTarget != null && (
        <RevealDialog
          busy={revealBusy}
          onSubmit={submitReveal}
          onClose={() => setRevealTarget(null)}
        />
      )}

      {pendingDelete != null &&
        (() => {
          const target = list.find((n) => n.id === pendingDelete);
          const name = target?.title?.trim();
          return (
            <ConfirmDialog
              title="Delete note"
              confirmLabel="Delete note"
              message={
                name && name !== "Untitled"
                  ? `Delete “${name}”? This can’t be undone.`
                  : "Delete this note? This can’t be undone."
              }
              onConfirm={() => doDelete(pendingDelete)}
              onClose={() => setPendingDelete(null)}
            />
          );
        })()}
    </main>
  );
}

export default Notes;
