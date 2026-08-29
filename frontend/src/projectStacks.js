// Shared project-stack metadata used by the project creator and workspace.

export const STACK_BY_TRACK = {
  'python': { id: 'python', name: 'Python' },
  'python-intermediate': { id: 'python', name: 'Python' },
  'backend-foundations': { id: 'python', name: 'Python + SQL' },
  'javascript': { id: 'javascript', name: 'JavaScript' },
  'html-css': { id: 'html', name: 'HTML / CSS' },
  'react-typescript': { id: 'react', name: 'React' },
  'full-stack': { id: 'react', name: 'React' },
  'linux-shell': { id: 'bash', name: 'Shell script' },
};

export const DEFAULT_STACKS = [
  { id: 'python', name: 'Python' },
  { id: 'javascript', name: 'JavaScript' },
  { id: 'html', name: 'HTML / CSS' },
];

// editor syntax mode + starter filename per stack id
export const STACK_META = {
  python: { mode: 'python', ext: 'py', file: 'main.py' },
  javascript: { mode: 'javascript', ext: 'js', file: 'main.js' },
  html: { mode: 'html', ext: 'html', file: 'index.html' },
  react: { mode: 'javascript', ext: 'jsx', file: 'App.jsx' },
  bash: { mode: 'python', ext: 'sh', file: 'script.sh' },
};

export const SKILLS_BY_STACK = {
  python: [
    'Variables', 'Functions', 'Loops', 'Conditionals', 'Lists & dicts',
    'Strings', 'Classes', 'File I/O', 'Error handling', 'Modules',
  ],
  javascript: [
    'Variables (let/const)', 'Functions & arrows', 'Loops', 'Conditionals',
    'Arrays', 'Objects', 'Template literals', 'map / filter / reduce',
    'Promises & async', 'fetch & JSON',
  ],
  html: [
    'Semantic HTML', 'Forms & inputs', 'CSS selectors', 'Box model', 'Flexbox',
    'Grid', 'Responsive design', 'Colours & typography', 'Positioning', 'Transitions',
  ],
  react: [
    'Components & props', 'JSX', 'useState', 'useEffect', 'Lists & keys',
    'Controlled forms', 'Fetching data', 'Conditional rendering', 'Context', 'Routing',
  ],
  bash: [
    'Navigation & paths', 'Pipes & redirection', 'grep / sed / awk', 'Variables & quoting',
    'Conditionals & loops', 'Functions', 'Exit codes', 'Permissions', 'Arguments & flags', 'cron',
  ],
};

export function stacksForMajor(majorData) {
  const tracks = majorData?.tracks || [];
  if (!tracks.length) return DEFAULT_STACKS;
  const seen = new Set();
  const opts = [];
  for (const slug of tracks) {
    const s = STACK_BY_TRACK[slug];
    if (s && !seen.has(s.id)) {
      seen.add(s.id);
      opts.push(s);
    }
  }
  return opts.length ? opts : DEFAULT_STACKS;
}

export const editorMode = (stackId) => STACK_META[stackId]?.mode || 'python';
export const stackFile = (stackId) => STACK_META[stackId]?.file || 'main.txt';
