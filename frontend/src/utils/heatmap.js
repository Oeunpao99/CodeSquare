// GitHub-style contribution grid built from REAL per-day counts
// ({ "2026-11-27": 3, ... } from /progress/activity or /community/users/:u/activity).
// Days with no activity stay empty — nothing is estimated or invented.

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const LEVEL_STYLES = ['bg-level-0', 'bg-level-1', 'bg-level-2', 'bg-level-3', 'bg-level-4'];

const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
// Monday-based weekday index (0 = Mon … 6 = Sun).
const monIndex = (date) => (date.getDay() + 6) % 7;
const levelFor = (v) => (v <= 0 ? 0 : v <= 1 ? 1 : v <= 3 ? 2 : v <= 6 ? 3 : 4);
const pad2 = (n) => String(n).padStart(2, '0');
const isoDay = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

export function buildYearGrid(days, year) {
  const counts = days || {};
  const today = startOfDay(new Date());
  // Grid spans the Monday on/before Jan 1 → the Sunday on/after Dec 31.
  const start = startOfDay(new Date(year, 0, 1));
  start.setDate(start.getDate() - monIndex(start));
  const end = startOfDay(new Date(year, 11, 31));
  end.setDate(end.getDate() + (6 - monIndex(end)));

  const grid = [];
  const monthLabel = [];
  let lastMonth = -1;
  let activeDays = 0;
  for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 7)) {
    const col = [];
    let firstInYear = null;
    for (let d = 0; d < 7; d++) {
      const date = new Date(cursor);
      date.setDate(date.getDate() + d);
      const inYear = date.getFullYear() === year;
      if (inYear && !firstInYear) firstInYear = date;
      const count = inYear ? counts[isoDay(date)] || 0 : 0;
      if (count > 0) activeDays += 1;
      col.push({
        level: levelFor(count),
        count,
        label: `${count} ${count === 1 ? 'activity' : 'activities'} on ${date.toDateString()}`,
        pad: !inYear,
        future: inYear && date > today,
        today: date.getTime() === today.getTime(),
      });
    }
    // Label a column with the month of its first in-year day (so the leading
    // December days of the previous year never print "Dec" over "Jan").
    const m = firstInYear ? firstInYear.getMonth() : -1;
    monthLabel.push(m !== -1 && m !== lastMonth ? m : null);
    if (m !== -1) lastMonth = m;
    grid.push(col);
  }
  return { grid, monthLabel, activeDays };
}
