// A small DAX interpreter for the Power BI practice panel. It evaluates the
// student's measures against the Lotus Bean dataset with real filter-context
// rules: visuals and slicers set filters, CALCULATE changes them, iterators
// (SUMX, RANKX…) create row context, and a measure inside row context does
// context transition. Not a full DAX engine; unsupported functions report
// themselves clearly instead of guessing.
import { TABLES, LOOKUP, FK, KEY } from './data';

export class DaxError extends Error {}
class RowContextError extends DaxError {}

// ------------------------------------------------------------------ lexer --
function lex(src) {
  const toks = [];
  let i = 0;
  const s = src;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if ((c === '/' && s[i + 1] === '/') || (c === '-' && s[i + 1] === '-')) { while (i < s.length && s[i] !== '\n') i++; continue; }
    if (c === '/' && s[i + 1] === '*') { const j = s.indexOf('*/', i + 2); i = j < 0 ? s.length : j + 2; continue; }
    if (c === '"') {
      let j = i + 1; let v = '';
      while (j < s.length) { if (s[j] === '"' && s[j + 1] === '"') { v += '"'; j += 2; continue; } if (s[j] === '"') break; v += s[j++]; }
      toks.push({ t: 'str', v }); i = j + 1; continue;
    }
    if (c === '[') { const j = s.indexOf(']', i); if (j < 0) throw new DaxError('Missing ]'); toks.push({ t: 'bracket', v: s.slice(i + 1, j).trim() }); i = j + 1; continue; }
    if (c === "'") { const j = s.indexOf("'", i + 1); if (j < 0) throw new DaxError("Missing closing '"); toks.push({ t: 'qident', v: s.slice(i + 1, j) }); i = j + 1; continue; }
    if (/[0-9.]/.test(c) && /[0-9]/.test(s[i + 1] ?? c)) { let j = i; while (j < s.length && /[0-9.]/.test(s[j])) j++; toks.push({ t: 'num', v: parseFloat(s.slice(i, j)) }); i = j; continue; }
    if (/[A-Za-z_]/.test(c)) { let j = i; while (j < s.length && /[A-Za-z0-9_.]/.test(s[j])) j++; toks.push({ t: 'ident', v: s.slice(i, j) }); i = j; continue; }
    const two = s.slice(i, i + 2);
    if (['<>', '<=', '>=', '&&', '||', '=='].includes(two)) { toks.push({ t: 'op', v: two === '==' ? '=' : two }); i += 2; continue; }
    if ('=<>+-*/&(),{}'.includes(c)) { toks.push({ t: 'op', v: c }); i++; continue; }
    throw new DaxError(`Unexpected character "${c}"`);
  }
  return toks;
}

// ----------------------------------------------------------------- parser --
function parse(src) {
  const toks = lex(src);
  let p = 0;
  const peek = (v) => toks[p] && toks[p].t === 'op' && toks[p].v === v;
  const eat = (v) => { if (!peek(v)) throw new DaxError(`Expected "${v}"${toks[p] ? ` near "${toks[p].v}"` : ' at the end'}`); p++; };

  const expr = () => orExpr();
  const orExpr = () => { let l = andExpr(); while (peek('||')) { p++; l = { k: 'bin', op: '||', l, r: andExpr() }; } return l; };
  const andExpr = () => { let l = cmp(); while (peek('&&')) { p++; l = { k: 'bin', op: '&&', l, r: cmp() }; } return l; };
  const cmp = () => {
    let l = add();
    while (toks[p] && toks[p].t === 'op' && ['=', '<>', '<', '>', '<=', '>='].includes(toks[p].v)) { const op = toks[p++].v; l = { k: 'bin', op, l, r: add() }; }
    if (toks[p] && toks[p].t === 'ident' && toks[p].v.toUpperCase() === 'IN') { p++; l = { k: 'in', l, r: primary() }; }
    return l;
  };
  const add = () => { let l = mul(); while (peek('+') || peek('-') || peek('&')) { const op = toks[p++].v; l = { k: 'bin', op, l, r: mul() }; } return l; };
  const mul = () => { let l = unary(); while (peek('*') || peek('/')) { const op = toks[p++].v; l = { k: 'bin', op, l, r: unary() }; } return l; };
  const unary = () => { if (peek('-')) { p++; return { k: 'neg', e: unary() }; } if (peek('+')) { p++; return unary(); } return primary(); };
  const primary = () => {
    const tk = toks[p];
    if (!tk) throw new DaxError('The formula ends too early');
    if (tk.t === 'num') { p++; return { k: 'lit', v: tk.v }; }
    if (tk.t === 'str') { p++; return { k: 'lit', v: tk.v }; }
    if (tk.t === 'bracket') { p++; return { k: 'meas', name: tk.v }; }
    if (tk.t === 'op' && tk.v === '(') { p++; const e = expr(); eat(')'); return e; }
    if (tk.t === 'op' && tk.v === '{') {
      p++; const items = [];
      if (!peek('}')) { items.push(expr()); while (peek(',')) { p++; items.push(expr()); } }
      eat('}'); return { k: 'list', items };
    }
    if (tk.t === 'qident' || tk.t === 'ident') {
      p++;
      if (toks[p] && toks[p].t === 'bracket') { const col = toks[p++].v; return { k: 'col', table: tk.v, col }; }
      if (tk.t === 'ident' && peek('(')) {
        p++; const args = [];
        if (!peek(')')) {
          for (;;) {
            if (peek(',')) { args.push({ k: 'empty' }); p++; continue; }
            args.push(expr());
            if (peek(',')) { p++; if (peek(')')) args.push({ k: 'empty' }); continue; }
            break;
          }
        }
        eat(')');
        return { k: 'call', name: tk.v.toUpperCase(), args };
      }
      const up = tk.v.toUpperCase();
      if (up === 'TRUE') return { k: 'lit', v: true };
      if (up === 'FALSE') return { k: 'lit', v: false };
      if (up === 'ASC' || up === 'DESC') return { k: 'order', v: up };
      return { k: 'table', table: tk.v };
    }
    throw new DaxError(`Unexpected "${tk.v}"`);
  };
  const tree = expr();
  if (p < toks.length) throw new DaxError(`Unexpected "${toks[p].v}"`);
  return tree;
}

// ------------------------------------------------------- data + contexts --
const tableName = (t) => {
  const hit = Object.keys(TABLES).find((k) => k.toLowerCase() === String(t).toLowerCase());
  if (!hit) throw new DaxError(`There's no table named '${t}'. Tables: ${Object.keys(TABLES).join(', ')}`);
  return hit;
};
const colName = (table, c) => {
  const row = TABLES[table][0] || {};
  const hit = Object.keys(row).find((k) => k.toLowerCase() === String(c).toLowerCase());
  if (!hit) throw new DaxError(`Column '${c}' isn't in ${table}. Columns: ${Object.keys(row).join(', ')}`);
  return hit;
};

// A filter context is a list of { table, col, test } plus an optional RLS set.
const fkey = (f) => `${f.table}|${f.col}`;

function rowPasses(table, row, ctx) {
  for (const f of ctx.filters) {
    if (f.table === table) { if (!f.test(row[f.col])) return false; }
    else if (table === 'Sales' && LOOKUP[f.table]) {
      const dim = LOOKUP[f.table][row[FK[f.table]]];
      if (!dim || !f.test(dim[f.col])) return false;
    }
  }
  if (ctx.rls) {
    if (ctx.rls.table === table) { if (!ctx.rls.keys.has(row[KEY[table]])) return false; }
    else if (table === 'Sales' && ctx.rls.table !== 'Sales') { if (!ctx.rls.keys.has(row[FK[ctx.rls.table]])) return false; }
  }
  return true;
}

const rowsOf = (table, ctx) => TABLES[table].filter((r) => rowPasses(table, r, ctx));

const withFilters = (ctx, filters) => ({ ...ctx, filters, row: null });
const dropFilters = (filters, pred) => filters.filter((f) => !pred(f));

// Context transition: the current row becomes filters.
function transition(ctx) {
  if (!ctx.row) return ctx;
  const { table, row, cols } = ctx.row;
  let filters = ctx.filters;
  if (cols) {
    cols.forEach((c) => { filters = dropFilters(filters, (f) => f.table === table && f.col === c); filters = [...filters, { table, col: c, test: (v) => v === row[c] }]; });
  } else {
    const k = KEY[table];
    filters = dropFilters(filters, (f) => f.table === table);
    filters = [...filters, { table, col: k, test: (v) => v === row[k] }];
  }
  return withFilters(ctx, filters);
}

// --------------------------------------------------------------- helpers --
const num = (v) => (v === null || v === undefined || v === '' ? 0 : typeof v === 'boolean' ? (v ? 1 : 0) : Number(v));
const truthy = (v) => !!(v && v !== 0);
const isTable = (v) => v && v.k === 'tableval';
const agg = (vals, fn) => { const xs = vals.filter((v) => v !== null && v !== undefined && v !== ''); return xs.length ? fn(xs) : null; };
const AGG = {
  SUM: (xs) => xs.reduce((a, b) => a + num(b), 0),
  AVERAGE: (xs) => xs.reduce((a, b) => a + num(b), 0) / xs.length,
  MIN: (xs) => xs.reduce((a, b) => (b < a ? b : a)),
  MAX: (xs) => xs.reduce((a, b) => (b > a ? b : a)),
  COUNT: (xs) => xs.length,
  DISTINCTCOUNT: (xs) => new Set(xs).size,
};

function shiftYear(d, n) {
  const [y, m, day] = d.split('-').map(Number);
  const ny = y + n;
  const last = new Date(ny, m, 0).getDate();
  return `${ny}-${String(m).padStart(2, '0')}-${String(Math.min(day, last)).padStart(2, '0')}`;
}

// ------------------------------------------------------------ evaluator --
export function makeEngine(measures, opts = {}) {
  const parsed = {};
  const getMeasure = (name) => {
    const key = Object.keys(measures).find((k) => k.toLowerCase() === name.toLowerCase());
    if (!key) return null;
    if (!parsed[key]) parsed[key] = parse(measures[key]);
    return parsed[key];
  };
  let depth = 0;

  function evalTable(n, ctx) {
    if (n.k === 'table') { const t = tableName(n.table); return { k: 'tableval', table: t, rows: rowsOf(t, ctx) }; }
    if (n.k === 'call') {
      const v = evaluate(n, ctx);
      if (isTable(v)) return v;
    }
    throw new DaxError('Expected a table here (e.g. Sales, ALL(Products), FILTER(...))');
  }

  function datesInContext(ctx) {
    const dateFilters = ctx.filters.filter((f) => f.table === 'Date');
    return TABLES.Date.filter((r) => dateFilters.every((f) => f.test(r[f.col]))).map((r) => r.Date);
  }

  // Turn one CALCULATE filter argument into a change of the filter list.
  function applyFilterArg(arg, ctx, filters) {
    if (arg.k === 'call' && ['ALL', 'REMOVEFILTERS', 'ALLSELECTED'].includes(arg.name)) {
      if (!arg.args.length) return [];
      for (const a of arg.args) {
        if (a.k === 'table') { const t = tableName(a.table); filters = dropFilters(filters, (f) => f.table === t); }
        else if (a.k === 'col') { const t = tableName(a.table); const c = colName(t, a.col); filters = dropFilters(filters, (f) => f.table === t && f.col === c); }
      }
      return filters;
    }
    if (arg.k === 'call' && arg.name === 'ALLEXCEPT') {
      const t = tableName(arg.args[0].table);
      const keep = new Set(arg.args.slice(1).map((a) => colName(t, a.col)));
      return dropFilters(filters, (f) => f.table === t && !keep.has(f.col));
    }
    if (arg.k === 'call' && (arg.name === 'SAMEPERIODLASTYEAR' || arg.name === 'DATEADD' || arg.name === 'DATESYTD' || arg.name === 'PREVIOUSYEAR')) {
      const dates = datesInContext({ ...ctx, filters });
      let set;
      if (arg.name === 'DATESYTD') {
        const max = dates[dates.length - 1];
        if (!max) return filters;
        const y = max.slice(0, 4);
        set = new Set(TABLES.Date.map((r) => r.Date).filter((d) => d.startsWith(y) && d <= max));
      } else if (arg.name === 'PREVIOUSYEAR') {
        const max = dates[dates.length - 1];
        const y = String(Number((max || '2026').slice(0, 4)) - 1);
        set = new Set(TABLES.Date.map((r) => r.Date).filter((d) => d.startsWith(y)));
      } else {
        let n = -1;
        if (arg.name === 'DATEADD') {
          n = num(evaluate(arg.args[1], ctx));
          const unit = arg.args[2]?.k === 'table' ? arg.args[2].table.toUpperCase() : 'YEAR';
          if (unit !== 'YEAR') throw new DaxError('This preview supports DATEADD(…, n, YEAR).');
        }
        set = new Set(dates.map((d) => shiftYear(d, n)));
      }
      filters = dropFilters(filters, (f) => f.table === 'Date');
      return [...filters, { table: 'Date', col: 'Date', test: (v) => set.has(v) }];
    }
    if (arg.k === 'call' && (arg.name === 'FILTER' || arg.name === 'VALUES' || arg.name === 'KEEPFILTERS')) {
      if (arg.name === 'KEEPFILTERS') {
        const before = filters;
        const changed = applyFilterArg(arg.args[0], ctx, filters);
        return [...before, ...changed.filter((f) => !before.includes(f))];
      }
      const tv = evaluate(arg, { ...ctx, filters, row: null });
      if (tv.cols) {
        const c = tv.cols[0];
        const set = new Set(tv.rows.map((r) => r[c]));
        filters = dropFilters(filters, (f) => f.table === tv.table && f.col === c);
        return [...filters, { table: tv.table, col: c, test: (v) => set.has(v) }];
      }
      const k = KEY[tv.table];
      const set = new Set(tv.rows.map((r) => r[k]));
      filters = dropFilters(filters, (f) => f.table === tv.table);
      return [...filters, { table: tv.table, col: k, test: (v) => set.has(v) }];
    }
    // Boolean filter on one column: Products[Category] = "Coffee", Sales[Quantity] >= 50 …
    const cols = [];
    const walk = (x) => { if (!x || typeof x !== 'object') return; if (x.k === 'col') cols.push(x); Object.values(x).forEach((v) => (Array.isArray(v) ? v.forEach(walk) : typeof v === 'object' && walk(v))); };
    walk(arg);
    const uniq = [...new Set(cols.map((c) => `${tableName(c.table)}|${colName(tableName(c.table), c.col)}`))];
    if (uniq.length === 1) {
      const [t, c] = uniq[0].split('|');
      const test = (v) => truthy(evaluate(arg, { ...ctx, filters: [], row: { table: t, row: { [c]: v }, cols: [c] } }));
      filters = dropFilters(filters, (f) => f.table === t && f.col === c);
      return [...filters, { table: t, col: c, test }];
    }
    if (uniq.length > 1) throw new DaxError('A filter can only use one column here. Wrap it in FILTER(…) for more.');
    throw new DaxError('This CALCULATE filter isn’t supported in the preview.');
  }

  function evaluate(n, ctx) {
    switch (n.k) {
      case 'lit': return n.v;
      case 'empty': return null;
      case 'order': return n.v;
      case 'list': return { k: 'listval', items: n.items.map((x) => evaluate(x, ctx)) };
      case 'neg': return -num(evaluate(n.e, ctx));
      case 'table': return evalTable(n, ctx);
      case 'in': {
        const l = evaluate(n.l, ctx); const r = evaluate(n.r, ctx);
        return (r.items || []).includes(l);
      }
      case 'col': {
        const t = tableName(n.table); const c = colName(t, n.col);
        if (ctx.row && ctx.row.table === t) return ctx.row.row[c];
        throw new RowContextError(`A single value for column '${c}' in table '${t}' can't be determined. Use it inside an aggregation (SUM, SUMX…) or a calculated column.`);
      }
      case 'meas': {
        if (ctx.row && Object.prototype.hasOwnProperty.call(ctx.row.row, n.name)) return ctx.row.row[n.name];
        const tree = getMeasure(n.name);
        if (!tree) throw new DaxError(`There's no measure named [${n.name}]. Available: ${Object.keys(measures).map((m) => `[${m}]`).join(', ')}`);
        if (++depth > 40) throw new DaxError('A measure refers to itself.');
        try { return evaluate(tree, transition(ctx)); } finally { depth--; }
      }
      case 'bin': {
        if (n.op === '&&') return truthy(evaluate(n.l, ctx)) && truthy(evaluate(n.r, ctx));
        if (n.op === '||') return truthy(evaluate(n.l, ctx)) || truthy(evaluate(n.r, ctx));
        const l = evaluate(n.l, ctx); const r = evaluate(n.r, ctx);
        switch (n.op) {
          case '+': return num(l) + num(r);
          case '-': return num(l) - num(r);
          case '*': return num(l) * num(r);
          case '/': if (num(r) === 0) return Infinity; return num(l) / num(r);
          case '&': return `${l ?? ''}${r ?? ''}`;
          case '=': return l == r || (l === null && (r === 0 || r === '')) || (r === null && (l === 0 || l === '')); // eslint-disable-line eqeqeq
          case '<>': return !(l == r); // eslint-disable-line eqeqeq
          case '<': return l < r;
          case '>': return l > r;
          case '<=': return l <= r;
          case '>=': return l >= r;
          default: throw new DaxError(`Unknown operator ${n.op}`);
        }
      }
      case 'call': return callFn(n, ctx);
      default: throw new DaxError('Unsupported expression');
    }
  }

  function colArg(a) {
    if (!a || a.k !== 'col') throw new DaxError('Expected a column like Sales[Amount]');
    const t = tableName(a.table); return { t, c: colName(t, a.col) };
  }

  function iterate(tv, ctx, fn) {
    return tv.rows.map((row) => fn({ ...ctx, row: { table: tv.table, row, cols: tv.cols } }));
  }

  function callFn(n, ctx) {
    const a = n.args;
    const N = n.name;
    if (AGG[N] && a.length === 1 && a[0].k === 'col') {
      const { t, c } = colArg(a[0]);
      const base = ctx.row ? transition(ctx) : ctx;
      return agg(rowsOf(t, base).map((r) => r[c]), AGG[N]);
    }
    if ((N === 'MAX' || N === 'MIN') && a.length === 2) {
      const x = num(evaluate(a[0], ctx)); const y = num(evaluate(a[1], ctx));
      return N === 'MAX' ? Math.max(x, y) : Math.min(x, y);
    }
    switch (N) {
      case 'COUNTROWS': { const base = ctx.row ? transition(ctx) : ctx; const tv = a.length ? evalTable(a[0], base) : null; if (!tv) throw new DaxError('COUNTROWS needs a table'); return tv.rows.length || null; }
      case 'SUMX': case 'AVERAGEX': case 'MINX': case 'MAXX': case 'COUNTX': {
        const tv = evalTable(a[0], ctx.row ? transition(ctx) : ctx);
        const vals = iterate(tv, ctx, (rc) => evaluate(a[1], rc));
        const f = { SUMX: 'SUM', AVERAGEX: 'AVERAGE', MINX: 'MIN', MAXX: 'MAX', COUNTX: 'COUNT' }[N];
        return agg(vals, AGG[f]);
      }
      case 'CALCULATE': case 'CALCULATETABLE': {
        let filters = (ctx.row ? transition(ctx) : ctx).filters;
        const base = { ...ctx, row: null };
        for (const arg of a.slice(1)) filters = applyFilterArg(arg, base, filters);
        return evaluate(a[0], { ...ctx, filters, row: null });
      }
      case 'TOTALYTD': {
        const filters = applyFilterArg({ k: 'call', name: 'DATESYTD', args: [a[1]] }, { ...ctx, row: null }, ctx.filters);
        return evaluate(a[0], { ...ctx, filters, row: null });
      }
      case 'SAMEPERIODLASTYEAR': case 'DATEADD': case 'DATESYTD':
        throw new DaxError(`${N} returns a set of dates: use it inside CALCULATE, e.g. CALCULATE([Total Sales], ${N}('Date'[Date]))`);
      case 'ALL': case 'REMOVEFILTERS': case 'ALLSELECTED': {
        if (!a.length) throw new DaxError('ALL() on its own only works inside CALCULATE');
        if (a[0].k === 'table') { const t = tableName(a[0].table); return { k: 'tableval', table: t, rows: TABLES[t] }; }
        const { t, c } = colArg(a[0]);
        const seen = new Set(); const rows = [];
        TABLES[t].forEach((r) => { if (!seen.has(r[c])) { seen.add(r[c]); rows.push({ [c]: r[c] }); } });
        return { k: 'tableval', table: t, rows, cols: [c] };
      }
      case 'VALUES': case 'DISTINCT': {
        if (a[0].k === 'table') return evalTable(a[0], ctx);
        const { t, c } = colArg(a[0]);
        const seen = new Set(); const rows = [];
        const src = t === 'Sales' ? rowsOf('Sales', ctx) : rowsOf(t, ctx).filter((r) => rowsOf('Sales', ctx).some((s) => LOOKUP[t] && s[FK[t]] === r[KEY[t]]) || !LOOKUP[t]);
        src.forEach((r) => { if (!seen.has(r[c])) { seen.add(r[c]); rows.push({ [c]: r[c] }); } });
        return { k: 'tableval', table: t, rows, cols: [c] };
      }
      case 'FILTER': {
        const tv = evalTable(a[0], ctx);
        const rows = tv.rows.filter((row) => truthy(evaluate(a[1], { ...ctx, row: { table: tv.table, row, cols: tv.cols } })));
        return { ...tv, rows };
      }
      case 'RELATED': {
        const { t, c } = colArg(a[0]);
        if (!ctx.row) throw new RowContextError('RELATED works row by row: use it in a calculated column or inside SUMX/FILTER.');
        if (ctx.row.table === t) return ctx.row.row[c];
        if (ctx.row.table !== 'Sales' || !LOOKUP[t]) throw new DaxError(`There's no relationship from ${ctx.row.table} to ${t}.`);
        const dim = LOOKUP[t][ctx.row.row[FK[t]]];
        return dim ? dim[c] : null;
      }
      case 'RANKX': {
        const tv = evalTable(a[0], { ...ctx, row: null });
        const order = a[3] && a[3].k === 'order' ? a[3].v : 'DESC';
        const cur = a[2] && a[2].k !== 'empty' ? num(evaluate(a[2], ctx)) : num(evaluate(a[1], ctx));
        const vals = iterate(tv, { ...ctx, row: null }, (rc) => num(evaluate(a[1], transition(rc))));
        return 1 + vals.filter((v) => (order === 'ASC' ? v < cur : v > cur)).length;
      }
      case 'DIVIDE': {
        const d = num(evaluate(a[1], ctx));
        if (!d) return a[2] && a[2].k !== 'empty' ? evaluate(a[2], ctx) : null;
        return num(evaluate(a[0], ctx)) / d;
      }
      case 'IF': return truthy(evaluate(a[0], ctx)) ? evaluate(a[1], ctx) : (a[2] ? evaluate(a[2], ctx) : null);
      case 'SWITCH': {
        const v = evaluate(a[0], ctx);
        for (let i = 1; i + 1 < a.length; i += 2) { if (evaluate(a[i], ctx) === v) return evaluate(a[i + 1], ctx); }
        return a.length % 2 === 0 ? evaluate(a[a.length - 1], ctx) : null;
      }
      case 'AND': return truthy(evaluate(a[0], ctx)) && truthy(evaluate(a[1], ctx));
      case 'OR': return truthy(evaluate(a[0], ctx)) || truthy(evaluate(a[1], ctx));
      case 'NOT': return !truthy(evaluate(a[0], ctx));
      case 'BLANK': return null;
      case 'ISBLANK': { const v = evaluate(a[0], ctx); return v === null || v === undefined || v === ''; }
      case 'TRUE': return true;
      case 'FALSE': return false;
      case 'ROUND': { const f = 10 ** num(evaluate(a[1] || { k: 'lit', v: 0 }, ctx)); return Math.round(num(evaluate(a[0], ctx)) * f) / f; }
      case 'ABS': return Math.abs(num(evaluate(a[0], ctx)));
      case 'INT': return Math.floor(num(evaluate(a[0], ctx)));
      case 'YEAR': return Number(String(evaluate(a[0], ctx)).slice(0, 4));
      case 'MONTH': return Number(String(evaluate(a[0], ctx)).slice(5, 7));
      case 'HASONEVALUE': { const { t, c } = colArg(a[0]); return new Set(rowsOf(t, ctx).map((r) => r[c])).size === 1; }
      case 'SELECTEDVALUE': {
        const { t, c } = colArg(a[0]);
        const vals = [...new Set(rowsOf(t, ctx).map((r) => r[c]))];
        return vals.length === 1 ? vals[0] : (a[1] ? evaluate(a[1], ctx) : null);
      }
      case 'USERPRINCIPALNAME': case 'USERNAME': return opts.user || 'dara@lotusbean.example';
      case 'FORMAT': { const v = evaluate(a[0], ctx); return String(v); }
      default:
        throw new DaxError(`${N}() isn't supported in this preview yet. Your answer is still checked when you press Run.`);
    }
  }

  return {
    evaluate: (src, filters = [], extra = {}) => evaluate(parse(src), { filters, row: null, ...extra }),
    evaluateMeasure: (name, filters = [], extra = {}) => {
      const tree = getMeasure(name);
      if (!tree) throw new DaxError(`No measure [${name}]`);
      return evaluate(tree, { filters, row: null, ...extra });
    },
    evaluateRow: (src, table, row) => evaluate(parse(src), { filters: [], row: { table, row } }),
    rowsOf: (table, filters = [], extra = {}) => rowsOf(table, { filters, ...extra }),
  };
}

// Built-in measures that the lessons refer to.
export const BASE_MEASURES = {
  'Total Sales': 'SUM(Sales[Amount])',
  'Total Quantity': 'SUM(Sales[Quantity])',
  'Total Cost': 'SUMX(Sales, Sales[Quantity] * Sales[Unit Cost])',
  Orders: 'DISTINCTCOUNT(Sales[OrderID])',
  Profit: '[Total Sales] - [Total Cost]',
};

// Split the editor text into definitions:  Name = expression  (one or many).
// A line like  [RepEmail] = USERPRINCIPALNAME()  is a row-level security rule.
export function splitDefinitions(code) {
  const clean = code.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.replace(/(\/\/|--).*$/, '')).join('\n');
  const defs = [];
  let cur = null;
  let depth = 0;
  for (const line of clean.split('\n')) {
    const m = depth === 0 && line.match(/^\s*([A-Za-z_][A-Za-z0-9_ %]*?)\s*=(?!=)(.*)$/);
    const rls = depth === 0 && line.match(/^\s*\[[^\]]+\]\s*=/);
    if (rls) { cur = { name: null, rls: true, expr: line.trim() }; defs.push(cur); }
    else if (m) { cur = { name: m[1].trim(), expr: m[2] }; defs.push(cur); }
    else if (cur) cur.expr += `\n${line}`;
    for (const ch of line.replace(/"[^"]*"/g, '')) { if (ch === '(') depth++; if (ch === ')') depth = Math.max(0, depth - 1); }
  }
  return defs.filter((d) => d.expr.trim());
}

export function isRowContextError(e) { return e instanceof RowContextError; }
