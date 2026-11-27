import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiSearch, FiArrowRight, FiBookOpen, FiClock, FiX, FiCornerDownLeft, FiPlayCircle, FiUsers, FiStar, FiCheckCircle } from 'react-icons/fi';
import { docService } from '../services/api';
import { useMajor } from '../context/MajorContext';
import { MAJORS } from '../majors';
import { partitionByMajor } from '../libraryMap';
import CollectionLogo from '../components/CollectionLogo';
import LibraryThumb from '../components/LibraryThumb';
import { LibrarySkeleton } from '../components/Skeletons';

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
    <p className="text-[0.6875rem] text-cs-text-muted mt-3">
      appears in: {labels.join(' · ')}
    </p>
  );
}

function CollectionCard({ c, forMajor = false }) {
  const { t } = useTranslation();
  return (
    <Link to={`/library/${c.slug}`} className="card group relative flex flex-col overflow-hidden text-cs-text hover:border-cs-primary/40">
      <LibraryThumb
        path={c.slug}
        className="-mx-6 -mt-6 mb-4 w-[calc(100%+3rem)] max-w-none aspect-[3/2] transition-transform duration-500 group-hover:scale-[1.03]"
      />
      {forMajor && (
        <span className="absolute top-3 right-3 z-10 text-[0.625rem] uppercase tracking-wider px-2 py-0.5 rounded bg-cs-darkest/80 backdrop-blur text-cs-primary">
          {t('dashboard.for_your_major')}
        </span>
      )}
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-xl bg-cs-overlay/5 flex items-center justify-center text-2xl shrink-0">
          <CollectionLogo slug={c.slug} fallback={c.icon} />
        </span>
        <h3 className="text-lg font-bold">{c.title}</h3>
      </div>
      <p className="text-sm text-cs-text-dim mt-1 line-clamp-2">{c.description}</p>

      {/* community stats — learners, finishers, rating */}
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 mt-2.5 text-xs text-cs-text-muted">
        <span className="inline-flex items-center gap-1.5" title="learners with activity on this shelf">
          <FiUsers className="text-sm" /> {c.learners || 0}
        </span>
        {c.finished > 0 && (
          <span className="inline-flex items-center gap-1.5 text-cs-green" title="learners who finished every topic">
            <FiCheckCircle className="text-sm" /> {c.finished}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <FiStar className={`text-sm ${c.rating_count ? 'text-cs-orange fill-current' : ''}`} />
          {c.rating_count ? c.rating_avg.toFixed(1) : '—'}
        </span>
      </div>

      <div className="flex-grow" />

      {c.trackable > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-[0.6875rem] text-cs-text-muted mb-1.5">
            <span className={c.completed === c.trackable ? 'text-cs-green' : ''}>
              {c.completed} / {c.trackable} {t('library.done')}
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
        <span className="text-cs-text-muted">{t('library.topics', { count: c.topic_count })}</span>
        <span className="inline-flex items-center gap-1 text-cs-primary group-hover:text-cs-cyan transition-colors">
          Browse <FiArrowRight />
        </span>
      </div>
      <MajorChips slugs={c.majors} />
    </Link>
  );
}

function Library() {
  const { t } = useTranslation();
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
    return <LibrarySkeleton />;
  }

  const isSearching = results !== null;

  return (
    <main className="w-full px-6 lg:px-10 py-8">
      {/* Sticky header — the whole thing (title, description, search and category
          filters) stays locked while the collections scroll beneath it. */}
      <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] lg:top-14 z-30 -mx-6 lg:-mx-10 px-6 lg:px-10 pt-4 pb-4 -mt-8 mb-6 bg-cs-dark/85 backdrop-blur-xl border-b border-cs-line/[0.07]">

        {/* Search (left) + category tabs (right) on one row to save header height. */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="relative w-full lg:max-w-md shrink-0">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-cs-text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('library.search_placeholder')}
              className="input w-full h-10 !py-0 pl-9 pr-9"
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
            <div className="flex gap-1.5 overflow-x-auto lg:ml-auto lg:justify-end -mx-1 px-1 pb-1 lg:pb-0">
              {['all', ...cats].map((k) => (
                <button
                  key={k}
                  onClick={() => setCat(k)}
                  className={`h-9 px-3.5 rounded-full text-sm whitespace-nowrap shrink-0 transition-colors ${
                    cat === k
                      ? 'bg-cs-overlay/[0.09] text-cs-text font-medium'
                      : 'text-cs-text-dim hover:text-cs-text hover:bg-cs-overlay/[0.06]'
                  }`}
                >
                  {k === 'all' ? t('library.all') : CAT_LABELS[k] || k}
                </button>
              ))}
            </div>
          )}
        </div>
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
              {resume.resuming ? t('library.continue_reading') : t('library.jump_back')}
            </p>
            <h2 className="text-xl font-bold truncate">{resume.title}</h2>
            <p className="text-sm text-cs-text-dim truncate">
              {resume.collection_title} <span className="text-cs-text-muted">·</span>{' '}
              {resume.position} of {resume.total} · {resume.reading_minutes} min
            </p>
          </div>
          <span className="inline-flex items-center gap-2 text-cs-primary font-semibold group-hover:text-cs-cyan transition-colors shrink-0 self-start sm:self-center">
            {resume.resuming ? t('library.continue') : t('library.reread')} <FiArrowRight />
          </span>
        </Link>
      )}

      {isSearching ? (
        <section>
          <h2 className="text-sm uppercase tracking-wider text-cs-text-muted mb-4">
            {searching
              ? 'Searching…'
              : `${results.length} result${results.length === 1 ? '' : 's'} for “${query.trim()}”`}
          </h2>

          {!searching && results.length === 0 && (
            <p className="text-sm text-cs-text-muted">
              {t('library.no_results')}
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
                    <span className="">{r.collection_title}</span>
                    {r.summary ? ` · ${r.summary}` : ''}
                  </div>
                </div>
                <span className="flex items-center gap-1 text-[0.6875rem] text-cs-text-muted shrink-0">
                  <FiClock /> {r.reading_minutes}m
                </span>
                <FiCornerDownLeft className="text-cs-text-muted group-hover:text-cs-primary transition-colors shrink-0" />
              </Link>
            ))}
          </div>
        </section>
      ) : cat !== 'all' ? (
        <section>
          <h2 className="text-sm uppercase tracking-wider text-cs-text-muted mb-4">
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
              <h2 className="text-sm uppercase tracking-wider text-cs-text-muted mb-4">
                {t('library.your_library', { major: majorData?.label })}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {forMajor.map((c) => (
                  <CollectionCard key={c.slug} c={c} forMajor />
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="text-sm uppercase tracking-wider text-cs-text-muted mb-4">
              {hasMajor ? t('library.all_collections') : t('library.collections')}
            </h2>
            {!hasMajor && (
              <p className="text-sm text-cs-text-muted mb-4">
                <Link to="/dashboard" className="text-cs-primary">
                  → {t('library.pick_major')}
                </Link>{' '}
                {t('library.pick_major_desc')}
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
