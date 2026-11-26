import { useMemo, useState } from "react";
import { highlight } from "./highlight";

/* ------------------------------------------------------------------ *
 *  Inline + block markdown → HTML string (ported from the old webview) *
 * ------------------------------------------------------------------ */

export function escHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeHref(u: string): string | null {
  u = String(u || "").trim();
  if (/^(\/|#|\.|\?)/.test(u)) return u;
  if (/^(https?:|mailto:|tel:)/i.test(u)) return u;
  return null;
}

/** `**bold**`, `` `code` ``, `[text](href)` — everything else escaped. */
export function inlineHTML(text: string): string {
  const re = /(\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/;
  let rest = String(text);
  let out = "";
  while (rest) {
    const m = rest.match(re);
    if (!m || m.index === undefined) {
      out += escHtml(rest);
      break;
    }
    if (m.index > 0) out += escHtml(rest.slice(0, m.index));
    if (m[2] != null) out += "<strong>" + escHtml(m[2]) + "</strong>";
    else if (m[3] != null) out += '<code class="ic">' + escHtml(m[3]) + "</code>";
    else {
      const h = safeHref(m[5]);
      out += h
        ? '<a href="' + escHtml(h) + '" target="_blank" rel="noreferrer noopener nofollow">' + escHtml(m[4]) + "</a>"
        : '<span title="blocked link">' + escHtml(m[4]) + "</span>";
    }
    rest = rest.slice(m.index + m[0].length);
  }
  return out;
}

function headingHtml(level: number, text: string): string {
  const tag = level <= 1 ? "h3" : level === 2 ? "h4" : "h5";
  return `<${tag} class="mdh mdh${Math.min(3, level)}">${inlineHTML(text)}</${tag}>`;
}

const BULLET = /^[\t ]*(?:[-*]|\d+[.)])\s+/;

function buildListHtml(lines: string[]): string {
  const rows = lines.map((raw) => {
    const ind = (raw.match(/^[\t ]*/)?.[0] || "").replace(/\t/g, "  ").length;
    const mm = raw.match(/^[\t ]*([-*]|\d+[.)])\s+([\s\S]*)$/);
    const marker = mm ? mm[1] : "-";
    const text = (mm ? mm[2] : raw.trim()).trim();
    return { ind, ordered: /\d/.test(marker), text };
  });
  const base = Math.min(...rows.map((r) => r.ind));
  type Item = { text: string; sub: { ordered: boolean; items: string[] } | null };
  const items: Item[] = [];
  for (const r of rows) {
    if (r.ind > base && items.length) {
      const parent = items[items.length - 1];
      if (!parent.sub) parent.sub = { ordered: r.ordered, items: [] };
      parent.sub.items.push(inlineHTML(r.text));
    } else {
      items.push({ text: inlineHTML(r.text), sub: null });
    }
  }
  const renderItem = (it: Item): string => {
    let inner = it.text;
    if (it.sub) {
      const stag = it.sub.ordered ? "ol" : "ul";
      inner += `<${stag} class="mdl">${it.sub.items.map((x) => `<li>${x}</li>`).join("")}</${stag}>`;
    }
    return `<li>${inner}</li>`;
  };
  const tag = rows[0].ordered ? "ol" : "ul";
  return `<${tag} class="mdl">${items.map(renderItem).join("")}</${tag}>`;
}

function renderProseHtml(text: string): string {
  const raw = String(text).replace(/\r\n?/g, "\n").split("\n");
  const isB = (s?: string) => /^[\t ]*(?:[-*]|\d+[.)])\s/.test(s || "");
  const kept = raw.filter((l, i) => !(l.trim() === "" && isB(raw[i - 1]) && isB(raw[i + 1])));
  const blocks = kept.join("\n").trim().split(/\n{2,}/).filter(Boolean);
  const out: string[] = [];

  for (const b of blocks) {
    const lines = b.split("\n");
    let para: string[] = [];
    let list: string[] = [];
    const flushP = () => {
      if (para.length) {
        out.push(`<p>${inlineHTML(para.join(" "))}</p>`);
        para = [];
      }
    };
    const flushL = () => {
      if (list.length >= 2) out.push(buildListHtml(list));
      else if (list.length === 1) {
        para.push(list[0].replace(BULLET, ""));
        flushP();
      }
      list = [];
    };
    for (const line of lines) {
      const h = line.match(/^(#{1,6})\s+(.*\S)\s*#*\s*$/);
      const bh = line.match(/^\*\*(.+?)\*\*:?\s*$/);
      if (h) {
        flushP();
        flushL();
        out.push(headingHtml(h[1].length, h[2]));
      } else if (bh) {
        flushP();
        flushL();
        out.push(headingHtml(3, bh[1]));
      } else if (BULLET.test(line)) {
        flushP();
        list.push(line);
      } else if (list.length && /^[\t ]{2,}\S/.test(line)) {
        list[list.length - 1] += " " + line.trim();
      } else if (line.trim()) {
        flushL();
        para.push(line);
      }
    }
    flushP();
    flushL();
  }
  return out.join("");
}

/* ------------------------------------------------------------------ *
 *  Segmenting: fenced code / ```tool blocks vs prose                  *
 * ------------------------------------------------------------------ */

export type Segment =
  | { kind: "prose"; html: string }
  | { kind: "code"; lang: string; body: string }
  | { kind: "tool"; raw: string };

/** First top-level {...} from `start`, honouring strings/escapes so nested
 *  braces (create_files) and stray ``` inside file content don't truncate it. */
function scanBalanced(text: string, start: number): [number, number] | null {
  let depth = 0;
  let objStart = -1;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === "{") {
      if (depth === 0) objStart = i;
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0 && objStart >= 0) return [objStart, i + 1];
    }
  }
  return null;
}

export function parseSegments(src: string): Segment[] {
  src = String(src || "");
  const segs: Segment[] = [];
  let pos = 0;

  const pushProse = (s: string) => {
    const html = renderProseHtml(s);
    if (html) segs.push({ kind: "prose", html });
  };

  while (pos < src.length) {
    const fenceAt = src.indexOf("```", pos);
    if (fenceAt === -1) {
      pushProse(src.slice(pos));
      break;
    }
    if (fenceAt > pos) pushProse(src.slice(pos, fenceAt));

    const after = src.slice(fenceAt + 3);
    const head = after.match(/^([A-Za-z0-9_+-]*)[ \t]*\r?\n?/);
    const lang = (head?.[1] || "").toLowerCase();
    const bodyStart = fenceAt + 3 + (head ? head[0].length : 0);

    if (lang === "tool") {
      const obj = scanBalanced(src, bodyStart);
      if (obj) {
        segs.push({ kind: "tool", raw: src.slice(obj[0], obj[1]) });
        const rest = src.slice(obj[1]).match(/^\s*```/);
        pos = obj[1] + (rest ? rest[0].length : 0);
      } else {
        // still streaming in, or malformed — a chip, and swallow the rest
        segs.push({ kind: "tool", raw: src.slice(bodyStart) });
        pos = src.length;
      }
      continue;
    }

    const closeAt = src.indexOf("```", bodyStart);
    if (closeAt === -1) {
      segs.push({ kind: "code", lang, body: src.slice(bodyStart) });
      pos = src.length;
    } else {
      segs.push({ kind: "code", lang, body: src.slice(bodyStart, closeAt).replace(/\n$/, "") });
      pos = closeAt + 3;
    }
  }

  if (!segs.length) pushProse(src);
  return segs;
}

/* ------------------------------------------------------------------ *
 *  The model asks to act with a ```tool {json} block — show it as a   *
 *  plain-language action, never the raw JSON.                         *
 * ------------------------------------------------------------------ */

const TOOL_VERB: Record<string, string> = {
  read_file: "Read",
  create_file: "Create",
  create_files: "Create",
  edit_file: "Edit",
  delete_file: "Delete",
  search_code: "Search",
  list_files: "List",
};

interface Toolish {
  tool: string;
  path?: string;
  paths?: string[];
  files?: { path?: string }[];
  query?: string;
  glob?: string;
}

function parseToolish(raw: string): Toolish | null {
  const s = String(raw || "").trim();
  try {
    const o = JSON.parse(s);
    if (o && o.tool) return o as Toolish;
  } catch {
    /* fall through to a lenient scan */
  }
  const t = s.match(/"tool"\s*:\s*"([a-z_]+)"/i);
  if (!t) return null;
  const o: Toolish = { tool: t[1] };
  const p = s.match(/"path"\s*:\s*"([^"]+)"/);
  if (p) o.path = p[1];
  const q = s.match(/"query"\s*:\s*"([^"]+)"/);
  if (q) o.query = q[1];
  const g = s.match(/"glob"\s*:\s*"([^"]+)"/);
  if (g) o.glob = g[1];
  const ps = s.match(/"paths"\s*:\s*\[([^\]]*)\]/);
  if (ps) o.paths = (ps[1].match(/"([^"]+)"/g) || []).map((x) => x.slice(1, -1));
  return o;
}

function toolTargets(o: Toolish): string[] {
  if (o.tool === "search_code") return [o.query, o.glob].filter((x): x is string => !!x);
  if (o.tool === "list_files") return o.glob ? [o.glob] : [];
  if (Array.isArray(o.paths)) return o.paths.filter(Boolean);
  if (Array.isArray(o.files)) return o.files.map((f) => f && f.path).filter((x): x is string => !!x);
  if (o.path) return [o.path];
  return [];
}

export function ToolChip({ raw }: { raw: string }) {
  const o = parseToolish(raw);
  const targets = o ? toolTargets(o) : [];
  const verb = o ? TOOL_VERB[o.tool] || o.tool.replace(/_/g, " ") : "Working…";
  return (
    <div className="my-2 flex flex-wrap items-center gap-1.5 rounded-lg border border-line bg-overlay px-2.5 py-1.5 font-mono text-xs text-dim">
      {/* live badge — keeps ticking while the agent is mid-action */}
      <span className="relative mr-0.5 flex h-1.5 w-1.5 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-[ping_1.4s_cubic-bezier(0,0,0.2,1)_infinite] rounded-full bg-cyan opacity-70" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan" />
      </span>
      <span className="text-fg">{verb}</span>
      {targets.slice(0, 3).map((t, i) => (
        <code key={i} className="break-all rounded bg-white/[0.07] px-1.5 py-px text-[11px] text-primary">
          {t}
        </code>
      ))}
      {targets.length > 3 && <span className="text-muted">+{targets.length - 3} more</span>}
    </div>
  );
}

function CodeBlock({ lang, body }: { lang: string; body: string }) {
  const [label, setLabel] = useState("copy");
  const { html, label: langLabel } = useMemo(() => highlight(lang, body), [lang, body]);

  const copy = () => {
    const done = () => {
      setLabel("copied");
      setTimeout(() => setLabel("copy"), 1400);
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(body).then(done, done);
    else done();
  };

  return (
    <div className="my-2 overflow-hidden rounded-lg border border-line bg-codebg">
      <div className="flex items-center justify-between border-b border-line bg-white/[0.03] px-2.5 py-1">
        <span className="font-mono text-2xs text-muted">{langLabel || "code"}</span>
        <button type="button" onClick={copy} className="border-0 bg-transparent font-mono text-2xs text-muted hover:text-fg">
          {label}
        </button>
      </div>
      <pre className="m-0 overflow-x-auto p-2.5">
        <code
          className="hljs whitespace-pre bg-transparent p-0 font-mono text-xs leading-normal"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </pre>
    </div>
  );
}

export function Markdown({ src }: { src: string }) {
  const segs = useMemo(() => parseSegments(src), [src]);
  return (
    <div className="prose-md">
      {segs.map((s, i) =>
        s.kind === "code" ? (
          <CodeBlock key={i} lang={s.lang} body={s.body} />
        ) : s.kind === "tool" ? (
          <ToolChip key={i} raw={s.raw} />
        ) : (
          <div key={i} dangerouslySetInnerHTML={{ __html: s.html }} />
        ),
      )}
    </div>
  );
}
