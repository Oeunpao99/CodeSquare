import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { aiService, projectService } from '../services/api';
import { FiZap, FiCode, FiCheck, FiPlus } from 'react-icons/fi';
import { toast } from '../utils/toast';
import LangLogo from '../components/LangLogo';
import MajorIcon from '../components/MajorIcon';
import { useMajor } from '../context/MajorContext';
import { stacksForMajor, SKILLS_BY_STACK } from '../projectStacks';

const GENERATION_STEPS = [
  'Reading your major & skill focus…',
  'Reshaping skills into a project brief…',
  'Designing the architecture & requirements…',
  'Scaffolding starter files…',
  'Polishing hints and edge cases…',
  'Saving it to your workspace…',
];

const FLYING_LINES = [
  'def build()...', 'let data = [];', 'import ai_tutor', 'function main()', 'fetch("/project")',
  '{ type: "brief" }', 'while learning:', 'app.use(middleware)', 'return skills', '=> "done"',
];

function GenerateProject() {
  const { major, majorData } = useMajor();
  const navigate = useNavigate();
  const languageOptions = useMemo(() => stacksForMajor(majorData), [majorData]);

  const [language, setLanguage] = useState(() => languageOptions[0]?.id || 'python');
  const [difficulty, setDifficulty] = useState('beginner');
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);

  const allSkills = SKILLS_BY_STACK[language] || SKILLS_BY_STACK.python;

  useEffect(() => {
    if (!languageOptions.some((o) => o.id === language)) {
      setLanguage(languageOptions[0]?.id || 'python');
    }
  }, [languageOptions]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setSkills((prev) => prev.filter((s) => allSkills.includes(s)));
  }, [language]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSkill = (skill) =>
    setSkills((prev) => (prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]));

  // Fill a fake progress bar + cycle messages while the AI works.
  useEffect(() => {
    if (!loading) return;
    setProgress(0);
    setStepIndex(0);
    const tick = setInterval(() => {
      setProgress((p) => (p + Math.random() * 7 + 2 >= 90 ? 90 : p + Math.random() * 7 + 2));
    }, 130);
    const msg = setInterval(() => {
      setStepIndex((i) => (i + 1) % GENERATION_STEPS.length);
    }, 900);
    return () => { clearInterval(tick); clearInterval(msg); };
  }, [loading]);

  const generate = async () => {
    if (skills.length === 0) {
      toast.error("Select at least one skill you've learned!");
      return;
    }
    setLoading(true);
    try {
      const gen = await aiService.generateProject(
        language, skills, difficulty, majorData?.projectFocus || null
      );
      setProgress(100);
      const p = gen.data;
      const res = await projectService.create({
        title: p.title || 'AI project',
        description: p.description || '',
        language,
        code: p.starter_code || '',
        brief: {
          requirements: p.requirements || [],
          hints: p.hints || [],
          estimated_time: p.estimated_time || '',
        },
      });
      navigate(`/projects/${res.data.id}`);
    } catch {
      toast.error('Could not generate the project. Try again.');
      setLoading(false);
    }
  };

  return (
    <main className="w-full px-6 lg:px-10 py-8">
      <div className="rounded-xl border border-cs-line/10 bg-cs-overlay/[0.03] px-5 py-4 mb-6 flex flex-wrap items-center gap-x-4 gap-y-2">
        <FiZap className="text-cs-primary shrink-0" />
        <p className="flex-1 min-w-0 text-[0.9375rem] text-cs-text-dim">
          The AI sizes a project to what you've learned and drops it into your workspace.
        </p>
        {majorData ? (
          <span className="inline-flex items-center gap-2 text-sm">
            <span style={{ color: majorData.color }}><MajorIcon major={major} /></span>
            <span className="font-medium">{majorData.label}</span>
            <Link to="/profile" className="text-cs-text-muted hover:text-cs-primary">Change</Link>
          </span>
        ) : (
          <Link to="/dashboard" className="text-sm text-cs-primary">Pick a major for tailored projects →</Link>
        )}
      </div>

      {loading && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-cs-dark/70 backdrop-blur-md" />
          <div className="absolute inset-0 pointer-events-none code-rain-layer" aria-hidden>
            {Array.from({ length: 22 }).map((_, i) => (
              <span
                key={i}
                className="code-rain-line"
                style={{
                  left: `${(i * 4.5) % 100}%`,
                  animationDuration: `${2.5 + (i % 5) * 0.9}s`,
                  animationDelay: `${(i % 7) * 0.55}s`,
                  fontSize: `${12 + (i % 3) * 3}px`,
                  opacity: 0.2 + (i % 4) * 0.16,
                }}
              >
                {FLYING_LINES[i % FLYING_LINES.length]}
              </span>
            ))}
          </div>

          <div className="relative z-10 w-full max-w-lg animate-slide-up">
            <div className="flex justify-center mb-3">
              <div className="relative w-14 h-14">
                <div className="absolute inset-0 rounded-full border-4 border-cs-primary/15" />
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-cs-primary border-r-cs-cyan animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <FiCode className="text-cs-primary animate-pulse" />
                </div>
              </div>
            </div>

            <div className="terminal p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-cs-cyan flex items-center gap-2">
                  <FiCode className="animate-pulse" /> ai · generating project
                </span>
                <span className="text-xl font-bold text-cs-primary tabular-nums">
                  {Math.round(progress)}%
                </span>
              </div>
              <div className="h-3 bg-cs-darkest rounded-full overflow-hidden border border-cs-line/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cs-primary via-cs-cyan to-cs-violet transition-[width] duration-150 ease-out relative"
                  style={{ width: `${progress}%` }}
                >
                  <span className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-5 rounded bg-white/40 blur-[2px]" />
                </div>
              </div>
              <div className="mt-4 h-5 relative overflow-hidden">
                {GENERATION_STEPS.map((text, i) => (
                  <div
                    key={text}
                    className={`absolute inset-0 transition-all duration-300 ${
                      i === stepIndex ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
                    }`}
                  >
                    <span className="flex items-center gap-2 text-sm text-cs-text-dim">
                      <span className="w-1.5 h-1.5 rounded-full bg-cs-primary animate-pulse" />
                      {text}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-cs-line/10 flex flex-wrap items-center gap-2">
                <span className="mono-label text-[0.625rem]">reshaping</span>
                <span className="px-2 py-0.5 rounded-md bg-cs-overlay/[0.06] border border-cs-line/10 text-xs text-cs-mint">
                  {languageOptions.find((o) => o.id === language)?.name || language}
                </span>
                {skills.map((s) => (
                  <span key={s} className="px-2 py-0.5 rounded-md bg-cs-overlay/[0.06] border border-cs-line/10 text-xs text-cs-text-dim">
                    {s}
                  </span>
                ))}
                <span className="px-2 py-0.5 rounded-md bg-cs-orange/[0.1] border border-cs-orange/20 text-xs text-cs-orange">
                  {difficulty}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {!loading && (
        <section className="rounded-xl border border-cs-line/10 divide-y divide-cs-line/10">
          {/* 1. Language */}
          <div className="p-5">
            <h2 className="text-base font-semibold">1. Language</h2>
            <p className="text-sm text-cs-text-dim mt-0.5">
              {majorData ? `Stacks from your ${majorData.label} path.` : 'The AI writes the brief in this stack.'}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3 mt-4">
              {languageOptions.map((opt) => {
                const on = language === opt.id;
                return (
                  <button key={opt.id} onClick={() => setLanguage(opt.id)}
                    className={`relative h-14 px-4 rounded-lg border flex items-center gap-3 text-left transition-colors ${
                      on ? 'border-cs-primary bg-cs-primary/[0.06]' : 'border-cs-line/15 hover:border-cs-line/30 hover:bg-cs-overlay/[0.03]'
                    }`}>
                    <LangLogo name={opt.id} className="text-xl shrink-0" />
                    <span className="font-medium text-[0.9375rem] truncate">{opt.name}</span>
                    {on && <FiCheck className="ml-auto text-cs-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Difficulty */}
          <div className="p-5">
            <h2 className="text-base font-semibold">2. Difficulty</h2>
            <p className="text-sm text-cs-text-dim mt-0.5">How much scaffolding you want.</p>
            <div className="grid sm:grid-cols-3 gap-3 mt-4">
              {[
                { id: 'beginner', label: 'Beginner', desc: 'Simple & guided' },
                { id: 'intermediate', label: 'Intermediate', desc: 'More challenging' },
                { id: 'advanced', label: 'Advanced', desc: 'Push your limits' },
              ].map((opt, i) => {
                const on = difficulty === opt.id;
                return (
                  <button key={opt.id} onClick={() => setDifficulty(opt.id)}
                    className={`p-4 rounded-lg border text-left transition-colors ${
                      on ? 'border-cs-primary bg-cs-primary/[0.06]' : 'border-cs-line/15 hover:border-cs-line/30 hover:bg-cs-overlay/[0.03]'
                    }`}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-[0.9375rem]">{opt.label}</span>
                      <span className="flex gap-1">
                        {[0, 1, 2].map((d) => (
                          <span key={d} className={`w-4 h-1.5 rounded-full ${d <= i ? 'bg-cs-primary' : 'bg-cs-overlay/[0.12]'}`} />
                        ))}
                      </span>
                    </div>
                    <span className="block text-sm text-cs-text-dim mt-1">{opt.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Skills */}
          <div className="p-5">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">3. Skills</h2>
                <p className="text-sm text-cs-text-dim mt-0.5">
                  What can you do in {languageOptions.find((o) => o.id === language)?.name || 'this stack'}? The project only uses what you tick.
                </p>
              </div>
              <span className="text-sm text-cs-text-muted shrink-0">{skills.length} selected</span>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              {allSkills.map((skill) => {
                const on = skills.includes(skill);
                return (
                  <button key={skill} onClick={() => toggleSkill(skill)}
                    className={`h-9 px-3.5 rounded-lg border inline-flex items-center gap-1.5 text-sm transition-colors ${
                      on ? 'border-cs-primary bg-cs-primary/[0.06] text-cs-text' : 'border-cs-line/15 text-cs-text-dim hover:border-cs-line/30 hover:text-cs-text'
                    }`}>
                    {on ? <FiCheck className="text-cs-primary" /> : <FiPlus className="text-cs-text-muted" />} {skill}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-cs-text-dim">
              {(languageOptions.find((o) => o.id === language)?.name || language)} · {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} · {skills.length} skill{skills.length === 1 ? '' : 's'}
            </span>
            <button onClick={generate} disabled={loading} className="btn btn-primary">
              <FiZap /> Generate project
            </button>
          </div>
        </section>
      )}
    </main>
  );
}

export default GenerateProject;
