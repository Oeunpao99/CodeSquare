import React from 'react';

// Power BI's default report theme colours.
export const PBI = ['#118DFF', '#12239E', '#E66C37', '#6B007B', '#E044A7', '#744EC2', '#D9B300', '#D64550'];

// ------------------------------------------------------------- formatting --
export function guessFormat(name = '', expr = '') {
  const s = `${name} ${expr}`.toLowerCase();
  if (/share|%|pct|ratio|margin|growth|yoy/.test(s)) return 'pct';
  if (/rank/.test(s)) return 'int';
  if (/quantity|qty|count|orders|rows|units|customers/.test(s) || /countrows|distinctcount|count\(/.test(s)) return 'int';
  if (/sales|amount|cost|profit|price|revenue|\bly\b|ytd|spend/.test(s)) return 'cur';
  return 'num';
}

export function fmt(v, kind = 'num', compact = false) {
  if (v === null || v === undefined || v === '') return '(Blank)';
  if (typeof v === 'boolean') return v ? 'True' : 'False';
  if (typeof v === 'string') return v;
  if (!Number.isFinite(v)) return 'Infinity';
  if (kind === 'pct') return `${(v * 100).toFixed(1)}%`;
  if (kind === 'int') return Math.round(v).toLocaleString();
  const abs = Math.abs(v);
  const pre = kind === 'cur' ? '$' : '';
  if (compact && abs >= 1000) return `${pre}${(v / 1000).toFixed(abs >= 100000 ? 0 : 2)}K`;
  return `${pre}${v.toLocaleString(undefined, { minimumFractionDigits: kind === 'cur' ? 2 : 0, maximumFractionDigits: 2 })}`;
}

// --------------------------------------------------------------- visuals --
export function Card({ label, value, kind, highlight }) {
  return (
    <div className={`h-full flex flex-col items-center justify-center text-center px-2 ${highlight ? 'bg-[#fff8db]' : ''}`}>
      <span className="text-[26px] leading-none font-semibold text-[#252423] tabular-nums truncate max-w-full">{fmt(value, kind, true)}</span>
      <span className="mt-1.5 text-[11px] text-[#605e5c] truncate max-w-full">{label}</span>
    </div>
  );
}

export function ColumnChart({ data, kind, onPick, picked, color = PBI[0] }) {
  const W = 360; const H = 170; const pad = { l: 34, r: 6, t: 16, b: 30 };
  const max = Math.max(1e-9, ...data.map((d) => Math.abs(Number(d.value) || 0)));
  const bw = (W - pad.l - pad.r) / Math.max(1, data.length);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
      {[0, 0.5, 1].map((g) => (
        <g key={g}>
          <line x1={pad.l} x2={W - pad.r} y1={pad.t + (H - pad.t - pad.b) * (1 - g)} y2={pad.t + (H - pad.t - pad.b) * (1 - g)} stroke="#edebe9" />
          <text x={pad.l - 4} y={pad.t + (H - pad.t - pad.b) * (1 - g) + 3} textAnchor="end" fontSize="8" fill="#605e5c">{fmt(max * g, kind, true)}</text>
        </g>
      ))}
      {data.map((d, i) => {
        const h = ((Math.abs(Number(d.value) || 0)) / max) * (H - pad.t - pad.b);
        const x = pad.l + i * bw + bw * 0.15;
        const dim = picked && picked !== d.label;
        return (
          <g key={d.label} onClick={() => onPick?.(d.label)} className={onPick ? 'cursor-pointer' : ''}>
            <rect x={x} y={H - pad.b - h} width={bw * 0.7} height={Math.max(0, h)} fill={color} opacity={dim ? 0.3 : 1}>
              <title>{`${d.label}: ${fmt(d.value, kind)}`}</title>
            </rect>
            <text x={x + bw * 0.35} y={H - pad.b - h - 3} textAnchor="middle" fontSize="8" fill="#252423">{fmt(d.value, kind, true)}</text>
            <text x={x + bw * 0.35} y={H - pad.b + 11} textAnchor="middle" fontSize="8.5" fill="#605e5c">{String(d.label).length > 10 ? `${String(d.label).slice(0, 9)}…` : d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function BarChart({ data, kind, color = PBI[0], onPick, picked }) {
  const W = 360; const rowH = 20; const H = Math.max(60, data.length * rowH + 10); const lab = 92;
  const max = Math.max(1e-9, ...data.map((d) => Math.abs(Number(d.value) || 0)));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="xMidYMin meet">
      {data.map((d, i) => {
        const w = ((Math.abs(Number(d.value) || 0)) / max) * (W - lab - 50);
        const dim = picked && picked !== d.label;
        return (
          <g key={d.label} transform={`translate(0 ${5 + i * rowH})`} onClick={() => onPick?.(d.label)} className={onPick ? 'cursor-pointer' : ''}>
            <text x={lab - 6} y={12} textAnchor="end" fontSize="9" fill="#605e5c">{String(d.label).length > 16 ? `${String(d.label).slice(0, 15)}…` : d.label}</text>
            <rect x={lab} y={3} width={Math.max(0, w)} height={rowH - 7} fill={color} opacity={dim ? 0.3 : 1}><title>{`${d.label}: ${fmt(d.value, kind)}`}</title></rect>
            <text x={lab + w + 4} y={12} fontSize="8.5" fill="#252423">{fmt(d.value, kind, true)}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function LineChart({ labels, series, kind }) {
  const W = 360; const H = 170; const pad = { l: 34, r: 8, t: 14, b: 26 };
  const all = series.flatMap((s) => s.values.map((v) => Number(v) || 0));
  const max = Math.max(1e-9, ...all);
  const x = (i) => pad.l + (i * (W - pad.l - pad.r)) / Math.max(1, labels.length - 1);
  const y = (v) => pad.t + (1 - (Number(v) || 0) / max) * (H - pad.t - pad.b);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
      {[0, 0.5, 1].map((g) => (
        <g key={g}>
          <line x1={pad.l} x2={W - pad.r} y1={y(max * g)} y2={y(max * g)} stroke="#edebe9" />
          <text x={pad.l - 4} y={y(max * g) + 3} textAnchor="end" fontSize="8" fill="#605e5c">{fmt(max * g, kind, true)}</text>
        </g>
      ))}
      {labels.map((l, i) => (i % Math.ceil(labels.length / 9) === 0 ? (
        <text key={l} x={x(i)} y={H - 8} textAnchor="middle" fontSize="7.5" fill="#605e5c">{l}</text>
      ) : null))}
      {series.map((s, si) => (
        <g key={s.name}>
          <polyline fill="none" stroke={s.color || PBI[si]} strokeWidth="2" points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} strokeDasharray={s.dashed ? '4 3' : undefined} />
          {s.values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="1.8" fill={s.color || PBI[si]}><title>{`${labels[i]} · ${s.name}: ${fmt(v, kind)}`}</title></circle>)}
        </g>
      ))}
      <g transform={`translate(${pad.l} 4)`}>
        {series.map((s, si) => (
          <g key={s.name} transform={`translate(${si * 110} 0)`}>
            <circle cx="3" cy="3" r="3" fill={s.color || PBI[si]} />
            <text x="9" y="6" fontSize="8" fill="#605e5c">{s.name.length > 22 ? `${s.name.slice(0, 21)}…` : s.name}</text>
          </g>
        ))}
      </g>
    </svg>
  );
}

export function Matrix({ head, rows, total }) {
  return (
    <div className="h-full overflow-auto text-[11px] text-[#252423]">
      <table className="w-full border-collapse">
        <thead>
          <tr>{head.map((h, i) => <th key={h} className={`sticky top-0 bg-white px-2 py-1 font-semibold border-b-2 border-[#118DFF] ${i ? 'text-right' : 'text-left'}`}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r[0]} className="odd:bg-[#f3f2f1]/60">
              {r.map((c, i) => <td key={i} className={`px-2 py-[3px] ${i ? 'text-right tabular-nums' : ''}`}>{c}</td>)}
            </tr>
          ))}
          {total && (
            <tr className="font-semibold border-t border-[#c8c6c4]">
              {total.map((c, i) => <td key={i} className={`px-2 py-1 ${i ? 'text-right tabular-nums' : ''}`}>{c}</td>)}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
