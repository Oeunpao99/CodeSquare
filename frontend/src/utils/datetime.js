export const TZ = 'Asia/Phnom_Penh';

// Backend timestamps are stored/serialized as naive-UTC strings WITHOUT a
// timezone marker (e.g. "2026-09-01T05:00:00"). JS would otherwise parse those
// as *local* time — on a UTC+7 machine (Cambodia) a brand-new post then reads
// as 7 hours old. Anything lacking a zone suffix is treated as UTC.
function parseIso(iso) {
  if (!iso) return null;
  const hasZone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(iso.trim());
  const d = new Date(hasZone ? iso : `${iso}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(iso, opts = {}) {
  const d = parseIso(iso);
  if (!d) return '';
  return d.toLocaleDateString(undefined, {
    timeZone: TZ,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...opts,
  });
}

export function formatDateTime(iso) {
  const d = parseIso(iso);
  if (!d) return '';
  return d.toLocaleString(undefined, {
    timeZone: TZ,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function timeAgo(iso) {
  const d = parseIso(iso);
  if (!d) return '';
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return formatDate(iso);
}