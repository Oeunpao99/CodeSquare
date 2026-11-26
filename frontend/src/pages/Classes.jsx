import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiUsers, FiPlus, FiLogIn, FiX, FiBookOpen, FiClock, FiGrid } from 'react-icons/fi';
import { classService, teacherService } from '../services/api';
import { Sk } from '../components/Skeletons';
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
  return (
    <Link
      to={`/classes/${c.id}`}
      className="group card !p-0 overflow-hidden flex flex-col text-cs-text hover:border-cs-primary/40 transition-colors"
    >
      <div className="h-20 px-5 flex items-end pb-3" style={{ background: c.color }}>
        <span className="text-white/90 text-xs font-semibold">{c.subject || 'Class'}</span>
      </div>
      <div className="p-5 flex flex-col gap-2 flex-1">
        <h3 className="font-bold text-lg leading-snug group-hover:text-cs-primary transition-colors">{c.title}</h3>
        {c.description && <p className="text-sm text-cs-text-dim line-clamp-2">{c.description}</p>}
        <div className="mt-auto pt-3 flex items-center gap-4 text-sm text-cs-text-dim">
          <span>{c.role === 'teacher' ? 'You’re the instructor' : `Instructor: ${c.teacher.display_name}`}</span>
          <span className="inline-flex items-center gap-1 ml-auto"><FiUsers /> {c.student_count}</span>
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

  return (
    <main className="w-full px-6 lg:px-10 py-8">
      <div className="sticky top-0 z-30 -mx-6 lg:-mx-10 px-6 lg:px-10 py-4 -mt-8 mb-6 bg-cs-dark/85 backdrop-blur-xl border-b border-cs-line/[0.07]">
        <div className="flex flex-wrap items-end justify-between gap-4 lg:pr-52">
          <div>
            <span className="mono-label">Classes</span>
            <h1 className="text-3xl font-bold mt-2 flex items-center gap-3">
              <FiGrid className="text-cs-primary" /> My Classes
            </h1>
          </div>
        </div>
      </div>

      {data === null && (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card !p-0 overflow-hidden">
              <Sk className="h-20 w-full rounded-none" />
              <div className="p-5 space-y-3"><Sk className="h-5 w-2/3" /><Sk className="h-3.5 w-full" /></div>
            </div>
          ))}
        </div>
      )}

      {empty && (
        <div className="card text-center py-14 max-w-xl mx-auto">
          <FiBookOpen className="text-4xl text-cs-primary mx-auto mb-3" />
          <h2 className="text-lg font-bold mb-1">No classes yet</h2>
          <p className="text-cs-text-dim text-sm mb-5">
            Got a class code from your instructor? Join to see the class materials.
          </p>
          <button onClick={() => setModal('join')} className="btn btn-primary btn-sm"><FiLogIn /> Join with code</button>
        </div>
      )}

      {data && data.teaching.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-bold mb-4">Instructing</h2>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {data.teaching.map((c) => <ClassCard key={c.id} c={c} />)}
          </div>
        </section>
      )}

      {data && data.enrolled.length > 0 && (
        <section>
          <h2 className="text-lg font-bold mb-4">Enrolled</h2>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {data.enrolled.map((c) => <ClassCard key={c.id} c={c} />)}
          </div>
        </section>
      )}

      {/* Floating ➕: students join; instructors get Join / Create */}
      {fabOpen && <div className="fixed inset-0 z-40" onClick={() => setFabOpen(false)} />}
      <div className="fixed bottom-24 right-12 z-50 flex flex-col items-end gap-3">
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
