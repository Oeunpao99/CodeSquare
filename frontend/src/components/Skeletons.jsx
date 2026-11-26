import React from 'react';

/**
 * Skeleton loading placeholders — grey shapes in the layout of the real page,
 * with a soft shimmer (`.skeleton` in styles/index.css). Used instead of a
 * spinner so the page doesn't jump when content arrives.
 */
export function Sk({ className = '', style }) {
  return <div aria-hidden="true" style={style} className={`skeleton rounded-lg ${className}`} />;
}

function Screen({ children, label = 'Loading' }) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className="w-full px-6 lg:px-10 py-8 animate-route-fade">
      {children}
      <span className="sr-only">{label}…</span>
    </div>
  );
}

function PageHeader({ withIcon = false }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-4">
        {withIcon && <Sk className="w-14 h-14 rounded-2xl shrink-0" />}
        <div className="flex-1 space-y-3">
          <Sk className="h-3 w-24" />
          <Sk className="h-8 w-2/3 max-w-md" />
        </div>
      </div>
      <Sk className="h-4 w-full max-w-2xl mt-5" />
      <Sk className="h-4 w-4/5 max-w-xl mt-2" />
    </div>
  );
}

/** A Library shelf / course card: 3:2 image, title, two text lines, progress. */
export function CardSkeleton() {
  return (
    <div className="card overflow-hidden flex flex-col">
      <Sk className="-mx-6 -mt-6 mb-4 w-[calc(100%+3rem)] aspect-[3/2] rounded-none" />
      <div className="flex items-center gap-3">
        <Sk className="w-10 h-10 rounded-xl shrink-0" />
        <Sk className="h-5 w-1/2" />
      </div>
      <Sk className="h-3.5 w-full mt-4" />
      <Sk className="h-3.5 w-3/4 mt-2" />
      <Sk className="h-1.5 w-full mt-6 rounded-full" />
    </div>
  );
}

function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3.5 py-2.5">
      <Sk className="w-14 aspect-[3/2] rounded-md shrink-0" />
      <div className="flex-1 space-y-2">
        <Sk className="h-3.5 w-2/3" />
        <Sk className="h-3 w-1/2" />
      </div>
      <Sk className="h-3 w-8 shrink-0" />
    </div>
  );
}

/** /library */
export function LibrarySkeleton() {
  return (
    <Screen label="Loading library">
      <PageHeader />
      <Sk className="h-11 w-full max-w-xl rounded-xl mb-8" />
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
      </div>
    </Screen>
  );
}

/** /library/:collection */
export function CollectionSkeleton() {
  return (
    <Screen label="Loading shelf">
      <Sk className="h-4 w-28 mb-6" />
      <PageHeader withIcon />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-cs-line/10 overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3">
              <Sk className="w-8 h-8 rounded-full shrink-0" />
              <Sk className="h-4 w-40" />
              <Sk className="h-1.5 w-16 ml-auto rounded-full" />
            </div>
            <div className="grid md:grid-cols-2 border-t border-cs-line/10">
              {Array.from({ length: 4 }).map((__, j) => <RowSkeleton key={j} />)}
            </div>
          </div>
        ))}
      </div>
    </Screen>
  );
}

/** /library/:collection/:topic */
export function ArticleSkeleton() {
  return (
    <Screen label="Loading article">
      <div className="max-w-3xl">
        <Sk className="h-4 w-40 mb-6" />
        <Sk className="w-full aspect-[5/1] rounded-2xl mb-8" />
        <Sk className="h-9 w-3/4 mb-4" />
        <Sk className="h-4 w-1/3 mb-10" />
        {[100, 96, 88, 92, 60].map((w, i) => (
          <Sk key={i} className="h-4 mb-3" style={{ width: `${w}%` }} />
        ))}
        <Sk className="h-40 w-full rounded-xl my-8" />
        {[94, 85, 70].map((w, i) => (
          <Sk key={i} className="h-4 mb-3" style={{ width: `${w}%` }} />
        ))}
      </div>
    </Screen>
  );
}

/** /dashboard (Learn) */
export function DashboardSkeleton() {
  return (
    <Screen label="Loading dashboard">
      <div className="card flex items-center gap-4 mb-10">
        <Sk className="w-14 h-14 rounded-2xl shrink-0" />
        <div className="flex-1 space-y-2.5">
          <Sk className="h-3 w-20" />
          <Sk className="h-6 w-48" />
          <div className="flex gap-2 pt-1">
            {Array.from({ length: 4 }).map((_, i) => <Sk key={i} className="h-6 w-24 rounded-full" />)}
          </div>
        </div>
      </div>
      <Sk className="h-7 w-56 mb-3" />
      <Sk className="h-4 w-80 mb-8" />
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card">
            <div className="flex items-center gap-3 mb-4">
              <Sk className="w-12 h-12 rounded-xl shrink-0" />
              <Sk className="h-5 w-1/2" />
            </div>
            <Sk className="h-3.5 w-full" />
            <Sk className="h-3.5 w-2/3 mt-2" />
            <Sk className="h-1.5 w-full mt-6 rounded-full" />
          </div>
        ))}
      </div>
    </Screen>
  );
}

/** /learn/:slug (a course and its modules) */
export function CourseSkeleton() {
  return (
    <Screen label="Loading course">
      <Sk className="h-4 w-28 mb-6" />
      <PageHeader withIcon />
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card">
            <div className="flex items-center gap-4">
              <Sk className="w-10 h-10 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Sk className="h-5 w-1/3" />
                <Sk className="h-3.5 w-1/2" />
              </div>
              <Sk className="h-6 w-20 rounded-full" />
            </div>
            <div className="mt-4 space-y-2 pl-14">
              <Sk className="h-10 w-full rounded-lg" />
              <Sk className="h-10 w-full rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </Screen>
  );
}

/** /learn/:slug/module/:id/lesson/:id — lesson text + code panel */
export function LessonSkeleton() {
  return (
    <Screen label="Loading lesson">
      <Sk className="h-4 w-40 mb-6" />
      <Sk className="h-8 w-1/2 mb-8" />
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card space-y-3">
          {[100, 94, 88, 97, 72].map((w, i) => (
            <Sk key={i} className="h-4" style={{ width: `${w}%` }} />
          ))}
          <Sk className="h-36 w-full rounded-xl !my-6" />
          {[90, 80, 65].map((w, i) => (
            <Sk key={i} className="h-4" style={{ width: `${w}%` }} />
          ))}
        </div>
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <Sk className="h-4 w-24" />
            <Sk className="h-9 w-24 rounded-lg" />
          </div>
          <Sk className="h-80 w-full rounded-xl" />
        </div>
      </div>
    </Screen>
  );
}
