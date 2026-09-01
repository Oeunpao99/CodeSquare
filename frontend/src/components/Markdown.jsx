import React, { useState } from 'react';
import { FiCopy, FiCheck } from 'react-icons/fi';
import CodeEditor from './CodeEditor';

// A small markdown renderer: fenced code blocks (with a copy button), inline
// `code` / **bold** / [links], `#`–`###` headings, and `-` / `1.` lists.
// Enough for tutor replies, project briefs and notes.

function renderInline(text, keyBase = '') {
  const out = [];
  const re = /(\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/;
  let rest = String(text);
  let k = 0;
  while (rest) {
    const m = rest.match(re);
    if (!m) { out.push(rest); break; }
    if (m.index > 0) out.push(rest.slice(0, m.index));
    if (m[2] != null) {
      out.push(<strong key={`${keyBase}b${k++}`} className="font-semibold text-cs-text">{m[2]}</strong>);
    } else if (m[3] != null) {
      out.push(
        <code key={`${keyBase}c${k++}`} className="font-mono text-[0.85em] px-1 py-0.5 rounded bg-cs-overlay/10 text-cs-cyan">
          {m[3]}
        </code>
      );
    } else {
      out.push(
        <a key={`${keyBase}a${k++}`} href={m[5]} target="_blank" rel="noreferrer" className="underline text-cs-primary">
          {m[4]}
        </a>
      );
    }
    rest = rest.slice(m.index + m[0].length);
  }
  return out;
}

function CodeBlock({ lang, body }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(body);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };
  return (
    <div className="rounded-lg border border-cs-line/15 bg-cs-darkest overflow-hidden my-2">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-cs-line/10 bg-cs-overlay/[0.04]">
        <span className="font-mono text-[10px] text-cs-text-muted">{lang || 'code'}</span>
        <button onClick={copy} className="font-mono text-[10px] text-cs-text-muted hover:text-cs-text inline-flex items-center gap-1">
          {copied ? <FiCheck /> : <FiCopy />} {copied ? 'copied' : 'copy'}
        </button>
      </div>
      {/* Read-only CodeMirror → syntax colors that follow the app's selected
          theme (Tokyo Night, GitHub Light, …). */}
      <CodeEditor value={body} language={lang || 'python'} readOnly minimal onChange={() => {}} />
    </div>
  );
}

const BULLET = /^[\t ]*([-*]|\d+[.)])\s+/;

// Parse a run of (possibly indented) bullet lines into a nested tree:
//   { ordered, items: [{ text, children: <tree>|null }] }
function parseListTree(lines) {
  const rows = lines.map((raw) => {
    const indent = (raw.match(/^[\t ]*/)[0] || '').replace(/\t/g, '  ').length;
    const m = raw.match(/^[\t ]*([-*]|\d+[.)])\s+([\s\S]*)$/) || [null, '-', raw.trim()];
    return { indent, ordered: /\d/.test(m[1]), text: m[2].trim() };
  });
  if (!rows.length) return { ordered: false, items: [] };

  // Rank each distinct indent width to a 0-based depth, so irregular indentation
  // from an LLM (2 vs 3 vs 4 spaces, stray tabs) still nests by *relative* depth
  // instead of silently dropping the rows that don't line up.
  const widths = [...new Set(rows.map((r) => r.indent))].sort((a, b) => a - b);
  const depthOf = (indent) => widths.filter((w) => w <= indent).length - 1;

  const root = { ordered: rows[0].ordered, items: [] };
  const stack = [root]; // stack[d] = the list node new items at depth d attach to
  for (const r of rows) {
    const depth = Math.max(0, Math.min(depthOf(r.indent), stack.length - 1));
    const list = stack[depth];
    if (list.items.length === 0) list.ordered = r.ordered;
    const item = { text: r.text, children: { ordered: false, items: [] } };
    list.items.push(item);
    stack[depth + 1] = item.children;
    stack.length = depth + 2;
  }

  // Drop the empty child lists we speculatively attached to leaf items.
  const prune = (node) => {
    for (const it of node.items) {
      if (it.children && it.children.items.length) prune(it.children);
      else it.children = null;
    }
  };
  prune(root);
  return root;
}

function Heading({ level, text, k }) {
  const cls = level <= 1 ? 'text-[15px] font-bold text-cs-text mt-4 mb-1.5'
    : level === 2 ? 'text-sm font-bold text-cs-text mt-4 mb-1'
    : 'text-[13px] font-semibold text-cs-text mt-3 mb-1';
  const Tag = `h${Math.min(4, level + 1)}`;
  return <Tag className={cls}>{renderInline(text, k)}</Tag>;
}

// A leading token that looks like a file or directory path — "app/main.py",
// "app/api/v1/", "README.md". Rendered monospace so file-tree bullets read as
// a structure instead of blending into the prose bullets around them.
const PATH_LEAD = /^([\w.-]+\/[\w.{}/-]*(?:\.[a-z0-9]{1,6}|\/)|[\w-]+\.[a-z]{1,5})(?=[\s:—-]|$)/i;

function renderListItem(text, keyBase) {
  const m = text.match(PATH_LEAD);
  if (m) {
    return [
      <code
        key={`${keyBase}path`}
        className="font-mono text-[0.85em] px-1 py-0.5 rounded bg-cs-overlay/10 text-cs-text"
      >
        {m[1]}
      </code>,
      ...renderInline(text.slice(m[1].length), `${keyBase}rest-`),
    ];
  }
  return renderInline(text, keyBase);
}

function ListTree({ tree, k, depth = 0, nested = false }) {
  const Tag = tree.ordered ? 'ol' : 'ul';
  // Step the marker shape per depth (disc → circle → square) so three levels of
  // nesting stay tellable apart — Tailwind's `list-disc` alone repeats at every
  // level, which is what made the folder-structure replies hard to scan.
  const marker = tree.ordered
    ? 'list-decimal'
    : depth === 0 ? 'list-disc' : depth === 1 ? 'list-[circle]' : 'list-[square]';
  return (
    <Tag
      className={`${marker} pl-5 space-y-1.5 marker:text-cs-text-dim ${
        nested ? 'mt-1.5' : 'my-2.5'
      }`}
    >
      {tree.items.map((it, j) => (
        <li key={j} className="leading-relaxed pl-1">
          {renderListItem(it.text, `${k}${j}-`)}
          {it.children && it.children.items.length > 0 && (
            <ListTree tree={it.children} k={`${k}${j}-`} depth={depth + 1} nested />
          )}
        </li>
      ))}
    </Tag>
  );
}

function List({ lines, k }) {
  return <ListTree tree={parseListTree(lines)} k={k} />;
}

const isBulletLine = (s) => /^[\t ]*(?:[-*]|\d+[.)])\s/.test(s || '');

function Prose({ text }) {
  // Drop blank lines that sit *between* two list items so a "loose" list still
  // parses as one list (not a scatter of one-item lists → plain sentences).
  const raw = String(text).replace(/\r\n?/g, '\n').split('\n');
  const kept = raw.filter((line, idx) =>
    !(line.trim() === '' && isBulletLine(raw[idx - 1]) && isBulletLine(raw[idx + 1]))
  );
  const blocks = kept.join('\n').trim().split(/\n{2,}/).filter(Boolean);
  return blocks.map((b, i) => {
    // Walk the lines: headings become <Heading>, consecutive bullet lines group
    // into one <List>, the rest are paragraphs. Works even when a heading and its
    // list sit in the same block (no blank line between them).
    const lines = b.split('\n');
    const out = [];
    let buf = [];
    let run = [];
    const flushP = () => {
      if (buf.length) {
        out.push(
          <p key={`${i}p${out.length}`} className="leading-relaxed my-2.5 first:mt-0 last:mb-0">
            {renderInline(buf.join(' '), `${i}-${out.length}-`)}
          </p>
        );
        buf = [];
      }
    };
    const flushL = () => {
      if (run.length >= 2) {
        out.push(<List key={`${i}l${out.length}`} lines={run} k={`${i}-${out.length}-`} />);
      } else if (run.length === 1) {
        // A lone "- ..." line isn't a list — render it as a plain sentence.
        buf.push(run[0].replace(BULLET, ''));
        flushP();
      }
      run = [];
    };
    for (const line of lines) {
      const h = line.match(/^(#{1,6})\s+(.*\S)\s*#*\s*$/);
      const boldH = line.match(/^\*\*(.+?)\*\*:?\s*$/);
      if (h) {
        flushP(); flushL();
        out.push(<Heading key={`${i}h${out.length}`} level={h[1].length} text={h[2]} k={`${i}-${out.length}-`} />);
      } else if (boldH) {
        flushP(); flushL();
        out.push(<Heading key={`${i}h${out.length}`} level={3} text={boldH[1]} k={`${i}-${out.length}-`} />);
      } else if (BULLET.test(line)) {
        flushP(); run.push(line);
      } else if (run.length && /^[\t ]{2,}\S/.test(line)) {
        // Indented continuation of the current list item (wrapped / lazy line).
        run[run.length - 1] += ` ${line.trim()}`;
      } else if (line.trim()) {
        flushL(); buf.push(line);
      }
    }
    flushP(); flushL();
    return <React.Fragment key={i}>{out}</React.Fragment>;
  });
}

function Markdown({ text, className = '', size = 'text-sm' }) {
  const src = String(text || '');
  const parts = [];
  const fence = /```(\w+)?\n?([\s\S]*?)```/g;
  let last = 0;
  let m;
  while ((m = fence.exec(src)) !== null) {
    if (m.index > last) parts.push({ type: 'prose', body: src.slice(last, m.index) });
    parts.push({ type: 'code', lang: m[1] || '', body: m[2].replace(/\n$/, '') });
    last = m.index + m[0].length;
  }
  if (last < src.length) {
    // A trailing ``` with no closing fence yet (mid-stream) — render it as a
    // live code block so the reader sees the highlighted result, not raw text.
    const tail = src.slice(last);
    const open = tail.match(/```(\w+)?\n?/);
    if (open) {
      if (open.index > 0) parts.push({ type: 'prose', body: tail.slice(0, open.index) });
      parts.push({ type: 'code', lang: open[1] || '', body: tail.slice(open.index + open[0].length) });
    } else {
      parts.push({ type: 'prose', body: tail });
    }
  }
  if (!parts.length) parts.push({ type: 'prose', body: src });

  return (
    <div className={`${size} text-cs-text-dim ${className}`}>
      {parts.map((p, i) => {
        if (p.type !== 'code') return <Prose key={i} text={p.body} />;
        return <CodeBlock key={i} lang={p.lang} body={p.body} />;
      })}
    </div>
  );
}

export default Markdown;
