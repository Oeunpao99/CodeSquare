import React from 'react';
import {
  SiPython, SiJavascript, SiReact, SiHtml5, SiLinux, SiGit, SiFastapi,
} from 'react-icons/si';
import {
  FiLayers, FiBookOpen, FiGlobe, FiDatabase, FiShare2, FiShield,
  FiCheckSquare, FiCpu, FiTool,
} from 'react-icons/fi';

// A real brand mark where one exists; otherwise a plain SVG icon. Never an emoji.
const MAP = {
  python: [SiPython, '#3776AB'],
  'python-intermediate': [SiPython, '#3776AB'],
  javascript: [SiJavascript, '#F7DF1E'],
  'html-css': [SiHtml5, '#E34F26'],
  'react-typescript': [SiReact, '#61DAFB'],
  'linux-shell': [SiLinux, '#FCC624'],
  'backend-foundations': [SiFastapi, '#009688'],
  'full-stack': [FiLayers, null],
  'version-control': [SiGit, '#F05032'],
  'dev-workflow': [FiTool, null],
  'http-web': [FiGlobe, null],
  'sql-databases': [FiDatabase, null],
  'api-design': [FiShare2, null],
  security: [FiShield, null],
  testing: [FiCheckSquare, null],
  dsa: [FiCpu, null],
};

const INITIALS = /^[A-Za-z0-9]{1,3}$/;

function CollectionLogo({ slug, fallback, brand = true, className = '', style, ...rest }) {
  const hit = MAP[slug];
  if (hit) {
    const [Icon, color] = hit;
    return (
      <Icon
        className={className}
        style={{ color: brand && color ? color : undefined, ...style }}
        {...rest}
      />
    );
  }

  // Latin initials (e.g. "PY") still render as text; emoji / anything else falls
  // back to a generic icon rather than an emoji glyph.
  if (typeof fallback === 'string' && INITIALS.test(fallback.trim())) {
    return (
      <span className={`font-mono font-semibold ${className}`} style={style} {...rest}>
        {fallback.trim().toUpperCase()}
      </span>
    );
  }

  return <FiBookOpen className={className} style={style} {...rest} />;
}

export default CollectionLogo;
