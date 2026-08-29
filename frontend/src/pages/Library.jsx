import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiSearch, FiArrowRight, FiBookOpen, FiClock, FiX, FiCornerDownLeft, FiPlayCircle, FiUsers, FiStar, FiCheckCircle } from 'react-icons/fi';
import { docService } from '../services/api';
import { useMajor } from '../context/MajorContext';
import { MAJORS } from '../majors';
import { partitionByMajor } from '../libraryMap';
import CollectionLogo from '../components/CollectionLogo';

const CAT_LABELS = {
  python: 'Python',
  web: 'Web',
  backend: 'Backend',
  data: 'Data & SQL',
  devops: 'DevOps',
  cs: 'CS Fundamentals',
};
const CAT_ORDER = ['python', 'web', 'backend', 'data', 'devops', 'cs'];

function MajorChips({ slugs = [] }) {
  if (!slugs.length) return null;
  const labels = slugs.map((s) => MAJORS[s]?.label).filter(Boolean).slice(0, 3);
  if (!labels.length) return null;
  return (
    <p className="text-[11px] text-cs-text-muted mt-3 font-mono">
      appears in: {labels.join(' · ')}
    </p>
  );
}

function CollectionCard({ c, forMajor = false }) {
  return (
    <Link to={`/library/${c.slug}`} className="card group relative flex flex-col">
      {forMajor && (
        <span className="absolute top-3 right-3 text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-cs-primary/15 text-cs-primary">
          your path
        </span>
      )}
      <span className="w-12 h-12 rounded-xl bg-cs-overlay/5 flex items-center justify-center text-3xl shrink-0 mb-4">
        <CollectionLogo slug={c.slug} fallback={c.icon} />
      </span>
      <h3 className="text-lg font-bold">{c.title}</h3>
      <p className="text-sm text-cs-text-dim mt-1 line-clamp-2">{c.description}</p>

      {/* community stats — learners, finishers, rating */}
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 mt-2.5 text-xs font-mono text-cs-text-muted">
        <span className="inline-flex items-center gap-1.5" title="learners with activity on this shelf">
          <FiUsers className="text-sm" /> {c.learners || 0}
        </span>
        {c.finished > 0 && (
          <span className="inline-flex items-center gap-1.5 text-cs-green" title="learners who finished every topic">
            <FiCheckCircle className="text-sm" /> {c.finished}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5" title={c.rating_count ? `${c.rating_count} rating${c.rating_count === 1 ? '' : 's'}` : 'not rated yet'}>
          <FiStar className={`text-sm ${c.rating_count ? 'text-cs-orange fill-current' : ''}`} />
          {c.rating_count ? `${c.rating_avg.toFixed(1)} (${c.rating_count})` : '—'}
        </span>
      </div>

      <div className="flex-grow" />

      {c.trackable > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-[11px] font-mono text-cs-text-muted mb-1.5">
            <span className={c.completed === c.trackable ? 'text-cs-green' : ''}>
              {c.completed} / {c.trackable} done
            </span>
            <span>{Math.round((c.completed / c.trackable) * 100)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-cs-overlay/10 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                c.completed === c.trackable ? 'bg-cs-green' : 'bg-cs-primary'
              }`}
              style={{ width: `${(c.completed / c.trackable) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mt-4 text-sm">
        <span className="text-cs-text-muted font-mono">{c.topic_count} topics</span>
        <span className="inline-flex items-center gap-1 text-cs-primary group-hover:text-cs-cyan transition-colors">
          Browse <FiArrowRight />
        </span>
      </div>
      <MajorChips slugs={c.majors} />
    </Link>
  );
}

function Library() {
  const { major, majorData, hasMajor } = useMajor();
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null); // null = not searching
  const [searching, setSearching] = useState(false);
  const [cat, setCat] = useState('all'); // language / category filter
  const [resume, setResume] = useState(null); // next article to continue reading

  useEffect(() => {
    docService
      .getCollections()
      .then((res) => setCollections(res.data))
      .catch((err) => console.error('Error loading library:', err))
      .finally(() => setLoading(false));
    docService
      .continueReading()
      .then((res) => setResume(res.data || null))
      .catch(() => setResume(null));
  }, []);

  // Debounced topic search across every shelf.
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const id = setTimeout(() => {
      docService
        .search(term)
        .then((res) => setResults(res.data))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 220);
    return () => clearTimeout(id);
  }, [query]);

  const [forMajor, others] = useMemo(
    () => (hasMajor ? partitionByMajor(collections, major) : [[], collections]),
    [collections, major, hasMajor]
  );
  const forMajorSlugs = useMemo(() => new Set(forMajor.map((c) => c.slug)), [forMajor]);
  const cats = useMemo(
    () => CAT_ORDER.filter((k) => collections.some((c) => c.category === k)),
    [collections]
  );

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-cs-darkest border-t-cs-primary rounded-full animate-spin"></div>
        <p className="text-gray-400">Loading the library...</p>
      </div>
    );
  }

  const isSearching = results !== null;

  return (
    <main className="w-full px-6 lg:px-10 py-8">
      {/* Sticky header — the whole thing (title, description, search and category
          filters) stays locked while the collections scroll beneath it. */}
      <div className="sticky top-0 z-30 -mx-6 lg:-mx-10 px-6 lg:px-10 pt-4 pb-4 -mt-8 mb-6 bg-cs-dark/85 backdrop-blur-xl border-b border-cs-line/[0.07]">
        <span className="mono-label">// knowledge library</span>
        <h1 className="text-3xl font-bold mt-3 mb-2 flex items-center gap-3">
          <FiBookOpen className="text-cs-primary" /> Library
        </h1>
        <p className="text-cs-text-dim mb-6">
          Reference and deep-dives. Look anything up, read ahead — no track required.
        </p>

        <div className="relative max-w-lg mb-6">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-cs-text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search topics — rebase, JOIN, f-string…"
            className="input w-full pl-9 pr-9"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-cs-text-muted hover:text-cs-text"
              aria-label="Clear search"
            >
              <FiX />
            </button>
          )}
        </div>

        {!isSearching && cats.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {['all', ...cats].map((k) => (
              <button
                key={k}
                onClick={() => setCat(k)}
                className={`px-3 py-1.5 rounded-full text-xs font-mono transition-colors ${
                  cat === k
                    ? 'bg-cs-primary/15 text-cs-primary border border-cs-primary/30'
                    : 'text-cs-text-dim border border-cs-line/10 hover:text-cs-text hover:border-cs-line/25'
                }`}
              >
                {k === 'all' ? 'All' : CAT_LABELS[k] || k}
              </button>
            ))}
          </div>
        )}
      </div>

      {!isSearching && resume && (
        <Link
          to={`/library/${resume.collection_slug}/${resume.topic_slug}`}
          className="card mb-10 flex flex-col sm:flex-row sm:items-center gap-5 border-cs-primary/40 hover:border-cs-primary/70 group"
        >
          <span className="w-14 h-14 rounded-xl bg-cs-primary/15 text-cs-primary flex items-center justify-center text-3xl shrink-0">
            <FiPlayCircle />
          </span>
          <div className="flex-grow min-w-0">
            <p className="mono-label text-cs-primary mb-1">
              {resume.resuming ? '// continue reading' : '// jump back in'}
            </p>
            <h2 className="text-xl font-bold truncate">{resume.title}</h2>
            <p className="text-sm text-cs-text-dim font-mono truncate">
              {resume.collection_title} <span className="text-cs-text-muted">·</span>{' '}
              {resume.position} of {resume.total} · {resume.reading_minutes} min
            </p>
          </div>
          <span className="inline-flex items-center gap-2 text-cs-primary font-semibold group-hover:text-cs-cyan transition-colors shrink-0 self-start sm:self-center">
            {resume.resuming ? 'Continue' : 'Reread'} <FiArrowRight />
          </span>
        </Link>
      )}

      {isSearching ? (
        <section>
          <h2 className="text-sm font-mono uppercase tracking-[0.2em] text-cs-text-muted mb-4">
            {searching
              ? 'Searching…'
              : `${results.length} result${results.length === 1 ? '' : 's'} for “${query.trim()}”`}
          </h2>

          {!searching && results.length === 0 && (
            <p className="text-sm text-cs-text-muted">
              Nothing matched. Try a shorter term, or browse the collections below by clearing the search.
            </p>
          )}

          <div className="rounded-xl border border-cs-line/10 divide-y divide-cs-line/10 overflow-hidden">
            {results.map((r) => (
              <Link
                key={`${r.collection_slug}/${r.topic_slug}`}
                to={`/library/${r.collection_slug}/${r.topic_slug}`}
                className="group flex items-center gap-4 px-4 py-3 hover:bg-cs-overlay/5 transition-colors"
              >
                <span className="w-8 h-8 rounded-lg bg-cs-overlay/5 flex items-center justify-center text-lg shrink-0">
                  <CollectionLogo slug={r.collection_slug} fallback={r.collection_icon} />
                </span>
                <div className="flex-grow min-w-0">
                  <div className="text-sm font-medium text-cs-text group-hover:text-cs-primary transition-colors truncate">
                    {r.title}
                  </div>
                  <div className="text-xs text-cs-text-muted truncate mt-0.5">
                    <span className="font-mono">{r.collection_title}</span>
                    {r.summary ? ` · ${r.summary}` : ''}
                  </div>
                </div>
                <span className="flex items-center gap-1 text-[11px] font-mono text-cs-text-muted/60 shrink-0">
                  <FiClock /> {r.reading_minutes}m
                </span>
                <FiCornerDownLeft className="text-cs-text-muted/30 group-hover:text-cs-primary transition-colors shrink-0" />
              </Link>
            ))}
          </div>
        </section>
      ) : cat !== 'all' ? (
        <section>
          <h2 className="text-sm font-mono uppercase tracking-[0.2em] text-cs-text-muted mb-4">
            {CAT_LABELS[cat] || cat}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {collections
              .filter((c) => c.category === cat)
              .map((c) => (
                <CollectionCard key={c.slug} c={c} forMajor={forMajorSlugs.has(c.slug)} />
              ))}
          </div>
        </section>
      ) : (
        <>
          {hasMajor && forMajor.length > 0 && (
            <section className="mb-12">
              <h2 className="text-sm font-mono uppercase tracking-[0.2em] text-cs-text-muted mb-4">
                Your {majorData?.label} library
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {forMajor.map((c) => (
                  <CollectionCard key={c.slug} c={c} forMajor />
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="text-sm font-mono uppercase tracking-[0.2em] text-cs-text-muted mb-4">
              {hasMajor ? 'All collections' : 'Collections'}
            </h2>
            {!hasMajor && (
              <p className="text-sm text-cs-text-muted mb-4">
                <Link to="/dashboard" className="text-cs-primary font-mono">
                  → pick a major
                </Link>{' '}
                to pin the shelves that matter for your path.
              </p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {(hasMajor ? others : collections).map((c) => (
                <CollectionCard key={c.slug} c={c} />
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}

export default Library;
