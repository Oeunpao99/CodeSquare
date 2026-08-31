import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { quizService } from '../services/api';
import {
  FiArrowLeft, FiArrowRight, FiCheckCircle, FiXCircle, FiZap, FiAward,
  FiRotateCcw, FiTerminal,
} from 'react-icons/fi';
import { toast } from '../utils/toast';

const DIFF_BADGE = {
  beginner: 'badge-green',
  intermediate: 'badge-cyan',
  advanced: 'badge-orange',
};

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

const fileExt = (lang) =>
  lang === 'javascript' ? 'js' : lang === 'sql' ? 'sql' : lang === 'python' ? 'py' : 'txt';

/** Render a question that may carry an indented code block after a blank line. */
function QuestionText({ text }) {
  const at = text.indexOf('\n\n');
  if (at === -1) {
    return <p className="font-semibold text-cs-text text-base leading-relaxed">{text}</p>;
  }
  const head = text.slice(0, at);
  const code = text.slice(at + 2).replace(/^\n+/, '');
  return (
    <>
      <p className="font-semibold text-cs-text text-base leading-relaxed">{head}</p>
      <pre className="mt-3 rounded-lg bg-cs-darkest/70 border border-cs-line/10 p-3 font-mono text-[13px] leading-6 text-cs-mint overflow-x-auto whitespace-pre">
        {code}
      </pre>
    </>
  );
}

function QuizView() {
  const { slug } = useParams();

  const [quiz, setQuiz] = useState(null);       // null = loading
  const [notFound, setNotFound] = useState(false);
  const [answers, setAnswers] = useState([]);
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const qRefs = useRef([]);

  useEffect(() => {
    let alive = true;
    setQuiz(null);
    setNotFound(false);
    setResult(null);
    quizService.get(slug)
      .then((r) => {
        if (!alive) return;
        setQuiz(r.data);
        setAnswers(new Array(r.data.questions.length).fill(-1));
      })
      .catch(() => alive && setNotFound(true));
    return () => { alive = false; };
  }, [slug]);

  const answeredCount = answers.filter((a) => a >= 0).length;
  const total = quiz ? quiz.questions.length : 0;
  const allAnswered = quiz && answeredCount === total;
  const pct = total ? Math.round((answeredCount / total) * 100) : 0;

  const pick = (qi, oi) => {
    if (result) return;                 // locked after submit
    setAnswers((prev) => prev.map((a, i) => (i === qi ? oi : a)));
  };

  const submit = async () => {
    if (!quiz || submitting || !allAnswered) return;
    setSubmitting(true);
    try {
      const r = await quizService.submit(slug, answers);
      setResult(r.data);
      if (r.data.passed) {
        toast.success(
          r.data.first_pass ? 'Quiz passed' : 'Passed again',
          r.data.first_pass ? `+${r.data.xp_awarded} XP` : `${r.data.score}%`,
        );
      } else {
        toast.error('Not passed yet', `${r.data.score}% — need ${r.data.pass_score}%`);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      toast.error('Could not submit your answers.');
    } finally {
      setSubmitting(false);
    }
  };

  const retake = () => {
    setResult(null);
    setAnswers(new Array(total).fill(-1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Per-question view model: graded results after submit, raw quiz before.
  const rows = useMemo(() => {
    if (!quiz) return [];
    if (result) {
      return result.results.map((r) => ({
        q: r.q,
        options: r.options,
        chosen: r.your_answer,
        correct: r.correct_answer,
        isCorrect: r.is_correct,
        explain: r.explain,
        graded: true,
      }));
    }
    return quiz.questions.map((qq, i) => ({
      q: qq.q,
      options: qq.options,
      chosen: answers[i],
      graded: false,
    }));
  }, [quiz, result, answers]);

  if (notFound) {
    return (
      <main className="w-full px-6 lg:px-10 py-16">
        <div className="max-w-md mx-auto card text-center py-14 border-cs-orange/25">
          <p className="font-mono text-5xl mb-4 text-cs-text-muted select-none">404</p>
          <p className="text-cs-text-dim mb-6 font-mono">quiz_not_found: /{slug}</p>
          <Link to="/quizzes" className="btn btn-primary btn-sm">Back to Quizzes</Link>
        </div>
      </main>
    );
  }

  if (!quiz) {
    return (
      <main className="w-full px-6 lg:px-10 py-8">
        <p className="text-cs-text-muted font-mono text-sm">loading /quizzes/{slug}…</p>
      </main>
    );
  }

  const ext = fileExt(quiz.language);

  return (
    <main className="w-full px-6 lg:px-10 py-8">
      {/* Full-bleed sticky header */}
      <div className="sticky top-0 z-30 -mx-6 lg:-mx-10 px-6 lg:px-10 pt-4 pb-4 -mt-8 mb-6 bg-cs-dark/85 backdrop-blur-xl border-b border-cs-line/[0.07]">
        <Link to="/quizzes" className="inline-flex items-center gap-2 text-sm font-mono text-cs-text-dim hover:text-cs-primary mb-3">
          <FiArrowLeft /> ../quizzes
        </Link>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className={`badge ${DIFF_BADGE[quiz.difficulty] || 'badge-cyan'}`}>{quiz.difficulty}</span>
          {quiz.topic && (
            <span className="px-2.5 py-1 rounded-md text-[10px] font-mono uppercase tracking-wide border border-cs-line/15 text-cs-text-dim">
              {quiz.topic}
            </span>
          )}
          {quiz.language && <span className="font-mono text-xs text-cs-text-muted">{quiz.language}</span>}
          <span className="font-mono text-xs text-cs-primary inline-flex items-center gap-1">
            <FiZap className="text-[11px]" /> {quiz.xp_reward} XP
          </span>
          <span className="font-mono text-xs text-cs-text-muted">pass ≥ {quiz.pass_score}%</span>
          {quiz.passed && (
            <span className="font-mono text-xs text-cs-green inline-flex items-center gap-1">
              <FiCheckCircle className="text-[11px]" /> passed
            </span>
          )}
        </div>
        <h1 className="text-2xl font-bold font-mono flex items-center gap-2">
          <span className="text-cs-mint select-none">❯&nbsp;</span>{quiz.title}
        </h1>
        {quiz.description && <p className="text-sm text-cs-text-dim mt-2 max-w-3xl">{quiz.description}</p>}
      </div>

      {/* Score banner */}
      {result && <ScoreBanner result={result} />}

      {/* Questions */}
      <div className="space-y-5 min-w-0">
        {rows.map((row, qi) => {
            const ring = row.graded
              ? row.isCorrect
                ? 'border-cs-green/30 shadow-[0_0_40px_-24px_rgb(var(--cs-green)/0.7)]'
                : 'border-cs-red/30 shadow-[0_0_40px_-24px_rgb(var(--cs-red)/0.7)]'
              : row.chosen >= 0
                ? 'border-cs-primary/25'
                : 'border-cs-line/10';
            return (
              <div
                key={qi}
                ref={(el) => (qRefs.current[qi] = el)}
                className={`terminal border ${ring} scroll-mt-28 transition-shadow`}
              >
                {/* card header — filename tab */}
                <div className="terminal-bar">
                  <span className="terminal-dot bg-cs-red/80" />
                  <span className="terminal-dot bg-cs-orange/80" />
                  <span className="terminal-dot bg-cs-green/80" />
                  <span className="ml-2 font-mono text-[11px] text-cs-text-muted inline-flex items-center gap-1.5">
                    <FiTerminal className="text-[11px]" />
                    question_{String(qi + 1).padStart(2, '0')}.{ext}
                  </span>
                  {row.graded && (
                    <span className={`ml-auto font-mono text-[11px] inline-flex items-center gap-1 ${
                      row.isCorrect ? 'text-cs-green' : 'text-cs-red'
                    }`}>
                      {row.isCorrect ? <FiCheckCircle /> : <FiXCircle />}
                      {row.isCorrect ? 'correct' : 'incorrect'}
                    </span>
                  )}
                </div>

                <div className="p-5 lg:p-6">
                  <div className="flex items-start gap-3 mb-5">
                    <span className="shrink-0 w-8 h-8 rounded-lg grid place-items-center font-mono text-sm font-bold bg-cs-primary/10 border border-cs-primary/30 text-cs-primary select-none">
                      {String(qi + 1).padStart(2, '0')}
                    </span>
                    <div className="min-w-0 flex-1">
                      <QuestionText text={row.q} />
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-[11px] font-mono uppercase tracking-wide text-cs-text-muted">select one</span>
                    {!row.graded && row.chosen >= 0 && (
                      <span className="text-[11px] font-mono text-cs-primary inline-flex items-center gap-1">
                        <FiCheckCircle className="text-[11px]" /> answered
                      </span>
                    )}
                  </div>

                  {/* options — 2-up grid uses the full width */}
                  <div className="grid sm:grid-cols-2 gap-3">
                    {row.options.map((opt, oi) => {
                      const chosen = row.chosen === oi;
                      const isRight = row.graded && row.correct === oi;
                      const isWrongPick = row.graded && chosen && !row.isCorrect;

                      let cls = 'border-cs-line/15 bg-cs-overlay/[0.02] hover:border-cs-primary/40 hover:bg-cs-overlay/[0.06]';
                      let chip = 'border-cs-line/25 text-cs-text-muted';
                      if (isRight) {
                        cls = 'border-cs-green/50 bg-cs-green/[0.08]';
                        chip = 'border-cs-green/60 text-cs-green bg-cs-green/10';
                      } else if (isWrongPick) {
                        cls = 'border-cs-red/50 bg-cs-red/[0.08]';
                        chip = 'border-cs-red/60 text-cs-red bg-cs-red/10';
                      } else if (chosen && !row.graded) {
                        cls = 'border-cs-primary/60 bg-cs-primary/[0.10] shadow-[0_0_22px_-10px_rgb(var(--cs-primary)/0.7)]';
                        chip = 'border-cs-primary text-cs-primary bg-cs-primary/10';
                      }

                      return (
                        <button
                          key={oi}
                          type="button"
                          onClick={() => pick(qi, oi)}
                          disabled={row.graded}
                          className={`group w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border text-left text-sm transition-all ${cls} ${
                            row.graded ? 'cursor-default' : ''
                          }`}
                        >
                          <span className={`w-7 h-7 rounded-lg border flex items-center justify-center font-mono text-xs font-bold shrink-0 transition-colors ${chip}`}>
                            {LETTERS[oi]}
                          </span>
                          <span className="text-cs-text-dim flex-1">{opt}</span>
                          {isRight && <FiCheckCircle className="text-cs-green shrink-0" />}
                          {isWrongPick && <FiXCircle className="text-cs-red shrink-0" />}
                        </button>
                      );
                    })}
                  </div>

                  {/* explanation — styled like a source comment */}
                  {row.graded && row.explain && (
                    <div className={`mt-4 rounded-lg border-l-2 pl-4 pr-3 py-2.5 font-mono text-[13px] leading-6 ${
                      row.isCorrect
                        ? 'border-cs-green/40 bg-cs-green/[0.04] text-cs-text-dim'
                        : 'border-cs-primary/40 bg-cs-primary/[0.04] text-cs-text-dim'
                    }`}>
                      <span className="text-cs-text-muted select-none"># </span>{row.explain}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* bottom action mirror (mobile-friendly) */}
          <div className="flex items-center justify-between gap-3 pt-2">
            {!result ? (
              <>
                <span className="font-mono text-xs text-cs-text-muted">
                  {answeredCount} / {total} answered
                </span>
                <button
                  onClick={submit}
                  disabled={!allAnswered || submitting}
                  className="btn btn-primary btn-sm disabled:opacity-40"
                >
                  {submitting ? 'Submitting…' : 'Submit answers'} <FiArrowRight />
                </button>
              </>
            ) : (
              <>
                <button onClick={retake} className="btn btn-secondary btn-sm">
                  <FiRotateCcw /> Retake
                </button>
                <Link to="/quizzes" className="btn btn-ghost btn-sm">
                  Done <FiArrowRight />
                </Link>
              </>
            )}
          </div>
        </div>
      </main>
    );
}

function ScoreBanner({ result }) {
  const good = result.passed;
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border mb-8 ${
        good ? 'border-cs-green/30' : 'border-cs-red/30'
      }`}
    >
      {/* dotted tech backdrop */}
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage: `radial-gradient(rgb(var(--cs-${good ? 'green' : 'red'}) / 0.10) 1px, transparent 1px)`,
          backgroundSize: '16px 16px',
        }}
      />
      <div className="relative flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-8 p-5 sm:p-6">
        {/* big score dial */}
        <div className="flex items-center gap-4 shrink-0">
          <div
            className="w-20 h-20 rounded-2xl grid place-items-center font-mono font-bold text-2xl"
            style={{
              color: `rgb(var(--cs-${good ? 'green' : 'red'}))`,
              background: `rgb(var(--cs-${good ? 'green' : 'red'}) / 0.10)`,
              border: `1px solid rgb(var(--cs-${good ? 'green' : 'red'}) / 0.35)`,
            }}
          >
            {result.score}%
          </div>
          <div>
            <p className={`font-mono text-sm font-bold ${good ? 'text-cs-green' : 'text-cs-red'}`}>
              {good ? 'PASSED' : 'TRY AGAIN'}
            </p>
            <p className="font-mono text-[11px] text-cs-text-muted mt-0.5">
              {result.correct}/{result.total} correct · need {result.pass_score}%
            </p>
          </div>
        </div>

        {/* meter */}
        <div className="flex-1 min-w-0">
          <div className="h-2.5 rounded-full bg-cs-overlay/10 overflow-hidden">
            <div
              className="h-full rounded-full transition-[width] duration-700"
              style={{
                width: `${Math.max(3, result.score)}%`,
                background: good
                  ? 'linear-gradient(90deg, rgb(var(--cs-green)/0.4), rgb(var(--cs-green)))'
                  : 'linear-gradient(90deg, rgb(var(--cs-red)/0.4), rgb(var(--cs-red)))',
              }}
            />
          </div>
          <div className="flex items-center justify-between mt-2 font-mono text-[11px] text-cs-text-muted">
            <span>0%</span>
            <span className="text-cs-text-dim">pass line {result.pass_score}%</span>
            <span>100%</span>
          </div>
        </div>

        {/* xp stamp */}
        {good && result.first_pass && (
          <div className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-cs-primary/30 bg-cs-primary/10 text-cs-primary font-mono text-sm font-bold">
            <FiAward /> +{result.xp_awarded} XP
          </div>
        )}
        {(!good || !result.first_pass) && (
          <div className="shrink-0 font-mono text-[11px] text-cs-text-muted">
            best {result.best_score}%
          </div>
        )}
      </div>
    </div>
  );
}

export default QuizView;
