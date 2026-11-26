import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiPlus, FiTrash2, FiEdit2, FiEye, FiEyeOff, FiX, FiCheckCircle, FiBarChart2, FiArrowRight, FiHelpCircle,
} from 'react-icons/fi';
import { classService } from '../../services/api';
import { Sk } from '../Skeletons';
import Dialog from './Dialog';
import { toast } from '../../utils/toast';
import { confirmDialog } from '../../utils/confirm';

const blankQ = () => ({ q: '', options: ['', ''], answer: 0, explain: '' });

// ------------------------------------------------------------------ editor
function QuizEditor({ cid, quizId, onClose, onSaved }) {
  const [quiz, setQuiz] = useState(quizId ? null : {
    title: '', description: '', pass_score: 70, published: true, questions: [blankQ()],
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (quizId) classService.quizForEdit(cid, quizId).then((r) => setQuiz(r.data));
  }, [cid, quizId]);

  const setQ = (i, patch) => setQuiz({ ...quiz, questions: quiz.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)) });

  const save = async () => {
    setBusy(true);
    try {
      const body = { ...quiz, pass_score: Number(quiz.pass_score) || 0 };
      if (quizId) await classService.saveQuiz(cid, quizId, body);
      else await classService.createQuiz(cid, body);
      toast.success('Quiz saved');
      onSaved();
    } catch (err) {
      const d = err.response?.data?.detail;
      toast.error((Array.isArray(d) ? 'Fill in every question and option' : d) || 'Could not save the quiz.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      wide
      title={quizId ? 'Edit quiz' : 'New quiz'}
      onClose={onClose}
      footer={quiz && (
        <>
          <button onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button onClick={save} disabled={busy || !quiz.title.trim()} className="btn btn-primary">{busy ? 'Saving…' : 'Save quiz'}</button>
        </>
      )}
    >
      {!quiz ? <Sk className="h-60 w-full" /> : (
        <div className="space-y-5">
          <div className="grid sm:grid-cols-[1fr_8rem] gap-4">
            <label className="block text-sm">
              <span className="font-medium">Title</span>
              <input autoFocus value={quiz.title} onChange={(e) => setQuiz({ ...quiz, title: e.target.value })}
                placeholder="Day 1 check" className="input w-full mt-1.5" />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Pass mark %</span>
              <input type="number" min={0} max={100} value={quiz.pass_score}
                onChange={(e) => setQuiz({ ...quiz, pass_score: e.target.value })} className="input w-full mt-1.5" />
            </label>
          </div>
          <label className="block text-sm">
            <span className="font-medium">Instructions <span className="text-cs-text-dim font-normal">(optional)</span></span>
            <input value={quiz.description} onChange={(e) => setQuiz({ ...quiz, description: e.target.value })} className="input w-full mt-1.5" />
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={quiz.published} onChange={(e) => setQuiz({ ...quiz, published: e.target.checked })} />
            Visible to students
          </label>

          {quiz.questions.map((q, i) => (
            <div key={i} className="rounded-xl border border-cs-line/10 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">Question {i + 1}</span>
                {quiz.questions.length > 1 && (
                  <button onClick={() => setQuiz({ ...quiz, questions: quiz.questions.filter((_, j) => j !== i) })}
                    className="ml-auto p-1.5 text-cs-text-dim hover:text-cs-red" aria-label="Remove question"><FiTrash2 /></button>
                )}
              </div>
              <input value={q.q} onChange={(e) => setQ(i, { q: e.target.value })} placeholder="Question" className="input w-full" />
              <p className="text-xs text-cs-text-dim">Select the correct answer.</p>
              {q.options.map((o, k) => (
                <div key={k} className="flex items-center gap-2">
                  <input type="radio" name={`ans-${i}`} checked={q.answer === k} onChange={() => setQ(i, { answer: k })}
                    aria-label={`Option ${k + 1} is correct`} />
                  <input value={o} placeholder={`Option ${k + 1}`}
                    onChange={(e) => setQ(i, { options: q.options.map((x, m) => (m === k ? e.target.value : x)) })}
                    className="input flex-1 !py-2" />
                  {q.options.length > 2 && (
                    <button
                      onClick={() => setQ(i, {
                        options: q.options.filter((_, m) => m !== k),
                        answer: q.answer === k ? 0 : q.answer > k ? q.answer - 1 : q.answer,
                      })}
                      className="p-1.5 text-cs-text-dim hover:text-cs-red" aria-label="Remove option"><FiX /></button>
                  )}
                </div>
              ))}
              {q.options.length < 6 && (
                <button onClick={() => setQ(i, { options: [...q.options, ''] })} className="text-sm text-cs-primary font-medium">+ Add option</button>
              )}
              <input value={q.explain} onChange={(e) => setQ(i, { explain: e.target.value })}
                placeholder="Explanation shown after answering (optional)" className="input w-full !py-2 text-sm" />
            </div>
          ))}
          <button onClick={() => setQuiz({ ...quiz, questions: [...quiz.questions, blankQ()] })} className="btn btn-secondary w-full justify-center">
            <FiPlus /> Add question
          </button>
        </div>
      )}
    </Dialog>
  );
}

// ------------------------------------------------------------------ results
function Results({ cid, quizId, onClose }) {
  const [data, setData] = useState(null);
  useEffect(() => { classService.quizResults(cid, quizId).then((r) => setData(r.data)); }, [cid, quizId]);
  return (
    <Dialog title={data ? `Results · ${data.quiz.title}` : 'Results'} onClose={onClose}>
      {!data ? <Sk className="h-40 w-full" /> : (
        <ul className="divide-y divide-cs-line/10">
          {data.students.length === 0 && <li className="py-3 text-sm text-cs-text-dim">No students in the class yet.</li>}
          {data.students.map((s) => (
            <li key={s.user_id} className="flex items-center gap-3 py-3">
              <span className="flex-1 min-w-0 truncate font-medium">{s.display_name}</span>
              {s.best_score == null ? (
                <span className="text-sm text-cs-text-dim">Not taken</span>
              ) : (
                <>
                  <span className="text-xs text-cs-text-dim">{s.attempts} attempt{s.attempts === 1 ? '' : 's'}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[0.6875rem] font-semibold text-white ${s.passed ? 'bg-cs-green' : 'bg-cs-orange'}`}>
                    {Math.round(s.best_score)}%
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}

// ------------------------------------------------------------------ tab
export default function QuizzesTab({ cid, isTeacher }) {
  const [list, setList] = useState(null);
  const [editing, setEditing] = useState(null); // null | 'new' | quiz id
  const [results, setResults] = useState(null);

  const load = () => classService.quizzes(cid).then((r) => setList(r.data)).catch(() => setList([]));
  useEffect(() => { load(); }, [cid]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      {isTeacher && (
        <button onClick={() => setEditing('new')} className="btn btn-primary"><FiPlus /> New quiz</button>
      )}

      {list === null && <Sk className="h-24 w-full rounded-2xl" />}
      {list && list.length === 0 && (
        <p className="py-10 text-center text-sm text-cs-text-dim">
          {isTeacher ? 'Create a quiz to check what your students learned.' : 'No quizzes yet.'}
        </p>
      )}

      {list && list.length > 0 && (
        <div className="card !p-0 overflow-hidden">
          <ul className="divide-y divide-cs-line/10">
            {list.map((z) => (
              <li key={z.id} className="flex items-center gap-4 px-5 py-4">
                <span className="w-10 h-10 rounded-xl bg-cs-primary/10 text-cs-primary grid place-items-center shrink-0"><FiHelpCircle /></span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">{z.title}</p>
                  <p className="text-xs text-cs-text-dim">
                    {z.question_count} question{z.question_count === 1 ? '' : 's'} · pass {z.pass_score}%
                    {isTeacher && ` · ${z.students_taken} student${z.students_taken === 1 ? '' : 's'} took it`}
                  </p>
                </div>
                {isTeacher ? (
                  <>
                    {!z.published && <span className="px-2 py-0.5 rounded-full text-[0.6875rem] font-semibold bg-cs-overlay/10 text-cs-text-dim">Draft</span>}
                    <button onClick={() => setResults(z.id)} className="btn btn-ghost btn-sm"><FiBarChart2 /> Results</button>
                    <button onClick={() => setEditing(z.id)} className="p-2 text-cs-text-dim hover:text-cs-primary" title="Edit" aria-label="Edit"><FiEdit2 /></button>
                    <button
                      onClick={async () => { await classService.publishQuiz(cid, z.id, !z.published); load(); }}
                      className="p-2 text-cs-text-dim hover:text-cs-primary" title={z.published ? 'Hide from students' : 'Show to students'}
                      aria-label="Toggle visibility"
                    >
                      {z.published ? <FiEyeOff /> : <FiEye />}
                    </button>
                    <button
                      onClick={async () => {
                        if (!(await confirmDialog({ title: `Delete "${z.title}"?`, message: 'The quiz and all student results will be deleted.' }))) return;
                        await classService.deleteQuiz(cid, z.id); load();
                      }}
                      className="p-2 text-cs-text-dim hover:text-cs-red" title="Delete" aria-label="Delete"
                    >
                      <FiTrash2 />
                    </button>
                  </>
                ) : (
                  <>
                    {z.best_score != null && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.6875rem] font-semibold text-white ${z.passed ? 'bg-cs-green' : 'bg-cs-orange'}`}>
                        {z.passed && <FiCheckCircle />} {Math.round(z.best_score)}%
                      </span>
                    )}
                    <Link to={`/quizzes/${z.slug}`} className={`btn btn-sm ${z.best_score == null ? 'btn-primary' : 'btn-ghost'}`}>
                      {z.best_score == null ? 'Start' : 'Retake'} <FiArrowRight />
                    </Link>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {editing && (
        <QuizEditor cid={cid} quizId={editing === 'new' ? null : editing} onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }} />
      )}
      {results && <Results cid={cid} quizId={results} onClose={() => setResults(null)} />}
    </div>
  );
}

