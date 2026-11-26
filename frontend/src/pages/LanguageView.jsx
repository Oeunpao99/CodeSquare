import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { lessonService } from '../services/api';
import {
  FiArrowLeft, FiArrowRight, FiCheck, FiClock, FiZap, FiLayers, FiBookOpen, FiChevronRight,
} from 'react-icons/fi';
import LangLogo from '../components/LangLogo';
import { CourseSkeleton } from '../components/Skeletons';

const DIFF_COLOR = {
  beginner: 'text-cs-green',
  intermediate: 'text-cs-orange',
  advanced: 'text-cs-red',
};
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const lessonMinutes = (l) => Math.max(1, Math.ceil((l.content?.length || 0) / 500));

// Wide AI banner per course (backend/scripts/gen_course_banners.py); hidden if missing.
function CourseBanner({ slug }) {
  const [ok, setOk] = useState(true);
  if (!ok) return null; // no banner yet: show the clean header, no empty strip
  return (
    <div className="-mx-6 -mt-6 mb-6 aspect-[5/1] overflow-hidden rounded-t-2xl bg-cs-overlay/5">
      <img
        src={`/banners/course/${slug}.webp`}
        alt=""
        onError={() => setOk(false)}
        className="w-full h-full object-cover"
      />
    </div>
  );
}

function LanguageView() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [language, setLanguage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    lessonService.getLanguage(slug)
      .then((r) => setLanguage(r.data))
      .catch((error) => {
        console.error('Error fetching language:', error);
        navigate('/dashboard');
      })
      .finally(() => setLoading(false));
  }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading || !language) {
    return (
      <main className="w-full px-6 lg:px-10 py-6">
        <CourseSkeleton />
      </main>
    );
  }

  const modules = language.modules || [];
  const allLessons = modules.flatMap((m) => (m.lessons || []).map((l) => ({ ...l, moduleId: m.id })));
  const totalLessons = allLessons.length;
  const completedLessons = allLessons.filter((l) => l.completed).length;
  const progressPct = totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0;
  const totalMinutes = allLessons.reduce((acc, l) => acc + lessonMinutes(l), 0);
  const totalXp = allLessons.reduce((acc, l) => acc + (l.xp_reward || 0), 0);
  const next = allLessons.find((l) => !l.completed);
  const lessonUrl = (l) => `/learn/${slug}/module/${l.moduleId}/lesson/${l.id}`;
  const hours = totalMinutes >= 60 ? `${(totalMinutes / 60).toFixed(1).replace(/\.0$/, '')} h` : `${totalMinutes} min`;

  return (
    <main className="w-full px-6 lg:px-10 py-6">
      {/* Compact sticky bar */}

      {/* Hero */}
      <section className="card overflow-hidden mb-8">
        <CourseBanner slug={language.slug} />

        <div className="flex flex-col lg:flex-row lg:items-end gap-6">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 mb-2">
              <LangLogo name={language.slug || language.name} className="text-3xl shrink-0" />
              <h1 className="text-3xl font-bold">{language.name}</h1>
            </div>
            <p className="text-cs-text-dim max-w-3xl">{language.description}</p>

            <div className="flex flex-wrap gap-x-5 gap-y-1 mt-4 text-sm text-cs-text-dim">
              <span className="inline-flex items-center gap-1.5"><FiLayers /> {modules.length} modules</span>
              <span className="inline-flex items-center gap-1.5"><FiBookOpen /> {totalLessons} lessons</span>
              <span className="inline-flex items-center gap-1.5"><FiClock /> about {hours}</span>
              <span className="inline-flex items-center gap-1.5"><FiZap /> {totalXp} XP</span>
            </div>
          </div>

          <div className="lg:w-72 shrink-0">
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="text-cs-text-dim">Your progress</span>
              <span className="font-semibold">{completedLessons} / {totalLessons}</span>
            </div>
            <div className="h-2 rounded-full bg-cs-overlay/10 overflow-hidden">
              <div className="h-full rounded-full bg-cs-primary transition-all duration-500" style={{ width: `${progressPct}%` }} />
            </div>
            {next ? (
              <Link to={lessonUrl(next)} className="btn btn-primary w-full justify-center mt-4">
                {completedLessons ? 'Continue' : 'Start course'} <FiArrowRight />
              </Link>
            ) : totalLessons > 0 ? (
              <p className="mt-4 text-sm font-semibold text-cs-green inline-flex items-center gap-1.5">
                <FiCheck /> Course complete
              </p>
            ) : null}
          </div>
        </div>

        {/* What you'll learn: numbered, links to each module below */}
        {modules.length > 0 && (
          <div className="mt-6 pt-6 border-t border-cs-line/10">
            <h2 className="text-sm font-semibold mb-3">What you'll learn</h2>
            <ol className="grid sm:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-2">
              {modules.map((m, i) => (
                <li key={m.id}>
                  <a href={`#mod-${m.id}`} className="flex items-center gap-3 text-sm text-cs-text hover:text-cs-primary">
                    <span className="w-6 h-6 rounded-full bg-cs-overlay/[0.07] grid place-items-center text-xs font-semibold shrink-0">
                      {i + 1}
                    </span>
                    {m.title}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>

      {/* Modules */}
      <div className="space-y-6">
        {modules.map((module) => {
          const done = (module.lessons || []).filter((l) => l.completed).length;
          const total = module.lessons?.length || 0;
          return (
            <section key={module.id} id={`mod-${module.id}`} className="card !p-0 overflow-hidden scroll-mt-24">
              <header className="flex items-start gap-4 p-5 border-b border-cs-line/10">
                <span className="w-10 h-10 rounded-xl bg-cs-primary/10 text-cs-primary grid place-items-center font-bold shrink-0">
                  {module.level ?? module.order}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold">
                    <span className={DIFF_COLOR[module.difficulty] || 'text-cs-text-dim'}>{cap(module.difficulty)}</span>
                    <span className="text-cs-text-muted"> · Level {module.level ?? module.order}</span>
                  </p>
                  <h2 className="text-lg font-bold">{module.title}</h2>
                  {module.description && <p className="text-sm text-cs-text-dim mt-0.5">{module.description}</p>}
                </div>
                <span className="text-sm text-cs-text-dim shrink-0 tabular-nums">{done}/{total}</span>
              </header>

              <ul className="divide-y divide-cs-line/10">
                {(module.lessons || []).map((lesson, i) => (
                  <li key={lesson.id}>
                    <Link
                      to={`/learn/${slug}/module/${module.id}/lesson/${lesson.id}`}
                      className="group flex items-center gap-4 px-5 py-3.5 text-cs-text hover:bg-cs-overlay/[0.04] transition-colors"
                    >
                      <span
                        className={`w-8 h-8 rounded-full grid place-items-center text-sm shrink-0 ${
                          lesson.completed ? 'bg-cs-green text-white' : 'border border-cs-line/20 text-cs-text-dim'
                        }`}
                      >
                        {lesson.completed ? <FiCheck /> : i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate group-hover:text-cs-primary transition-colors">{lesson.title}</p>
                        <p className="text-xs text-cs-text-dim mt-0.5 flex gap-3">
                          <span className="inline-flex items-center gap-1"><FiClock /> {lessonMinutes(lesson)} min</span>
                          <span className="inline-flex items-center gap-1"><FiZap /> {lesson.xp_reward} XP</span>
                          {lesson.completed && <span className="text-cs-green font-semibold">{Math.round(lesson.score)}%</span>}
                        </p>
                      </div>
                      <FiChevronRight className="text-cs-text-muted group-hover:text-cs-primary transition-colors shrink-0" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </main>
  );
}

export default LanguageView;
