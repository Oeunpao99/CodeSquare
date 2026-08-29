import React from 'react';
import {
  SiPython, SiJavascript, SiTypescript, SiHtml5, SiCss3, SiReact,
  SiPostgresql, SiFastapi, SiDocker, SiGit, SiGithub, SiPostman, SiSwagger,
} from 'react-icons/si';
import { FiCode } from 'react-icons/fi';

// Official brand marks (Simple Icons) for every language / tool we reference,
// so cards use the real logo instead of an emoji. Keys are matched loosely
// against a slug, name or id (case-insensitive).
const MAP = {
  python: [SiPython, '#3776AB'],
  javascript: [SiJavascript, '#F7DF1E'],
  js: [SiJavascript, '#F7DF1E'],
  typescript: [SiTypescript, '#3178C6'],
  ts: [SiTypescript, '#3178C6'],
  html: [SiHtml5, '#E34F26'],
  'html/css': [SiHtml5, '#E34F26'],
  'html & css': [SiHtml5, '#E34F26'],
  'html and css': [SiHtml5, '#E34F26'],
  css: [SiCss3, '#1572B6'],
  react: [SiReact, '#61DAFB'],
  sql: [SiPostgresql, '#4169E1'],
  postgres: [SiPostgresql, '#4169E1'],
  postgresql: [SiPostgresql, '#4169E1'],
  database: [SiPostgresql, '#4169E1'],
  fastapi: [SiFastapi, '#009688'],
  api: [SiFastapi, '#009688'],
  'rest api': [SiFastapi, '#009688'],
  docker: [SiDocker, '#2496ED'],
  devops: [SiDocker, '#2496ED'],
  git: [SiGit, '#F05032'],
  github: [SiGithub, null], // brand black is invisible on dark — follow text colour
  postman: [SiPostman, '#FF6C37'],
  swagger: [SiSwagger, '#85EA2D'],
  openapi: [SiSwagger, '#85EA2D'],
  'openapi / swagger': [SiSwagger, '#85EA2D'],
};

function resolve(name) {
  const key = String(name || '').trim().toLowerCase();
  if (MAP[key]) return MAP[key];
  // fall back to a contains-match (e.g. "Python 3", "Intro to SQL")
  const hit = Object.keys(MAP).find((k) => key.includes(k));
  return hit ? MAP[hit] : [FiCode, null];
}

function LangLogo({ name, brand = true, className = '', style, ...rest }) {
  const [Icon, color] = resolve(name);
  return (
    <Icon
      className={className}
      style={{ color: brand && color ? color : undefined, ...style }}
      aria-label={typeof name === 'string' ? name : undefined}
      {...rest}
    />
  );
}

export default LangLogo;
