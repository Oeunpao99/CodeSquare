import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiUsers, FiPlus, FiLogIn, FiX, FiBookOpen, FiClock, FiGrid, FiSearch } from 'react-icons/fi';
import { classService, teacherService } from '../services/api';
import { Sk } from '../components/Skeletons';
import LangLogo from '../components/LangLogo';
import CodeInput from '../components/class/CodeInput';
import { toast } from '../utils/toast';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#0EA5E9', '#F2C811', '#EC4899'];

function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center p-4 bg-black/50" onMouseDown={onClose}>
      <div className="card w-full max-w-md" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="text-cs-text-dim hover:text-cs-text" aria-label="Close"><FiX /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ClassCard({ c }) {
  const mine = c.role === 'teacher';
  const showSubject = c.subject && c.subject.trim().toLowerCase() !== (c.title || '').trim().toLowerCase();
  return (
    <Link
      to={`/classes/${c.id}`}
      className="group rounded-xl overflow-hidden border border-cs-line/10 bg-cs-dark text-cs-text flex flex-col hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
    >
      {/* Coloured header like the class banner: big faded mark sways, tile overlaps the edge */}
      <div className="relative h-24 px-5 pt-4 text-white overflow-hidden" style={{ background: c.color }}>
        <span className="pointer-events-none absolute -right-3 -bottom-8 class-sway" aria-hidden>
          <LangLogo name={c.subject || c.title} brand={false} className="text-[7rem] text-white/[0.16]" />
        </span>
        <p className="relative text-lg font-bold truncate pr-20">{c.title}</p>
        {showSubject && <p className="relative text-sm text-white/85 truncate">{c.subject}</p>}
        {mine && (
          <span className="absolute top-4 right-4 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/20">Instructor</span>
        )}
      </div>
      <div className="relative px-5 pb-4 flex-1 flex flex-col">
        <span className="-mt-7 mb-3 w-14 h-14 rounded-xl bg-white grid place-items-center text-[1.75rem] shadow-md ring-4 ring-[rgb(var(--cs-dark))] group-hover:class-bob"
          style={{ color: c.color }}>
          <LangLogo name={c.subject || c.title} />
        </span>
        {c.description && <p className="text-sm text-cs-text-dim line-clamp-2 mb-3">{c.description}</p>}
        <div className="mt-auto flex items-center justify-between gap-3 text-sm text-cs-text-dim">
          <span className="truncate">{mine ? 'You’re the instructor' : c.teacher.display_name}</span>
          <span className="inline-flex items-center gap-1.5 shrink-0"><FiUsers /> {c.student_count} student{c.student_count === 1 ? '' : 's'}</span>
        </div>
      </div>
    </Link>
  );
}

export default function Classes() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [teacher, setTeacher] = useState(undefined); // undefined = loading, null = never applied
  const [modal, setModal] = useState(null); // 'join' | 'create'
  const [code, setCode] = useState('');
  const [form, setForm] = useState({ title: '', subject: '', description: '', color: COLORS[0] });
  const [busy, setBusy] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [tab, setTab] = useState('all'); // all | teaching | enrolled
  const [search, setSearch] = useState('');
  const [codeStatus, setCodeStatus] = useState('idle'); // idle | verifying | error | success

  const load = () => classService.mine().then((r) => setData(r.data)).catch(() => setData({ teaching: [], enrolled: [] }));
  useEffect(() => {
    load();
    teacherService.me().then((r) => setTeacher(r.data)).catch(() => setTeacher(null));
  }, []);

  const isTeacher = teacher?.status === 'approved';

  const join = async (e, codeArg) => {
    e?.preventDefault();
    const c = codeArg || code;
    if (busy || c.length < 6) return;
    setBusy(true);
    setCodeStatus('verifying');
    const started = Date.now();
    const atLeast = async (ms) => { const left = ms - (Date.now() - started); if (left > 0) await new Promise((r) => setTimeout(r, left)); };
    try {
      const r = await classService.join(c);
      await atLeast(900);            // let the spin finish one wave
      setCodeStatus('success');
      await new Promise((res) => setTimeout(res, 550));
      toast.success(`Joined ${r.data.title}`);
      navigate(`/classes/${r.data.id}`);
    } catch (err) {
      await atLeast(700);
      setCodeStatus('error');
      toast.error(err.response?.data?.detail || 'Could not join that class.');
      setTimeout(() => { setCodeStatus('idle'); setCode(''); }, 650);
    } finally {
      setBusy(false);
    }
  };

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await classService.create(form);
      toast.success('Class created');
      navigate(`/classes/${r.data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not create the class.');
    } finally {
      setBusy(false);
    }
  };

  const empty = data && !data.teaching.length && !data.enrolled.length;
  const q = search.trim().toLowerCase();
  const pool = data ? (tab === 'teaching' ? data.teaching : tab === 'enrolled' ? data.enrolled : [...data.teaching, ...data.enrolled]) : [];
  const shown = pool.filter((c) => !q || `${c.title} ${c.subject || ''} ${c.teacher?.display_name || ''}`.toLowerCase().includes(q));
  const tabs = data ? [
    ['all', 'All', data.teaching.length + data.enrolled.length],
    ...(isTeacher || data.teaching.length ? [['teaching', 'Instructing', data.teaching.length]] : []),
    ['enrolled', 'Enrolled', data.enrolled.length],
  ] : [];

  return (
    <main className="w-full px-6 lg:px-10 py-8">
      <section>
        {/* Tabs + actions */}
        <div className="flex flex-wrap items-center gap-x-7 border-b border-cs-line/10">
          {tabs.map(([k, label, n]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`relative h-12 px-0.5 text-[0.9375rem] transition-colors ${tab === k ? 'text-cs-primary' : 'text-cs-text-dim hover:text-cs-text'}`}>
              {label}<span className="ml-1.5 text-xs text-cs-text-muted">{n}</span>
              {tab === k && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-cs-primary" />}
            </button>
          ))}
          {data === null && <span className="h-12" />}
          {data && !empty && (
          <label className="ml-auto my-2 h-9 w-full sm:w-72 flex items-center gap-2 px-3 rounded-lg border border-cs-line/15 focus-within:border-cs-primary/50 transition-colors">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search classes"
              className="flex-1 min-w-0 bg-transparent outline-none text-[0.9375rem] placeholder:text-cs-text-muted" />
            {search
              ? <button type="button" onClick={() => setSearch('')} className="text-cs-text-muted hover:text-cs-text"><FiX /></button>
              : <FiSearch className="text-cs-text-muted" />}
          </label>
          )}
        </div>
        <div className="h-6" />

        {data === null && (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => <Sk key={i} className="h-44 w-full rounded-xl" />)}
          </div>
        )}

        {empty && (
          <div className="text-center py-14 max-w-md mx-auto">
            <FiBookOpen className="text-3xl text-cs-text-muted mx-auto mb-3" />
            <h2 className="text-base font-semibold mb-1">No classes yet</h2>
            <p className="text-cs-text-dim text-sm mb-5">
              Got a class code from your instructor? Join to see the class materials.
            </p>
            <button onClick={() => setModal('join')} className="btn btn-primary btn-sm"><FiLogIn /> Join with code</button>
          </div>
        )}

        {data && !empty && shown.length === 0 && (
          <p className="text-center text-sm text-cs-text-dim py-14">
            {q ? `No classes match “${search}”.` : 'Nothing here yet.'}
          </p>
        )}

        {shown.length > 0 && (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {shown.map((c) => <ClassCard key={`${c.role}-${c.id}`} c={c} />)}
          </div>
        )}
      </section>

      {/* Floating ➕: students join; instructors get Join / Create */}
      {fabOpen && <div className="fixed inset-0 z-40" onClick={() => setFabOpen(false)} />}
      <div className="fixed bottom-16 right-12 z-50 flex flex-col items-end gap-3">
        {fabOpen && (
          <div className="flex flex-col items-end gap-2 animate-tab-in">
            <button
              onClick={() => { setFabOpen(false); setModal('create'); }}
              className="inline-flex items-center gap-2 pl-4 pr-3 h-11 rounded-full bg-cs-dark border border-cs-line/15 shadow-lg text-sm font-semibold hover:border-cs-primary/50"
            >
              Create class <span className="w-7 h-7 rounded-full bg-cs-primary/10 text-cs-primary grid place-items-center"><FiPlus /></span>
            </button>
            <button
              onClick={() => { setFabOpen(false); setModal('join'); }}
              className="inline-flex items-center gap-2 pl-4 pr-3 h-11 rounded-full bg-cs-dark border border-cs-line/15 shadow-lg text-sm font-semibold hover:border-cs-primary/50"
            >
              Join with code <span className="w-7 h-7 rounded-full bg-cs-primary/10 text-cs-primary grid place-items-center"><FiLogIn /></span>
            </button>
          </div>
        )}
        <button
          onClick={() => (isTeacher ? setFabOpen((v) => !v) : setModal('join'))}
          aria-label={isTeacher ? 'Join or create a class' : 'Join a class'}
          title={isTeacher ? 'Join or create a class' : 'Join a class'}
          className="w-14 h-14 rounded-full bg-cs-primary text-white grid place-items-center shadow-xl hover:scale-105 active:scale-95 transition-transform"
        >
          <FiPlus className={`text-2xl transition-transform duration-200 ${fabOpen ? 'rotate-45' : ''}`} />
        </button>
      </div>

      {modal === 'join' && (
        <Modal title="Join a class" onClose={() => setModal(null)}>
          <form onSubmit={join} className="space-y-4">
            <p className="text-sm text-cs-text-dim">Enter the class code your instructor gave you.</p>
            <CodeInput
              autoFocus
              value={code}
              onChange={setCode}
              onComplete={(c) => join(null, c)}
              status={codeStatus}
            />
            <button type="submit" disabled={busy || code.length < 6} className="btn btn-primary w-full justify-center">
              {codeStatus === 'verifying' ? 'Verifying…' : codeStatus === 'success' ? 'Joined!' : 'Join class'}
            </button>
          </form>
        </Modal>
      )}

      {modal === 'create' && (
        <Modal title="Create a class" onClose={() => setModal(null)}>
          <form onSubmit={create} className="space-y-3">
            <label className="block text-sm">
              <span className="font-medium">Class name</span>
              <input autoFocus required minLength={2} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Power BI — Batch 1 (Dec 2026)" className="input w-full mt-1" />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Subject</span>
              <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="Power BI" className="input w-full mt-1" />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Description</span>
              <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Mon–Fri, 3:00–4:00pm · 30 sessions" className="input w-full mt-1" />
            </label>
            <div className="text-sm">
              <span className="font-medium">Colour</span>
              <div className="flex gap-2 mt-1.5">
                {COLORS.map((col) => (
                  <button type="button" key={col} onClick={() => setForm({ ...form, color: col })}
                    className={`w-7 h-7 rounded-full ${form.color === col ? 'ring-2 ring-offset-2 ring-cs-primary ring-offset-cs-darker' : ''}`}
                    style={{ background: col }} aria-label={`Colour ${col}`} />
                ))}
              </div>
            </div>
            <button type="submit" disabled={busy} className="btn btn-primary w-full justify-center !mt-5">
              {busy ? 'Creating…' : 'Create class'}
            </button>
          </form>
        </Modal>
      )}
    </main>
  );
}
