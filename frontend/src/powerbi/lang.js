// Syntax modes for DAX and Power Query M (CodeMirror stream languages).
// Token names map to the same highlight tags the other languages use, so the
// colours follow the app theme: functions blue, tables cyan, [columns]/[measures]
// mint, strings green, numbers orange, keywords violet.
import { StreamLanguage } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

const tokenTable = {
  fn: t.function(t.variableName),
  table: t.className,
  field: t.propertyName,
  kw: t.keyword,
  type: t.typeName,
};

const DAX_KW = /^(VAR|RETURN|TRUE|FALSE|ASC|DESC|IN|NOT|AND|OR)\b/i;

export const daxLanguage = StreamLanguage.define({
  name: 'dax',
  startState: () => ({ block: false }),
  token(stream, state) {
    if (state.block) { if (stream.skipTo('*/')) { stream.next(); stream.next(); state.block = false; } else stream.skipToEnd(); return 'comment'; }
    if (stream.eatSpace()) return null;
    if (stream.match('--') || stream.match('//')) { stream.skipToEnd(); return 'comment'; }
    if (stream.match('/*')) { state.block = true; return 'comment'; }
    if (stream.match(/^"(?:[^"]|"")*"/)) return 'string';
    if (stream.match(/^\[[^\]]*\]/)) return 'field';
    if (stream.match(/^'[^']*'(?=\s*\[)/)) return 'table';
    if (stream.match(/^\d+(\.\d+)?/)) return 'number';
    if (stream.match(/^[A-Za-z_][\w.]*(?=\s*\()/)) return 'fn';
    if (stream.match(/^[A-Za-z_][\w]*(?=\[)/)) return 'table';
    if (stream.match(DAX_KW)) return 'kw';
    if (stream.match(/^[A-Za-z_][\w ]*?(?=\s*=)/) && stream.column() === 0) return 'variableName.definition';
    if (stream.match(/^(<>|<=|>=|&&|\|\||[=<>+\-*/&,(){}])/)) return 'operator';
    stream.next();
    return null;
  },
  tokenTable,
  languageData: { commentTokens: { line: '--' } },
});

const M_KW = /^(let|in|each|if|then|else|and|or|not|true|false|null|try|otherwise|error|meta|as|is|section|shared)\b/;
const M_TYPE = /^(type\s+)?(number|text|date|datetime|datetimezone|time|duration|logical|binary|any|list|record|table|Int64\.Type|Currency\.Type|Percentage\.Type)\b/;

export const mLanguage = StreamLanguage.define({
  name: 'powerquery',
  startState: () => ({ block: false }),
  token(stream, state) {
    if (state.block) { if (stream.skipTo('*/')) { stream.next(); stream.next(); state.block = false; } else stream.skipToEnd(); return 'comment'; }
    if (stream.eatSpace()) return null;
    if (stream.match('//')) { stream.skipToEnd(); return 'comment'; }
    if (stream.match('/*')) { state.block = true; return 'comment'; }
    if (stream.match(/^#"(?:[^"]|"")*"/)) return 'variableName';
    if (stream.match(/^"(?:[^"]|"")*"/)) return 'string';
    if (stream.match(/^\[[^\]]*\]/)) return 'field';
    if (stream.match(/^#?[A-Za-z_][\w]*\.[\w.]*(?=\s*\()/)) return 'fn';
    if (stream.match(/^#(date|datetime|time|duration|table)\b/)) return 'fn';
    if (stream.match(/^\d+(\.\d+)?/)) return 'number';
    if (stream.match(M_TYPE)) return 'type';
    if (stream.match(M_KW)) return 'kw';
    if (stream.match(/^[A-Za-z_][\w]*/)) return 'variableName';
    if (stream.match(/^(=>|<>|<=|>=|[=<>+\-*/&,(){}])/)) return 'operator';
    stream.next();
    return null;
  },
  tokenTable,
  languageData: { commentTokens: { line: '//' } },
});

// Which one a Power BI snippet is.
export const isPowerQuery = (src = '') => /\blet\b[\s\S]*\bin\b|\bTable\.|\bCsv\.|\beach\b|#"/.test(src);
