/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./webview/**/*.{ts,tsx,html}"],
  // The panel lives inside VS Code — colours come from the editor theme via CSS
  // variables defined in webview/style.css, so classes stay theme-aware.
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        panel: "var(--panel)",
        fg: "var(--fg)",
        dim: "var(--dim)",
        muted: "var(--muted)",
        line: "var(--line)",
        overlay: "var(--overlay)",
        codebg: "var(--code-bg)",
        primary: "var(--primary)",
        green: "var(--green)",
        mint: "var(--mint)",
        cyan: "var(--cyan)",
        red: "var(--red)",
        orange: "var(--orange)",
      },
      fontFamily: {
        mono: "var(--mono)",
        ui: "var(--ui)",
      },
      fontSize: {
        "2xs": ["10px", "1.4"],
      },
    },
  },
  plugins: [],
};
