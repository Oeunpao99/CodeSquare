import React, { useEffect, useState } from 'react';

// Right-hand panel of the sign-in page. Shows /auth/hero.jpg when that file
// exists in frontend/public (drop a real photo of your students there),
// otherwise an illustrated group of IT students. Taglines rotate underneath.

const SLIDES = [
  { kicker: 'Learn by building', text: 'Write real code from your first lesson, and get feedback on every line.' },
  { kicker: 'Job-ready', text: 'From your first print() to a portfolio of shipped projects employers can open.' },
  { kicker: 'Never alone', text: 'Classes, an AI tutor and a community of developers learning with you.' },
];

function Student({ x, skin, hair, shirt, style, glasses }) {
  const head = 250;
  return (
    <g>
      {/* hair behind the head (long styles) */}
      {style === 'long' && <path d={`M${x - 38} ${head + 2}c-4-36 14-52 38-52s42 16 38 52l4 64c-14 8-30 6-36-2h-12c-6 8-22 10-36 2z`} fill={hair} />}
      {style === 'bun' && <circle cx={x} cy={head - 40} r="15" fill={hair} />}
      {/* body */}
      <path d={`M${x - 66} 402c0-58 26-92 66-92s66 34 66 92z`} fill={shirt} />
      <path d={`M${x - 12} 312l12 16 12-16z`} fill="#fff" opacity=".85" />
      <rect x={x - 11} y={head + 26} width="22" height="26" rx="8" fill={skin} />
      {/* head */}
      <circle cx={x - 33} cy={head + 4} r="7" fill={skin} />
      <circle cx={x + 33} cy={head + 4} r="7" fill={skin} />
      <ellipse cx={x} cy={head} rx="32" ry="35" fill={skin} />
      <circle cx={x - 11} cy={head + 2} r="3.2" fill="#1f2937" />
      <circle cx={x + 11} cy={head + 2} r="3.2" fill="#1f2937" />
      <path d={`M${x - 9} ${head + 16}q9 8 18 0`} stroke="#7c2d12" strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx={x - 20} cy={head + 12} r="5" fill="#f43f5e" opacity=".18" />
      <circle cx={x + 20} cy={head + 12} r="5" fill="#f43f5e" opacity=".18" />
      {glasses && (
        <g fill="none" stroke="#111827" strokeWidth="2.6">
          <circle cx={x - 11} cy={head + 2} r="9" /><circle cx={x + 11} cy={head + 2} r="9" /><path d={`M${x - 2} ${head + 2}h4`} />
        </g>
      )}
      {/* hair on top */}
      {style === 'short' && <path d={`M${x - 33} ${head - 4}c-3-26 13-40 33-40 21 0 37 14 33 40-5-12-16-18-33-18s-28 6-33 18z`} fill={hair} />}
      {style === 'curly' && [[-24, -18], [-12, -32], [4, -36], [18, -30], [27, -16], [-4, -24], [12, -22]].map(([dx, dy], i) => (
        <circle key={i} cx={x + dx} cy={head + dy} r="12" fill={hair} />
      ))}
      {(style === 'long' || style === 'bun') && <path d={`M${x - 33} ${head - 2}c0-24 15-37 33-37s33 13 33 37c-10-12-21-17-33-17s-24 5-33 17z`} fill={hair} />}
      {/* arms resting on the desk */}
      <path d={`M${x - 58} 360c-6 22 4 38 26 40`} stroke={shirt} strokeWidth="20" fill="none" strokeLinecap="round" />
      <path d={`M${x + 58} 360c6 22-4 38-26 40`} stroke={shirt} strokeWidth="20" fill="none" strokeLinecap="round" />
      {/* laptop lid facing us */}
      <path d={`M${x - 62} 404l10-70h104l10 70z`} fill="#cbd5e1" />
      <path d={`M${x - 62} 404l10-70h104l10 70z`} fill="url(#lid)" />
      <rect x={x - 9} y="360" width="18" height="18" rx="5" fill="#2563eb" opacity=".9" />
      <path d={`M${x - 3} 365l-4 4 4 4M${x + 3} 365l4 4-4 4`} stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </g>
  );
}

function Illustration() {
  return (
    <svg viewBox="0 0 800 560" className="w-full h-auto" role="img" aria-label="A group of IT students coding together">
      <defs>
        <linearGradient id="lid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".55" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="45%" r="60%">
          <stop offset="0" stopColor="#3b82f6" stopOpacity=".35" /><stop offset="1" stopColor="#3b82f6" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="400" cy="270" rx="400" ry="260" fill="url(#glow)" />

      {/* floating code window */}
      <g className="class-bob" style={{ transformOrigin: '170px 110px' }}>
        <rect x="60" y="40" width="250" height="150" rx="14" fill="#0b1220" stroke="#1e293b" />
        <circle cx="82" cy="60" r="5" fill="#f87171" /><circle cx="98" cy="60" r="5" fill="#fbbf24" /><circle cx="114" cy="60" r="5" fill="#34d399" />
        {[[80, 92, 70, '#c084fc'], [158, 92, 90, '#e2e8f0'], [96, 116, 60, '#60a5fa'], [164, 116, 110, '#34d399'], [96, 140, 120, '#e2e8f0'], [224, 140, 50, '#fb923c'], [80, 164, 40, '#c084fc']].map(([x1, y, w, c], i) => (
          <rect key={i} x={x1} y={y - 5} width={w} height="9" rx="4.5" fill={c} opacity=".9" />
        ))}
      </g>

      {/* tests passed pill */}
      <g className="class-bob" style={{ animationDelay: '1.2s' }}>
        <rect x="530" y="56" width="200" height="46" rx="23" fill="#052e16" stroke="#166534" />
        <circle cx="557" cy="79" r="12" fill="#22c55e" />
        <path d="M551 79l4.5 4.5 8-9" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <text x="578" y="85" fontSize="17" fontWeight="600" fill="#bbf7d0" fontFamily="Inter, system-ui, sans-serif">All tests passed</text>
      </g>

      {/* progress chart card */}
      <g className="class-bob" style={{ animationDelay: '2.1s' }}>
        <rect x="560" y="128" width="170" height="104" rx="14" fill="#0b1220" stroke="#1e293b" />
        <text x="578" y="152" fontSize="12" fill="#94a3b8" fontFamily="Inter, system-ui, sans-serif">Weekly XP</text>
        {[34, 52, 40, 66, 58, 80].map((h, i) => (
          <rect key={i} x={580 + i * 23} y={218 - h} width="14" height={h} rx="4" fill={i === 5 ? '#3b82f6' : '#334155'} />
        ))}
      </g>

      {/* desk + students */}
      <Student x={160} skin="#e0ac83" hair="#2b1d16" shirt="#7c3aed" style="long" />
      <Student x={320} skin="#a5694a" hair="#111827" shirt="#0ea5e9" style="curly" glasses />
      <Student x={480} skin="#f1c7a3" hair="#5b3a24" shirt="#f97316" style="bun" />
      <Student x={640} skin="#c68b62" hair="#1f1b1a" shirt="#10b981" style="short" />
      <rect x="40" y="402" width="720" height="22" rx="6" fill="#1e293b" />
      <rect x="40" y="402" width="720" height="5" rx="2.5" fill="#334155" />
      <rect x="90" y="424" width="14" height="110" fill="#1e293b" />
      <rect x="696" y="424" width="14" height="110" fill="#1e293b" />
      {/* coffee + plant */}
      <path d="M58 402v-26h28v26z" fill="#e2e8f0" /><path d="M86 382c10 0 10 14 0 14" stroke="#e2e8f0" strokeWidth="4" fill="none" />
      <path d="M716 402l6-28h30l6 28z" fill="#b45309" />
      <path d="M737 374c-14-20-4-40 6-44-2 16 4 26-6 44zM737 374c8-18 24-22 32-18-10 6-14 16-32 18z" fill="#22c55e" />
    </svg>
  );
}

export default function AuthShowcase() {
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(true);
  const go = (n) => {
    setShown(false);
    setTimeout(() => { setI(n); setShown(true); }, 450);
  };
  const [photo, setPhoto] = useState(null); // null = checking, true/false
  useEffect(() => {
    const t = setInterval(() => {
      setShown(false);
      setTimeout(() => { setI((n) => (n + 1) % SLIDES.length); setShown(true); }, 450);
    }, 6000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const img = new Image();
    img.onload = () => setPhoto(true);
    img.onerror = () => setPhoto(false);
    img.src = '/auth/hero.jpg';
  }, []);
  const s = SLIDES[i];

  return (
    <aside className="relative hidden lg:flex flex-col overflow-hidden bg-[#070b16] text-white">
      {photo ? (
        <img src="/auth/hero.jpg" alt="" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center px-10 pb-56">
          <div className="w-full max-w-[44rem]"><Illustration /></div>
        </div>
      )}
      {/* readable bottom: dark fade behind the text */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />

      <div className="relative mt-auto px-14 pb-14">
        <div className={`transition-all duration-[450ms] ease-out ${shown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
          <p className="text-[2.25rem] leading-none mb-5 text-white/90" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>{s.kicker}</p>
          <p className="text-[2.6rem] leading-[1.15] font-bold max-w-[34rem]">{s.text}</p>
        </div>
        <div className="mt-10 flex items-end justify-between">
          <div>
            <p className="text-lg font-semibold">CodeSquare</p>
            <p className="text-sm text-white/60">Learn to code, the practical way</p>
          </div>
          <div className="flex items-center gap-2" role="tablist" aria-label="Highlights">
            {SLIDES.map((_, n) => (
              <button key={n} type="button" onClick={() => n !== i && go(n)} role="tab" aria-selected={n === i} aria-label={`Highlight ${n + 1}`}
                className={`h-1.5 rounded-full transition-all ${n === i ? 'w-6 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/70'}`} />
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
