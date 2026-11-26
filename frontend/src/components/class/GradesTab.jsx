import React, { useEffect, useState } from 'react';
import { FiDownload } from 'react-icons/fi';
import { classService } from '../../services/api';
import { Sk } from '../Skeletons';

const CELL = {
  graded: (c, max) => ({ text: `${c.grade}/${max}`, cls: 'text-cs-text font-semibold' }),
  submitted: (c) => ({ text: c.late ? 'Late' : 'To grade', cls: c.late ? 'text-cs-orange font-medium' : 'text-cs-primary font-medium' }),
  missing: () => ({ text: 'Missing', cls: 'text-cs-red font-medium' }),
  not_submitted: () => ({ text: '—', cls: 'text-cs-text-muted' }),
};

function csvEscape(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Students x (assignments, quizzes). Teacher only.
export default function GradesTab({ cid, classTitle }) {
  const [g, setG] = useState(null);
  useEffect(() => { classService.grades(cid).then((r) => setG(r.data)).catch(() => setG(false)); }, [cid]);

  if (g === null) return <Sk className="h-48 w-full rounded-2xl" />;
  if (g === false) return <p className="py-10 text-center text-sm text-cs-text-dim">Couldn’t load grades.</p>;
  if (!g.students.length) return <p className="py-10 text-center text-sm text-cs-text-dim">No students yet. Share the class code to get started.</p>;
  if (!g.assignments.length && !g.quizzes.length) {
    return <p className="py-10 text-center text-sm text-cs-text-dim">Grades appear here once you add assignments or quizzes.</p>;
  }

  const exportCsv = () => {
    const head = ['Student', 'Username',
      ...g.assignments.map((a) => `${a.title} (/${a.max_points})`),
      ...g.quizzes.map((z) => `${z.title} (quiz %)`)];
    const rows = g.students.map((s) => [
      s.display_name, s.username,
      ...g.assignments.map((a) => {
        const c = s.assignments[a.id];
        return c.status === 'graded' ? c.grade : c.status === 'submitted' ? 'submitted' : c.status === 'missing' ? 'missing' : '';
      }),
      ...g.quizzes.map((z) => (s.quizzes[z.id] == null ? '' : Math.round(s.quizzes[z.id]))),
    ]);
    const csv = [head, ...rows].map((r) => r.map(csvEscape).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(classTitle || 'class').replace(/[^\w-]+/g, '_')}_grades.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <p className="text-sm text-cs-text-dim">{g.students.length} students · {g.assignments.length} assignments · {g.quizzes.length} quizzes</p>
        <button onClick={exportCsv} className="btn btn-secondary btn-sm ml-auto"><FiDownload /> Download CSV</button>
      </div>
      <div className="card !p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-cs-line/10 text-left">
              <th className="px-4 py-3 font-semibold sticky left-0 bg-cs-darker">Student</th>
              {g.assignments.map((a) => (
                <th key={`a${a.id}`} className="px-4 py-3 font-semibold whitespace-nowrap">
                  {a.title}<span className="block text-xs font-normal text-cs-text-dim">/{a.max_points}</span>
                </th>
              ))}
              {g.quizzes.map((z) => (
                <th key={`q${z.id}`} className="px-4 py-3 font-semibold whitespace-nowrap">
                  {z.title}<span className="block text-xs font-normal text-cs-text-dim">Quiz %</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-cs-line/10">
            {g.students.map((s) => (
              <tr key={s.user_id}>
                <td className="px-4 py-3 sticky left-0 bg-cs-darker">
                  <span className="font-medium">{s.display_name}</span>
                  <span className="block text-xs text-cs-text-dim">@{s.username}</span>
                </td>
                {g.assignments.map((a) => {
                  const c = s.assignments[a.id];
                  const v = CELL[c.status](c, a.max_points);
                  return <td key={`a${a.id}`} className={`px-4 py-3 ${v.cls}`}>{v.text}</td>;
                })}
                {g.quizzes.map((z) => {
                  const v = s.quizzes[z.id];
                  return (
                    <td key={`q${z.id}`} className={`px-4 py-3 ${v == null ? 'text-cs-text-muted' : v >= z.pass_score ? 'text-cs-green font-semibold' : 'text-cs-orange font-semibold'}`}>
                      {v == null ? '—' : `${Math.round(v)}%`}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
