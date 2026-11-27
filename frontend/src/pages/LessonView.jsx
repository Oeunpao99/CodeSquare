import React, { useState, useEffect, useRef } from 'react';
import { useCrumbNames, crumbName } from '../utils/crumbs';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { lessonService, aiService } from '../services/api';
import CodeEditor from '../components/CodeEditor';
import AITutor from '../components/AITutor';
import { FiArrowLeft, FiArrowRight, FiCheck, FiPlay, FiBook, FiHelpCircle, FiCheckCircle, FiXCircle, FiCode, FiX, FiClock } from 'react-icons/fi';

const estimatedReadTime = (html) =>
  Math.max(1, Math.round((String(html || '').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length) / 220));
import AiIcon from '../components/AiIcon';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from '../utils/toast';
import { highlightAllCode } from '../utils/highlight';
import { LessonSkeleton } from '../components/Skeletons';

// Loaded only for Power BI lessons.
const PowerBIDesktop = React.lazy(() => import('../components/powerbi/PowerBIDesktop'));

function LessonView() {
  const { slug, moduleId, lessonId } = useParams();
  const navigate = useNavigate();
  const [lesson, setLesson] = useState(null);
  // Real names for the top-bar breadcrumb: Learn › Course › Module › Lesson
  useCrumbNames(lesson ? { [`module-${moduleId}`]: lesson.module_title, [String(lessonId)]: lesson.title } : null);
  const [loading, setLoading] = useState(true);
  const [activeExercise, setActiveExercise] = useState(0);
  const [code, setCode] = useState('');
  const [output, setOutput] = useState([]);
  const [testResults, setTestResults] = useState([]);
  const [hints, setHints] = useState([]);
  const [hintLevel, setHintLevel] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [error, setError] = useState('');
  const [timeSpent, setTimeSpent] = useState(0);
  const [showTutor, setShowTutor] = useState(false);

  // Docked-tutor width — drag the left edge to resize; remembered across sessions.
  const TUTOR_MIN = 320;
  const [tutorWidth, setTutorWidth] = useState(() => {
    const v = parseInt(localStorage.getItem('cs-tutor-width') || '', 10);
    return Number.isFinite(v) ? Math.min(Math.max(v, TUTOR_MIN), 900) : 420;
  });
  const [resizingTutor, setResizingTutor] = useState(false);
  const rafRef = useRef(0);
  const lessonBodyRef = useRef(null);

  const startTutorResize = (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = tutorWidth;
    let latest = startW;
    setResizingTutor(true);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    const onMove = (ev) => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        const max = Math.min(900, window.innerWidth - 380);
        latest = Math.min(Math.max(startW + (startX - ev.clientX), TUTOR_MIN), max);
        setTutorWidth(latest);
      });
    };
    const onUp = () => {
      setResizingTutor(false);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      try { localStorage.setItem('cs-tutor-width', String(Math.round(latest))); } catch { /* ignore */ }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  useEffect(() => {
    fetchLesson();
  }, [slug, moduleId, lessonId]);

  useEffect(() => {
    const timer = setInterval(() => setTimeSpent((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchLesson = async () => {
    try {
      const response = await lessonService.getLesson(slug, moduleId, lessonId);
      setLesson(response.data);
      const firstExercise = response.data.exercises?.[0];
      if (firstExercise) {
        setCode(firstExercise.starter_code);
      }
    } catch (error) {
      console.error('Error fetching lesson:', error);
      navigate(`/learn/${slug}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!lesson) return;
    highlightAllCode(lessonBodyRef.current, slug);
  }, [lesson, slug]);

  const currentExercise = lesson?.exercises?.[activeExercise];
  // File name shown above the editor, per course (and DAX vs Power Query M).
  const fileName = (kind) => {
    const src = (kind === 'example' ? lesson?.code_example : code) || '';
    const byTrack = {
      python: 'main.py', 'python-intermediate': 'main.py', 'ai-llm': 'main.py', dsa: 'main.py',
      'backend-foundations': 'main.py', javascript: 'main.js', 'full-stack': 'app.js',
      'react-typescript': 'App.tsx', 'html-css': 'index.html', 'linux-shell': 'script.sh',
      'sql-data': 'query.sql',
    };
    if (slug === 'power-bi') return /\blet\b|Table\.|Csv\.|=\s*Table/.test(src) ? 'query.pq' : 'measure.dax';
    const name = byTrack[slug] || 'main.py';
    return kind === 'example' ? name.replace(/^(main|app|query|script|index)/, 'example') : name;
  };

  const handleCodeChange = (newCode) => {
    setCode(newCode);
  };

  const executeCode = async () => {
    setOutput([]);
    setError('');
    setSubmitting(true);

    try {
      const response = await lessonService.submitExercise(currentExercise.id, code);
      setTestResults(response.data.results);

      if (response.data.passed) {
        toast.success('Exercise complete! 🎉');
        handleLessonComplete();
      } else {
        const total = response.data.results.length;
        const ok = response.data.results.filter((r) => r.passed).length;
        toast.error(`${ok} of ${total} checks passed. Keep going!`);
        setError(`${ok} of ${total} checks passed. Look at the red ones below, fix them and run again.`);
      }
    } catch (error) {
      console.error('Error submitting:', error);
      setError('Could not run your code. Please try again.');
      toast.error('Error running code');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLessonComplete = async () => {
    try {
      await lessonService.completeLesson(lesson.id, 100, timeSpent, 1);
    } catch (e) {
      console.error('Error saving progress:', e);
    }
    toast.success('Lesson completed! 🎉');
    setTimeout(() => {
      navigate(`/learn/${slug}`);
    }, 1500);
  };

  const requestHint = async () => {
    if (!currentExercise) return;
    const nextLevel = hintLevel + 1;
    setHintLevel(nextLevel);

    try {
      const response = await aiService.getHint(
        currentExercise.id,
        code,
        error || null,
        nextLevel
      );
      setHints((prev) => [...prev, { level: nextLevel, text: response.data.hint }]);
    } catch (error) {
      setHints((prev) => [
        ...prev,
        {
          level: nextLevel,
          text: 'Try breaking the problem into smaller steps. What does each input lead to?',
        },
      ]);
    }
  };

  const resetExercise = () => {
    if (currentExercise) {
      setCode(currentExercise.starter_code);
      setOutput([]);
      setTestResults([]);
      setHints([]);
      setHintLevel(0);
      setError('');
      setShowAnswer(false);
    }
  };

  if (loading) {
    return <LessonSkeleton />;
  }

  if (!lesson) return null;

  const tutorPanel = (
    <div className="flex flex-col h-full bg-cs-darker">
      <div className="flex items-center justify-between px-4 py-3 border-b border-cs-line/10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-main flex items-center justify-center">
            <AiIcon className="text-cs-dark text-lg" />
          </div>
          <div>
            <div className="font-semibold text-sm">CodeSquareAgent</div>
            <div className="text-xs text-cs-green flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-cs-green rounded-full animate-pulse"></span>
              Online
            </div>
          </div>
        </div>
        <button
          onClick={() => setShowTutor(false)}
          className="p-2 text-cs-text-dim hover:text-cs-primary hover:bg-cs-overlay/10 rounded-lg transition-all"
          title="Close panel"
        >
          <FiX />
        </button>
      </div>
      <div className="flex-grow min-h-0">
        <AITutor language={slug} context={`Learning: ${lesson.title}`} embedded />
      </div>
    </div>
  );

  return (
    <div className="h-[calc(100vh-3.75rem)] lg:h-[calc(100vh-3.5rem)] bg-cs-dark flex flex-col overflow-hidden">
      {/* z-30 + right padding: keeps the global theme / language / bell controls visible */}
      <header className="shrink-0 z-30 bg-cs-dark bg-opacity-90 backdrop-blur-2xl border-b border-cs-line/10 px-6 lg:px-8 py-2.5">
        <div className="flex items-center justify-between gap-4">
          {/* One-line path: Course / Module / Lesson */}
          <nav className="flex items-center gap-2 min-w-0 text-[0.9375rem]" aria-label="Lesson path">
            <Link to={`/learn/${slug}`} title="Back to course"
              className="w-8 h-8 shrink-0 grid place-items-center rounded-lg text-cs-text-dim hover:text-cs-primary hover:bg-cs-overlay/[0.05]">
              <FiArrowLeft />
            </Link>
            <Link to={`/learn/${slug}`} className="shrink-0 text-cs-text-dim hover:text-cs-primary">
              {crumbName(slug) || slug.replace(/[-_]+/g, ' ').replace(/^./, (c) => c.toUpperCase())}
            </Link>
            <span className="text-cs-text-muted">/</span>
            <Link to={`/learn/${slug}`} className="hidden sm:inline truncate max-w-[16rem] text-cs-text-dim hover:text-cs-primary"
              title={`Module ${lesson.module_level || ''}`.trim()}>
              {lesson.module_title || `Module ${lesson.module_level || ''}`}
            </Link>
            <span className="hidden sm:inline text-cs-text-muted">/</span>
            <h1 className="font-semibold truncate">{lesson.title}</h1>
            <span className="hidden md:inline shrink-0 text-xs text-cs-text-muted ml-1">Lesson {lesson.order}</span>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setShowTutor((v) => !v)}
              className={`btn btn-sm ${showTutor ? 'btn-primary' : 'btn-ghost'}`}
              title="Toggle the CodeSquareAgent panel"
            >
              <AiIcon /> <span className="hidden sm:inline">CodeSquareAgent</span>
            </button>
            <Link to="/projects" className="btn btn-ghost btn-sm">
              <FiCode /> <span className="hidden sm:inline">Projects</span>
            </Link>
          </div>
        </div>
      </header>

      {/* IDE-style split: lesson content scrolls on the left, tutor docks on the right */}
      <div className="flex flex-1 min-h-0">
        <main className="flex-1 min-w-0 overflow-y-auto px-6 lg:px-8 py-6">
          <div className="w-full flex flex-col gap-6">
          <section className="card-article overflow-hidden">
            <div className="flex items-start justify-between gap-4 mb-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-main rounded-xl flex items-center justify-center shrink-0">
                  <FiBook className="text-cs-dark" />
                </div>
                <div>
                  <p className="mono-label text-[0.625rem]"> concepts</p>
                  <h2 className="text-lg font-bold leading-tight">Lesson {lesson.order}</h2>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="badge badge-primary">{lesson.xp_reward || 10} XP</span>
                <span className="inline-flex items-center gap-1.5 text-xs text-cs-text-muted">
                  <FiClock /> ~{estimatedReadTime(lesson.content)} min
                </span>
              </div>
            </div>

            <div className="mb-6 text-sm text-cs-text-muted">
              Read the concept, then try the exercise — the CodeSquareAgent is on hand if you get stuck.
            </div>

            <div className="pt-6 border-t border-cs-line/10">
              <div
                ref={lessonBodyRef}
                className="lesson-article"
                dangerouslySetInnerHTML={{ __html: lesson.content }}
              />
            </div>

            {lesson.code_example && (
              <div className="mt-8 card-code overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 code-tab">
                  <span className="text-[0.8125rem] text-cs-text flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cs-red/70" />
                    <span className="w-2 h-2 rounded-full bg-cs-orange/70" />
                    <span className="w-2 h-2 rounded-full bg-cs-green/70" />
                    <span className="ml-3 text-cs-cyan inline-flex items-center gap-1.5">
                      <FiCode /> {fileName('example')}
                    </span>
                  </span>
                  <span className="hidden sm:inline-flex items-center gap-1.5 text-[0.625rem] uppercase tracking-wider text-cs-text-muted">
                    <FiBook /> read-only
                  </span>
                </div>
                <div className="p-4">
                  <CodeEditor
                    compact
                    value={lesson.code_example}
                    onChange={() => {}}
                    language={slug}
                    readOnly={true}
                  />
                </div>
              </div>
            )}
          </section>

          <section className="card flex-grow">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-cs-green rounded-xl flex items-center justify-center text-white">
                  <FiPlay />
                </div>
                <div>
                  <h2 className="text-lg font-bold">
                    Practice: {currentExercise?.title}
                  </h2>
                  <p className="text-sm text-cs-text-muted">
                    Exercise {activeExercise + 1} of {lesson?.exercises?.length || 0}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={resetExercise} className="btn btn-ghost btn-sm">
                  Reset
                </button>
                <button onClick={executeCode} disabled={submitting} title="Run (Ctrl+Enter)" className="btn btn-primary btn-sm">
                  <FiPlay /> {submitting ? 'Running...' : 'Run Code'}
                </button>
              </div>
            </div>

            <p className="text-sm text-cs-text-dim mb-4">{currentExercise?.description}</p>

            <div id="lesson-editor" className="h-[18.75rem] rounded-2xl bg-cs-darker border border-white border-opacity-10 overflow-hidden mb-4">
              <div className="flex items-center gap-2 px-4 py-3 bg-white bg-opacity-5">
                <span className="font-mono text-sm text-cs-cyan">{fileName('exercise')}</span>
              </div>
              <div className="h-[calc(100%-3.0625rem)]">
                <CodeEditor
                  compact
                  value={code}
                  onChange={handleCodeChange}
                  language={slug}
                  onSubmit={() => { if (!submitting) executeCode(); }}
                />
              </div>
            </div>

            {slug === 'power-bi' && (
              <div className="mb-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                  <p className="text-sm font-semibold">Try it in Power BI</p>
                  <p className="text-xs text-cs-text-muted">
                    {fileName('exercise') === 'query.pq'
                      ? 'Your query runs in the Power Query Editor below. Click a step to see the table at that point.'
                      : 'Your measure runs on the Lotus Bean Coffee dataset. Click slicers and columns to change the filter context.'}
                  </p>
                </div>
                <React.Suspense fallback={<div className="h-[42rem] rounded-lg skeleton" />}>
                <PowerBIDesktop
                  code={code}
                  kind={fileName('exercise') === 'query.pq' ? 'm' : 'dax'}
                  onNewMeasure={() => document.getElementById('lesson-editor')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                />
                </React.Suspense>
              </div>
            )}

            {error && (
              <div className="mb-4 p-4 rounded-xl bg-cs-red bg-opacity-10 border border-cs-red border-opacity-30 flex items-start gap-3">
                <FiXCircle className="text-cs-red mt-1 shrink-0" />
                <div>
                  <p className="font-semibold text-cs-red mb-1">Not quite yet</p>
                  <p className="text-sm text-cs-text-dim">{error}</p>
                </div>
              </div>
            )}

            {testResults.length > 0 && (
              <div className="mb-4 p-4 rounded-xl bg-cs-overlay/[0.04] border border-cs-line/10">
                <p className="text-sm font-semibold mb-3">Checks</p>
                <div className="space-y-2">
                  {testResults.map((result, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      {result.passed ? (
                        <FiCheckCircle className="text-cs-green" />
                      ) : (
                        <FiXCircle className="text-cs-red" />
                      )}
                      <span className={result.passed ? 'text-cs-green' : 'text-cs-red'}>
                        {result.description}
                      </span>
                      {!result.passed && result.error && result.error !== 'content check failed' && (
                        <span className="text-xs text-cs-text-muted font-mono">{result.error}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {hints.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <FiHelpCircle className="text-cs-orange" />
                  <span className="font-semibold text-cs-orange text-sm">Hints Revealed</span>
                </div>
                <div className="space-y-2">
                  {hints.map((hint, index) => (
                    <div key={index} className="p-3 rounded-xl bg-cs-orange bg-opacity-10 border border-cs-orange border-opacity-20 text-sm text-cs-text-dim">
                      <span className="font-bold text-cs-orange mr-2">Hint {hint.level}:</span>
                      {hint.text}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between items-center">
              <button onClick={requestHint} disabled={hintLevel >= 5} className="btn btn-secondary btn-sm">
                <FiHelpCircle /> Pick a Hint (Level {hintLevel + 1}/5)
              </button>

              <div className="flex gap-2">
                {activeExercise > 0 && (
                  <button onClick={() => setActiveExercise(activeExercise - 1)} className="btn btn-ghost btn-sm">
                    Previous
                  </button>
                )}
                {activeExercise < (lesson?.exercises?.length || 1) - 1 && (
                  <button
                    onClick={() => {
                      setActiveExercise(activeExercise + 1);
                      resetExercise();
                    }}
                    className="btn btn-ghost btn-sm"
                  >
                    Next <FiArrowRight />
                  </button>
                )}
              </div>
            </div>
          </section>
          </div>
        </main>

        {/* Docked tutor panel (desktop) — drag the left edge to resize */}
        <AnimatePresence initial={false}>
          {showTutor && (
            <motion.aside
              key="ai-tutor-dock"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: tutorWidth, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: resizingTutor ? 0 : 0.25, ease: 'easeOut' }}
              className="relative hidden lg:block shrink-0 h-full border-l border-cs-line/10 overflow-hidden"
            >
              <div
                onMouseDown={startTutorResize}
                title="Drag to resize"
                className={`absolute left-0 top-0 bottom-0 w-1.5 z-20 cursor-col-resize transition-colors ${
                  resizingTutor ? 'bg-cs-primary/60' : 'hover:bg-cs-primary/40'
                }`}
              />
              <div style={{ width: tutorWidth }} className="h-full">{tutorPanel}</div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {/* Tutor drawer (mobile / tablet) — overlays because there's no room to split */}
      <AnimatePresence>
        {showTutor && (
          <motion.div
            key="ai-tutor-drawer"
            className="lg:hidden fixed inset-0 z-[60]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="absolute inset-0 bg-cs-dark/60" onClick={() => setShowTutor(false)} />
            <motion.div
              initial={{ x: 420 }}
              animate={{ x: 0 }}
              exit={{ x: 420 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="absolute top-0 right-0 h-full w-full sm:w-[25rem] shadow-2xl"
            >
              {tutorPanel}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Persistent edge handle so first-time users notice the tutor */}
      {!showTutor && (
        <button
          onClick={() => setShowTutor(true)}
          title="Open the CodeSquareAgent"
          className="fixed right-0 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-2 px-2 py-4 rounded-l-xl bg-gradient-main text-cs-dark shadow-lg hover:pr-3 transition-all"
        >
          <AiIcon className="text-xl" />
          <span className="text-xs font-semibold tracking-wide [writing-mode:vertical-rl] rotate-180">
            AI&nbsp;Tutor
          </span>
        </button>
      )}
    </div>
  );
}

export default LessonView;
