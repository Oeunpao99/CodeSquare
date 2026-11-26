// Bundles the React webview into out/webview/ and builds its Tailwind CSS.
// The extension host (src/) is still compiled by tsc — this only touches webview/.
import * as esbuild from "esbuild";
import { execSync, spawn } from "node:child_process";

const watch = process.argv.includes("--watch");
const prod = process.argv.includes("--prod");
const tw = process.platform === "win32" ? "npx.cmd" : "npx";

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: ["webview/main.tsx"],
  outfile: "out/webview/main.js",
  bundle: true,
  format: "iife",
  target: "es2020",
  jsx: "automatic",
  sourcemap: !prod,
  minify: prod,
  logLevel: "info",
  define: { "process.env.NODE_ENV": JSON.stringify(prod ? "production" : "development") },
};

const cssArgs = [
  "tailwindcss",
  "-i", "webview/style.css",
  "-o", "out/webview/style.css",
  ...(prod ? ["--minify"] : []),
];

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  spawn(tw, [...cssArgs, "--watch"], { stdio: "inherit" });
  console.log("[webview] watching for changes…");
} else {
  execSync([tw, ...cssArgs].join(" "), { stdio: "inherit" });
  await esbuild.build(options);
  console.log("[webview] build complete");
}
