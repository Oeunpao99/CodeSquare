import React from 'react';

// Older AI reviews were saved as one block of text ("- Score: 85 / - Overall
// feedback: … / - Specific suggestions: …"). Split that into the same shape new
// reviews have: { feedback, suggestions[], improvements[] }.
const SECTIONS = [
  ['skip', /^(score|whether|passes|pass\/fail|passed)\b/i],
  ['summary', /^(overall|summary|feedback)\b/i],
  ['suggestions', /^(specific )?(suggestions?|improvements? to make|to improve|what to improve|areas? (for|to) improve)/i],
  ['strengths', /^(what (they|you) did well|strengths?|done well|good)\b/i],
];

export function normalizeReview(review) {
  if (!review) return review;
  const hasLists = (review.suggestions || []).length || (review.improvements || []).length;
  const text = String(review.feedback || '');
  if (hasLists || !/\n/.test(text)) return review;

  const out = { summary: [], suggestions: [], strengths: [] };
  let section = 'summary';
  for (const raw of text.split('\n')) {
    let line = raw.trim();
    if (!line) continue;
    const bullet = /^([-*•]|\d+[.)])\s+/.test(line);
    const body = line.replace(/^([-*•]|\d+[.)])\s+/, '').replace(/\*\*/g, '');
    const head = body.match(/^([^:]{3,60}):\s*(.*)$/);
    const hit = head && SECTIONS.find(([, re]) => re.test(head[1].trim()));
    if (hit) {
      section = hit[0];
      if (section !== 'skip' && head[2]) out[section === 'summary' ? 'summary' : section].push(head[2]);
      continue;
    }
    if (section === 'skip') continue;
    if (section === 'summary') out.summary.push(body);
    else if (bullet || !out[section].length) out[section].push(body);
    else out[section][out[section].length - 1] += ` ${body}`; // wrapped line
  }
  return {
    ...review,
    feedback: out.summary.join(' '),
    suggestions: out.suggestions,
    improvements: out.strengths,
  };
}

// `code` spans inside review text.
export function InlineCode({ text }) {
  const parts = String(text).split(/(`[^`]+`)/g);
  return parts.map((p, i) => (p.startsWith('`') && p.endsWith('`') && p.length > 2
    ? <code key={i} className="px-1.5 py-0.5 rounded-md bg-cs-overlay/[0.07] text-cs-cyan text-[0.85em] font-mono break-words">{p.slice(1, -1)}</code>
    : <React.Fragment key={i}>{p}</React.Fragment>));
}
