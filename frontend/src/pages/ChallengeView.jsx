import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { challengeService } from '../services/api';
import CodeEditor from '../components/CodeEditor';
import Markdown from '../components/Markdown';
import {
  FiArrowLeft, FiArrowRight, FiPlay, FiHelpCircle, FiRotateCcw,
  FiCheckCircle, FiXCircle, FiZap, FiAward,
} from 'react-icons/fi';
import { toast } from '../utils/toast';

const DIFF_BADGE = {
  beginner: 'badge-green',
  intermediate: 'badge-cyan',
  advanced: 'badge-orange',
};

function fileLabel(language) {
  if (language === 'javascript') return 'challenge.js';
  if (language === 'sql') return 'challenge.sql';
  if (language === 'html-css') return 'challenge.html';
  return 'challenge.py';
}

function ChallengeView() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [challenge, setChallenge] = useState(null);   // null = loading
  const [notFound, setNotFound] = useState(false);
  const [code, setCode] = useState('');
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const [nextSlug, setNextSlug] = useState(null);

  useEffect(() => {
    let alive = true;
    setChallenge(null);
    setNotFound(false);
    setResult(null);
    setShowHints(false);
    setNextSlug(null);
    challengeService.get(slug)
      .then((r) => {
        if (!alive) return;
        setChallenge(r.data);
        setCode(r.data.last_code || r.data.starter_code || '');
      })
      .catch(() => alive && setNotFound(true));
    return () => { alive = false; };
  }, [slug]);

  const passed = !!result?.passed;

  const run = async () => {
    if (!challenge || running) return;
    setRunning(true);
    try {
      const r = await challengeService.submit(slug, code);
      setResult(r.data);
      if (r.data.passed) {
        toast.success(
          r.data.first_solve ? 'Challenge solved' : 'Still passing',
          r.data.first_solve ? `+${r.data.xp_awarded} XP` : undefined,
        );
        // Suggest a next unsolved challenge at the same difficulty.
        challengeService.list({ solved: false, difficulty: challenge.difficulty, limit: 5 })
          .then((res) => {
            const pick = (res.data || []).find((c) => c.slug !== slug);
            setNextSlug(pick ? pick.slug : null);
          })
          .catch(() => {});
      } else {
        toast.error('Some tests failed — keep going.');
      }
    } catch {
      toast.error('Could not run your code.');
    } finally {
      setRunning(false);
    }
  };

  const reset = () => {
    setCode(challenge?.starter_code || '');
    setResult(null);
  };

  const review = result?.review;
  const testResults = result?.results || [];

  if (notFound) {
    return (
      <main className="w-full px-6 lg:px-10 py-16">
        <div className="max-w-md mx-auto card text-center py-14 border-cs-orange/25">
          <p className="font-mono text-5xl mb-4 text-cs-text-muted select-none">404</p>
          <p className="text-cs-text-dim mb-6 font-mono">challenge_not_found: /{slug}</p>
          <Link to="/practice" className="btn btn-primary btn-sm">Back to Practice</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="w-full px-6 lg:px-10 py-8">
      {!challenge ? (
        <p className="text-cs-text-muted font-mono text-sm">loading /practice/{slug}…</p>
      ) : (
        <>
          {/* Page header — locked while the problem + editor scroll beneath it. */}
          <div className="sticky top-0 z-30 -mx-6 lg:-mx-10 px-6 lg:px-10 pt-4 pb-4 -mt-8 mb-6 bg-cs-dark/85 backdrop-blur-xl border-b border-cs-line/[0.07]">
            <Link to="/practice" className="inline-flex items-center gap-2 text-sm font-mono text-cs-text-dim hover:text-cs-primary mb-3">
              <FiArrowLeft /> ../practice
            </Link>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className={`badge ${DIFF_BADGE[challenge.difficulty] || 'badge-cyan'}`}>
                {challenge.difficulty}
              </span>
              {challenge.kind === 'debug' && (
                <span className="px-2.5 py-1 rounded-md text-[10px] font-mono uppercase tracking-wide border border-cs-orange/30 bg-cs-orange/10 text-cs-orange">
                  🐛 debug — find &amp; fix the bug
                </span>
              )}
              {challenge.topic && (
                <span className="px-2.5 py-1 rounded-md text-[10px] font-mono uppercase tracking-wide border border-cs-line/15 text-cs-text-dim">
                  {challenge.topic}
                </span>
              )}
              <span className="font-mono text-xs text-cs-text-muted">
                {challenge.language} · {fileLabel(challenge.language)}
              </span>
              <span className="font-mono text-xs text-cs-primary inline-flex items-center gap-1">
                <FiZap className="text-[11px]" /> {challenge.xp_reward} XP
              </span>
              {challenge.solved && (
                <span className="font-mono text-xs text-cs-green inline-flex items-center gap-1">
                  <FiCheckCircle className="text-[11px]" /> solved
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold font-mono flex items-center gap-2">
              <span className="text-cs-mint select-none">❯&nbsp;</span>{challenge.title}
            </h1>
          </div>

          <div className="grid lg:grid-cols-[minmax(0,340px)_1.4fr] gap-6 items-start">
            {/* Left — problem + hints */}
            <div className="space-y-4 lg:sticky lg:top-6">
              <div className="card overflow-hidden">
                <div className="flex items-center gap-1.5 px-3 py-2 border-b border-cs-line/10 bg-cs-line/[0.03]">
                  <span className="terminal-dot bg-cs-red/80" />
                  <span className="terminal-dot bg-cs-orange/80" />
                  <span className="terminal-dot bg-cs-green/80" />
                  <span className="ml-2 font-mono text-[11px] text-cs-text-muted">README.md</span>
                </div>
                <div className="p-4 text-sm text-cs-text-dim">
                  <Markdown text={challenge.prompt} />
                </div>
              </div>

              {showHints && challenge.hints?.length > 0 && (
                <div className="space-y-2">
                  {challenge.hints.map((h, i) => (
                    <div key={i} className="p-3 rounded-lg bg-cs-orange/10 border border-cs-orange/25 text-sm text-cs-text-dim font-mono">
                      <span className="font-bold text-cs-orange mr-2">hint {i + 1}:</span>{h}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right — editor + results + actions */}
            <div className="min-w-0 space-y-4">
              <div className="terminal">
                <div className="terminal-bar">
                  <span className="terminal-dot bg-cs-red/80" />
                  <span className="terminal-dot bg-cs-orange/80" />
                  <span className="terminal-dot bg-cs-green/80" />
                  <span className="ml-2 font-mono text-xs text-cs-text-muted">
                    ~/challenges/{fileLabel(challenge.language)}
                  </span>
                  <span className="ml-auto font-mono text-[10px] text-cs-text-muted hidden sm:inline">⌘/Ctrl+↵ run</span>
                </div>
                <div className="h-[360px]">
                  <CodeEditor value={code} onChange={setCode} language={challenge.language} onSubmit={run} />
                </div>
                <div className="flex items-center gap-2 px-3 py-2 border-t border-cs-line/10 bg-cs-line/[0.03]">
                  <button
                    onClick={() => setShowHints((v) => !v)}
                    disabled={!challenge.hints?.length}
                    className="btn btn-ghost btn-sm disabled:opacity-40"
                  >
                    <FiHelpCircle /> {showHints ? 'Hide hints' : `Hints (${challenge.hints?.length || 0})`}
                  </button>
                  <button onClick={reset} className="btn btn-ghost btn-sm">
                    <FiRotateCcw /> Reset
                  </button>
                  <div className="flex-1" />
                  <button onClick={run} disabled={running} title="Run (Ctrl+Enter)" className="btn btn-primary btn-sm">
                    <FiPlay /> {running ? 'Running…' : 'Run tests'}
                  </button>
                </div>
              </div>

              {result && (
                <div
                  className={`rounded-xl border ${passed ? 'border-cs-green/30 bg-cs-green/[0.06]' : 'border-cs-red/30 bg-cs-red/[0.06]'} overflow-hidden`}
                >
                  <div className={`flex items-center gap-2 px-4 py-2.5 border-b font-mono text-sm ${
                    passed ? 'text-cs-green border-cs-green/20' : 'text-cs-red border-cs-red/20'
                  }`}>
                    {passed ? <FiCheckCircle /> : <FiXCircle />}
                    {result.tests_passed}/{result.tests_total} tests passed
                    {passed && result.first_solve && (
                      <span className="inline-flex items-center gap-1 text-cs-primary ml-1">
                        <FiAward /> +{result.xp_awarded} XP
                      </span>
                    )}
                  </div>
                  <div className="p-3 space-y-1 bg-cs-darkest/40">
                    {testResults.map((tc, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        {tc.passed
                          ? <FiCheckCircle className="text-cs-green mt-0.5 shrink-0" />
                          : <FiXCircle className="text-cs-red mt-0.5 shrink-0" />}
                        <span className={tc.passed ? 'text-cs-green' : 'text-cs-red'}>{tc.description}</span>
                        {!tc.passed && tc.error && (
                          <span className="text-xs text-cs-text-muted font-mono break-all">{tc.error}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {passed && review && (
                <div className="card border-cs-primary/25">
                  <div className="flex items-center justify-between mb-2">
                    <span className="mono-label text-cs-primary"> ai review</span>
                    {typeof review.score === 'number' && (
                      <span className="font-mono text-sm text-cs-text-dim">score {Math.round(review.score)}/100</span>
                    )}
                  </div>
                  {review.feedback && <Markdown text={review.feedback} />}
                  {review.suggestions?.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-semibold text-cs-text mb-1">Suggestions</p>
                      <ul className="list-disc pl-5 space-y-1 text-sm text-cs-text-dim">
                        {review.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {passed && (
                <div className="flex justify-end gap-2">
                  {nextSlug ? (
                    <button
                      onClick={() => navigate(`/practice/c/${nextSlug}`)}
                      className="btn btn-ghost btn-sm"
                    >
                      Next challenge <FiArrowRight />
                    </button>
                  ) : (
                    <Link to="/practice" className="btn btn-ghost btn-sm">
                      Done <FiArrowRight />
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </main>
  );
}

export default ChallengeView;
