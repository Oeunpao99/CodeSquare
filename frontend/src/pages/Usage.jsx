import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { usageService } from '../services/api';
import {
  FiTerminal, FiZap, FiCpu, FiCode, FiFileText, FiCheckCircle, FiArrowRight,
} from 'react-icons/fi';
import { toast } from '../utils/toast';

const KIND_META = {
  chat: { label: 'Tutor chat', icon: FiCpu },
  hint: { label: 'Lesson hints', icon: FiZap },
  review: { label: 'Code reviews', icon: FiCheckCircle },
  project: { label: 'Project briefs', icon: FiCode },
  notes: { label: 'Note → project', icon: FiFileText },
};

function fmtInt(n) {
  return (n || 0).toLocaleString();
}

function fmtCountdown(secs) {
  if (secs <= 0) return 'now';
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function WindowCard({ w, tick }) {
  const secs = Math.max(0, (w.resets_in_seconds || 0) - tick);
  const warn = w.percent >= 80;
  const color = warn ? 'rgb(var(--cs-orange))' : 'rgb(var(--cs-primary))';
  return (
    <div className="card flex flex-col justify-between bg-gradient-to-br from-cs-darker to-cs-darker/40">
      <div className="flex items-start justify-between gap-3">
        <p className="mono-label text-cs-text-dim">{w.label}</p>
        <span className={`font-mono text-[10px] px-2 py-0.5 rounded-full border uppercase tracking-wider ${
          warn ? 'border-cs-orange/40 bg-cs-orange/10 text-cs-orange' : 'border-cs-line/15 text-cs-text-muted'
        }`}>
          {warn ? 'high' : 'meter'}
        </span>
      </div>

      <div className="mt-2">
        <p className="font-mono text-3xl font-bold leading-none">
          {w.percent}<span className="text-base text-cs-text-muted">%</span>
        </p>
        <p className="font-mono text-[11px] text-cs-text-muted mt-1">
          {fmtInt(w.used)} / {fmtInt(w.limit)} tokens
        </p>
      </div>

      <div className="mt-4 space-y-1">
        <div className="h-2 rounded-full bg-cs-overlay/10 overflow-hidden">
          <div
            className="h-full rounded-full transition-[width] duration-700"
            style={{
              width: `${Math.max(1.5, w.percent)}%`,
              background: `linear-gradient(90deg, ${color}66, ${color})`,
              boxShadow: `0 0 12px -2px ${color}`,
            }}
          />
        </div>
        <div className="flex items-center justify-between font-mono text-[10px] text-cs-text-muted">
          <span>resets</span>
          <span className={warn ? 'text-cs-orange font-semibold' : ''}>{fmtCountdown(secs)}</span>
        </div>
      </div>
    </div>
  );
}

function Usage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);     // null loading, false error
  const [planList, setPlanList] = useState([]);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);        // seconds since last fetch, for the countdown
  const timer = useRef(null);

  const load = () => {
    usageService.get().then((r) => { setData(r.data); setTick(0); }).catch(() => setData(false));
    usageService.plans().then((r) => setPlanList(r.data)).catch(() => {});
  };

  useEffect(() => {
    load();
    timer.current = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer.current);
  }, []);

  const choosePlan = async (key) => {
    if (busy || key === data?.plan) return;
    setBusy(true);
    try {
      const r = await usageService.setPlan(key);
      setData(r.data);
      setTick(0);
      setPlanList((prev) => prev.map((p) => ({ ...p, current: p.key === key })));
      toast.success('Plan updated', `You're on ${r.data.plan_label}.`);
    } catch (e) {
      toast.error('Could not update plan', e?.response?.data?.detail);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="w-full px-6 lg:px-10 py-8">
      <div className="sticky top-0 z-30 -mx-6 lg:-mx-10 px-6 lg:px-10 pt-4 pb-4 -mt-8 mb-6 bg-cs-dark/85 backdrop-blur-xl border-b border-cs-line/[0.07]">
        <span className="mono-label text-cs-primary">// account</span>
        <h1 className="text-3xl font-bold mt-2 flex items-center gap-3">
          <FiTerminal className="text-cs-primary" /> Usage
        </h1>
      </div>

      {data === null && <p className="text-cs-text-muted font-mono text-sm">reading meters…</p>}
      {data === false && (
        <div className="card text-center py-14 border-cs-red/20">
          <p className="text-cs-text-dim font-mono text-sm">Couldn’t load usage. Try again shortly.</p>
        </div>
      )}

      {data && data !== false && (
        <div className="space-y-8">
          {/* Account + meters */}
          <div className="grid lg:grid-cols-[1fr_2fr] gap-6 items-stretch">
            {/* Account card */}
            <div className="card flex flex-col justify-between gap-6 bg-gradient-to-br from-cs-primary/[0.06] to-transparent">
              <div className="flex items-center gap-4">
                <span className="w-14 h-14 rounded-2xl bg-cs-primary/15 text-cs-primary flex items-center justify-center font-mono font-bold text-xl shrink-0 shadow-[0_0_24px_-8px_rgb(var(--cs-primary)/0.6)]">
                  {user?.username?.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="font-mono font-semibold text-lg truncate">{user?.username}</p>
                  <p className="text-xs text-cs-text-muted font-mono truncate">{user?.email}</p>
                </div>
              </div>
              <div>
                <span className="px-3 py-1.5 rounded-full text-xs font-mono font-semibold uppercase tracking-wider border border-cs-primary/30 bg-cs-primary/10 text-cs-primary">
                  {data.plan_label} plan
                </span>
                <p className="font-mono text-[11px] text-cs-text-muted mt-3">
                  {data.calls_this_week} AI call{data.calls_this_week === 1 ? '' : 's'} this week · limits soft — nothing blocked
                </p>
              </div>
            </div>

            {/* Meters */}
            <div className="grid sm:grid-cols-2 gap-4">
              <WindowCard w={data.session} tick={tick} />
              <WindowCard w={data.weekly} tick={tick} />
            </div>
          </div>

          {/* Per-kind */}
          {Object.keys(data.by_kind || {}).length > 0 && (
            <div className="card">
              <span className="mono-label text-cs-text-dim">// tokens this week, by surface</span>
              <div className="mt-3 rounded-lg border border-cs-line/10 overflow-hidden">
                {Object.entries(data.by_kind)
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, v], i) => {
                    const meta = KIND_META[k] || { label: k, icon: FiZap };
                    const max = Math.max(...Object.values(data.by_kind), 1);
                    return (
                      <div key={k} className={`flex items-center gap-3 px-4 py-2.5 ${i > 0 ? 'border-t border-cs-line/10' : ''}`}>
                        <meta.icon className="text-cs-text-muted shrink-0" />
                        <span className="font-mono text-sm text-cs-text w-40 sm:w-52 shrink-0">{meta.label}</span>
                        <div className="flex-1 hidden sm:block h-1.5 rounded-full bg-cs-overlay/10 overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-main" style={{ width: `${(v / max) * 100}%` }} />
                        </div>
                        <span className="font-mono text-xs text-cs-text-dim shrink-0">{fmtInt(v)}</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Plans */}
          <div>
            <span className="mono-label text-cs-text-dim">// plans</span>
            <div className="grid sm:grid-cols-2 gap-4 mt-3">
              {planList.map((p) => (
                <div
                  key={p.key}
                  className={`card flex flex-col ${p.current ? 'border-cs-primary/50 shadow-[0_0_30px_-12px_rgb(var(--cs-primary)/0.4)]' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-lg font-bold">{p.label}</h3>
                      <p className="text-sm text-cs-text-dim mt-1">{p.blurb}</p>
                    </div>
                    <span className="font-mono text-lg font-bold text-cs-primary shrink-0">{p.price}</span>
                  </div>
                  <ul className="mt-4 space-y-1.5 flex-1">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-cs-text-dim">
                        <FiCheckCircle className="text-cs-green mt-0.5 shrink-0" /> {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => choosePlan(p.key)}
                    disabled={busy || p.current}
                    className={`btn btn-sm w-full mt-5 font-mono ${p.current ? 'btn-ghost' : 'btn-primary'}`}
                  >
                    {p.current ? 'Current plan' : <>Switch to {p.label} <FiArrowRight /></>}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default Usage;
