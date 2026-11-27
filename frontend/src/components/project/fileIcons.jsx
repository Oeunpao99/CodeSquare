import React from 'react';
import {
  FiCode, FiGlobe, FiImage, FiGrid, FiFileText, FiCheckSquare, FiBookOpen, FiGithub, FiPackage, FiBox,
  FiSettings, FiTool, FiServer, FiDroplet, FiTerminal, FiDatabase, FiLayers, FiLock, FiAward, FiFile,
  FiInfo, FiMusic, FiType, FiCpu,
} from 'react-icons/fi';
import {
  SiDocker, SiNpm, SiNginx, SiGit, SiVite, SiTailwindcss, SiPostcss, SiYaml, SiC, SiCplusplus, SiMarkdown,
  SiToml, SiGnubash, SiTypescript, SiJavascript, SiReact, SiPython, SiHtml5, SiCss3, SiDotenv, SiEslint,
  SiPrettier, SiJupyter, SiRust, SiGo, SiPhp, SiRuby, SiKotlin, SiSwift, SiOpenjdk, SiSass, SiVuedotjs,
  SiSvelte, SiSqlite, SiPowerbi,
} from 'react-icons/si';

// ----------------------------------------------------------------- folders --
// [colour, badge icon] by folder name, like an editor icon theme.
const FOLDERS = [
  [['src', 'source', 'lib', 'app'], '#4CAF50', FiCode],
  [['public', 'static', 'www', 'wwwroot'], '#42A5F5', FiGlobe],
  [['assets', 'images', 'img', 'icons', 'illustrations', 'banners', 'thumbnails', 'media'], '#FFB300', FiImage],
  [['components', 'widgets', 'ui'], '#26C6DA', FiGrid],
  [['pages', 'views', 'screens', 'routes', 'templates'], '#FF7043', FiFileText],
  [['tests', 'test', '__tests__', 'spec', 'e2e'], '#26A69A', FiCheckSquare],
  [['docs', 'doc', 'documentation'], '#78909C', FiBookOpen],
  [['.github', '.git'], '#8D9DAE', FiGithub],
  [['.vscode', '.idea', '.devcontainer'], '#2196F3', FiSettings],
  [['node_modules', 'vendor', 'packages', 'site-packages'], '#8BC34A', FiPackage],
  [['dist', 'build', 'out', 'target', 'bin', 'release'], '#EF5350', FiBox],
  [['docker', '.docker'], '#2496ED', FiBox],
  [['config', 'configs', 'settings', 'conf', 'env'], '#90A4AE', FiSettings],
  [['utils', 'util', 'helpers', 'tools', 'common', 'shared'], '#AB47BC', FiTool],
  [['api', 'routers', 'routes_api', 'services', 'server', 'backend', 'controllers'], '#5C6BC0', FiServer],
  [['styles', 'css', 'scss', 'theme', 'themes'], '#EC407A', FiDroplet],
  [['scripts', 'bin_scripts', 'cli'], '#FDD835', FiTerminal],
  [['models', 'schemas', 'db', 'database', 'migrations', 'alembic', 'versions'], '#7E57C2', FiDatabase],
  [['context', 'store', 'hooks', 'state', 'redux'], '#00ACC1', FiLayers],
  [['sounds', 'audio', 'music'], '#EF5350', FiMusic],
  [['fonts'], '#8D6E63', FiType],
  [['ai', 'ml', 'notebooks', 'powerbi'], '#26A69A', FiCpu],
  [['frontend', 'client', 'web'], '#42A5F5', FiGlobe],
  [['design', 'designs', 'figma'], '#EC407A', FiImage],
];
const folderStyle = (name) => {
  const n = name.toLowerCase();
  const hit = FOLDERS.find(([names]) => names.includes(n));
  return hit ? { color: hit[1], Badge: hit[2] } : { color: '#90A4AE', Badge: null };
};

export function FolderIcon({ name, open }) {
  const { color, Badge } = folderStyle(name);
  return (
    <span className="relative inline-block w-[16px] h-[16px] shrink-0">
      <svg viewBox="0 0 16 16" className="w-full h-full" aria-hidden>
        {open ? (
          <>
            <path d="M1.5 3.5A1 1 0 0 1 2.5 2.5h3.6l1.4 1.5h5.9a1 1 0 0 1 1 1V6H4.4a1 1 0 0 0-.95.7L1.5 12.5z" fill={color} opacity=".75" />
            <path d="M3.4 6.7A1 1 0 0 1 4.35 6H15a.6.6 0 0 1 .57.8l-1.9 5.9a1 1 0 0 1-.95.7H1.6z" fill={color} />
          </>
        ) : (
          <>
            <path d="M1.5 3.5A1 1 0 0 1 2.5 2.5h3.6l1.4 1.5h5.9a1 1 0 0 1 1 1v.5h-13z" fill={color} opacity=".75" />
            <rect x="1.5" y="5" width="13" height="8.5" rx="1" fill={color} />
          </>
        )}
      </svg>
      {Badge && (
        <span className="absolute -right-[3px] -bottom-[2px] w-[10px] h-[10px] rounded-full grid place-items-center bg-cs-darkest">
          <Badge className="w-[7px] h-[7px]" style={{ color }} strokeWidth={3} />
        </span>
      )}
    </span>
  );
}

// ------------------------------------------------------------------- files --
const BY_NAME = {
  dockerfile: [SiDocker, '#2496ED'], '.dockerignore': [SiDocker, '#2496ED'],
  'package.json': [SiNpm, '#CB3837'], 'package-lock.json': [SiNpm, '#CB3837'],
  '.gitignore': [SiGit, '#F05032'], '.gitattributes': [SiGit, '#F05032'],
  'nginx.conf': [SiNginx, '#009639'],
  '.env': [SiDotenv, '#ECD53F'], '.env.example': [SiDotenv, '#ECD53F'], '.env.local': [SiDotenv, '#ECD53F'],
  license: [FiAward, '#FFB300'], 'license.txt': [FiAward, '#FFB300'], 'license.md': [FiAward, '#FFB300'],
  'readme.md': [FiInfo, '#42A5F5'],
  'requirements.txt': [SiPython, '#3776AB'], 'pyproject.toml': [SiPython, '#3776AB'], pipfile: [SiPython, '#3776AB'],
  makefile: [FiSettings, '#EF6C00'], procfile: [FiSettings, '#8D6E63'],
};
const BY_PREFIX = [
  ['docker-compose', SiDocker, '#2496ED'], ['compose.', SiDocker, '#2496ED'],
  ['vite.config', SiVite, '#9C6BFF'], ['tailwind.config', SiTailwindcss, '#38BDF8'],
  ['postcss.config', SiPostcss, '#DD3A0A'], ['.eslintrc', SiEslint, '#4B32C3'], ['eslint.config', SiEslint, '#4B32C3'],
  ['.prettierrc', SiPrettier, '#F7B93E'], ['tsconfig', SiTypescript, '#3178C6'],
];
const BY_EXT = {
  py: [SiPython, '#3776AB'], ipynb: [SiJupyter, '#F37626'],
  js: [SiJavascript, '#E5C100'], mjs: [SiJavascript, '#E5C100'], cjs: [SiJavascript, '#E5C100'],
  jsx: [SiReact, '#00B8D9'], tsx: [SiReact, '#3178C6'], ts: [SiTypescript, '#3178C6'],
  html: [SiHtml5, '#E34F26'], htm: [SiHtml5, '#E34F26'], css: [SiCss3, '#1572B6'], scss: [SiSass, '#CC6699'], sass: [SiSass, '#CC6699'],
  vue: [SiVuedotjs, '#41B883'], svelte: [SiSvelte, '#FF3E00'],
  json: ['{}', '#F9A825'], md: [SiMarkdown, '#42A5F5'], yml: [SiYaml, '#CB171E'], yaml: [SiYaml, '#CB171E'],
  toml: [SiToml, '#9C4121'], ini: [FiSettings, '#90A4AE'], cfg: [FiSettings, '#90A4AE'], conf: [FiSettings, '#90A4AE'],
  sql: [SiSqlite, '#4479A1'], db: [SiSqlite, '#4479A1'], sh: [SiGnubash, '#4EAA25'], bash: [SiGnubash, '#4EAA25'],
  bat: [FiTerminal, '#C1F12E'], ps1: [FiTerminal, '#5391FE'], c: [SiC, '#5C6BC0'], h: [SiC, '#5C6BC0'],
  cpp: [SiCplusplus, '#00599C'], hpp: [SiCplusplus, '#00599C'], rs: [SiRust, '#DEA584'], go: [SiGo, '#00ADD8'],
  php: [SiPhp, '#777BB4'], rb: [SiRuby, '#CC342D'], kt: [SiKotlin, '#7F52FF'], swift: [SiSwift, '#F05138'],
  java: [SiOpenjdk, '#E76F00'], cs: [FiCode, '#68217A'],
  png: [FiImage, '#26A69A'], jpg: [FiImage, '#26A69A'], jpeg: [FiImage, '#26A69A'], gif: [FiImage, '#26A69A'],
  webp: [FiImage, '#26A69A'], svg: [FiImage, '#FFB300'], ico: [FiImage, '#26A69A'],
  mp3: [FiMusic, '#EF5350'], wav: [FiMusic, '#EF5350'], txt: [FiFileText, '#90A4AE'], csv: [FiGrid, '#43A047'],
  lock: [FiLock, '#90A4AE'], dax: [SiPowerbi, '#E8B000'], pq: [SiPowerbi, '#E8B000'], xml: [FiCode, '#FF7043'],
};

export function FileIcon({ path }) {
  const name = path.split('/').pop().toLowerCase();
  const ext = name.includes('.') ? name.split('.').pop() : '';
  const pre = BY_PREFIX.find(([p]) => name.startsWith(p));
  const [Icon, color] = BY_NAME[name] || (pre ? [pre[1], pre[2]] : null) || BY_EXT[ext] || [FiFile, '#90A4AE'];
  if (typeof Icon === 'string') {
    return <span className="w-[16px] shrink-0 text-center text-[10px] font-bold leading-none" style={{ color }}>{Icon}</span>;
  }
  return <Icon className="w-[14px] h-[14px] shrink-0 mx-[1px]" style={{ color }} />;
}
