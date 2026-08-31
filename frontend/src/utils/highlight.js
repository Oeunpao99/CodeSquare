// Tiny dependency-free syntax highlighter for the static HTML code blocks that
// ship inside Library articles / lesson concepts (rendered server-side, so they
// have no token spans). Tokenizes plain text into escaped, span-wrapped HTML —
// the `.tok-*` colors are defined in styles/index.css and follow the active theme.

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const COMMENT = /(#[^\n]*)/;
const STRING =
  /('''[\s\S]*?'''|"""[\s\S]*?"""|'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`)/;
const NUMBER = /\b(?:0x[\da-fA-F]+|\d+\.?\d*(?:[eE][+-]?\d+)?)\b/;

const WORDS = (kw, builtin) => {
  const pieces = [];
  if (kw && kw.length) pieces.push(`(${kw})`);
  if (builtin && builtin.length) pieces.push(`(${builtin})`);
  return new RegExp(`\\b(?:${pieces.join('|')})\\b`);
};

const PY_KEYWORDS =
  'def|return|if|elif|else|for|while|in|not|and|or|import|from|as|class|None|True|False|pass|break|continue|lambda|try|except|raise|with|global|nonlocal|yield|assert|del|is|match|case';
const PY_BUILTIN =
  'print|len|range|type|str|int|float|bool|list|dict|set|tuple|enumerate|zip|map|filter|sorted|sum|min|max|open|input|isinstance|super|hex|chr|ord|repr|round|abs|all|any|bin|divmod|format|frozenset|id|iter|next|object|pow|reversed|slice|vars|self|strip|split|join|append|extend|keys|values|items|lower|upper|title';

const JS_KEYWORDS =
  'const|let|var|function|return|if|else|for|while|of|in|new|class|extends|this|null|undefined|true|false|async|await|import|from|export|default|try|catch|finally|throw|typeof|instanceof|do|switch|case|break|continue|delete|void|yield|get|set|static|super';
const JS_BUILTIN =
  'console|Math|JSON|document|window|Date|Promise|globalThis|Number|String|Array|Object|Boolean|Symbol';

const DEFAULT_KEYWORDS =
  'def|if|else|for|while|return|class|and|or|not|import|from|as|function|var|let|const|new|this|try|catch';

// Keyword lookahead must not swallow identifiers: `formatting` stays a variable,
// only `format` on its own is a builtin. The \b boundaries handle that.
const KEYWORD = WORDS(PY_KEYWORDS, PY_BUILTIN);

function patternsFor(lang) {
  const l = (lang || '').toLowerCase();
  if (/py|python/.test(l)) {
    return { comment: COMMENT, string: STRING, keyword: WORDS(PY_KEYWORDS, PY_BUILTIN), number: NUMBER };
  }
  if (/js|javascript|react|tsx?/.test(l)) {
    return { comment: /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)/, string: STRING, keyword: WORDS(JS_KEYWORDS, JS_BUILTIN), number: NUMBER };
  }
  if (/html|xml/.test(l)) {
    return { comment: /(<!--[\s\S]*?-->)/, string: /("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')/, tag: /(<\/?[a-zA-Z][\w-]*|\/?\s*>)/, keyword: WORDS(DEFAULT_KEYWORDS, '') };
  }
  if (/sh|bash|shell|zsh/.test(l)) {
    return { comment: COMMENT, string: /("(?:\\.|[^"\\\n])*"|'(?:[^'\\\n])*')/, var: /(\$\{?[\w]+\}?)/, keyword: WORDS('if|then|else|fi|for|while|do|done|function|case|in|esac|export|echo|cd|mkdir|rm|touch|grep|sed|awk|curl|sudo', '') };
  }
  return { comment: COMMENT, string: STRING, keyword: WORDS(DEFAULT_KEYWORDS, ''), number: NUMBER };
}

export function highlightCode(code, lang) {
  const rules = Object.entries(patternsFor(lang)).map(([type, re]) => ({ type, re }));
  const master = new RegExp(rules.map((r) => `(${r.re.source})`).join('|'), 'g');
  const out = [];
  let last = 0;
  let m;
  while ((m = master.exec(code || '')) !== null) {
    if (m.index > last) out.push(escapeHtml(code.slice(last, m.index)));
    const g = m.slice(1);
    const hit = g.findIndex((x) => x !== undefined);
    const type = rules[hit] ? rules[hit].type : 'plain';
    out.push(`<span class="tok-${type}">${escapeHtml(m[0])}</span>`);
    last = m.index + m[0].length;
  }
  out.push(escapeHtml((code || '').slice(last)));
  return out.join('');
}

// Apply `highlightCode` to every `<pre><code>` inside an element. Inline `code`
// leafs keep their pill styling — only real blocks get tokenized.
export function highlightAllCode(root, lang) {
  if (!root) return;
  root.querySelectorAll('pre code').forEach((el) => {
    const plain = el.textContent || '';
    if (plain && !/tok-/.test(plain)) {
      el.innerHTML = highlightCode(plain, lang);
    }
  });
}