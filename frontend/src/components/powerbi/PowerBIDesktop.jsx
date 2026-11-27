import React, { useEffect, useMemo, useState } from 'react';
import {
  FiBarChart2, FiGrid, FiShare2, FiDatabase, FiRefreshCw, FiFileText, FiPlusSquare, FiUploadCloud,
  FiChevronRight, FiChevronDown, FiCheck, FiX, FiFilter, FiHash, FiCalendar, FiType, FiSettings,
  FiInfo, FiEye, FiUser, FiTable, FiSliders,
} from 'react-icons/fi';
import { TABLES, RELATIONSHIPS, COLUMN_TYPES, COMPANY } from '../../powerbi/data';
import { makeEngine, BASE_MEASURES, splitDefinitions, isRowContextError } from '../../powerbi/dax';
import { runQuery } from '../../powerbi/mquery';
import { Card, ColumnChart, BarChart, LineChart, Matrix, fmt, guessFormat, PBI } from './charts';

// --------------------------------------------------------------- helpers --
const YELLOW = '#F2C811';
const CATEGORIES = [...new Set(TABLES.Products.map((p) => p.Category))];
const CITIES = [...new Set(TABLES.Stores.map((s) => s.City))];
const MONTHS = [...new Set(TABLES.Date.map((d) => d['Year Month']))];
const REPS = [...new Set(TABLES.Stores.map((s) => s.RepEmail))];

const eq = (table, col, v) => ({ table, col, test: (x) => x === v });

function PbiLogo({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden>
      <rect x="1" y="7" width="3.5" height="8" rx="1" fill="#E8B000" />
      <rect x="6" y="4" width="3.5" height="11" rx="1" fill="#F2C811" />
      <rect x="11" y="1" width="3.5" height="14" rx="1" fill="#FADF6B" />
    </svg>
  );
}

const TypeIcon = ({ t }) => {
  if (t === 'num' || t === 'int') return <span className="font-mono text-[9px] text-[#605e5c]">{t === 'int' ? '123' : '1.2'}</span>;
  if (t === 'date') return <FiCalendar className="text-[10px] text-[#605e5c]" />;
  if (t === 'text') return <span className="font-mono text-[9px] text-[#605e5c]">ABC</span>;
  return <span className="font-mono text-[9px] text-[#605e5c]">ABC<br />123</span>;
};

// Which column to slice the student's measure by, from what it mentions.
function pickDimension(expr) {
  const s = expr.toLowerCase();
  if (/stores|rankx|\[store\]/.test(s)) return { table: 'Stores', col: 'Store', label: 'Store' };
  if (/samperiod|sameperiod|dateadd|ytd|'date'|date\[|previousyear/.test(s)) return { table: 'Date', col: 'Year Month', label: 'Month', time: true };
  if (/products\[product\]|share/.test(s)) return { table: 'Products', col: 'Product', label: 'Product' };
  if (/customer/.test(s)) return { table: 'Customers', col: 'Segment', label: 'Segment' };
  return { table: 'Products', col: 'Category', label: 'Category' };
}

// ------------------------------------------------------- report guide text --
const GUIDE = (m, dim) => [
  ['Slicers', 'Slicers filter every visual on the page. Pick a year or a city and watch every number change: that is filter context.'],
  ['Cards', 'One number each: a measure evaluated under the current filters. Put the KPIs a manager checks first here, top left.'],
  ['Column chart', 'Compares categories. Click a column to cross-filter the rest of the page, the way Power BI does.'],
  ['Line chart', 'A trend over time. Notice the dip in April (Khmer New Year) and the December peak: seasonality you would explain to stakeholders.'],
  [m ? `${m} by ${dim}` : 'Your measure', m ? `Your measure, evaluated once per ${dim.toLowerCase()}. Every bar is the same formula under a different filter context.` : 'Write a measure in the editor and it appears here, evaluated per category.'],
  ['Matrix', 'The exact numbers behind the chart, with a total row. For ratios and ranks the total is not the sum of the rows: DAX re-evaluates the measure for the total.'],
];

// ========================================================================= //
export default function PowerBIDesktop({ code = '', kind = 'dax', onNewMeasure }) {
  const [view, setView] = useState(kind === 'm' ? 'query' : 'report');
  const [year, setYear] = useState(null);
  const [city, setCity] = useState(null);
  const [cat, setCat] = useState(null);
  const [explain, setExplain] = useState(false);
  const [tableName, setTableName] = useState('Sales');
  const [step, setStep] = useState(-1);
  const [user, setUser] = useState(REPS[0]);
  const [open, setOpen] = useState({ Sales: true });

  useEffect(() => { setView(kind === 'm' ? 'query' : 'report'); }, [kind]);

  // ---- parse the student's DAX into measures / calculated column / RLS rule
  const model = useMemo(() => {
    if (kind !== 'dax') return { defs: [], measures: BASE_MEASURES };
    const defs = splitDefinitions(code);
    const measures = { ...BASE_MEASURES };
    const out = [];
    for (const d of defs) {
      if (d.rls) { out.push({ ...d, type: 'rls' }); continue; }
      const expr = d.expr.trim();
      if (!expr) { out.push({ ...d, type: 'empty' }); continue; }
      measures[d.name] = expr;
      out.push({ ...d, expr, type: 'measure' });
    }
    const engine = makeEngine(measures, { user });
    for (const d of out) {
      if (d.type !== 'measure') continue;
      try { d.value = engine.evaluateMeasure(d.name, []); }
      catch (e) {
        if (isRowContextError(e)) {
          try {
            d.type = 'column';
            d.values = new Map(TABLES.Sales.map((r) => [r.OrderID, engine.evaluateRow(d.expr, 'Sales', r)]));
            delete measures[d.name];
          } catch (e2) { d.error = e2.message; d.type = 'measure'; }
        } else d.error = e.message;
      }
    }
    return { defs: out, measures };
  }, [code, kind, user]);

  const engine = useMemo(() => makeEngine(model.measures, { user }), [model, user]);
  const primary = [...model.defs].reverse().find((d) => d.type === 'measure' || d.type === 'column');
  const rlsRule = model.defs.find((d) => d.type === 'rls');
  const emptyDef = !primary && model.defs.find((d) => d.type === 'empty');

  // Row-level security: which stores the chosen user may see.
  const rls = useMemo(() => {
    if (!rlsRule) return null;
    try {
      const keys = new Set(TABLES.Stores.filter((s) => {
        const v = engine.evaluateRow(rlsRule.expr, 'Stores', s);
        return v === true || v === 1;
      }).map((s) => s.StoreKey));
      return { table: 'Stores', keys };
    } catch { return null; }
  }, [rlsRule, engine]);

  const base = useMemo(() => {
    const f = [];
    if (year) f.push(eq('Date', 'Year', year));
    if (city) f.push(eq('Stores', 'City', city));
    if (cat) f.push(eq('Products', 'Category', cat));
    return f;
  }, [year, city, cat]);

  const ev = (name, filters) => {
    try { return engine.evaluateMeasure(name, filters, rls ? { rls } : {}); } catch { return null; }
  };

  const pKind = primary ? guessFormat(primary.name, primary.expr) : 'num';
  const dim = primary?.type === 'column' ? { label: primary.name, column: true } : pickDimension(primary?.expr || '');

  // ---- report data
  const report = useMemo(() => {
    if (kind !== 'dax') return null;
    const notCat = base.filter((f) => !(f.table === 'Products' && f.col === 'Category'));
    const byCat = CATEGORIES.map((c) => ({ label: c, value: ev('Total Sales', [...notCat, eq('Products', 'Category', c)]) }));
    const months = (year ? MONTHS.filter((m) => m.endsWith(String(year))) : MONTHS);
    const trend = months.map((m) => ev('Total Sales', [...base, eq('Date', 'Year Month', m)]));
    let mine = [];
    if (primary?.type === 'measure' && !primary.error) {
      if (dim.time) {
        mine = months.map((m) => ({ label: m.replace(/ 20/, " '"), value: ev(primary.name, [...base, eq('Date', 'Year Month', m)]) }));
      } else {
        const values = [...new Set(TABLES[dim.table].map((r) => r[dim.col]))];
        mine = values.map((v) => ({ label: v, value: ev(primary.name, [...base, eq(dim.table, dim.col, v)]) }));
        if (!/rank/i.test(primary.name)) mine.sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));
        else mine.sort((a, b) => (Number(a.value) || 0) - (Number(b.value) || 0));
      }
    } else if (primary?.type === 'column') {
      const rows = engine.rowsOf('Sales', base, rls ? { rls } : {});
      const groups = new Map();
      rows.forEach((r) => { const k = String(primary.values.get(r.OrderID)); groups.set(k, (groups.get(k) || 0) + r.Amount); });
      mine = [...groups.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
    }
    return {
      total: ev('Total Sales', base),
      orders: ev('Orders', base),
      qty: ev('Total Quantity', base),
      mineValue: primary?.type === 'measure' && !primary.error ? ev(primary.name, base) : null,
      byCat, months, trend, mine,
      trendMine: dim.time && primary?.type === 'measure' ? months.map((m) => ev(primary.name, [...base, eq('Date', 'Year Month', m)])) : null,
    };
  }, [engine, base, primary, kind, year, rls]); // eslint-disable-line react-hooks/exhaustive-deps

  const query = useMemo(() => (kind === 'm' ? runQuery(code) : []), [code, kind]);
  useEffect(() => { setStep(query.length - 1); }, [query.length]);

  // ------------------------------------------------------------- chrome --
  const TABS = ['File', 'Home', 'Insert', 'Modeling', 'View', 'Optimize', 'Help'];
  const RibbonBtn = ({ icon: Icon, label, onClick, active }) => (
    <button type="button" onClick={onClick}
      className={`flex flex-col items-center justify-start gap-1 px-2 pt-1 h-[52px] min-w-[52px] rounded text-[10.5px] leading-tight text-[#252423] hover:bg-[#edebe9] ${active ? 'bg-[#e1dfdd]' : ''}`}>
      <Icon className="text-[18px] text-[#3b3a39]" />
      <span className="text-center whitespace-nowrap">{label}</span>
    </button>
  );
  const Group = ({ title, children }) => (
    <div className="flex flex-col border-r border-[#e1dfdd] pr-1.5 mr-1.5">
      <div className="flex items-start">{children}</div>
      <span className="text-[9.5px] text-[#605e5c] text-center mt-0.5">{title}</span>
    </div>
  );

  const Badge = ({ n }) => (explain ? (
    <span className="absolute -top-2 -left-2 z-10 w-5 h-5 rounded-full grid place-items-center text-[11px] font-bold text-[#252423] shadow" style={{ background: YELLOW }}>{n}</span>
  ) : null);

  const Visual = ({ title, n, children, className = '', selected }) => (
    <div className={`relative bg-white rounded-[2px] shadow-[0_1px_2px_rgba(0,0,0,0.12)] flex flex-col min-h-0 ${selected ? 'outline outline-1 outline-[#118DFF]' : ''} ${className}`}>
      <Badge n={n} />
      {title && <p className="px-2.5 pt-1.5 text-[11.5px] font-semibold text-[#252423] truncate">{title}</p>}
      <div className="flex-1 min-h-0 px-1.5 pb-1">{children}</div>
    </div>
  );

  // --------------------------------------------------------- report view --
  const ReportView = () => {
    const r = report;
    return (
      <div className="flex-1 min-w-0 flex flex-col bg-[#eaeaea]">
        {/* formula bar */}
        <div className="h-8 shrink-0 bg-white border-b border-[#e1dfdd] flex items-center gap-2 px-2 text-[12px]">
          <span className={`w-5 h-5 grid place-items-center rounded ${primary?.error ? 'text-[#a4262c]' : 'text-[#107c10]'}`}>{primary?.error ? <FiX /> : <FiCheck />}</span>
          <span className="font-mono text-[11.5px] text-[#252423] truncate flex-1">
            {primary ? `${primary.name} = ${primary.expr.replace(/\s+/g, ' ').trim()}` : rlsRule ? `Role filter: ${rlsRule.expr}` : 'Write a measure in the editor below, e.g.  Total Quantity = SUM(Sales[Quantity])'}
          </span>
        </div>
        {primary?.error && <div className="px-3 py-1.5 bg-[#fde7e9] text-[#a4262c] text-[11.5px] border-b border-[#f1bbbc]">{primary.error}</div>}
        {emptyDef && <div className="px-3 py-1.5 bg-[#fff4ce] text-[#605e5c] text-[11.5px] border-b border-[#f2e6a6]">Finish the formula after “=” to see “{emptyDef.name}” on the report.</div>}
        {rlsRule && (
          <div className="px-3 py-1.5 bg-[#fff4ce] text-[#252423] text-[11.5px] border-b border-[#f2e6a6] flex items-center gap-2 flex-wrap">
            <FiEye /> Now viewing as role <b>Sales Reps</b>, user
            <select value={user} onChange={(e) => setUser(e.target.value)} className="bg-white border border-[#c8c6c4] rounded px-1 py-0.5">
              {REPS.map((u) => <option key={u}>{u}</option>)}
            </select>
            <span className="text-[#605e5c]">· {rls ? `${rls.keys.size} of ${TABLES.Stores.length} stores visible` : 'rule could not be evaluated'}</span>
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-auto p-3">
          <div className="mx-auto bg-[#f7f7f7] rounded-[2px] shadow-[0_0_0_1px_#d2d0ce] p-3 grid gap-2.5 min-w-[640px]"
            style={{ gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gridAutoRows: '44px' }}>
            {/* header + slicers */}
            <div className="col-span-5 row-span-1 flex items-center gap-2 px-1">
              <span className="w-7 h-7 rounded-full grid place-items-center text-white text-[11px] font-bold" style={{ background: '#12239E' }}>LB</span>
              <div className="leading-tight">
                <p className="text-[15px] font-bold text-[#252423]">Sales overview</p>
                <p className="text-[10px] text-[#605e5c]">{COMPANY} · {cat ? `${cat} · ` : ''}{city || 'All cities'} · {year || 'Jan 2025 – Jun 2026'}</p>
              </div>
            </div>
            <Visual n={1} className="col-span-3 row-span-1" title="">
              <div className="h-full flex items-center gap-1">
                {[null, 2025, 2026].map((y) => (
                  <button key={String(y)} type="button" onClick={() => setYear(y)}
                    className={`flex-1 h-6 text-[11px] border ${year === y ? 'bg-[#252423] text-white border-[#252423]' : 'bg-white text-[#252423] border-[#c8c6c4] hover:bg-[#f3f2f1]'}`}>{y || 'All'}</button>
                ))}
              </div>
            </Visual>
            <Visual className="col-span-4 row-span-1" title="">
              <div className="h-full flex items-center gap-1 overflow-x-auto">
                {[null, ...CITIES].map((c) => (
                  <button key={String(c)} type="button" onClick={() => setCity(c)}
                    className={`shrink-0 h-6 px-2 text-[11px] border ${city === c ? 'bg-[#252423] text-white border-[#252423]' : 'bg-white text-[#252423] border-[#c8c6c4] hover:bg-[#f3f2f1]'}`}>{c || 'All cities'}</button>
                ))}
              </div>
            </Visual>

            {/* cards */}
            <Visual n={2} className="col-span-3 row-span-2"><Card label="Total Sales" value={r.total} kind="cur" /></Visual>
            <Visual className="col-span-3 row-span-2"><Card label="Orders" value={r.orders} kind="int" /></Visual>
            <Visual className="col-span-3 row-span-2"><Card label="Total Quantity" value={r.qty} kind="int" /></Visual>
            <Visual className="col-span-3 row-span-2" selected={!!primary}>
              {primary?.type === 'measure' && !primary.error
                ? <Card label={primary.name} value={r.mineValue} kind={pKind} highlight />
                : <Card label={primary?.type === 'column' ? `${primary.name} (column)` : 'Your measure'} value={primary?.type === 'column' ? `${new Set(primary.values.values()).size} values` : '—'} highlight />}
            </Visual>

            {/* charts */}
            <Visual n={3} className="col-span-5 row-span-4" title={`Total Sales by Category${cat ? ` · ${cat} selected` : ''}`}>
              <ColumnChart data={r.byCat} kind="cur" onPick={(l) => setCat((c) => (c === l ? null : l))} picked={cat} />
            </Visual>
            <Visual n={4} className="col-span-7 row-span-4" title={`Total Sales${r.trendMine ? ` and ${primary.name}` : ''} by Month`}>
              <LineChart labels={r.months.map((m) => m.replace(/ 20/, " '"))}
                series={[{ name: 'Total Sales', values: r.trend }, ...(r.trendMine ? [{ name: primary.name, values: r.trendMine, color: PBI[2], dashed: true }] : [])]} kind="cur" />
            </Visual>

            <Visual n={5} className="col-span-5 row-span-5" selected={!!primary}
              title={primary ? (primary.type === 'column' ? `Total Sales by ${primary.name}` : `${primary.name} by ${dim.label}`) : 'Your measure by Category'}>
              {r.mine.length ? (
                dim.time && primary?.type === 'measure'
                  ? <ColumnChart data={r.mine} kind={pKind} color={PBI[2]} />
                  : <BarChart data={r.mine.slice(0, 12)} kind={primary?.type === 'column' ? 'cur' : pKind} color={PBI[2]} />
              ) : (
                <div className="h-full grid place-items-center text-center text-[11px] text-[#605e5c] px-4">
                  {primary?.error ? 'Fix the formula to see this visual.' : 'Your measure appears here once the formula is complete.'}
                </div>
              )}
            </Visual>
            <Visual n={6} className="col-span-7 row-span-5" title="Matrix">
              {r.mine.length ? (
                <Matrix
                  head={[primary?.type === 'column' ? primary.name : dim.label, primary?.type === 'column' ? 'Total Sales' : primary.name, ...(primary?.type === 'column' ? [] : ['Total Sales'])]}
                  rows={r.mine.slice(0, 14).map((m) => (primary?.type === 'column'
                    ? [m.label, fmt(m.value, 'cur')]
                    : [m.label, fmt(m.value, pKind), fmt(dim.time ? ev('Total Sales', [...base, eq('Date', 'Year Month', MONTHS.find((x) => x.replace(/ 20/, " '") === m.label))]) : ev('Total Sales', [...base, eq(dim.table, dim.col, m.label)]), 'cur')]))}
                  total={primary?.type === 'column' ? ['Total', fmt(r.total, 'cur')] : ['Total', fmt(r.mineValue, pKind), fmt(r.total, 'cur')]}
                />
              ) : (
                <Matrix head={['Category', 'Total Sales']} rows={r.byCat.map((c) => [c.label, fmt(c.value, 'cur')])} total={['Total', fmt(r.total, 'cur')]} />
              )}
            </Visual>
          </div>
        </div>
      </div>
    );
  };

  // ---------------------------------------------------------- table view --
  const TableView = () => {
    const calc = primary?.type === 'column' && tableName === 'Sales' ? primary : null;
    const rows = TABLES[tableName].slice(0, 80);
    const cols = Object.keys(TABLES[tableName][0]);
    return (
      <div className="flex-1 min-w-0 flex flex-col bg-white">
        <div className="h-8 shrink-0 border-b border-[#e1dfdd] flex items-center gap-2 px-2 text-[12px] font-mono text-[#252423]">
          <FiCheck className="text-[#107c10]" /> {calc ? `${calc.name} = ${calc.expr.trim()}` : `${tableName} · ${TABLES[tableName].length.toLocaleString()} rows`}
        </div>
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="text-[11.5px] text-[#252423] border-collapse">
            <thead>
              <tr>
                {cols.map((c) => <th key={c} className="sticky top-0 bg-[#f3f2f1] border border-[#e1dfdd] px-2 py-1 text-left font-semibold whitespace-nowrap">{c}</th>)}
                {calc && <th className="sticky top-0 bg-[#fff4ce] border border-[#e1dfdd] px-2 py-1 text-left font-semibold whitespace-nowrap">{calc.name} <span className="font-normal text-[#605e5c]">fx</span></th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-[#f3f2f1]">
                  {cols.map((c) => <td key={c} className={`border border-[#edebe9] px-2 py-[3px] whitespace-nowrap ${typeof r[c] === 'number' ? 'text-right tabular-nums' : ''}`}>{typeof r[c] === 'number' && /Price|Cost|Amount/.test(c) ? r[c].toFixed(2) : String(r[c])}</td>)}
                  {calc && <td className="border border-[#edebe9] px-2 py-[3px] bg-[#fffbe6] whitespace-nowrap">{String(calc.values.get(r.OrderID) ?? '')}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="h-6 shrink-0 border-t border-[#e1dfdd] bg-[#f3f2f1] px-2 text-[10.5px] text-[#605e5c] flex items-center">
          Table: {tableName} ({TABLES[tableName].length.toLocaleString()} rows){calc ? ` · calculated column ${calc.name} added` : ''} · showing first {rows.length}
        </div>
      </div>
    );
  };

  // ---------------------------------------------------------- model view --
  const ModelView = () => {
    const pos = { Sales: [330, 150], Products: [80, 40], Stores: [580, 40], Date: [80, 270], Customers: [580, 270] };
    const card = (t) => {
      const [x, y] = pos[t];
      const cols = Object.keys(TABLES[t][0]).slice(0, 7);
      return (
        <g key={t} transform={`translate(${x - 75} ${y - 20})`}>
          <rect width="150" height={28 + cols.length * 14} rx="4" fill="#fff" stroke={t === 'Sales' ? '#118DFF' : '#c8c6c4'} />
          <rect width="150" height="22" rx="4" fill={t === 'Sales' ? '#118DFF' : '#f3f2f1'} />
          <text x="8" y="15" fontSize="11" fontWeight="600" fill={t === 'Sales' ? '#fff' : '#252423'}>{t}{t === 'Sales' ? '  (fact)' : ''}</text>
          {cols.map((c, i) => <text key={c} x="10" y={36 + i * 14} fontSize="10" fill="#3b3a39">{c}</text>)}
          {t === 'Stores' && rlsRule && <text x="146" y="15" textAnchor="end" fontSize="9" fill="#a4262c">RLS</text>}
        </g>
      );
    };
    return (
      <div className="relative flex-1 min-w-0 bg-[#f3f2f1] overflow-hidden">
        <p className="absolute left-3 top-2 text-[11px] text-[#605e5c]">Star schema · each dimension filters Sales (1 → *)</p>
        <svg viewBox="0 -10 660 400" preserveAspectRatio="xMidYMid meet" className="absolute inset-0 w-full h-full p-4">
          {RELATIONSHIPS.map((rel) => {
            const [x1, y1] = pos[rel.from]; const [x2, y2] = pos[rel.to];
            return (
              <g key={rel.to}>
                <line x1={x1} y1={y1 + 20} x2={x2} y2={y2 + 20} stroke="#8a8886" strokeWidth="1.5" />
                <text x={x1 + (x2 - x1) * 0.22} y={y1 + 20 + (y2 - y1) * 0.22 - 4} fontSize="11" fill="#252423">*</text>
                <text x={x1 + (x2 - x1) * 0.8} y={y1 + 20 + (y2 - y1) * 0.8 - 4} fontSize="10" fill="#252423">1</text>
                <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 + 32} textAnchor="middle" fontSize="8.5" fill="#605e5c">{rel.fromCol}</text>
              </g>
            );
          })}
          {Object.keys(pos).map(card)}
        </svg>
      </div>
    );
  };

  // ------------------------------------------------------ Power Query view --
  const QueryView = () => {
    const sel = query[Math.max(0, Math.min(step, query.length - 1))];
    const cols = sel ? Object.keys(sel.rows[0] || {}) : [];
    return (
      <div className="flex-1 min-w-0 flex bg-white">
        {/* Queries pane */}
        <div className="w-40 shrink-0 border-r border-[#e1dfdd] bg-[#faf9f8] text-[11.5px]">
          <p className="px-2 py-1.5 font-semibold text-[#252423] border-b border-[#e1dfdd]">Queries [{query.length ? 6 : 5}]</p>
          {['Sales', 'Products', 'Stores', 'Date', 'Customers'].map((q) => (
            <p key={q} className="px-2 py-1 flex items-center gap-1.5 text-[#3b3a39]"><FiTable className="text-[#605e5c]" /> {q}</p>
          ))}
          {sel && <p className="px-2 py-1 flex items-center gap-1.5 bg-[#e1dfdd] text-[#252423] font-semibold"><FiTable /> {query[query.length - 1].name}</p>}
          <p className="px-2 pt-2 pb-1 text-[10.5px] text-[#605e5c]">Parameters</p>
          <p className="px-2 py-0.5 text-[#3b3a39]">RangeStart</p>
          <p className="px-2 py-0.5 text-[#3b3a39]">RangeEnd</p>
        </div>
        {/* formula bar + grid */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="h-8 shrink-0 border-b border-[#e1dfdd] flex items-center gap-2 px-2 text-[11.5px] font-mono text-[#252423]">
            <span className="text-[#605e5c] not-italic">fx</span>
            <span className="truncate">{sel ? `= ${sel.expr.replace(/\s+/g, ' ')}` : 'Write a query in the editor below, e.g.  Typed = Table.TransformColumnTypes(Source, {{"Amount", type number}})'}</span>
          </div>
          {sel?.note && <div className="px-3 py-1.5 bg-[#fff4ce] text-[#605e5c] text-[11px] border-b border-[#f2e6a6] flex items-center gap-1.5"><FiInfo /> {sel.note}</div>}
          <div className="flex-1 min-h-0 overflow-auto">
            {sel ? (
              <table className="text-[11.5px] text-[#252423] border-collapse">
                <thead>
                  <tr>
                    <th className="sticky top-0 left-0 z-10 bg-[#f3f2f1] border border-[#e1dfdd] w-8" />
                    {cols.map((c) => (
                      <th key={c} className="sticky top-0 bg-[#f3f2f1] border border-[#e1dfdd] px-2 py-1 text-left font-semibold whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5"><span className="inline-block w-5 text-center leading-[0.8]"><TypeIcon t={sel.types?.[c]} /></span>{c}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sel.rows.slice(0, 60).map((r, i) => (
                    <tr key={i}>
                      <td className="sticky left-0 bg-[#f3f2f1] border border-[#edebe9] px-1.5 text-right text-[#605e5c]">{i + 1}</td>
                      {cols.map((c) => (
                        <td key={c} className={`border border-[#edebe9] px-2 py-[3px] whitespace-nowrap ${r[c] === 'Error' ? 'text-[#a4262c] font-semibold' : ''} ${typeof r[c] === 'number' ? 'text-right tabular-nums' : ''}`}>
                          {r[c] === null || r[c] === undefined ? <span className="italic text-[#a19f9d]">null</span> : String(r[c])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="p-6 text-[12px] text-[#605e5c]">No steps yet.</p>}
          </div>
          <div className="h-6 shrink-0 border-t border-[#e1dfdd] bg-[#f3f2f1] px-2 text-[10.5px] text-[#605e5c] flex items-center gap-3">
            <span>{cols.length} COLUMNS, {sel ? sel.rows.length.toLocaleString() : 0} ROWS</span>
            <span>Column profiling based on top 1000 rows</span>
          </div>
        </div>
        {/* Query settings */}
        <div className="w-48 shrink-0 border-l border-[#e1dfdd] bg-[#faf9f8] text-[11.5px] flex flex-col">
          <p className="px-2 py-1.5 font-semibold text-[#252423] border-b border-[#e1dfdd]">Query Settings</p>
          <p className="px-2 pt-2 text-[10.5px] uppercase tracking-wide text-[#605e5c]">Properties</p>
          <p className="px-2 py-1 text-[#252423]">Name: {query[query.length - 1]?.name || '—'}</p>
          <p className="px-2 pt-2 text-[10.5px] uppercase tracking-wide text-[#605e5c]">Applied steps</p>
          <div className="flex-1 overflow-y-auto pb-2">
            {query.map((s, i) => (
              <button key={`${s.name}-${i}`} type="button" onClick={() => setStep(i)}
                className={`w-full text-left px-2 py-1 flex items-center gap-1.5 ${i === step ? 'bg-[#e1dfdd] font-semibold' : 'hover:bg-[#edebe9]'} ${s.implicit ? 'text-[#605e5c]' : 'text-[#252423]'}`}>
                <span className="truncate flex-1">{s.implicit ? 'Source' : s.name}</span>
                {s.note && !s.implicit && <FiInfo className="text-[#c19c00] shrink-0" title={s.note} />}
                <FiSettings className="text-[#8a8886] shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // -------------------------------------------------------- right panes --
  const FieldsPane = () => (
    <div className="w-48 shrink-0 border-l border-[#e1dfdd] bg-white text-[11.5px] text-[#252423] flex flex-col min-h-0">
      <p className="px-2.5 py-2 font-semibold border-b border-[#e1dfdd] flex items-center justify-between">Data <FiChevronRight className="text-[#605e5c]" /></p>
      <div className="flex-1 overflow-y-auto py-1">
        {Object.keys(TABLES).map((t) => {
          const mine = model.defs.filter((d) => d.name && (d.type === 'measure' || d.type === 'column'));
          return (
            <div key={t}>
              <button type="button" onClick={() => { setOpen((o) => ({ ...o, [t]: !o[t] })); if (view === 'table') setTableName(t); }}
                className={`w-full flex items-center gap-1 px-2 py-1 hover:bg-[#f3f2f1] ${view === 'table' && tableName === t ? 'bg-[#f3f2f1] font-semibold' : ''}`}>
                {open[t] ? <FiChevronDown /> : <FiChevronRight />} <FiTable className="text-[#605e5c]" /> {t}
              </button>
              {open[t] && (
                <div className="pl-6">
                  {t === 'Sales' && Object.keys(BASE_MEASURES).map((m) => (
                    <p key={m} className="py-0.5 flex items-center gap-1.5 text-[#3b3a39]"><span className="text-[10px] text-[#605e5c]">▦</span>{m}</p>
                  ))}
                  {t === 'Sales' && mine.map((d) => (
                    <p key={d.name} className="py-0.5 flex items-center gap-1.5 font-semibold bg-[#fff4ce] -ml-1 pl-1 rounded-sm">
                      <span className="text-[10px] text-[#605e5c]">{d.type === 'column' ? 'fx' : '▦'}</span>{d.name}
                    </p>
                  ))}
                  {Object.keys(COLUMN_TYPES[t]).map((c) => (
                    <p key={c} className="py-0.5 flex items-center gap-1.5 text-[#3b3a39]">
                      <span className="w-3 text-[10px] text-[#605e5c]">{/num|int/.test(COLUMN_TYPES[t][c]) ? 'Σ' : ''}</span>{c}
                    </p>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const VizPane = () => (
    <div className="w-[8.5rem] shrink-0 border-l border-[#e1dfdd] bg-white text-[11.5px] text-[#252423] hidden xl:flex flex-col">
      <p className="px-2.5 py-2 font-semibold border-b border-[#e1dfdd]">Visualizations</p>
      <div className="p-2 grid grid-cols-4 gap-1">
        {[FiBarChart2, FiSliders, FiGrid, FiHash, FiType, FiCalendar, FiFilter, FiTable, FiBarChart2, FiGrid, FiHash, FiShare2].map((I, i) => (
          <span key={i} className={`h-6 grid place-items-center rounded-sm border ${i === 0 ? 'border-[#118DFF] bg-[#eff6fc]' : 'border-transparent hover:bg-[#f3f2f1]'}`}><I className="text-[#3b3a39]" /></span>
        ))}
      </div>
      <p className="px-2.5 pt-2 text-[10.5px] text-[#605e5c]">Values</p>
      <p className="mx-2 mt-1 px-2 py-1 rounded-sm border border-[#c8c6c4] truncate">{primary?.name || 'Total Sales'}</p>
      <p className="px-2.5 pt-2 text-[10.5px] text-[#605e5c]">Axis</p>
      <p className="mx-2 mt-1 px-2 py-1 rounded-sm border border-[#c8c6c4] truncate">{primary?.type === 'column' ? primary.name : dim.label}</p>
    </div>
  );

  const FiltersPane = () => (
    <div className="w-36 shrink-0 border-l border-[#e1dfdd] bg-[#faf9f8] text-[11.5px] text-[#252423] hidden lg:flex flex-col">
      <p className="px-2.5 py-2 font-semibold border-b border-[#e1dfdd] flex items-center gap-1.5"><FiFilter /> Filters</p>
      <p className="px-2.5 pt-2 text-[10.5px] text-[#605e5c]">Filters on this page</p>
      {[['Year', year], ['City', city], ['Category', cat]].map(([k, v]) => (
        <div key={k} className="mx-2 mt-1.5 px-2 py-1.5 rounded-sm bg-white border border-[#e1dfdd]">
          <p className="font-semibold">{k}</p>
          <p className="text-[#605e5c]">{v ? `is ${v}` : 'is (All)'}</p>
        </div>
      ))}
      {rls && <div className="mx-2 mt-1.5 px-2 py-1.5 rounded-sm bg-[#fde7e9] border border-[#f1bbbc]"><p className="font-semibold">RLS: Sales Reps</p><p className="text-[#605e5c] truncate">{user}</p></div>}
    </div>
  );

  const GuidePane = () => (
    <div className="w-64 shrink-0 border-l border-[#e1dfdd] bg-white text-[12px] text-[#252423] flex flex-col min-h-0">
      <p className="px-3 py-2 font-semibold border-b border-[#e1dfdd] flex items-center justify-between">How to read this report
        <button type="button" onClick={() => setExplain(false)} className="text-[#605e5c] hover:text-[#252423]" aria-label="Close guide"><FiX /></button>
      </p>
      <ol className="flex-1 overflow-y-auto p-3 space-y-3">
        {GUIDE(primary?.type === 'measure' ? primary.name : null, dim.label).map(([t, d], i) => (
          <li key={t} className="flex gap-2.5">
            <span className="w-5 h-5 shrink-0 rounded-full grid place-items-center text-[11px] font-bold" style={{ background: YELLOW }}>{i + 1}</span>
            <span><b>{t}.</b> <span className="text-[#3b3a39]">{d}</span></span>
          </li>
        ))}
      </ol>
    </div>
  );

  const views = [
    ['report', FiBarChart2, 'Report view'],
    ['table', FiGrid, 'Table view'],
    ['model', FiShare2, 'Model view'],
  ];

  // -------------------------------------------------------------- render --
  return (
    <div className="rounded-lg overflow-hidden border border-[#c8c6c4] bg-white shadow-sm [color-scheme:light] text-left" style={{ fontFamily: "'Segoe UI', 'Inter', system-ui, sans-serif" }}>
      {/* title bar */}
      <div className="h-8 flex items-center gap-2 px-3 bg-[#f3f2f1] border-b border-[#e1dfdd] text-[12px] text-[#252423]">
        <PbiLogo />
        <span className="truncate">{view === 'query' ? 'Untitled - Power Query Editor' : `Lotus Bean Sales.pbix - Power BI Desktop`}</span>
        <span className="ml-auto inline-flex items-center gap-1.5 text-[#605e5c]"><FiUser /> Practice mode</span>
      </div>

      {/* ribbon */}
      <div className="bg-white border-b border-[#e1dfdd]">
        <div className="flex items-end gap-4 px-3 h-7 text-[12px]">
          {(view === 'query' ? ['File', 'Home', 'Transform', 'Add Column', 'View', 'Tools', 'Help'] : TABS).map((t) => (
            <span key={t} className={`pb-1 ${t === 'Home' ? 'border-b-2 font-semibold text-[#252423]' : 'text-[#3b3a39]'} ${t === 'File' ? 'text-white px-2 rounded-t-sm' : ''}`}
              style={t === 'Home' ? { borderColor: YELLOW } : t === 'File' ? { background: '#2d7d3a' } : undefined}>{t}</span>
          ))}
          <button type="button" onClick={() => setExplain((v) => !v)}
            className={`ml-auto mb-0.5 inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[11px] font-semibold border ${explain ? 'bg-[#252423] text-white border-[#252423]' : 'border-[#c8c6c4] text-[#252423] hover:bg-[#f3f2f1]'} ${view !== 'report' ? 'invisible' : ''}`}>
            <FiInfo /> {explain ? 'Hide guide' : 'Explain this report'}
          </button>
        </div>
        <div className="flex items-stretch px-2 py-1 overflow-x-auto">
          {view === 'query' ? (
            <>
              <Group title="Close"><RibbonBtn icon={FiCheck} label="Close & Apply" onClick={() => setView('report')} /></Group>
              <Group title="New Query"><RibbonBtn icon={FiDatabase} label="New Source" /><RibbonBtn icon={FiFileText} label="Enter Data" /></Group>
              <Group title="Query"><RibbonBtn icon={FiRefreshCw} label="Refresh Preview" /><RibbonBtn icon={FiSettings} label="Properties" /></Group>
              <Group title="Manage Columns"><RibbonBtn icon={FiGrid} label="Choose Columns" /><RibbonBtn icon={FiX} label="Remove Columns" /></Group>
              <Group title="Transform"><RibbonBtn icon={FiHash} label="Data Type" /><RibbonBtn icon={FiType} label="Use First Row as Headers" /></Group>
            </>
          ) : (
            <>
              <Group title="Data">
                <RibbonBtn icon={FiDatabase} label="Get data" />
                <RibbonBtn icon={FiGrid} label="Excel workbook" />
                <RibbonBtn icon={FiFileText} label="Transform data" onClick={() => setView('query')} />
              </Group>
              <Group title="Queries"><RibbonBtn icon={FiRefreshCw} label="Refresh" /></Group>
              <Group title="Insert"><RibbonBtn icon={FiBarChart2} label="New visual" /><RibbonBtn icon={FiType} label="Text box" /></Group>
              <Group title="Calculations"><RibbonBtn icon={FiPlusSquare} label="New measure" onClick={onNewMeasure} /></Group>
              <Group title="Share"><RibbonBtn icon={FiUploadCloud} label="Publish" /></Group>
            </>
          )}
        </div>
      </div>

      {/* body */}
      <div className="flex h-[620px]">
        {view !== 'query' && (
          <div className="w-11 shrink-0 bg-[#f3f2f1] border-r border-[#e1dfdd] flex flex-col items-center pt-2 gap-1">
            {views.map(([k, I, label]) => (
              <button key={k} type="button" onClick={() => setView(k)} title={label} aria-label={label}
                className={`relative w-9 h-9 grid place-items-center rounded-sm ${view === k ? 'bg-white text-[#252423]' : 'text-[#605e5c] hover:bg-[#e1dfdd]'}`}>
                {view === k && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r" style={{ background: YELLOW }} />}
                <I className="text-[17px]" />
              </button>
            ))}
          </div>
        )}
        {view === 'report' && <ReportView />}
        {view === 'table' && <TableView />}
        {view === 'model' && <ModelView />}
        {view === 'query' && <QueryView />}
        {view === 'report' && (explain ? <GuidePane /> : <><FiltersPane /><VizPane /><FieldsPane /></>)}
        {(view === 'table' || view === 'model') && <FieldsPane />}
      </div>

      {/* page tabs / status bar */}
      <div className="h-7 flex items-center gap-1 px-2 bg-[#f3f2f1] border-t border-[#e1dfdd] text-[11.5px] text-[#252423]">
        {view === 'query' ? (
          <span className="text-[#605e5c]">Preview downloaded from the Lotus Bean dataset · {query.length} applied step{query.length === 1 ? '' : 's'}</span>
        ) : (
          <>
            <span className="px-3 h-6 inline-flex items-center bg-white border-b-2 font-semibold" style={{ borderColor: YELLOW }}>Overview</span>
            <span className="px-3 h-6 inline-flex items-center text-[#605e5c]">Details</span>
            <span className="px-2 text-[#605e5c]">+</span>
            <span className="ml-auto text-[#605e5c]">Page 1 of 2 · {MONTHS.length} months · {TABLES.Sales.length.toLocaleString()} sales rows</span>
          </>
        )}
      </div>
    </div>
  );
}
