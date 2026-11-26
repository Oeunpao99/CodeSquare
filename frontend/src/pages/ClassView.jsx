import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  FiArrowLeft, FiCopy, FiRefreshCw, FiFileText, FiLink, FiPaperclip, FiPlus, FiTrash2,
  FiEye, FiEyeOff, FiDownload, FiExternalLink, FiChevronDown, FiUsers, FiUpload, FiLogOut, FiCalendar,
} from 'react-icons/fi';
import { motion } from 'framer-motion';
import { classService } from '../services/api';
import Markdown from '../components/Markdown';
import { Sk } from '../components/Skeletons';
import NotFound from './NotFound';
import Dialog from '../components/class/Dialog';
import FileDrop from '../components/class/FileDrop';
import AddStudentDialog from '../components/class/AddStudentDialog';
import TelegramDialog, { TelegramIcon } from '../components/class/TelegramDialog';
import StreamTab from '../components/class/StreamTab';
import QuizzesTab from '../components/class/QuizzesTab';
import AssignmentsTab from '../components/class/AssignmentsTab';
import GradesTab from '../components/class/GradesTab';
import { toast } from '../utils/toast';
import { confirmDialog } from '../utils/confirm';

const fmtSize = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
const KIND_ICON = { note: FiFileText, link: FiLink, file: FiPaperclip };

function sectionStatus(s) {
  if (!s.published) return { label: 'Draft', cls: 'bg-cs-overlay/10 text-cs-text-dim' };
  if (s.release_at && new Date(s.release_at + 'Z') > new Date()) {
    return { label: `Opens ${new Date(s.release_at + 'Z').toLocaleDateString()}`, cls: 'bg-cs-orange text-white' };
  }
  return { label: 'Published', cls: 'bg-cs-green text-white' };
}

// ------------------------------------------------------------------ material row
function MaterialRow({ cid, m, isTeacher, onDeleted }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const Icon = KIND_ICON[m.kind] || FiFileText;

  const openFile = async () => {
    setBusy(true);
    try {
      const viewable = /^(application\/pdf|image\/)/.test(m.content_type || '');
      const r = await classService.fileBlob(cid, m.id, viewable);
      const url = URL.createObjectURL(r.data);
      if (viewable) {
        window.open(url, '_blank', 'noopener');
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = m.file_name || 'file';
        a.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      toast.error('Could not open the file.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!(await confirmDialog({ title: 'Delete this material?', message: `"${m.title}" will be removed for everyone in the class.` }))) return;
    await classService.deleteMaterial(cid, m.id);
    onDeleted();
  };

  return (
    <li className="px-5 py-3">
      <div className="flex items-center gap-3">
        <span className="w-9 h-9 rounded-lg bg-cs-primary/10 text-cs-primary grid place-items-center shrink-0"><Icon /></span>
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate">{m.title}</p>
          <p className="text-xs text-cs-text-dim truncate">
            {m.kind === 'file' && `${m.file_name} · ${fmtSize(m.file_size || 0)}`}
            {m.kind === 'link' && host(m.url)}
            {m.kind === 'note' && 'Note'}
          </p>
        </div>
        {m.kind === 'note' && (
          <button onClick={() => setOpen((v) => !v)} className="btn btn-ghost btn-sm">
            {open ? 'Hide' : 'Read'} <FiChevronDown className={open ? 'rotate-180' : ''} />
          </button>
        )}
        {m.kind === 'link' && (
          <a href={m.url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
            Open <FiExternalLink />
          </a>
        )}
        {m.kind === 'file' && (
          <button onClick={openFile} disabled={busy} className="btn btn-ghost btn-sm">
            {busy ? 'Opening…' : <>Open <FiDownload /></>}
          </button>
        )}
        {isTeacher && (
          <button onClick={remove} className="p-2 text-cs-text-dim hover:text-cs-red" title="Delete" aria-label="Delete">
            <FiTrash2 />
          </button>
        )}
      </div>
      {open && m.body && (
        <div className="mt-3 ml-12 rounded-lg bg-cs-overlay/[0.04] p-4">
          <Markdown text={m.body} />
        </div>
      )}
    </li>
  );
}

// -------------------------------------------------------------- add material form
function AddMaterial({ cid, sid, onAdded }) {
  const [kind, setKind] = useState(null); // note | link | file
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState(null);
  const [pct, setPct] = useState(null);
  const [error, setError] = useState('');

  const reset = () => { setKind(null); setTitle(''); setBody(''); setUrl(''); setFile(null); setPct(null); setError(''); };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (kind === 'file') {
        if (!file) return;
        setPct(0);
        await classService.uploadFile(cid, sid, file, title, (ev) => ev.total && setPct(Math.round((ev.loaded / ev.total) * 100)));
      } else {
        await classService.addMaterial(cid, sid, { kind, title, body, url: kind === 'link' ? url : undefined });
      }
      toast.success('Added');
      reset();
      onAdded();
    } catch (err) {
      setPct(null);
      const d = err.response?.data?.detail;
      const msg = (Array.isArray(d) ? d[0]?.msg : d)
        || (err.response ? `Upload failed (error ${err.response.status}).` : 'Can’t reach the server. Check your connection and try again.');
      setError(msg);
      toast.error(msg);
    }
  };

  const LABEL = { file: 'Upload a file', link: 'Add a link', note: 'Write a note' };

  return (
    <>
      <div className="px-5 py-3 flex flex-wrap items-center gap-2 border-t border-cs-line/10">
        <span className="text-sm text-cs-text-dim mr-1">Add:</span>
        <button onClick={() => setKind('file')} className="btn btn-ghost btn-sm"><FiUpload /> File</button>
        <button onClick={() => setKind('link')} className="btn btn-ghost btn-sm"><FiLink /> Link</button>
        <button onClick={() => setKind('note')} className="btn btn-ghost btn-sm"><FiFileText /> Note</button>
      </div>

      {kind && (
        <Dialog
          title={LABEL[kind]}
          onClose={() => pct === null && reset()}
          footer={<>
            <button type="button" onClick={reset} disabled={pct !== null} className="btn btn-ghost">Cancel</button>
            <button type="submit" form="add-material" disabled={pct !== null || (kind === 'file' && !file)} className="btn btn-primary">
              {pct !== null ? `Uploading ${pct}%` : kind === 'file' ? 'Upload' : 'Add'}
            </button>
          </>}
        >
          <form id="add-material" onSubmit={submit} className="space-y-4">
            {kind === 'file' && (
              <FileDrop file={file} onFile={setFile} disabled={pct !== null} hint="Slides, PDF, .pbix, datasets" />
            )}
            <label className="block text-sm">
              <span className="font-medium">Title{kind === 'file' && <span className="text-cs-text-dim font-normal"> (optional, defaults to the file name)</span>}</span>
              <input autoFocus={kind !== 'file'} value={title} onChange={(e) => setTitle(e.target.value)} required={kind !== 'file'}
                placeholder={kind === 'link' ? 'Day 1 slides' : kind === 'note' ? 'Welcome' : 'D01 Slides'} className="input w-full mt-1.5" />
            </label>
            {kind === 'link' && (
              <label className="block text-sm">
                <span className="font-medium">Link</span>
                <input type="url" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className="input w-full mt-1.5" />
              </label>
            )}
            {kind === 'note' && (
              <label className="block text-sm">
                <span className="font-medium">Note <span className="text-cs-text-dim font-normal">(Markdown supported)</span></span>
                <textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} className="input w-full mt-1.5" />
              </label>
            )}
            {pct !== null && (
              <div className="h-2 rounded-full bg-cs-overlay/10 overflow-hidden">
                <div className="h-full bg-cs-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
            )}
            {error && (
              <p role="alert" className="rounded-lg bg-cs-red/10 text-cs-red text-sm px-3 py-2">{error}</p>
            )}
          </form>
        </Dialog>
      )}
    </>
  );
}

// ------------------------------------------------------------------------ page
export default function ClassView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [cls, setCls] = useState(null);
  const [missing, setMissing] = useState(false);
  const [searchParams] = useSearchParams();
  // Links from Telegram / notifications can open a specific tab: ?tab=assignments
  const TABS = ['stream', 'materials', 'quizzes', 'assignments', 'people', 'grades'];
  const [tab, setTab] = useState(() => (TABS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'stream'));
  const [members, setMembers] = useState(null);
  const [newSection, setNewSection] = useState({ title: '', published: true, release_at: '' });
  const [addingSection, setAddingSection] = useState(false);
  const [addingStudent, setAddingStudent] = useState(false);
  const [tgOpen, setTgOpen] = useState(false);

  const load = useCallback(() => {
    classService.get(id)
      .then((r) => setCls(r.data))
      .catch(() => setMissing(true));
  }, [id, navigate]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (tab === 'people' && cls?.role === 'teacher') classService.members(id).then((r) => setMembers(r.data));
  }, [tab, cls?.role, id]);

  if (missing) {
    return (
      <NotFound title="Class not found" />
    );
  }

  if (!cls) {
    return (
      <main className="w-full px-6 lg:px-10 py-8 space-y-6">
        <Sk className="h-40 w-full rounded-2xl" />
        <Sk className="h-48 w-full rounded-2xl" />
      </main>
    );
  }

  const isTeacher = cls.role === 'teacher';

  const copyCode = async () => {
    await navigator.clipboard.writeText(cls.join_code);
    toast.success('Code copied');
  };
  const rotate = async () => {
    if (!(await confirmDialog({ title: 'Make a new class code?', message: 'The current code will stop working. Students already in the class stay in it.', confirmLabel: 'Make new code', danger: false }))) return;
    const r = await classService.rotateCode(id);
    setCls({ ...cls, join_code: r.data.join_code });
  };
  const toggleJoining = async () => {
    const r = await classService.update(id, { code_enabled: !cls.code_enabled });
    setCls({ ...cls, code_enabled: r.data.code_enabled });
  };
  const leave = async () => {
    if (!(await confirmDialog({ title: 'Leave this class?', message: `You'll lose access to ${cls.title} until you join again with a code.`, confirmLabel: 'Leave class' }))) return;
    await classService.leave(id);
    navigate('/classes');
  };
  const addSection = async (e) => {
    e.preventDefault();
    await classService.addSection(id, {
      title: newSection.title,
      published: newSection.published,
      release_at: newSection.release_at ? new Date(newSection.release_at).toISOString().slice(0, 19) : null,
    });
    setNewSection({ title: '', published: true, release_at: '' });
    setAddingSection(false);
    load();
  };
  const togglePublish = async (s) => {
    await classService.updateSection(id, s.id, { published: !s.published });
    load();
  };
  const deleteSection = async (s) => {
    if (!(await confirmDialog({ title: `Delete "${s.title}"?`, message: 'This week and all its materials and files will be deleted. This can’t be undone.' }))) return;
    await classService.deleteSection(id, s.id);
    load();
  };

  return (
    <main className="w-full px-6 lg:px-10 py-6">
      <div className="sticky top-0 z-30 bg-cs-dark/85 backdrop-blur-xl border-b border-cs-line/[0.07] -mx-6 lg:-mx-10 px-6 lg:px-10 lg:pr-52 py-3 -mt-4 mb-6 flex items-center gap-3">
        <Link to="/classes" className="inline-flex items-center gap-1.5 text-sm text-cs-text-dim hover:text-cs-text shrink-0">
          <FiArrowLeft /> Classes
        </Link>
        <span className="text-cs-text-muted">/</span>
        <span className="font-semibold truncate">{cls.title}</span>
      </div>

      {/* Header: one coloured banner; class code inline (teacher) */}
      <section className="rounded-2xl overflow-hidden mb-6 text-white" style={{ background: cls.color }}>
        <div className="px-6 py-6 flex flex-col md:flex-row md:items-end gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-white/85 text-sm font-semibold">{cls.subject || 'Class'}</p>
            <h1 className="text-3xl font-bold mt-1">{cls.title}</h1>
            <p className="text-sm text-white/85 mt-2">
              {cls.teacher.display_name} · {cls.student_count} student{cls.student_count === 1 ? '' : 's'}
            </p>
            {cls.description && <p className="mt-2 text-sm text-white/90 whitespace-pre-line max-w-2xl">{cls.description}</p>}
          </div>

          {isTeacher ? (
            <div className="shrink-0 md:text-right">
              <p className="text-xs text-white/80">{cls.code_enabled ? 'Class code' : 'Joining closed'}</p>
              <div className="flex items-center md:justify-end gap-1">
                <span className={`text-2xl font-bold tracking-[0.2em] ${cls.code_enabled ? '' : 'line-through opacity-60'}`}>{cls.join_code}</span>
                <button onClick={copyCode} className="p-1.5 rounded-md hover:bg-white/15" title="Copy code" aria-label="Copy code"><FiCopy /></button>
                <button onClick={rotate} className="p-1.5 rounded-md hover:bg-white/15" title="New code" aria-label="New code"><FiRefreshCw /></button>
              </div>
              <button onClick={toggleJoining} className="text-xs text-white/85 hover:text-white underline underline-offset-2">
                {cls.code_enabled ? 'Stop new students joining' : 'Let students join again'}
              </button>
              <button onClick={() => setTgOpen(true)}
                className="mt-2 flex md:ml-auto items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white/15 hover:bg-white/25">
                <TelegramIcon className="w-4 h-4" /> Telegram alerts
              </button>
            </div>
          ) : (
            <button onClick={leave} className="shrink-0 self-start md:self-end inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-white/15 hover:bg-white/25">
              <FiLogOut /> Leave class
            </button>
          )}
        </div>
      </section>

      {/* Tabs: everyone sees the class work; the teacher also gets People + Grades. */}
      <div className="flex gap-1 mb-6 border-b border-cs-line/10 overflow-x-auto">
        {[
          ['stream', 'Stream'],
          ['materials', 'Materials'],
          ['quizzes', 'Quizzes'],
          ['assignments', 'Assignments'],
          ...(isTeacher ? [['people', 'People'], ['grades', 'Grades']] : []),
        ].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`relative h-11 px-4 text-sm whitespace-nowrap transition-colors duration-200 ${tab === k ? 'text-cs-primary font-semibold' : 'text-cs-text-dim hover:text-cs-text'}`}>
            {label}
            {/* One underline that slides between tabs */}
            {tab === k && (
              <motion.span
                layoutId="class-tab-underline"
                className="absolute left-0 right-0 -bottom-px h-0.5 rounded-full bg-cs-primary"
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Re-keyed per tab so each switch fades + rises in gently */}
      <div key={tab} className="animate-tab-in">
      {tab === 'stream' && <StreamTab cid={id} isTeacher={isTeacher} />}
      {tab === 'quizzes' && <QuizzesTab cid={id} isTeacher={isTeacher} />}
      {tab === 'assignments' && <AssignmentsTab cid={id} isTeacher={isTeacher} />}
      {tab === 'grades' && isTeacher && <GradesTab cid={id} classTitle={cls.title} />}

      {tab === 'materials' && (
        <div className="space-y-5">
          {isTeacher && (
            <button onClick={() => setAddingSection(true)} className="btn btn-primary">
              <FiPlus /> Add week
            </button>
          )}
          {cls.sections.length === 0 && (
            <p className="py-10 text-center text-sm text-cs-text-dim">
              {isTeacher ? 'Add your first week to start sharing materials.' : 'Your instructor hasn’t shared any materials yet.'}
            </p>
          )}

          {cls.sections.map((s) => {
            const st = sectionStatus(s);
            return (
              <section key={s.id} className="card !p-0 overflow-hidden">
                <header className="flex items-center gap-3 px-5 py-4 border-b border-cs-line/10">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-bold">{s.title}</h2>
                    {s.description && <p className="text-sm text-cs-text-dim">{s.description}</p>}
                  </div>
                  {isTeacher && (
                    <>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${st.cls}`}>{st.label}</span>
                      <button onClick={() => togglePublish(s)} className="btn btn-ghost btn-sm" title={s.published ? 'Hide from students' : 'Show to students'}>
                        {s.published ? <><FiEyeOff /> Unpublish</> : <><FiEye /> Publish</>}
                      </button>
                      <button onClick={() => deleteSection(s)} className="p-2 text-cs-text-dim hover:text-cs-red" title="Delete section" aria-label="Delete section">
                        <FiTrash2 />
                      </button>
                    </>
                  )}
                </header>
                {s.materials.length > 0 ? (
                  <ul className="divide-y divide-cs-line/10">
                    {s.materials.map((m) => (
                      <MaterialRow key={m.id} cid={id} m={m} isTeacher={isTeacher} onDeleted={load} />
                    ))}
                  </ul>
                ) : (
                  <p className="px-5 py-4 text-sm text-cs-text-dim">Nothing here yet.</p>
                )}
                {isTeacher && <AddMaterial cid={id} sid={s.id} onAdded={load} />}
              </section>
            );
          })}

        </div>
      )}

      {tgOpen && <TelegramDialog cid={id} onClose={() => setTgOpen(false)} />}

      {addingStudent && (
        <AddStudentDialog
          cid={id}
          onClose={() => setAddingStudent(false)}
          onAdded={(m) => {
            setMembers((list) => [...(list || []), m]);
            setCls((c) => ({ ...c, student_count: c.student_count + 1 }));
          }}
        />
      )}

      {addingSection && (
        <Dialog
          title="Add week / section"
          onClose={() => setAddingSection(false)}
          footer={<>
            <button type="button" onClick={() => setAddingSection(false)} className="btn btn-ghost">Cancel</button>
            <button type="submit" form="add-section" disabled={!newSection.title.trim()} className="btn btn-primary">Add section</button>
          </>}
        >
          <form id="add-section" onSubmit={addSection} className="space-y-4">
            <label className="block text-sm">
              <span className="font-medium">Name</span>
              <input autoFocus required value={newSection.title} onChange={(e) => setNewSection({ ...newSection, title: e.target.value })}
                placeholder="Week 1 — Introduction & Data" className="input w-full mt-1.5" />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={newSection.published} onChange={(e) => setNewSection({ ...newSection, published: e.target.checked })} />
              Visible to students
            </label>
            <label className="block text-sm">
              <span className="font-medium inline-flex items-center gap-1.5"><FiCalendar /> Open on <span className="text-cs-text-dim font-normal">(optional)</span></span>
              <input type="datetime-local" value={newSection.release_at} onChange={(e) => setNewSection({ ...newSection, release_at: e.target.value })}
                className="input w-full mt-1.5" />
              <span className="block text-xs text-cs-text-dim mt-1.5">Students see this week automatically from that date and time.</span>
            </label>
          </form>
        </Dialog>
      )}

      {tab === 'people' && isTeacher && (
        <section className="card !p-0 overflow-hidden">
          <header className="px-5 py-4 border-b border-cs-line/10 flex items-center gap-2">
            <FiUsers /> <h2 className="font-bold">People</h2>
            <span className="text-sm text-cs-text-dim">· {members ? members.length - 1 : '…'} students</span>
            <button onClick={() => setAddingStudent(true)} className="btn btn-primary btn-sm ml-auto">
              <FiPlus /> Add student
            </button>
          </header>
          <ul className="divide-y divide-cs-line/10">
            {(members || []).map((p) => (
              <li key={p.user_id} className="px-5 py-3 flex items-center gap-3">
                <span className="w-9 h-9 rounded-full bg-cs-primary/10 text-cs-primary grid place-items-center font-bold shrink-0">
                  {p.display_name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{p.display_name} <span className="text-cs-text-dim font-normal">@{p.username}</span></p>
                  <p className="text-xs text-cs-text-dim truncate">{p.email}</p>
                </div>
                {p.role === 'teacher' ? (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-cs-primary text-white">Instructor</span>
                ) : (
                  <button
                    onClick={async () => {
                      if (!(await confirmDialog({ title: `Remove ${p.display_name}?`, message: 'They’ll lose access to this class. They can rejoin with the class code.', confirmLabel: 'Remove' }))) return;
                      await classService.removeMember(id, p.user_id);
                      setMembers(members.filter((x) => x.user_id !== p.user_id));
                      setCls({ ...cls, student_count: cls.student_count - 1 });
                    }}
                    className="btn btn-ghost btn-sm"
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      </div>
    </main>
  );
}
