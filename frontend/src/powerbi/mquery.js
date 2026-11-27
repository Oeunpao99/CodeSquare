// Power Query (M) preview for the practice panel: turns the student's query into
// "Applied steps" and shows the table after each step, like the Power Query
// Editor. Supports the transforms the lessons teach; anything else is listed as a
// step that passes data through unchanged, with a note.
import { TABLES } from './data';

const PARAMS = { RangeStart: '2026-01-01', RangeEnd: '2026-04-01' };

// Raw-looking sources: before types are set, everything is text ("ABC").
const asText = (rows) => rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v === null ? null : String(v)])));
const typesOf = (rows, t = 'any') => Object.fromEntries(Object.keys(rows[0] || {}).map((k) => [k, t]));

function salesFor(year) {
  const rows = TABLES.Sales.filter((r) => r.OrderDate.startsWith(String(year)));
  if (rows.length) return rows;
  // Older years aren't in the dataset: derive a plausible one from the next year.
  return TABLES.Sales.filter((r) => r.OrderDate.startsWith(String(year + 1)))
    .map((r) => ({ ...r, OrderID: r.OrderID - 9000, OrderDate: `${year}${r.OrderDate.slice(4)}`, Quantity: Math.max(1, Math.round(r.Quantity * 0.85)) }))
    .map((r) => ({ ...r, Amount: Math.round(r.Quantity * r['Unit Price'] * 100) / 100 }));
}

function sourceFor(name) {
  const m = /^Sales_(\d{4})$/i.exec(name);
  if (m) { const rows = salesFor(Number(m[1])); return { rows: asText(rows), types: typesOf(rows) }; }
  const t = Object.keys(TABLES).find((k) => k.toLowerCase() === name.toLowerCase());
  if (t) return { rows: asText(TABLES[t]), types: typesOf(TABLES[t]) };
  return { rows: asText(TABLES.Sales), types: typesOf(TABLES.Sales) };
}

// ------------------------------------------------------- split into steps --
function topLevelSplit(s, sep = ',') {
  const out = []; let depth = 0; let q = false; let cur = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '"') q = !q;
    if (!q) { if ('([{'.includes(c)) depth++; if (')]}'.includes(c)) depth--; }
    if (!q && depth === 0 && c === sep) { out.push(cur); cur = ''; } else cur += c;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

export function parseSteps(code) {
  const src = code.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const letM = /\blet\b([\s\S]*?)\bin\b\s*([#\w"]+)?/i.exec(src);
  const body = letM ? letM[1] : src;
  const parts = letM ? topLevelSplit(body) : body.split(/\n(?=\s*[#A-Za-z_"][^=\n]*=)/);
  const steps = [];
  for (const part of parts) {
    const m = /^\s*(#"[^"]+"|[A-Za-z_][\w]*)\s*=\s*([\s\S]+)$/.exec(part.trim());
    if (m) steps.push({ name: m[1].replace(/^#"|"$/g, ''), expr: m[2].trim().replace(/,\s*$/, '') });
  }
  return steps;
}

// ------------------------------------------------- tiny `each` evaluator --
function evalEach(expr, row) {
  let e = expr.trim();
  const ifm = /^if\s+([\s\S]+?)\s+then\s+([\s\S]+?)\s+else\s+([\s\S]+)$/i.exec(e);
  if (ifm) return evalEach(ifm[1], row) ? evalEach(ifm[2], row) : evalEach(ifm[3], row);
  for (const op of [' and ', ' or ']) {
    const i = e.toLowerCase().indexOf(op);
    if (i > 0) { const l = evalEach(e.slice(0, i), row); const r = evalEach(e.slice(i + op.length), row); return op === ' and ' ? l && r : l || r; }
  }
  const cm = /^([\s\S]+?)\s*(>=|<=|<>|=|>|<)\s*([\s\S]+)$/.exec(e);
  if (cm) {
    const l = evalEach(cm[1], row); const r = evalEach(cm[3], row);
    const L = typeof l === 'number' || typeof r === 'number' ? Number(l) : l;
    const R = typeof l === 'number' || typeof r === 'number' ? Number(r) : r;
    return { '>=': L >= R, '<=': L <= R, '<>': L !== R, '=': L === R, '>': L > R, '<': L < R }[cm[2]];
  }
  const am = /^([\s\S]+?)\s*([+\-*/&])\s*([\s\S]+)$/.exec(e);
  if (am && !/^"/.test(e)) {
    const l = evalEach(am[1], row); const r = evalEach(am[3], row);
    if (am[2] === '&') return `${l}${r}`;
    return { '+': Number(l) + Number(r), '-': Number(l) - Number(r), '*': Number(l) * Number(r), '/': Number(l) / Number(r) }[am[2]];
  }
  e = e.replace(/^\(|\)$/g, '');
  const col = /^\[([^\]]+)\]$/.exec(e);
  if (col) { const v = row[col[1]]; return v !== null && v !== '' && !Number.isNaN(Number(v)) && !/^\d{4}-/.test(v) ? Number(v) : v; }
  const str = /^"([\s\S]*)"$/.exec(e);
  if (str) return str[1];
  if (/^-?\d+(\.\d+)?$/.test(e)) return Number(e);
  if (PARAMS[e]) return PARAMS[e];
  const dt = /^#date\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(e);
  if (dt) return `${dt[1]}-${dt[2].padStart(2, '0')}-${dt[3].padStart(2, '0')}`;
  throw new Error(`Can't preview "${e}"`);
}

const pairs = (s) => [...s.matchAll(/\{\s*"([^"]+)"\s*,\s*("([^"]*)"|type\s+(\w+)|Int64\.Type)\s*\}/g)]
  .map((m) => [m[1], m[3] ?? (m[4] || 'number')]);
const names = (s) => [...s.matchAll(/"([^"]+)"/g)].map((m) => m[1]);

const TYPE_FROM_M = { number: 'num', text: 'text', date: 'date', datetime: 'date', logical: 'text', Int64: 'int', any: 'any' };

function convert(v, t) {
  if (v === null || v === undefined) return v;
  if (t === 'num' || t === 'int') { const n = Number(v); return Number.isNaN(n) ? 'Error' : n; }
  if (t === 'date') return /^\d{4}-\d{2}-\d{2}/.test(String(v)) ? String(v).slice(0, 10) : 'Error';
  return String(v);
}

// Run each step; returns [{ name, expr, rows, types, note }]
export function runQuery(code) {
  const steps = parseSteps(code);
  const env = {};
  const out = [];
  const get = (n) => env[n] || sourceFor(n);

  // A snippet that starts from an undefined step (e.g. Typed) gets an implicit Source.
  const first = steps[0];
  if (first && !/^(Csv\.Document|Excel\.Workbook|Sql\.Database|Table\.Combine)/i.test(first.expr)) {
    const ref = /\(\s*(#"[^"]+"|[A-Za-z_]\w*)/.exec(first.expr);
    if (ref && !steps.some((s) => s.name === ref[1])) {
      const name = ref[1].replace(/^#"|"$/g, '');
      const src = sourceFor(name);
      env[name] = src;
      out.push({ name, expr: `Sales (from SQL Server)`, rows: src.rows, types: src.types, implicit: true });
    }
  }

  for (const st of steps) {
    const fn = (/^([A-Za-z.]+)\s*\(/.exec(st.expr) || [])[1] || '';
    const argsSrc = st.expr.slice(st.expr.indexOf('(') + 1, st.expr.lastIndexOf(')'));
    const args = topLevelSplit(argsSrc);
    const prevName = (args[0] || '').trim().replace(/^#"|"$/g, '');
    let res; let note = null;
    try {
      switch (fn) {
        case 'Csv.Document': {
          const cols = Object.keys(TABLES.Customers[0]);
          const raw = [Object.fromEntries(cols.map((c, i) => [`Column${i + 1}`, c])),
            ...TABLES.Customers.map((r) => Object.fromEntries(cols.map((c, i) => [`Column${i + 1}`, String(r[c])])))];
          res = { rows: raw, types: typesOf(raw, 'text') };
          note = 'Customers.csv: the first row still holds the column names.';
          break;
        }
        case 'Table.PromoteHeaders': {
          const p = get(prevName); const [head, ...rest] = p.rows;
          const keys = Object.keys(head);
          const rows = rest.map((r) => Object.fromEntries(keys.map((k) => [head[k], r[k]])));
          res = { rows, types: typesOf(rows, 'text') }; break;
        }
        case 'Table.TransformColumnTypes': {
          const p = get(prevName); const list = pairs(args.slice(1).join(','));
          const types = { ...p.types };
          list.forEach(([c, t]) => { types[c] = TYPE_FROM_M[t] || 'any'; });
          const rows = p.rows.map((r) => { const x = { ...r }; list.forEach(([c]) => { if (c in x) x[c] = convert(x[c], types[c]); }); return x; });
          res = { rows, types }; break;
        }
        case 'Table.RenameColumns': {
          const p = get(prevName); const list = pairs(args.slice(1).join(','));
          const map = Object.fromEntries(list);
          const rows = p.rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [map[k] || k, v])));
          const types = Object.fromEntries(Object.entries(p.types).map(([k, v]) => [map[k] || k, v]));
          res = { rows, types }; break;
        }
        case 'Table.RemoveColumns': case 'Table.SelectColumns': {
          const p = get(prevName); const list = names(args.slice(1).join(','));
          const keep = (k) => (fn === 'Table.RemoveColumns' ? !list.includes(k) : list.includes(k));
          const rows = p.rows.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => keep(k))));
          res = { rows, types: Object.fromEntries(Object.entries(p.types).filter(([k]) => keep(k))) }; break;
        }
        case 'Table.AddColumn': {
          const p = get(prevName); const col = names(args[1])[0];
          const each = (args[2] || '').replace(/^\s*each\s+/i, '');
          const tm = /type\s+(\w+)/.exec(args[3] || '');
          const rows = p.rows.map((r) => ({ ...r, [col]: evalEach(each, r) }));
          res = { rows, types: { ...p.types, [col]: tm ? TYPE_FROM_M[tm[1]] || 'any' : 'any' } }; break;
        }
        case 'Table.SelectRows': {
          const p = get(prevName); const each = (args[1] || '').replace(/^\s*each\s+/i, '');
          const rows = p.rows.filter((r) => evalEach(each, r));
          res = { rows, types: p.types };
          if (/RangeStart|RangeEnd/.test(each)) note = `Parameters: RangeStart = ${PARAMS.RangeStart}, RangeEnd = ${PARAMS.RangeEnd}. In the Service, incremental refresh fills these in.`;
          break;
        }
        case 'Table.Combine': {
          const list = names(st.expr).length ? names(st.expr) : (st.expr.match(/[A-Za-z_]\w*/g) || []).filter((x) => x !== 'Table' && x !== 'Combine');
          const parts = list.map((n) => get(n));
          const rows = parts.flatMap((x) => x.rows);
          res = { rows, types: parts[0]?.types || {} };
          note = list.map((n, i) => `${n}: ${parts[i].rows.length.toLocaleString()} rows`).join(' · ');
          break;
        }
        case 'Table.Sort': {
          const p = get(prevName); const list = names(args.slice(1).join(','));
          const desc = /Order\.Descending/.test(st.expr); const c = list[0];
          const rows = [...p.rows].sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * (desc ? -1 : 1));
          res = { rows, types: p.types }; break;
        }
        case 'Table.Distinct': { const p = get(prevName); const seen = new Set(); res = { types: p.types, rows: p.rows.filter((r) => { const k = JSON.stringify(r); if (seen.has(k)) return false; seen.add(k); return true; }) }; break; }
        default: {
          const p = env[prevName] || out[out.length - 1] || sourceFor('Sales');
          res = { rows: p.rows, types: p.types };
          note = fn ? `${fn} isn't previewed here; the data passes through unchanged.` : 'This step isn’t a function call the preview understands.';
        }
      }
    } catch (e) {
      const p = out[out.length - 1] || sourceFor('Sales');
      res = { rows: p.rows, types: p.types };
      note = e.message;
    }
    env[st.name] = res;
    out.push({ name: st.name, expr: st.expr, rows: res.rows, types: res.types, note });
  }
  return out;
}
