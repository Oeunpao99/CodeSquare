import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { lessonService } from '../services/api';
import { FiArrowLeft, FiLock, FiCheck, FiBook, FiClock, FiZap } from 'react-icons/fi';
import LangLogo from '../components/LangLogo';
import AiIcon from '../components/AiIcon';

function LanguageView() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [language, setLanguage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLanguage();
  }, [slug]);

  const fetchLanguage = async () => {
    try {
      const response = await lessonService.getLanguage(slug);
      setLanguage(response.data);
    } catch (error) {
      console.error('Error fetching language:', error);
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-cs-darkest border-t-cs-primary rounded-full animate-spin"></div>
        <p className="text-cs-text-muted">Loading {slug}...</p>
      </div>
    );
  }

  if (!language) return null;

  const totalLessons = language.modules?.reduce((acc, m) => acc + (m.lessons?.length || 0), 0) || 0;
  const completedLessons = language.modules?.reduce((acc, m) => acc + (m.lessons?.filter(l => l.completed).length || 0), 0) || 0;
  const progressPct = totalLessons ? (completedLessons / totalLessons) * 100 : 0;

  return (
    <main className="w-full px-6 lg:px-10 py-6">
      {/* Sticky header — just the compact identity bar stays locked while modules scroll */}
      <div className="sticky top-0 z-30 bg-cs-dark/85 backdrop-blur-xl border-b border-cs-line/[0.07] -mx-6 lg:-mx-10 px-6 lg:px-10 pt-4 pb-4 -mt-4 mb-6">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-cs-text-muted hover:text-cs-primary mb-3">
          <FiArrowLeft /> Back to Dashboard
        </Link>

        <div className="flex items-center gap-4 lg:gap-6">
          <LangLogo name={language.slug || language.name} className="text-4xl lg:text-5xl shrink-0" />
          <div className="min-w-0 flex-grow">
            <h1 className="text-2xl lg:text-3xl font-bold mb-0.5 truncate">{language.name}</h1>
            <p className="text-sm text-cs-text-muted truncate">{language.description}</p>
          </div>
          <div className="hidden md:block text-right shrink-0">
            <p className="font-mono text-sm text-cs-text-dim">{completedLessons} / {totalLessons} lessons</p>
            <div className="mt-1.5 h-2 w-40 bg-cs-darker rounded overflow-hidden">
              <div
                className="h-full rounded transition-all duration-500"
                style={{
                  width: `${progressPct}%`,
                  background: 'linear-gradient(90deg, rgb(var(--cs-primary)/0.4), rgb(var(--cs-primary)))',
                }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Info strip — progress + what you'll learn + agent (scrolls away) */}
      <div className="mb-8 grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-stretch">
          <div className="rounded-xl border border-cs-line/10 bg-cs-darker/60 p-3">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-cs-text-muted mb-2"> course progress</h3>
            <p className="text-sm text-cs-text">
              <span className="font-mono font-bold text-cs-primary">{completedLessons}</span>
              <span className="text-cs-text-muted"> / {totalLessons} lessons completed</span>
            </p>
            <div className="mt-2 h-2 bg-cs-darker rounded overflow-hidden">
              <div className="h-full bg-gradient-main rounded transition-all duration-500" style={{ width: `${progressPct}%` }}></div>
            </div>
          </div>

          <div className="rounded-xl border border-cs-line/10 bg-cs-darker/60 p-3">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-cs-text-muted mb-2"> what you'll learn</h3>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {language.modules?.map((module, index) => (
                <span key={index} className="flex items-center gap-1.5 text-sm text-cs-text-dim">
                  <span className="text-cs-green font-bold">✓</span> {module.title}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-cs-primary/40 bg-cs-primary/[0.06] p-3 sm:max-w-[240px]">
            <div className="flex items-center gap-2 mb-1">
              <AiIcon className="text-xl text-cs-primary" />
              <h3 className="font-semibold text-sm">CodeSquareAgent</h3>
            </div>
            <p className="text-xs text-cs-text-dim">
              Stuck? Get help that teaches — not just answers.
            </p>
          </div>
        </div>

      <div>
        {language.modules?.map((module) => (
          <div key={module.id} className="mb-8">
            <div className="flex items-center gap-6 p-6 card mb-4">
              <div className="px-4 py-2 font-mono text-sm font-bold shrink-0 text-cs-primary bg-cs-primary/15 border border-cs-primary/40 rounded-lg shadow-[0_0_16px_-8px_rgb(var(--cs-primary)/0.6)]">
                Lv. {module.level ?? module.order}
              </div>
              <div className="flex-grow">
                <h2 className="text-xl font-bold mb-1">{module.title}</h2>
                <p className="text-sm text-cs-text-muted">{module.description}</p>
              </div>
              <span
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold uppercase tracking-wide border ${
                  module.difficulty === 'beginner'
                    ? 'bg-cs-green/10 text-cs-green border-cs-green/30'
                    : module.difficulty === 'intermediate'
                    ? 'bg-cs-orange/10 text-cs-orange border-cs-orange/30'
                    : 'bg-cs-red/10 text-cs-red border-cs-red/30'
                }`}
              >
                {module.difficulty}
              </span>
            </div>

            <div className="flex flex-col gap-3">
              {module.lessons?.map((lesson) => (
                <Link
                  key={lesson.id}
                  to={`/learn/${slug}/module/${module.id}/lesson/${lesson.id}`}
                  className={`flex items-center gap-4 p-4 card group ${
                    lesson.completed ? '!border-cs-green !border-opacity-30' : ''
                  } hover:translate-x-1`}
                >
                  <div
                    className={`w-10 h-10 flex items-center justify-center rounded-full shrink-0 ${
                      lesson.completed
                        ? 'bg-cs-green bg-opacity-20 text-cs-green'
                        : 'bg-cs-primary bg-opacity-10 text-cs-primary'
                    }`}
                  >
                    {lesson.completed ? <FiCheck /> : <FiBook />}
                  </div>

                  <div className="flex-grow">
                    <h3 className="font-semibold text-[15px] mb-1">{lesson.title}</h3>
                    <div className="flex gap-4 text-xs text-cs-text-muted">
                      <span className="flex items-center gap-1"><FiClock /> {Math.ceil(lesson.content.length / 500)} min</span>
                      <span className="flex items-center gap-1"><FiZap /> {lesson.xp_reward} XP</span>
                    </div>
                  </div>

                  {lesson.completed && (
                    <div className="px-3 py-1.5 bg-cs-green bg-opacity-10 rounded-lg">
                      <span className="font-bold text-cs-green">{Math.round(lesson.score)}%</span>
                    </div>
                  )}

                  <FiArrowLeft className="text-cs-text-muted group-hover:text-cs-primary transition-colors rotate-180" />
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

export default LanguageView;