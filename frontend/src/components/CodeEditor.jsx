import React, { useMemo, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView, keymap } from '@codemirror/view';
import { Prec } from '@codemirror/state';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { python } from '@codemirror/lang-python';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';

// Colors are `var(--cs-*)` references, so the editor re-paints automatically
// when the app theme changes — no need to rebuild the extension.
const V = (name) => `rgb(var(--${name}))`;

const csEditorTheme = EditorView.theme(
  {
    '&': {
      color: V('cs-text'),
      backgroundColor: V('cs-darkest'),
      fontSize: '14px',
      height: '100%',
    },
    '&.cm-focused': { outline: 'none' },
    '.cm-scroller': {
      backgroundColor: V('cs-darkest'),
      fontFamily: "'JetBrains Mono', monospace",
    },
    '.cm-content': {
      caretColor: V('cs-primary'),
      fontFamily: "'JetBrains Mono', monospace",
    },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: V('cs-primary') },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: 'rgb(var(--cs-primary) / 0.18)',
    },
    '.cm-activeLine': { backgroundColor: 'rgb(var(--cs-text) / 0.04)' },
    '.cm-gutters': {
      backgroundColor: V('cs-darkest'),
      color: 'rgb(var(--cs-text-muted) / 0.7)',
      border: 'none',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'rgb(var(--cs-text) / 0.04)',
      color: V('cs-text-dim'),
    },
    '.cm-foldPlaceholder': {
      backgroundColor: 'rgb(var(--cs-text) / 0.1)',
      border: 'none',
      color: V('cs-text-dim'),
    },
    '.cm-tooltip': {
      backgroundColor: V('cs-darkest'),
      border: '1px solid rgb(var(--cs-text) / 0.12)',
      color: V('cs-text'),
    },
    '.cm-tooltip-autocomplete ul li[aria-selected]': {
      backgroundColor: 'rgb(var(--cs-primary) / 0.18)',
      color: V('cs-text'),
    },
  },
  { dark: true }
);

// Overrides for `minimal`: grow to the FULL content height — no inner scroll.
// The surrounding page/chat is the only scroll surface; lines wrap so there's
// no horizontal scroll either.
const csMinimalTheme = EditorView.theme({
  '&': { height: 'auto', fontSize: '13px', backgroundColor: V('cs-darkest') },
  '.cm-scroller': { overflowX: 'hidden', fontSize: '13px' },
  '.cm-content': { padding: '10px 12px' },
  '.cm-line': { padding: '0' },
});

const csHighlight = syntaxHighlighting(
  HighlightStyle.define([
    { tag: [t.comment, t.lineComment, t.blockComment], color: V('cs-text-muted'), fontStyle: 'italic' },
    { tag: [t.keyword, t.controlKeyword, t.operatorKeyword, t.modifier, t.self, t.null], color: V('cs-violet') },
    { tag: [t.function(t.variableName), t.function(t.propertyName), t.labelName], color: V('cs-blue') },
    { tag: [t.string, t.special(t.string), t.regexp], color: V('cs-green') },
    { tag: [t.number, t.bool, t.atom], color: V('cs-orange') },
    { tag: [t.className, t.typeName, t.namespace, t.tagName], color: V('cs-cyan') },
    { tag: [t.propertyName, t.attributeName], color: V('cs-mint') },
    { tag: [t.operator, t.punctuation, t.separator, t.bracket, t.paren, t.brace], color: V('cs-text-dim') },
    { tag: [t.variableName, t.definition(t.variableName)], color: V('cs-text') },
    { tag: [t.meta, t.documentMeta], color: V('cs-text-muted') },
    { tag: t.invalid, color: V('cs-red') },
    { tag: [t.heading, t.strong], color: V('cs-text'), fontWeight: 'bold' },
    { tag: t.link, color: V('cs-cyan'), textDecoration: 'underline' },
  ])
);

function CodeEditor({ value, onChange, language = 'python', readOnly = false, onSubmit, minimal = false }) {
  // Keep the latest onSubmit without rebuilding the editor extensions each render.
  const submitRef = useRef(onSubmit);
  submitRef.current = onSubmit;

  const extensions = useMemo(() => {
    const lang = {
      javascript: javascript, js: javascript, typescript: javascript,
      html: html, css: css,
    }[language.toLowerCase()] || python;
    return [
      lang(),
      csEditorTheme,
      ...(minimal ? [csMinimalTheme, EditorView.lineWrapping] : []),
      csHighlight,
      // Ctrl/Cmd+Enter runs the code. Highest precedence so it wins over the
      // default newline binding.
      Prec.highest(
        keymap.of([
          {
            key: 'Mod-Enter',
            preventDefault: true,
            run: () => {
              if (submitRef.current) {
                submitRef.current();
                return true;
              }
              return false;
            },
          },
        ])
      ),
    ];
  }, [language, minimal]);

  // `minimal` = a read-only, chrome-free view for rendering code inside prose
  // (chat replies, AI reviews). Same theme-following syntax colors, no gutters.
  const basicSetup = minimal
    ? {
        lineNumbers: false,
        highlightActiveLine: false,
        highlightActiveLineGutter: false,
        foldGutter: false,
        autocompletion: false,
        tabSize: 2,
      }
    : {
        lineNumbers: true,
        highlightActiveLine: true,
        highlightActiveLineGutter: true,
        foldGutter: true,
        autocompletion: true,
        tabSize: 2,
      };

  return (
    <CodeMirror
      value={value}
      onChange={(val) => onChange && onChange(val)}
      extensions={extensions}
      readOnly={readOnly}
      editable={!readOnly}
      theme="none"
      style={minimal ? { fontSize: '13px' } : { height: '100%' }}
      basicSetup={basicSetup}
    />
  );
}

export default CodeEditor;
