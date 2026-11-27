import { useEffect } from 'react';

// Real names for URL segments, so the top-bar breadcrumb can show
// "PHP › Talking to a database with PDO" instead of "Php › Talking to a database with pdo".
// Pages register what they've loaded; the breadcrumb listens for changes.
const names = new Map();
const EVENT = 'cs:crumb-names';

export const crumbName = (segment) => names.get(decodeURIComponent(segment || ''));

export function setCrumbNames(map) {
  let changed = false;
  Object.entries(map || {}).forEach(([seg, label]) => {
    if (seg && label && names.get(seg) !== label) { names.set(seg, label); changed = true; }
  });
  if (changed) window.dispatchEvent(new Event(EVENT));
}

export const onCrumbNames = (fn) => {
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
};

/** In a page: useCrumbNames({ [slug]: title }) once the data has loaded. */
export function useCrumbNames(map) {
  const key = JSON.stringify(map || {});
  useEffect(() => { setCrumbNames(map); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
}
