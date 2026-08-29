import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FiArrowRight, FiCheck, FiCheckCircle, FiClock, FiPlay, FiHelpCircle, FiBookmark } from 'react-icons/fi';
import { docService } from '../services/api';
import { toast } from '../utils/toast';
import { MAJORS } from '../majors';
import CollectionLogo from '../components/CollectionLogo';

const slugifyHeading = (t) =>
  String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'section';
const stripColon = (t) => t.replace(/\s*:\s*$/, '');

// Lines this quick runner can't interpret — if a snippet has any of them we
// hide the playground entirely rather than show a broken one.
const UNSUPPORTED = /(^|\n)\s*(if|elif|else|for|while|def|class|import|from|with|try|except|finally|return|yield|async|await|match|case|lambda|global|nonlocal|raise|assert|del)\b/;

// Evaluate a small Python-ish expression (numbers, strings, + - * / % **, and
// known variables). Returns undefined if it can't be done safely.
function evalExpr(raw, vars) {
  const src = String(raw).trim();
  const str = src.match(/^(['"])([\s\S]*)\1$/);
  if (str) return str[2];

  let ok = true;
  const js = src.replace(/[A-Za-z_]\w*/g, (id) => {
    if (id === 'True') return 'true';
    if (id === 'False') return 'false';
    if (id === 'None') return 'null';
    if (id in vars) return JSON.stringify(vars[id]);
    ok = false;
    return id;
  });
  if (!ok) return undefined;
  // after substitution only literals/operators may remain
  if (/[A-Za-z_]/.test(js.replace(/"[^"]*"/g, ''))) return undefined;
  if (!/^[\s\d.+\-*/%()"'!<>=&|]*$/.test(js.replace(/"[^"]*"/g, '""'))) return undefined;
  try {
    // eslint-disable-next-line no-new-func
    const v = Function(`"use strict";return (${js});`)();
    return v;
  } catch {
    return undefined;
  }
}

// A quick straight-line Python runner: variable assignments + print() with
// f-string interpolation and simple arithmetic. Not a real interpreter.
function runMiniPython(src) {
  const vars = {};
  const out = [];
  let error = null;

  for (const raw of src.split('\n')) {
    const line = raw.replace(/\s+#.*$/, '').trim();
    if (!line || line.startsWith('#')) continue;

    if (UNSUPPORTED.test('\n' + line)) {
      error = 'This quick playground runs straight-line code only (variables + print). Use “Do the lesson” for the real runtime.';
      break;
    }

    const a = line.match(/^([A-Za-z_]\w*)\s*=\s*(.+)$/);
    if (a) {
      const v = evalExpr(a[2], vars);
      vars[a[1]] = v === undefined ? a[2].trim().replace(/^(['"])([\s\S]*)\1$/, '$2') : v;
      continue;
    }

    const p = line.match(/^print\((.*)\)$/);
    if (p) {
      const arg = p[1].trim();
      const f = arg.match(/^f(['"])([\s\S]*)\1$/);
      if (f) {
        out.push(
          f[2].replace(/\{([^}]+)\}/g, (m, expr) => {
            const v = evalExpr(expr, vars);
            return v === undefined ? m : String(v);
          })
        );
      } else {
        const v = evalExpr(arg, vars);
        out.push(v === undefined ? arg.replace(/^(['"])([\s\S]*)\1$/, '$2') : String(v));
      }
      continue;
    }

    error = 'Only variable assignments and print() run here. Open the lesson for the full runtime.';
    break;
  }

  return { error, text: out.join('\n') || '(nothing printed)' };
}

function LibraryArticle() {
  const { collection, topic } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [toc, setToc] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [progress, setProgress] = useState(0);
  const [editor, setEditor] = useState('');
  const [output, setOutput] = useState({ ran: false });
  const [read, setRead] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const bodyRef = useRef(null);
  const autoReadSent = useRef(false);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    autoReadSent.current = false;
    docService
      .getTopic(collection, topic)
      .then((res) => {
        setData(res.data);
        setRead(!!res.data.read);
        setBookmarked(!!res.data.bookmarked);
      })
      .catch((err) => {
        if (err.response?.status === 404) setNotFound(true);
        else console.error('Error loading article:', err);
      })
      .finally(() => setLoading(false));
  }, [collection, topic]);

  const toggleRead = (next) => {
    const value = next ?? !read;
    setRead(value);
    docService.setRead(collection, topic, value).catch(() => {
      setRead(!value);
      toast.error("Couldn't save that");
    });
  };

  const toggleBookmark = () => {
    const value = !bookmarked;
    setBookmarked(value);
    docService.setBookmark(collection, topic, value).catch(() => {
      setBookmarked(!value);
      toast.error("Couldn't save that");
    });
  };

  // headings -> TOC, ids on headings, copy buttons on code blocks
  useEffect(() => {
    const root = bodyRef.current;
    if (!data || !root) return;

    const used = new Set();
    const items = [];
    root.querySelectorAll('h2, h3').forEach((node) => {
      let id = slugifyHeading(node.textContent);
      while (used.has(id)) id += '-x';
      used.add(id);
      node.id = id;
      items.push({ id, text: stripColon(node.textContent), level: node.tagName === 'H3' ? 2 : 1 });
    });
    setToc(items);

    const cleanups = [];
    root.querySelectorAll('pre').forEach((pre) => {
      if (pre.dataset.deco) return;
      pre.dataset.deco = '1';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = 'copy';
      btn.className = 'doc-copy';
      const onClick = () => {
        navigator.clipboard?.writeText(pre.innerText.replace(/\n?copy$/, '').trim());
        btn.textContent = 'copied';
        setTimeout(() => { btn.textContent = 'copy'; }, 1400);
      };
      btn.addEventListener('click', onClick);
      pre.appendChild(btn);
      cleanups.push(() => btn.removeEventListener('click', onClick));
    });

    setEditor(data.code_sample || '');
    setOutput({ ran: false });
    window.scrollTo({ top: 0 });
    return () => cleanups.forEach((fn) => fn());
  }, [data]);

  // scroll spy
  useEffect(() => {
    if (!toc.length) return;
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActiveId(e.target.id)),
      { rootMargin: '-90px 0px -70% 0px' }
    );
    toc.forEach((h) => {
      const el = document.getElementById(h.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [toc]);

  // reading progress bar
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(h > 0 ? Math.min(100, (window.scrollY / h) * 100) : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [data]);

  // Reaching the end of an article marks it read once, unless already read.
  useEffect(() => {
    if (data && !read && !autoReadSent.current && progress >= 95) {
      autoReadSent.current = true;
      toggleRead(true);
    }
  }, [progress, data, read]); // eslint-disable-line react-hooks/exhaustive-deps

  const majorLabels = useMemo(
    () => (data?.major_slugs || []).map((m) => MAJORS[m]?.label).filter(Boolean),
    [data]
  );

  const navGroups = useMemo(() => {
    if (!data) return [];
    const map = new Map();
    for (const s of data.siblings) {
      const key = s.group || 'Topics';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(s);
    }
    return [...map.entries()];
  }, [data]);

  // Only block the whole view on the very first load. Sibling navigation keeps
  // the current article visible (dimmed) while the next one fetches.
  if (loading && !data) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-cs-darkest border-t-cs-primary rounded-full animate-spin"></div>
        <p className="text-gray-400">Loading…</p>
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <main className="w-full px-6 lg:px-10 py-16 text-center">
        <p className="text-lg text-gray-400 mb-4">That article doesn’t exist.</p>
        <Link to={`/library/${collection}`} className="btn btn-primary">Back to collection</Link>
      </main>
    );
  }

  const rel = data.related_lesson;
  const showPlayground =
    !!data.code_sample &&
    /^python/.test(data.collection_slug) &&
    !UNSUPPORTED.test('\n' + data.code_sample);

  const run = () => setOutput({ ran: true, ...runMiniPython(editor) });
  const reset = () => { setEditor(data.code_sample || ''); setOutput({ ran: false }); };

  return (
    <main className="w-full pb-10">
      <div
        className="fixed top-0 left-0 h-0.5 bg-cs-orange z-[60] transition-[width] duration-100"
        style={{ width: `${progress}%` }}
      />

      {/* locked breadcrumb header */}
      <div className="hidden lg:block sticky top-0 z-30 bg-cs-dark/85 backdrop-blur-xl border-b border-cs-line/10 px-6 lg:px-10">
        <nav className="flex items-center gap-2 h-12 text-xs font-mono text-cs-text-muted whitespace-nowrap overflow-hidden">
          <Link to="/library" className="hover:text-cs-text shrink-0">Library</Link>
          <span className="text-cs-line/20 shrink-0">/</span>
          <Link
            to={`/library/${data.collection_slug}`}
            className="hover:text-cs-text shrink-0"
          >
            {data.collection_title}
          </Link>
          <span className="text-cs-line/20 shrink-0">/</span>
          <span className="text-cs-text-dim truncate">{data.title}</span>
        </nav>
      </div>

      <div
        className={`px-6 lg:px-10 pt-8 grid lg:grid-cols-[14rem_minmax(0,52rem)_13rem] 2xl:grid-cols-[15rem_minmax(0,62rem)_14rem] gap-x-10 gap-y-8 items-start transition-opacity duration-150 ${
          loading ? 'opacity-50' : 'opacity-100'
        }`}
      >
        {/* ---------- chapter nav ---------- */}
        <aside className="hidden lg:block sticky top-24 self-start max-h-[calc(100vh-7rem)] overflow-y-auto pr-1 text-sm">
          <div className="flex items-center gap-2.5 px-2 mb-5">
            <span className="w-7 h-7 rounded-lg bg-cs-primary/10 flex items-center justify-center text-base shrink-0">
              <CollectionLogo slug={data.collection_slug} fallback={data.collection_title.slice(0, 2)} />
            </span>
            <b className="font-mono text-sm font-medium truncate">{data.collection_title}</b>
            <span className="ml-auto font-mono text-[11px] text-cs-text-muted shrink-0">
              {data.position} / {data.total}
            </span>
          </div>

          {navGroups.map(([label, items]) => (
            <div key={label} className="mb-5">
              <div className="flex items-center gap-2 px-2 mb-1.5">
                <span className="font-mono text-[10px] tracking-[0.12em] text-cs-text-muted">
                  {label.toUpperCase()}
                </span>
                <span className="flex-1 h-px bg-cs-line/10" />
              </div>
              {items.map((s) => {
                const on = s.slug === data.slug;
                return (
                  <Link
                    key={s.slug}
                    to={`/library/${data.collection_slug}/${s.slug}`}
                    className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg leading-tight transition-colors ${
                      on
                        ? 'bg-cs-primary/10 text-cs-primary font-medium'
                        : 'text-cs-text-dim hover:text-cs-text hover:bg-cs-overlay/5'
                    }`}
                  >
                    <span
                      className={`w-3.5 h-3.5 shrink-0 rounded-full border grid place-items-center ${
                        s.completed
                          ? 'border-transparent bg-cs-green/20 text-cs-green'
                          : on
                          ? 'border-cs-primary'
                          : 'border-cs-line/20'
                      }`}
                    >
                      {s.completed && <FiCheck className="text-[9px]" strokeWidth={3} />}
                      {!s.completed && on && <span className="w-1 h-1 rounded-full bg-cs-primary" />}
                    </span>
                    <span className="truncate">{s.title}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </aside>

        {/* ---------- article ---------- */}
        <article className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-5">
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] px-2.5 py-1 rounded-full border border-cs-orange/25 bg-cs-orange/[0.07] text-cs-orange">
              <FiClock className="text-[11px]" /> {data.reading_minutes} min read
            </span>
            <span className="font-mono text-[11px] px-2.5 py-1 rounded-full border border-cs-line/10 bg-cs-darker text-cs-text-dim">
              {data.position} of {data.total}
            </span>
            <span className="flex-1" />
            <button
              onClick={toggleBookmark}
              aria-pressed={bookmarked}
              title={bookmarked ? 'Remove bookmark' : 'Bookmark this article'}
              className={`inline-flex items-center gap-1.5 font-mono text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                bookmarked
                  ? 'border-cs-primary/40 bg-cs-primary/10 text-cs-primary'
                  : 'border-cs-line/15 text-cs-text-dim hover:text-cs-text hover:border-cs-line/30'
              }`}
            >
              <FiBookmark className={`text-[11px] ${bookmarked ? 'fill-current' : ''}`} />
              {bookmarked ? 'Saved' : 'Save'}
            </button>
            <button
              onClick={() => toggleRead()}
              aria-pressed={read}
              className={`inline-flex items-center gap-1.5 font-mono text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                read
                  ? 'border-cs-green/40 bg-cs-green/10 text-cs-green'
                  : 'border-cs-line/15 text-cs-text-dim hover:text-cs-text hover:border-cs-line/30'
              }`}
            >
              <FiCheckCircle className="text-[11px]" />
              {read ? 'Read' : 'Mark as read'}
            </button>
          </div>

          <h1 className="font-mono text-[32px] leading-[1.14] font-medium tracking-tight text-cs-text">
            {data.title}
          </h1>

          {data.summary && (
            <p className="mt-3.5 text-[17px] leading-relaxed text-cs-text-dim max-w-[62ch]">
              {data.summary}
            </p>
          )}

          {majorLabels.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mt-5">
              <span className="font-mono text-[10px] tracking-[0.1em] text-cs-text-muted mr-1">
                SHOWS UP IN
              </span>
              {majorLabels.map((l) => (
                <span
                  key={l}
                  className="text-xs px-2 py-0.5 rounded-md bg-cs-overlay/[0.04] border border-cs-line/10 text-cs-text-dim"
                >
                  {l}
                </span>
              ))}
            </div>
          )}

          <div
            ref={bodyRef}
            className="lesson-article lesson-article--wide mt-9"
            dangerouslySetInnerHTML={{ __html: data.body }}
          />

          {showPlayground && (
            <section className="mt-9">
              <h2 className="font-mono text-lg font-medium text-cs-text flex items-center gap-2.5 mb-2">
                <span className="w-1.5 h-[1.1em] rounded-full bg-gradient-to-b from-cs-primary to-cs-cyan" />
                Try it
              </h2>
              <p className="text-sm text-cs-text-dim mb-3">
                Change a value and run it. Nothing here can break.
              </p>
              <div className="rounded-xl border border-cs-line/15 bg-cs-darker overflow-hidden">
                <div className="flex items-center gap-2 px-3.5 py-2.5 bg-cs-darkest border-b border-cs-line/15">
                  <FiPlay className="text-cs-orange text-xs" />
                  <b className="font-mono text-xs font-medium">Playground</b>
                  <span className="ml-auto font-mono text-[11px] text-cs-text-muted">Python 3.12</span>
                </div>
                <div className="grid md:grid-cols-2">
                  <textarea
                    value={editor}
                    onChange={(e) => setEditor(e.target.value)}
                    spellCheck={false}
                    className="w-full min-h-[20rem] p-3.5 bg-cs-darker text-cs-text font-mono text-[13px] leading-[22px] resize-y outline-none border-0"
                  />
                  <div
                    className="border-t md:border-t-0 md:border-l border-cs-line/10 p-3.5 bg-[#05070c] font-mono text-[12.5px] leading-[22px] whitespace-pre-wrap min-h-[20rem]"
                    style={{
                      color: output.ran
                        ? output.error
                          ? 'rgb(var(--cs-red))'
                          : 'rgb(var(--cs-green))'
                        : undefined,
                    }}
                  >
                    {output.ran ? (
                      output.error || output.text
                    ) : (
                      <span className="text-cs-text-muted">Output appears here after you run.</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 px-3.5 py-2.5 bg-cs-darkest border-t border-cs-line/15">
                  <button
                    onClick={run}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs bg-cs-primary text-cs-dark hover:brightness-110 transition"
                  >
                    <FiPlay className="text-xs" /> Run
                  </button>
                  <button
                    onClick={reset}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs border border-cs-line/15 text-cs-text hover:border-cs-line/30 transition"
                  >
                    Reset
                  </button>
                  <Link
                    to="/tutor"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs border border-cs-line/15 text-cs-text hover:border-cs-line/30 transition"
                  >
                    Ask why
                  </Link>
                </div>
              </div>
            </section>
          )}

          {rel && (
            <div className="mt-11 rounded-xl border border-cs-line/15 bg-cs-darkest p-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="font-mono text-base font-medium text-cs-text mb-1">
                  Ready to write it yourself?
                </h3>
                <p className="text-sm text-cs-text-dim max-w-[46ch]">
                  The lesson gives you a task, checks your code, and hints when you get stuck.
                </p>
              </div>
              <Link
                to={`/learn/${rel.slug}/module/${rel.module_id}/lesson/${rel.lesson_id}`}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-mono text-[13.5px] font-medium bg-cs-orange text-cs-dark hover:brightness-110 transition whitespace-nowrap"
              >
                Do the lesson <FiArrowRight />
              </Link>
            </div>
          )}

          {/* pager */}
          <div className="grid grid-cols-2 gap-3 mt-4">
            {data.prev ? (
              <Link
                to={`/library/${data.collection_slug}/${data.prev.slug}`}
                className="rounded-xl border border-cs-line/10 bg-cs-darker p-4 hover:border-cs-line/25 transition"
              >
                <span className="block font-mono text-[10px] tracking-[0.09em] text-cs-text-muted mb-1">
                  PREVIOUS
                </span>
                <span className="font-mono text-sm font-medium text-cs-text">{data.prev.title}</span>
              </Link>
            ) : (
              <span className="rounded-xl border border-cs-line/10 bg-cs-darker p-4 opacity-40">
                <span className="block font-mono text-[10px] tracking-[0.09em] text-cs-text-muted mb-1">
                  PREVIOUS
                </span>
                <span className="font-mono text-sm text-cs-text-dim">Start of collection</span>
              </span>
            )}
            {data.next ? (
              <Link
                to={`/library/${data.collection_slug}/${data.next.slug}`}
                className="rounded-xl border border-cs-line/10 bg-cs-darker p-4 text-right hover:border-cs-line/25 transition"
              >
                <span className="block font-mono text-[10px] tracking-[0.09em] text-cs-text-muted mb-1">
                  NEXT
                </span>
                <span className="font-mono text-sm font-medium text-cs-text">{data.next.title}</span>
              </Link>
            ) : (
              <span className="rounded-xl border border-cs-line/10 bg-cs-darker p-4 text-right opacity-40">
                <span className="block font-mono text-[10px] tracking-[0.09em] text-cs-text-muted mb-1">
                  NEXT
                </span>
                <span className="font-mono text-sm text-cs-text-dim">End of collection</span>
              </span>
            )}
          </div>
        </article>

        {/* ---------- on this page ---------- */}
        <aside className="hidden lg:block sticky top-24 self-start max-h-[calc(100vh-7rem)] overflow-y-auto">
          <p className="font-mono text-[10px] tracking-[0.12em] text-cs-text-muted mb-3">
            ON THIS PAGE
          </p>
          <ul>
            {toc.map((h) => (
              <li key={h.id}>
                <a
                  href={`#${h.id}`}
                  className={`block py-1.5 text-[13px] leading-snug border-l transition-colors ${
                    h.level === 2 ? 'pl-6' : 'pl-3'
                  } ${
                    activeId === h.id
                      ? 'border-cs-primary text-cs-primary'
                      : 'border-cs-line/10 text-cs-text-dim hover:text-cs-text'
                  }`}
                >
                  {h.text}
                </a>
              </li>
            ))}
          </ul>
          <Link
            to="/tutor"
            className="mt-6 inline-flex items-center gap-2 text-[13px] text-cs-text-dim hover:text-cs-primary transition-colors"
          >
            <FiHelpCircle /> Ask the CodeSquareAgent
          </Link>
        </aside>
      </div>
    </main>
  );
}

export default LibraryArticle;
