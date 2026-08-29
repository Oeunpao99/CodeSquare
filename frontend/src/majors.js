// Career "majors". Picking one filters + orders the dashboard tracks and — most
// importantly — steers the AI project generator via `projectFocus`.
//
// `tracks` holds Language slugs (from the lessons API) this major covers, most
// relevant first. `projectLang` is the language the project generator defaults
// to. `icon` is a Tabler icon name resolved in MajorIcon.

export const MAJORS = {
  'computer-science': {
    label: 'Computer Science',
    icon: 'TbBinaryTree',
    color: '#8B5CF6',
    tagline: 'Think like a computer scientist',
    blurb:
      'The fundamentals every engineer shares: logic, data structures, algorithms and how to reason about efficiency.',
    focus: ['Programming fundamentals', 'Data structures', 'Algorithms', 'Recursion', 'Big-O thinking', 'OOP'],
    tracks: ['python', 'python-intermediate', 'javascript', 'linux-shell'],
    projectLang: 'python',
    projectFocus:
      'core computer-science fundamentals — implementing data structures, algorithms and small command-line programs that exercise logic, recursion and complexity analysis',
  },

  'data-science': {
    label: 'Data Science',
    icon: 'TbChartHistogram',
    color: '#4ADE80',
    tagline: 'Turn raw data into answers',
    blurb:
      'Load messy data, clean it, measure it and communicate what you found. Python plus SQL plus a statistical mindset.',
    focus: ['Python for data', 'Working with datasets', 'Statistics basics', 'SQL queries', 'Data cleaning', 'Reporting'],
    tracks: ['python', 'python-intermediate', 'backend-foundations', 'linux-shell'],
    projectLang: 'python',
    projectFocus:
      'data analysis — loading a dataset, cleaning it, computing summary statistics and metrics, and producing a clear text or tabular report of the findings',
  },

  'ai-engineer': {
    label: 'AI Engineer',
    icon: 'TbSparkles',
    color: '#22D3EE',
    tagline: 'Build with models',
    blurb:
      'Text processing, classification, evaluation and prompt-driven apps — the practical side of shipping AI features.',
    focus: ['Python', 'Text processing', 'Classification basics', 'Working with model APIs', 'Prompt design', 'Evaluation'],
    tracks: ['python', 'python-intermediate', 'backend-foundations', 'linux-shell'],
    projectLang: 'python',
    projectFocus:
      'AI / machine-learning engineering — building things like a rule-based or statistical text classifier, a keyword extractor, a simple recommender, a prompt-driven assistant, or a small evaluation harness that scores model output',
  },

  'web-developer': {
    label: 'Web Developer',
    icon: 'TbBrandHtml5',
    color: '#FB923C',
    tagline: 'Make things people click',
    blurb:
      'Structure with HTML, style with CSS, bring it to life with JavaScript. Interfaces, interactivity and the browser.',
    focus: ['HTML', 'CSS', 'JavaScript', 'DOM & events', 'Fetch / HTTP', 'Components'],
    tracks: ['html-css', 'javascript', 'react-typescript', 'full-stack'],
    projectLang: 'javascript',
    projectFocus:
      'front-end web development — building interactive pages and UI components with HTML, CSS and JavaScript: forms, lists, filtering, DOM updates and calling an API for data',
  },

  'backend-engineer': {
    label: 'Backend Engineer',
    icon: 'TbServer2',
    color: '#3B82F6',
    tagline: 'Power the app from behind',
    blurb:
      'APIs, databases, migrations and the Git workflow. The services and data models everything else depends on.',
    focus: ['Python', 'REST APIs', 'Databases & SQL', 'Schema migrations', 'Validation & auth', 'Git & GitHub'],
    tracks: ['python', 'python-intermediate', 'backend-foundations', 'linux-shell', 'full-stack'],
    projectLang: 'python',
    projectFocus:
      'back-end engineering — designing REST endpoints, request/response models, validation, and small services that read and write structured data (in-memory or SQL)',
  },

  automation: {
    label: 'Automation Engineer',
    icon: 'TbScript',
    color: '#2DD4BF',
    tagline: 'Let scripts do the boring parts',
    blurb:
      'Practical Python that processes files, transforms text, talks to APIs and removes repetitive manual work.',
    focus: ['Python scripting', 'File I/O', 'Text & regex', 'Calling web APIs', 'Error handling', 'Scheduling'],
    tracks: ['python', 'python-intermediate', 'linux-shell', 'backend-foundations'],
    projectLang: 'python',
    projectFocus:
      'practical automation — scripts that read and write files, parse or transform text, call a web API and glue steps together to automate a repetitive task',
  },
};

export const MAJOR_KEYS = Object.keys(MAJORS);
export const MAJOR_STORAGE_KEY = 'cs-major';

export function isMajor(key) {
  return MAJOR_KEYS.includes(key);
}
