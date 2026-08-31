import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FiShield, FiSearch, FiCheck, FiChevronRight, FiChevronDown, FiExternalLink,
} from 'react-icons/fi';
import { adminService } from '../../services/adminApi';

const COLS = '2.4fr 96px 120px 90px 128px 168px 34px';

const fmtTok = (n) => {
  n = Number(n) || 0;
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return Math.round(n / 1e3) + 'K';
  return String(n);
};
const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
const fmtAgo = (iso) => {
  if (!iso) return 'never';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

const AVATAR_TINT = ['#2dd4bf', '#8b5cf6', '#22d3ee', '#4ade80', '#fb923c', '#f87171'];
const tintFor = (id) => AVATAR_TINT[id % AVATAR_TINT.length];

function PlanBadge({ plan }) {
  const pro = plan === 'pro';
  return (
    <span
      className={`inline-flex items-center px-2.5 py-[3px] rounded-full font-mono text-[11px] font-semibold ${
        pro ? 'bg-cs-primary/15 text-cs-primary' : 'border border-cs-line/15 text-cs-text-dim'
      }`}
    >
      {pro ? 'Pro' : 'Free'}
    </span>
  );
}

function Avatar({ user, size = 34 }) {
  const tint = tintFor(user.id);
  const letter = (user.display_name || user.username || '?').charAt(0).toUpperCase();
  return user.avatar ? (
    <img
      src={user.avatar}
      alt=""
      style={{ width: size, height: size }}
      className="flex-none rounded-[9px] object-cover"
    />
  ) : (
    <span
      style={{ width: size, height: size, background: `${tint}22`, color: tint }}
      className="flex-none rounded-[9px] flex items-center justify-center font-mono font-bold"
    >
      {letter}
    </span>
  );
}

function StatTile({ label, children }) {
  return (
    <div className="rounded-2xl bg-cs-darker/60 border border-cs-line/10 p-4">
      <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-cs-text-muted">{label}</div>
      <div className="font-mono text-2xl font-bold mt-1.5">{children}</div>
    </div>
  );
}

export default function AdminUsers() {
  const [stats, setStats] = useState(null);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState('');
  const [qDebounced, setQDebounced] = useState('');
  const [plan, setPlan] = useState('all');
  const [order, setOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const [openId, setOpenId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => { setPage(1); }, [qDebounced, plan, order]);

  const loadStats = useCallback(() => {
    adminService.stats().then((r) => setStats(r.data)).catch(() => {});
  }, []);
  useEffect(() => { loadStats(); }, [loadStats]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    adminService
      .users({
        q: qDebounced || undefined,
        plan: plan === 'all' ? undefined : plan,
        sort: 'created_at',
        order,
        page,
        page_size: pageSize,
      })
      .then((r) => {
        if (!alive) return;
        setRows(r.data.users);
        setTotal(r.data.total);
      })
      .catch(() => alive && setRows([]))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [qDebounced, plan, order, page]);

  const toggleRow = (id) => {
    if (openId === id) { setOpenId(null); setDetail(null); return; }
    setOpenId(id);
    setDetail(null);
    setDetailLoading(true);
    adminService
      .user(id)
      .then((r) => setDetail(r.data))
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
  };

  const patchUser = async (id, body) => {
    setSaving(true);
    try {
      const r = await adminService.updateUser(id, body);
      setRows((prev) => prev.map((u) => (u.id === id ? { ...u, ...r.data } : u)));
      setDetail((d) => (d && d.id === id ? { ...d, ...r.data } : d));
      loadStats();
    } catch (err) {
      alert(err?.response?.data?.detail || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const maxKind = useMemo(
    () => Math.max(1, ...(detail?.usage_7d_by_kind || []).map((k) => k.tokens)),
    [detail]
  );

  return (
    <div>
      {/* header */}
      <header className="sticky top-0 z-10 px-10 py-4 bg-cs-dark/85 backdrop-blur-xl border-b border-cs-line/[0.07]">
        <div className="mono-label text-cs-cyan">// admin</div>
        <h1 className="mt-2 text-3xl font-bold flex items-center gap-3">
          <FiShield className="text-cs-primary" /> Users
          {stats && (
            <span className="font-mono text-xs font-semibold text-cs-text-dim border border-cs-line/12 rounded-full px-2.5 py-0.5 mb-0.5">
              {stats.total_users.toLocaleString()}
            </span>
          )}
        </h1>
      </header>

      <div className="px-10 py-6 flex flex-col gap-5">
        {/* stat tiles */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          <StatTile label="total users">{stats ? stats.total_users.toLocaleString() : '—'}</StatTile>
          <StatTile label="free / pro">
            {stats ? (
              <>
                <span className="text-cs-text-dim">{stats.plan_free.toLocaleString()}</span>
                <span className="text-cs-text-muted text-base"> / </span>
                <span className="text-cs-primary">{stats.plan_pro.toLocaleString()}</span>
              </>
            ) : '—'}
          </StatTile>
          <StatTile label="new · 7d">
            <span className="text-cs-green">{stats ? `+${stats.new_7d}` : '—'}</span>
          </StatTile>
          <StatTile label="active · 7d">{stats ? stats.active_7d.toLocaleString() : '—'}</StatTile>
          <StatTile label="ai tokens · 7d">
            <span className="text-cs-primary">{stats ? fmtTok(stats.tokens_7d) : '—'}</span>
          </StatTile>
        </div>

        {/* filter bar */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[260px] max-w-[420px]">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-cs-text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search email, username or name"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl font-mono text-[13px] bg-cs-overlay/5 border border-cs-line/10 text-cs-text outline-none focus:border-cs-primary"
            />
          </div>
          <div className="flex gap-0.5 p-0.5 rounded-xl border border-cs-line/12 bg-cs-overlay/[0.03] font-mono text-[13px]">
            {['all', 'free', 'pro'].map((p) => (
              <button
                key={p}
                onClick={() => setPlan(p)}
                className={`px-3 py-1.5 rounded-lg capitalize transition-colors ${
                  plan === p ? 'bg-cs-primary/15 text-cs-primary' : 'text-cs-text-dim hover:text-cs-text'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <button
            onClick={() => setOrder((o) => (o === 'desc' ? 'asc' : 'desc'))}
            className="inline-flex items-center gap-1.5 px-3 py-2 font-mono text-[13px] text-cs-text-dim border border-cs-line/12 rounded-xl bg-cs-overlay/[0.03] hover:text-cs-text"
          >
            Joined {order === 'desc' ? '↓' : '↑'}
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-2.5 font-mono text-[12px] text-cs-text-muted">
            <span>{from}–{to} of {total.toLocaleString()}</span>
            <div className="flex gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="w-7 h-7 rounded-lg border border-cs-line/12 flex items-center justify-center disabled:opacity-30 hover:text-cs-text"
              >
                <FiChevronRight className="rotate-180 text-sm" />
              </button>
              <button
                disabled={to >= total}
                onClick={() => setPage((p) => p + 1)}
                className="w-7 h-7 rounded-lg border border-cs-line/12 flex items-center justify-center disabled:opacity-30 hover:text-cs-text"
              >
                <FiChevronRight className="text-sm" />
              </button>
            </div>
          </div>
        </div>

        {/* table */}
        <div className="rounded-2xl bg-cs-darker border border-cs-line/10 overflow-hidden">
          <div
            className="grid gap-3.5 px-[18px] py-3 font-mono text-[10px] uppercase tracking-[0.14em] text-cs-text-muted bg-cs-overlay/[0.02] border-b border-cs-line/8"
            style={{ gridTemplateColumns: COLS }}
          >
            <span>User</span><span>Plan</span><span>Joined</span><span>Onboard</span>
            <span>Flags</span><span>AI tokens · 7d / total</span><span />
          </div>

          {loading && rows.length === 0 && (
            <div className="px-[18px] py-10 text-center font-mono text-[12px] text-cs-text-muted">loading…</div>
          )}
          {!loading && rows.length === 0 && (
            <div className="px-[18px] py-10 text-center font-mono text-[12px] text-cs-text-muted">no users match</div>
          )}

          {rows.map((u) => {
            const open = openId === u.id;
            return (
              <div key={u.id} className={open ? 'bg-cs-primary/[0.03] border-b border-cs-line/5' : 'border-b border-cs-line/5'}>
                <button
                  onClick={() => toggleRow(u.id)}
                  className="w-full text-left grid gap-3.5 px-[18px] py-3.5 items-center hover:bg-cs-overlay/[0.025]"
                  style={{ gridTemplateColumns: COLS }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar user={u} />
                    <div className="min-w-0">
                      <div className="font-semibold text-[13.5px] truncate">
                        {u.display_name || u.username}{' '}
                        <span className="font-mono font-normal text-cs-text-muted">@{u.username}</span>
                      </div>
                      <div className="font-mono text-[11.5px] text-cs-text-muted truncate">{u.email}</div>
                    </div>
                  </div>
                  <div><PlanBadge plan={u.plan} /></div>
                  <div className="font-mono text-[12px] text-cs-text-dim">{fmtDate(u.created_at)}</div>
                  <div>{u.onboarded ? <FiCheck className="text-cs-green" /> : <span className="font-mono text-[11px] text-cs-text-muted">—</span>}</div>
                  <div className="flex gap-1.5">
                    {u.is_admin && (
                      <span className="font-mono text-[9px] font-semibold tracking-wider px-2 py-[2px] rounded-full border border-cs-primary/40 bg-cs-primary/10 text-cs-primary">ADMIN</span>
                    )}
                    {u.is_staff && (
                      <span className="font-mono text-[9px] font-semibold tracking-wider px-2 py-[2px] rounded-full border border-cs-violet/40 bg-cs-violet/10 text-cs-violet">STAFF</span>
                    )}
                    {!u.is_admin && !u.is_staff && <span className="font-mono text-[11px] text-cs-text-muted">—</span>}
                  </div>
                  <div className="font-mono text-[12px]">
                    <span className="text-cs-text">{fmtTok(u.tokens_7d)}</span>{' '}
                    <span className="text-cs-text-muted">/ {fmtTok(u.tokens_total)}</span>
                  </div>
                  <div className="text-cs-text-muted">
                    {open ? <FiChevronDown className="text-cs-primary text-base" /> : <FiChevronRight className="text-base" />}
                  </div>
                </button>

                {open && (
                  <div className="px-[18px] pb-6 pl-[64px]">
                    {detailLoading && <div className="font-mono text-[12px] text-cs-text-muted py-2">loading…</div>}
                    {detail && detail.id === u.id && (
                      <div className="grid md:grid-cols-3 gap-7 pt-1">
                        {/* usage */}
                        <div>
                          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-cs-text-muted mb-2.5">Usage · last 7 days</div>
                          <div className="flex flex-col gap-2">
                            {detail.usage_7d_by_kind.length === 0 && (
                              <div className="font-mono text-[12px] text-cs-text-muted">no AI usage</div>
                            )}
                            {detail.usage_7d_by_kind.map((k) => (
                              <div key={k.kind} className="grid items-center gap-2.5" style={{ gridTemplateColumns: '64px 1fr 52px' }}>
                                <span className="font-mono text-[12px] text-cs-text-dim">{k.kind}</span>
                                <span className="h-1.5 rounded-full bg-cs-overlay/[0.07] overflow-hidden">
                                  <span className="block h-full rounded-full bg-cs-primary" style={{ width: `${Math.max(3, (k.tokens / maxKind) * 100)}%` }} />
                                </span>
                                <span className="font-mono text-[11px] text-cs-text-muted text-right">{fmtTok(k.tokens)}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* activity */}
                        <div>
                          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-cs-text-muted mb-2.5">Activity</div>
                          <div className="font-mono text-[12.5px] text-cs-text-dim leading-[2]">
                            Lessons&nbsp;&nbsp;<span className="text-cs-text">{detail.lessons_completed}</span><br />
                            Projects&nbsp;&nbsp;<span className="text-cs-text">{detail.projects}</span><br />
                            Challenges&nbsp;&nbsp;<span className="text-cs-text">{detail.challenges_passed}</span><br />
                            Quizzes&nbsp;&nbsp;<span className="text-cs-text">{detail.quizzes_passed}</span><br />
                            Last active&nbsp;&nbsp;<span className="text-cs-text">{fmtAgo(detail.last_active)}</span>
                          </div>
                        </div>

                        {/* manage */}
                        <div>
                          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-cs-text-muted mb-2.5">Manage</div>
                          <div className="flex flex-col gap-3 items-start">
                            <label className="flex items-center gap-2 font-mono text-[12px] text-cs-text-dim">
                              Plan
                              <select
                                value={detail.plan}
                                disabled={saving}
                                onChange={(e) => patchUser(u.id, { plan: e.target.value })}
                                className="px-2.5 py-1.5 rounded-lg bg-cs-overlay/5 border border-cs-line/14 text-cs-primary outline-none"
                              >
                                <option value="free">Free</option>
                                <option value="pro">Pro</option>
                              </select>
                            </label>
                            <label className="flex items-center gap-2 font-mono text-[12px] text-cs-text-dim cursor-pointer">
                              <input
                                type="checkbox"
                                checked={detail.is_staff}
                                disabled={saving}
                                onChange={(e) => patchUser(u.id, { is_staff: e.target.checked })}
                              />
                              Staff (moderate community)
                            </label>
                            <label className="flex items-center gap-2 font-mono text-[12px] text-cs-text-dim cursor-pointer">
                              <input
                                type="checkbox"
                                checked={detail.is_admin}
                                disabled={saving}
                                onChange={(e) => patchUser(u.id, { is_admin: e.target.checked })}
                              />
                              Admin (portal access)
                            </label>
                            <a
                              href={`/u/${u.username}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 font-mono text-[12px] text-cs-primary hover:text-cs-mint mt-0.5"
                            >
                              View public profile <FiExternalLink className="text-[13px]" />
                            </a>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
