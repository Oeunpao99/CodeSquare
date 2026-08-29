import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  FiCode, FiZap, FiMessageCircle, FiArrowRight, FiPlay,
  FiTerminal, FiCheckCircle
} from 'react-icons/fi';
import ThemeMenu from '../components/ThemeMenu';
import LangLogo from '../components/LangLogo';
import AiIcon from '../components/AiIcon';

// editor-theme syntax palette (One Dark / Tokyo Night family)
const SYN = {
  comment: '#5C6370',
  keyword: '#C792EA',
  fn: '#82AAFF',
  string: '#C3E88D',
  number: '#F78C6C',
  operator: '#89DDFF',
  fg: '#E4E4E7',
  error: '#F87171',
};

function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const fullText = "why won't my loop stop?";
  const [typedText, setTypedText] = useState('');

  useEffect(() => {
    if (user) navigate('/dashboard');
  }, [user, navigate]);

  useEffect(() => {
    let i = 0;
    const timer = setInterval(() => {
      if (i <= fullText.length) {
        setTypedText(fullText.slice(0, i));
        i++;
      } else {
        clearInterval(timer);
      }
    }, 90);
    return () => clearInterval(timer);
  }, []);

  const features = [
    {
      icon: <FiPlay />,
      tag: '01',
      title: 'Learn',
      description: 'Structured lessons that start from zero. No experience assumed, nothing skipped.',
      color: '#2DD4BF',
    },
    {
      icon: <FiCode />,
      tag: '02',
      title: 'Practice',
      description: 'A real editor in the browser. Run code, read the error, iterate — instant feedback.',
      color: '#3B82F6',
    },
    {
      icon: <FiZap />,
      tag: '03',
      title: 'Build',
      description: 'AI scopes projects to exactly what you have learned so far. No tutorial hell.',
      color: '#4ADE80',
    },
    {
      icon: <FiMessageCircle />,
      tag: '04',
      title: 'Get Unstuck',
      description: 'The tutor explains why the code is wrong and what to try — not just that it broke.',
      color: '#8B5CF6',
    },
  ];

  const languages = [
    {
      name: 'Python',
      file: 'main.py',
      dot: '#3776AB',
      lines: [
        { t: 'def ', c: SYN.keyword }, { t: 'greet', c: SYN.fn }, { t: '(name):', c: SYN.fg },
      ],
      body: 'print(f"hi, {name}")',
    },
    {
      name: 'JavaScript',
      file: 'app.js',
      dot: '#F7DF1E',
      lines: [
        { t: 'const ', c: SYN.keyword }, { t: 'greet', c: SYN.fn }, { t: ' = (name) =>', c: SYN.fg },
      ],
      body: 'console.log(`hi, ${name}`)',
    },
    {
      name: 'HTML & CSS',
      file: 'index.html',
      dot: '#E34F26',
      lines: [
        { t: '<h1 ', c: SYN.keyword }, { t: 'class', c: SYN.fn }, { t: '="hero">', c: SYN.fg },
      ],
      body: 'Hello, world</h1>',
    },
  ];

  const steps = [
    { cmd: 'codesphere init', out: 'Account created. Workspace ready.' },
    { cmd: 'codesphere lang python', out: 'Track selected → 9 lessons queued.' },
    { cmd: 'codesphere start', out: 'Lesson 01 running. Tutor attached.' },
    { cmd: 'codesphere ship', out: 'First project scaffolded. Go build.' },
  ];

  const stack = ['Python', 'JavaScript', 'HTML/CSS', 'FastAPI', 'React', 'CodeSquareAgent'];

  const backendTree = [
    { path: 'databases/', note: 'sql · schema design · joins · indexing', c: SYN.fn },
    { path: 'migrations/', note: 'alembic · upgrade / downgrade · seeds', c: SYN.fn },
    { path: 'api/', note: 'fastapi · rest · auth · pagination', c: SYN.fn },
    { path: 'docs/', note: 'swagger ui · openapi schema', c: SYN.fn },
    { path: 'tooling/', note: 'postman collections · httpie · curl', c: SYN.fn },
    { path: 'devops/', note: 'docker · compose · ci pipelines · env config', c: SYN.fn },
    { path: 'vcs/', note: 'git · branching · github · pull requests · ssh keys', c: SYN.fn },
  ];

  const heroCode = useMemo(() => ([
    { n: 1, parts: [{ t: '# your first bug, explained', c: SYN.comment }] },
    { n: 2, parts: [{ t: 'for ', c: SYN.keyword }, { t: 'i ', c: SYN.fg }, { t: 'in ', c: SYN.keyword }, { t: 'range', c: SYN.fn }, { t: '(5):', c: SYN.fg }] },
    { n: 3, parts: [{ t: '    total ', c: SYN.fg }, { t: '+= ', c: SYN.operator }, { t: 'i', c: SYN.fg }] },
    { n: 4, parts: [{ t: 'print', c: SYN.fn }, { t: '(total)  ', c: SYN.fg }, { t: '# NameError: total', c: SYN.error }] },
  ]), []);

  return (
    <div className="min-h-screen overflow-x-hidden">
      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4 bg-cs-dark/70 backdrop-blur-2xl border-b border-cs-line/10">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2 font-mono text-lg font-bold text-cs-text group">
            <span className="text-cs-primary">⟨/⟩</span>
            <span className="text-cs-text-muted">~/</span>codesphere
            <span className="hidden sm:inline-flex items-center gap-1 ml-2 font-mono text-xs text-cs-text-muted">
              <span className="text-cs-green">$</span> <span className="text-cs-primary group-hover:text-cs-mint group-hover:shadow-[0_0_8px_rgb(var(--cs-primary)/0.5)] transition-all">status</span>
              <span className="w-1.5 h-3.5 bg-cs-primary/70 animate-pulse inline-block" aria-hidden="true" />
            </span>
          </Link>
          <div className="flex gap-3 items-center">
            <ThemeMenu />
            <Link to="/auth" className="btn btn-ghost btn-sm">Sign In</Link>
            <Link to="/auth" className="btn btn-primary btn-sm">Get Started</Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative min-h-screen flex items-center px-6 pt-28 pb-20 overflow-hidden">
        <div className="absolute inset-0 dev-grid" />

        {/* flying code — snippets drift up in the backdrop */}
        <div className="absolute inset-0 code-rain-layer pointer-events-none opacity-60" aria-hidden="true">
          {[
            { text: 'const ok = trained(tutor);', left: '6%', dur: '22s', delay: '0s', op: 0.5 },
            { text: 'db.query("SELECT * FROM app")', left: '18%', dur: '26s', delay: '3s', op: 0.4 },
            { text: 'npm run build --production', left: '68%', dur: '24s', delay: '1.5s', op: 0.5 },
            { text: 'git push origin main', left: '82%', dur: '28s', delay: '5s', op: 0.4 },
            { text: 'docker compose up -d', left: '45%', dur: '30s', delay: '7s', op: 0.45 },
            { text: 'print("hello, world")', left: '30%', dur: '20s', delay: '9s', op: 0.5 },
          ].map((snippet, i) => (
            <span
              key={i}
              className="code-rain-line"
              style={{
                left: snippet.left,
                animationDuration: snippet.dur,
                animationDelay: snippet.delay,
                opacity: snippet.op,
                fontSize: '11px',
              }}
            >
              {snippet.text}
            </span>
          ))}
        </div>

        <div className="absolute -top-40 -left-40 w-[36rem] h-[36rem] rounded-full bg-cs-primary/10 blur-[120px] neon-pulse" />
        <div className="absolute -bottom-40 -right-40 w-[36rem] h-[36rem] rounded-full bg-cs-violet/10 blur-[120px]" />

        <div className="relative max-w-6xl mx-auto grid lg:grid-cols-2 gap-14 items-center w-full">
          {/* left */}
          <div>
            <h1 className="text-5xl md:text-6xl font-extrabold leading-[1.05] mb-6">
              Learn to code with an{' '}
              <span className="text-gradient-dev">CodeSquareAgent</span>{' '}
              that reads your errors.
            </h1>
            <p className="text-lg text-cs-text-dim mb-8 max-w-xl">
              From <span className="font-mono text-cs-mint">"what is a variable?"</span> to shipping
              real projects. Structured lessons, a live editor, and a tutor that explains the
              <span className="text-cs-text"> why</span>.
            </p>
            <div className="flex flex-wrap gap-4 mb-10">
              <Link to="/auth" className="btn btn-primary btn-lg">
                Start Learning Now <FiArrowRight />
              </Link>
              <button className="btn btn-secondary btn-lg font-mono">
                <FiTerminal /> $ watch demo
              </button>
            </div>
            <div className="flex gap-10">
              {[
                { num: '9', label: 'Interactive Lessons' },
                { num: '4', label: 'CodeSquareAgent Modes' },
                { num: '∞', label: 'Practice Exercises' },
              ].map((s) => (
                <div key={s.label} className="flex flex-col">
                  <span className="text-3xl font-extrabold text-gradient-dev font-mono">{s.num}</span>
                  <span className="text-xs text-cs-text-muted mt-1">{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* right — terminal */}
          <div className="terminal relative overflow-hidden">
            <div className="scanlines absolute inset-0 pointer-events-none opacity-70" aria-hidden="true" />
            <div className="terminal-bar">
              <span className="terminal-dot bg-cs-red/80" />
              <span className="terminal-dot bg-cs-orange/80" />
              <span className="terminal-dot bg-cs-green/80" />
              <span className="ml-3 font-mono text-xs text-cs-text-muted">tutor.py — codesphere</span>
            </div>
            <div className="p-5 bg-cs-dark/60">
              {heroCode.map((line) => (
                <div key={line.n} className="code-line flex">
                  <span className="select-none text-cs-line/25 w-8 shrink-0">{line.n}</span>
                  <span>
                    {line.parts.map((p, idx) => (
                      <span key={idx} style={{ color: p.c }}>{p.t}</span>
                    ))}
                  </span>
                </div>
              ))}

              <div className="mt-4 rounded-lg glass glass-hover border-cs-primary/20 p-3 error-flicker">
                <div className="font-mono text-xs text-cs-cyan mb-1.5 flex items-center gap-1.5">
                  <AiIcon className="text-sm" /> ai_tutor
                </div>
                <p className="font-mono text-[13px] leading-6 text-cs-text-dim">
                  <span className="text-cs-text-muted">❯ </span>{typedText}
                  <span className="inline-block w-2 h-4 bg-cs-primary align-middle ml-0.5 animate-blink" />
                </p>
                <p className="font-mono text-[13px] leading-6 text-cs-text-dim mt-2 error-shake">
                  <span className="text-cs-green">total</span> is never set before line 3. Add{' '}
                  <span className="text-cs-mint">total = 0</span> above the loop — the name has to
                  exist before you add to it.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STACK STRIP */}
      <section className="border-y border-cs-line/10 bg-cs-darker/40">
        <div className="max-w-6xl mx-auto px-6 py-5 flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="mono-label text-cs-text-muted mr-2">// stack</span>
          {stack.map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5 font-mono text-xs px-2.5 py-1 rounded-md glass text-cs-text-dim">
              <LangLogo name={s} className="text-sm" />
              {s}
            </span>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <span className="mono-label">// capabilities</span>
        <h2 className="text-4xl font-extrabold mt-3 mb-3">Four ways the AI actually helps</h2>
        <p className="text-cs-text-dim mb-14 max-w-2xl">
          Not a chatbot bolted on. Four distinct roles — teacher, reviewer, architect, debugger —
          working the same codebase you are.
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((f) => (
            <div key={f.tag} className="glass glass-hover group rounded-2xl p-6">
              <div className="flex items-center justify-between mb-5">
                <div
                  className="w-11 h-11 flex items-center justify-center rounded-lg text-xl glass"
                  style={{ color: f.color }}
                >
                  {f.icon}
                </div>
                <span className="font-mono text-xs text-cs-text-muted group-hover:text-cs-cyan transition-colors">
                  // {f.tag}
                </span>
              </div>
              <h3 className="text-lg font-bold mb-2">{f.title}</h3>
              <p className="text-sm text-cs-text-dim leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* LANGUAGES */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <span className="mono-label">// choose your path</span>
        <h2 className="text-4xl font-extrabold mt-3 mb-3">Pick a language, open the file</h2>
        <p className="text-cs-text-dim mb-14 max-w-2xl">
          Start with whichever one excites you. You can switch tracks any time.
        </p>

        <div className="grid md:grid-cols-3 gap-6">
          {languages.map((lang) => (
            <div key={lang.name} className="terminal glass-hover group">
              <div className="terminal-bar">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: lang.dot }} />
                <span className="font-mono text-xs text-cs-text-muted">{lang.file}</span>
              </div>
              <div className="p-5 bg-cs-dark/50">
                <div className="code-line mb-1">
                  <span className="select-none text-cs-line/25 mr-3">1</span>
                  {lang.lines.map((p, i) => (
                    <span key={i} style={{ color: p.c }}>{p.t}</span>
                  ))}
                </div>
                <div className="code-line mb-6">
                  <span className="select-none text-cs-line/25 mr-3">2</span>
                  <span className="text-cs-text-dim">{'  '}{lang.body}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold">{lang.name}</span>
                  <Link to="/auth" className="btn btn-secondary btn-sm font-mono">
                    run <FiArrowRight />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* BACKEND & DEVOPS TRACK */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="mono-label">// beyond the basics</span>
            <h2 className="text-4xl font-extrabold mt-3 mb-4">Backend &amp; DevOps track</h2>
            <p className="text-cs-text-dim mb-6 max-w-xl">
              Once the fundamentals click, keep going. CodeSquareAgent walks you through the
              stack real teams ship on — databases and SQL, schema migrations, REST APIs and their
              docs, the tools you test them with, containers and CI, and the Git workflow that ties
              it together.
            </p>
            <div className="flex flex-wrap gap-2">
              {['SQL', 'Migrations', 'REST API', 'OpenAPI / Swagger', 'Postman', 'Docker', 'CI/CD', 'Git', 'GitHub', 'SSH'].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5 font-mono text-xs px-2.5 py-1 rounded-md glass glass-hover text-cs-text-dim">
                  <LangLogo name={t} className="text-sm" />
                  {t}
                </span>
              ))}
            </div>
          </div>

          <div className="terminal">
            <div className="terminal-bar">
              <span className="terminal-dot bg-cs-red/80" />
              <span className="terminal-dot bg-cs-orange/80" />
              <span className="terminal-dot bg-cs-green/80" />
              <span className="ml-3 font-mono text-xs text-cs-text-muted">codesphere-tracks/</span>
            </div>
            <div className="p-5 bg-cs-dark/60 font-mono text-sm">
              <div className="flex items-center gap-2 mb-2">
                <span style={{ color: SYN.keyword }}>backend-foundations/</span>
                <span className="text-cs-text-muted text-xs">// track</span>
              </div>
              {backendTree.map((row, i) => {
                const last = i === backendTree.length - 1;
                return (
                  <div key={row.path} className="flex items-start leading-7">
                    <span className="select-none text-cs-line/30 mr-2">{last ? '└──' : '├──'}</span>
                    <span style={{ color: row.c }}>{row.path}</span>
                    <span className="text-cs-text-muted ml-3 hidden sm:inline">{row.note}</span>
                  </div>
                );
              })}
              <div className="mt-3 pt-3 border-t border-cs-line/10 text-cs-text-muted text-xs">
                <span style={{ color: SYN.comment }}># in beta — enroll now, lessons unlock weekly</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="max-w-4xl mx-auto px-6 py-24">
        <span className="mono-label">// getting started</span>
        <h2 className="text-4xl font-extrabold mt-3 mb-14">Four commands to your first project</h2>

        <div className="terminal relative overflow-hidden">
          <div className="scanlines absolute inset-0 pointer-events-none opacity-50" aria-hidden="true" />
          <div className="terminal-bar">
            <span className="terminal-dot bg-cs-red/80" />
            <span className="terminal-dot bg-cs-orange/80" />
            <span className="terminal-dot bg-cs-green/80" />
            <span className="ml-3 font-mono text-xs text-cs-text-muted">zsh — ~/codesphere</span>
          </div>
          <div className="p-6 bg-cs-dark/60 space-y-4">
            {steps.map((s, i) => (
              <div key={s.cmd}>
                <p className="font-mono text-sm">
                  <span className="text-cs-primary">❯</span>{' '}
                  <span className="text-cs-mint">~</span>{' '}
                  <span className="text-cs-text">{s.cmd}</span>
                </p>
                <p className="font-mono text-sm text-cs-text-muted pl-6 flex items-center gap-2">
                  <FiCheckCircle className="text-cs-primary shrink-0" /> {s.out}
                </p>
                {i === steps.length - 1 && (
                  <p className="font-mono text-sm mt-2">
                    <span className="text-cs-primary">❯</span>{' '}
                    <span className="text-cs-mint">~</span>{' '}
                    <span className="inline-block w-2 h-4 bg-cs-primary align-middle animate-blink" />
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-6 pb-28 relative">
        <div className="absolute inset-0 code-rain-layer pointer-events-none opacity-35" aria-hidden="true">
          {[
            { text: 'npm run dev', left: '10%', dur: '24s', delay: '1s', op: 0.5 },
            { text: 'codesphere ship', left: '30%', dur: '20s', delay: '4s', op: 0.5 },
            { text: 'git commit -m "ship it"', left: '55%', dur: '26s', delay: '2s', op: 0.5 },
            { text: 'def learn():', left: '78%', dur: '22s', delay: '6s', op: 0.5 },
          ].map((sn, i) => (
            <span
              key={i}
              className="code-rain-line"
              style={{ left: sn.left, animationDuration: sn.dur, animationDelay: sn.delay, opacity: sn.op, fontSize: '11px' }}
            >
              {sn.text}
            </span>
          ))}
        </div>
        <div className="terminal dev-dots glass-hover relative overflow-hidden">
          <div className="scanlines absolute inset-0 pointer-events-none opacity-40" aria-hidden="true" />
          <div className="p-10 md:p-14 text-center bg-cs-dark/70">
            <span className="mono-label">// ready?</span>
            <h2 className="text-3xl md:text-4xl font-extrabold mt-3 mb-4">
              Start your coding journey today
            </h2>
            <p className="text-cs-text-dim mb-8">
              Free to start. No credit card. Just you, an editor, and a tutor that has your back.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link to="/auth" className="btn btn-primary btn-lg font-mono">
                ❯ codesphere init <FiArrowRight />
              </Link>
              <button className="btn btn-ghost btn-lg font-mono">
                <span className="text-cs-green">$</span> view roadmap
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-12 px-6 border-t border-cs-line/10">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-mono font-bold">
            <span className="text-cs-primary">⟨/⟩</span>
            <span className="text-cs-text-muted">~/</span>codesphere
          </div>
          <p className="font-mono text-xs text-cs-text-muted">
            AI-powered learning for complete beginners · © {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
}

export default Landing;
