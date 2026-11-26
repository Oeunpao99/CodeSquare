// A small highlight.js build — only the languages that show up in chat answers,
// so the bundle stays lean. Colours live in style.css (.hljs-* rules).
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import json from "highlight.js/lib/languages/json";
import javascript from "highlight.js/lib/languages/javascript";
import markdown from "highlight.js/lib/languages/markdown";
import plaintext from "highlight.js/lib/languages/plaintext";
import python from "highlight.js/lib/languages/python";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";

hljs.registerLanguage("bash", bash);
hljs.registerLanguage("css", css);
hljs.registerLanguage("json", json);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("plaintext", plaintext);
hljs.registerLanguage("python", python);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("yaml", yaml);

hljs.registerAliases(["py"], { languageName: "python" });
hljs.registerAliases(["js", "jsx", "mjs", "cjs", "node"], { languageName: "javascript" });
hljs.registerAliases(["ts", "tsx"], { languageName: "typescript" });
hljs.registerAliases(["sh", "shell", "zsh", "console"], { languageName: "bash" });
hljs.registerAliases(["html", "vue", "svg"], { languageName: "xml" });
hljs.registerAliases(["yml"], { languageName: "yaml" });
hljs.registerAliases(["md"], { languageName: "markdown" });
hljs.registerAliases(["text", "txt", ""], { languageName: "plaintext" });

const AUTO = ["python", "javascript", "typescript", "bash", "json", "xml", "css", "sql", "yaml"];

/** Returns highlighted HTML plus the resolved language label. */
export function highlight(lang: string, code: string): { html: string; label: string } {
  const l = (lang || "").toLowerCase().trim();
  if (l && hljs.getLanguage(l)) {
    try {
      const r = hljs.highlight(code, { language: l, ignoreIllegals: true });
      return { html: r.value, label: l };
    } catch {
      /* fall through */
    }
  }
  try {
    const r = hljs.highlightAuto(code, AUTO);
    return { html: r.value, label: l || r.language || "code" };
  } catch {
    return { html: escapeForPre(code), label: l || "code" };
  }
}

function escapeForPre(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
