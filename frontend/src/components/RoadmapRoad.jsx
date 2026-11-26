import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { FiCheck, FiFlag, FiAward } from 'react-icons/fi';
import LangLogo from './LangLogo';

// Infographic-style roadmap: a winding road that draws itself, with a stop per
// track (3 per row, snaking left→right then right→left) and a card above each
// stop listing its first modules. Pure SVG + CSS; coordinates are in a fixed
// 1000-wide space and scale with the container.
const W = 1000;
const ROW = 300;        // vertical distance between road rows
const TOP = 205;        // y of the first road row
const R = ROW / 2;      // U-turn radius
const XL = 185;         // where straight segments start/end (U-turns bulge past these)
const XR = W - XL;
const COLS = [295, 500, 705];
const DRAW = 2.4;       // seconds to draw the whole road

const ROAD = '#1e3a8a';

function buildPath(rows) {
  let d = `M ${XL - 90} ${TOP} L ${XR} ${TOP}`;
  for (let r = 1; r < rows; r++) {
    const yPrev = TOP + (r - 1) * ROW;
    const y = TOP + r * ROW;
    if (r % 2 === 1) d += ` A ${R} ${R} 0 0 1 ${XR} ${y} L ${XL} ${y}`;
    else d += ` A ${R} ${R} 0 0 0 ${XL} ${y} L ${XR} ${y}`;
    void yPrev;
  }
  return d;
}

export default function RoadmapRoad({ data }) {
  const tracks = data?.tracks || [];
  const rows = Math.max(1, Math.ceil(tracks.length / 3));
  const height = TOP + (rows - 1) * ROW + 110;
  const d = useMemo(() => buildPath(rows), [rows]);

  const stops = tracks.map((t, i) => {
    const r = Math.floor(i / 3);
    const c = i % 3;
    const x = r % 2 === 0 ? COLS[c] : COLS[2 - c];
    const y = TOP + r * ROW;
    // rough share of the road reached at this stop, to time its entrance
    const share = (r + (r % 2 === 0 ? (x - XL) : (XR - x)) / (XR - XL)) / rows;
    return { t, i, x, y, delay: 0.15 + share * DRAW };
  });
  const lastRow = rows - 1;
  const endX = lastRow % 2 === 0 ? XR : XL;
  const endY = TOP + lastRow * ROW;
  const current = tracks.findIndex((t) => t.status !== 'completed');

  if (!tracks.length) {
    return <p className="text-sm text-cs-text-dim py-10 text-center">No tracks in this path yet.</p>;
  }

  return (
    <div className="rounded-xl border border-cs-line/10 bg-cs-overlay/[0.02] overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${height}`} className="w-full min-w-[46rem] h-auto block" role="img" aria-label="Your learning roadmap">
        <defs>
          <pattern id="rr-dots" width="22" height="22" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.2" fill="rgb(var(--cs-overlay) / 0.10)" />
          </pattern>
          {/* userSpaceOnUse: a one-row (straight) road has a zero-height bounding box,
              which would make the default objectBoundingBox mask hide everything. */}
          <mask id="rr-reveal" maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={height}>
            <path d={d} pathLength="1" className="road-reveal" stroke="#fff" strokeWidth="80" fill="none" strokeLinecap="round"
              style={{ animationDuration: `${DRAW}s` }} />
          </mask>
        </defs>
        <rect width={W} height={height} fill="url(#rr-dots)" />

        {/* road + centre dashes, revealed by the animated mask */}
        <g mask="url(#rr-reveal)">
          <path d={d} stroke={ROAD} strokeWidth="54" fill="none" strokeLinecap="round" />
          <path d={d} stroke="rgba(255,255,255,0.85)" strokeWidth="3" strokeDasharray="16 14" fill="none" className="road-dash" />
        </g>

        {/* start */}
        <g className="road-pop" style={{ animationDelay: '0s' }}>
          <circle cx={XL - 90} cy={TOP} r="22" fill="rgb(var(--cs-green))" />
          <foreignObject x={XL - 102} y={TOP - 12} width="24" height="24">
            <div className="w-6 h-6 grid place-items-center text-white"><FiFlag /></div>
          </foreignObject>
          <text x={XL - 90} y={TOP + 48} textAnchor="middle" className="fill-cs-text text-[15px] font-semibold">Start</text>
        </g>

        {/* finish */}
        <g className="road-pop" style={{ animationDelay: `${DRAW + 0.1}s` }}>
          <circle cx={endX} cy={endY} r="30" fill="rgb(var(--cs-orange))" stroke="#fff" strokeWidth="4" />
          <foreignObject x={endX - 13} y={endY - 13} width="26" height="26">
            <div className="w-[26px] h-[26px] grid place-items-center text-white text-xl"><FiAward /></div>
          </foreignObject>
          <text x={endX} y={endY + 56} textAnchor="middle" className="fill-cs-text text-[15px] font-semibold">Job-ready</text>
        </g>

        {stops.map(({ t, i, x, y, delay }) => {
          const done = t.status === 'completed';
          const now = i === current;
          const mods = (t.modules || []).slice(0, 3);
          return (
            <g key={t.slug} className="road-pop" style={{ animationDelay: `${delay}s` }}>
              {/* leader from card to stop */}
              <line x1={x} y1={y - 44} x2={x} y2={y - 30} stroke="rgb(var(--cs-overlay) / 0.35)" strokeWidth="2" strokeDasharray="3 3" />

              {/* stop */}
              {now && <circle cx={x} cy={y} r="38" fill="none" stroke="rgb(var(--cs-primary))" strokeWidth="3" className="road-pulse" />}
              <circle cx={x} cy={y} r="30" fill={done ? 'rgb(var(--cs-green))' : '#fff'} stroke={done ? '#fff' : ROAD} strokeWidth="4" />
              <foreignObject x={x - 16} y={y - 16} width="32" height="32">
                <div className="w-8 h-8 grid place-items-center text-2xl" style={{ color: ROAD }}>
                  {done ? <FiCheck className="text-white" /> : <LangLogo name={t.slug} />}
                </div>
              </foreignObject>

              {/* card */}
              <foreignObject x={x - 94} y={y - 182} width="188" height="138">
                <Link to={`/learn/${t.slug}`}
                  className={`block h-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    now ? 'border-cs-primary bg-cs-dark shadow-lg' : 'border-cs-line/15 bg-cs-dark hover:border-cs-primary/50'
                  }`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-5 h-5 rounded-full grid place-items-center text-[11px] font-bold text-white shrink-0 ${done ? 'bg-cs-green' : 'bg-[#1e3a8a]'}`}>{i + 1}</span>
                    <span className="text-[13px] font-bold truncate">{t.name}</span>
                  </div>
                  <ul className="mt-1.5 space-y-0.5">
                    {mods.map((m) => (
                      <li key={m.id} className="text-[11px] text-cs-text-dim truncate">• {m.title}</li>
                    ))}
                  </ul>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="flex-1 h-1 rounded-full bg-cs-overlay/[0.12] overflow-hidden">
                      <span className={`block h-full rounded-full ${done ? 'bg-cs-green' : 'bg-cs-primary'}`} style={{ width: `${t.percent || 0}%` }} />
                    </span>
                    <span className="text-[10px] text-cs-text-muted tabular-nums">{t.completed_lessons}/{t.total_lessons}</span>
                  </div>
                </Link>
              </foreignObject>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
