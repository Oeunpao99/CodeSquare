import React, { useState } from 'react';
import { FiCopy, FiCheck } from 'react-icons/fi';
import CodeEditor from './CodeEditor';

// A small, dependency-free markdown renderer: fenced code blocks (with a copy
// button), inline `code` / **bold** / [links], `#`–`###` headings, and
// `-` / `1.` lists. Enough for tutor replies, project briefs and notes.

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

const BULLET = /^\s*([-*]|\d+[.)])\s+/;

function Heading({ level, text, k }) {
  const cls = level <= 1 ? 'text-[15px] font-bold text-cs-text mt-4 mb-1.5'
    : level === 2 ? 'text-sm font-bold text-cs-text mt-4 mb-1'
    : 'text-[13px] font-semibold text-cs-text mt-3 mb-1';
  const Tag = `h${Math.min(4, level + 1)}`;
  return <Tag className={cls}>{renderInline(text, k)}</Tag>;
}

function List({ lines, k }) {
  const ordered = /^\s*\d+[.)]/.test(lines[0]);
  const Tag = ordered ? 'ol' : 'ul';
  return (
    <Tag className={`${ordered ? 'list-decimal' : 'list-disc'} pl-5 space-y-1 my-1.5`}>
      {lines.map((l, j) => (
        <li key={j}>{renderInline(l.replace(BULLET, ''), `${k}${j}-`)}</li>
      ))}
    </Tag>
  );
}

function Prose({ text }) {
  const blocks = text.trim().split(/\n{2,}/).filter(Boolean);
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
          <p key={`${i}p${out.length}`} className="leading-relaxed my-1.5">
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
      {parts.map((p, i) =>
        p.type === 'code'
          ? <CodeBlock key={i} lang={p.lang} body={p.body} />
          : <Prose key={i} text={p.body} />
      )}
    </div>
  );
}

export default Markdown;
