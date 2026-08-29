// Which Library shelves each major sees first, most relevant first.
// Mirrors backend/majors.py MAJOR_DOCS: the major's tracks + the standalone
// reference shelves. Slugs are DocCollection.slug values.

import { MAJORS } from './majors';

const STANDALONE_DOCS = ['version-control', 'dev-workflow'];

export const MAJOR_DOCS = Object.fromEntries(
  Object.entries(MAJORS).map(([key, m]) => [key, [...m.tracks, ...STANDALONE_DOCS]])
);

// Split a flat collection list into [forMajor, others] in the major's order.
export function partitionByMajor(collections, majorKey) {
  const order = MAJOR_DOCS[majorKey];
  if (!order) return [[], collections];

  const rank = new Map(order.map((slug, i) => [slug, i]));
  const forMajor = collections
    .filter((c) => rank.has(c.slug))
    .sort((a, b) => rank.get(a.slug) - rank.get(b.slug));
  const others = collections.filter((c) => !rank.has(c.slug));
  return [forMajor, others];
}
