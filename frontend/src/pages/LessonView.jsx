import React, { useState, useEffect, useRef } from 'react';
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

function LessonView() {
  const { slug, moduleId, lessonId } = useParams();
  const navigate = useNavigate();
  const [lesson, setLesson] = useState(null);
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

  const currentExercise = lesson?.exercises?.[activeExercise];

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
        toast.error('Some tests failed. Keep trying!');
        const failedTest = response.data.results.find((r) => !r.passed);
        if (failedTest) setError(failedTest.error || "Code doesn't produce expected output");
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
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-cs-darkest border-t-cs-primary rounded-full animate-spin"></div>
        <p className="text-gray-400">Loading lesson...</p>
      </div>
    );
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
    <div className="h-[calc(100vh-60px)] lg:h-screen bg-cs-dark flex flex-col overflow-hidden">
      <header className="shrink-0 z-50 bg-cs-dark bg-opacity-90 backdrop-blur-2xl border-b border-cs-line/10 px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-6 min-w-0">
            <Link to={`/learn/${slug}`} className="inline-flex items-center gap-2 text-sm text-cs-text-dim hover:text-cs-primary shrink-0">
              <FiArrowLeft /> <span className="hidden sm:inline">Back to Course</span>
            </Link>
            <div className="min-w-0">
              <h1 className="text-xl font-bold truncate">{lesson.title}</h1>
              <p className="text-sm text-cs-text-muted">
                Module {moduleId} • Lesson {lesson.order}
              </p>
            </div>
          </div>

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
                  <p className="mono-label text-[10px]">// concepts</p>
                  <h2 className="text-lg font-bold leading-tight">Lesson {lesson.order}</h2>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="badge badge-primary">{lesson.xp_reward || 10} XP</span>
                <span className="inline-flex items-center gap-1.5 text-xs text-cs-text-muted font-mono">
                  <FiClock /> ~{estimatedReadTime(lesson.content)} min
                </span>
              </div>
            </div>

            <div className="mb-6 text-sm text-cs-text-muted">
              Read the concept, then try the exercise — the CodeSquareAgent is on hand if you get stuck.
            </div>

            <div className="pt-6 border-t border-cs-line/10">
              <div
                className="lesson-article"
                dangerouslySetInnerHTML={{ __html: lesson.content }}
              />
            </div>

            {lesson.code_example && (
              <div className="mt-8 card-code overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 code-tab">
                  <span className="font-mono text-[13px] text-cs-text flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cs-red/70" />
                    <span className="w-2 h-2 rounded-full bg-cs-orange/70" />
                    <span className="w-2 h-2 rounded-full bg-cs-green/70" />
                    <span className="ml-3 text-cs-cyan inline-flex items-center gap-1.5">
                      <FiCode /> example.{slug === 'python' ? 'py' : 'js'}
                    </span>
                  </span>
                  <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-cs-text-muted">
                    <FiBook /> read-only
                  </span>
                </div>
                <div className="p-4">
                  <CodeEditor
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
                <div className="w-10 h-10 bg-cs-green bg-opacity-20 rounded-xl flex items-center justify-center text-cs-green">
                  <FiPlay />
                </div>
                <div>
                  <h2 className="text-lg font-bold">
                    Practice: {currentExercise?.title}
                  </h2>
                  <p className="text-sm text-gray-500">
                    Exercise {activeExercise + 1} of {lesson?.exercises?.length || 0}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={resetExercise} className="btn btn-ghost btn-sm">
                  Reset
                </button>
                <button onClick={executeCode} disabled={submitting} className="btn btn-primary btn-sm">
                  <FiPlay /> {submitting ? 'Running...' : 'Run Code'}
                </button>
              </div>
            </div>

            <p className="text-sm text-gray-400 mb-4">{currentExercise?.description}</p>

            <div className="h-[300px] rounded-2xl bg-cs-darker border border-white border-opacity-10 overflow-hidden mb-4">
              <div className="flex items-center gap-2 px-4 py-3 bg-white bg-opacity-5">
                <span className="font-mono text-sm text-cs-cyan">main.{slug === 'python' ? 'py' : 'js'}</span>
              </div>
              <div className="h-[calc(100%-49px)]">
                <CodeEditor
                  value={code}
                  onChange={handleCodeChange}
                  language={slug}
                />
              </div>
            </div>

            {error && (
              <div className="mb-4 p-4 rounded-xl bg-cs-red bg-opacity-10 border border-cs-red border-opacity-30 flex items-start gap-3">
                <FiXCircle className="text-cs-red mt-1 shrink-0" />
                <div>
                  <p className="font-semibold text-cs-red mb-1">Your code has an error</p>
                  <p className="text-sm text-gray-300 font-mono">{error}</p>
                </div>
              </div>
            )}

            {testResults.length > 0 && (
              <div className="mb-4 p-4 rounded-xl bg-white bg-opacity-5 border border-white border-opacity-10">
                <p className="text-sm text-gray-400 mb-3">Test Results:</p>
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
                      {!result.passed && result.error && (
                        <span className="text-xs text-gray-500 font-mono">{result.error}</span>
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
                    <div key={index} className="p-3 rounded-xl bg-cs-orange bg-opacity-10 border border-cs-orange border-opacity-20 text-sm text-gray-300">
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
              className="absolute top-0 right-0 h-full w-full sm:w-[400px] shadow-2xl"
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
