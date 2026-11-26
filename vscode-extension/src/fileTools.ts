import * as cp from "child_process";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";

export interface ToolFile {
  path: string;
  content?: string;
}

export interface ToolCall {
  tool: string;
  path?: string;
  paths?: string[];
  content?: string;
  old_text?: string;
  new_text?: string;
  files?: ToolFile[];
  query?: string;
  glob?: string;
  regex?: boolean;
  tasks?: string[];
  command?: string;
  cwd?: string;
}

const MAX_READ_CHARS = 16_000;
const MAX_TREE_CHARS = 12_000;
const SEARCH_EXCLUDE =
  "{**/node_modules/**,**/.git/**,**/dist/**,**/build/**,**/out/**," +
  "**/.venv/**,**/venv/**,**/__pycache__/**,**/.next/**,**/.nuxt/**," +
  "**/coverage/**,**/.turbo/**,**/*.lock,**/*.min.*,**/*.map," +
  "**/.DS_Store,**/*.png,**/*.jpg,**/*.jpeg,**/*.gif,**/*.pdf,**/*.zip}";

/* ----------------------------- reading ----------------------------- */

function workspaceRoot(): vscode.Uri | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri;
}

/** Resolve a model-supplied relative path, refusing anything outside the workspace. */
function resolveInWorkspace(relPath: string): vscode.Uri | { error: string } {
  const root = workspaceRoot();
  if (!root) return { error: "no folder is open" };
  const clean = String(relPath || "").replace(/^[\\/]+/, "").replace(/\\/g, "/");
  const uri = vscode.Uri.joinPath(root, clean);
  const rootFs = root.fsPath.replace(/[\\/]+$/, "");
  if (uri.fsPath !== rootFs && !uri.fsPath.startsWith(rootFs + path.sep)) {
    return { error: "path is outside the workspace" };
  }
  return uri;
}

export async function readWorkspaceFile(
  relPath: string,
): Promise<{ ok: boolean; content?: string; error?: string }> {
  const resolved = resolveInWorkspace(relPath);
  if ("error" in resolved) return { ok: false, error: resolved.error };
  try {
    const bytes = await vscode.workspace.fs.readFile(resolved);
    if (bytes.includes(0)) return { ok: false, error: "binary file" };
    let text = new TextDecoder().decode(bytes);
    if (text.length > MAX_READ_CHARS) {
      text = text.slice(0, MAX_READ_CHARS) + "\n… (truncated)";
    }
    return { ok: true, content: text };
  } catch {
    return { ok: false, error: "not found" };
  }
}

/** A newline-separated list of workspace files, for the model's context. */
export async function buildWorkspaceTree(): Promise<string> {
  if (!workspaceRoot()) return "";
  const uris = await vscode.workspace.findFiles("**/*", SEARCH_EXCLUDE, 600);
  const rels = uris
    .map((u) => vscode.workspace.asRelativePath(u, false))
    .sort((a, b) => a.localeCompare(b));
  let tree = rels.join("\n");
  if (tree.length > MAX_TREE_CHARS) {
    tree = tree.slice(0, MAX_TREE_CHARS) + "\n… (list truncated)";
  }
  return tree;
}

/** List workspace files matching a glob (e.g. `backend/routers/*.py`). */
export async function listFiles(
  glob?: string,
): Promise<{ ok: boolean; paths: string[]; error?: string }> {
  if (!workspaceRoot()) return { ok: false, paths: [], error: "no folder is open" };
  const pattern = (glob || "**/*").replace(/^[\\/]+/, "").replace(/\\/g, "/");
  try {
    const uris = await vscode.workspace.findFiles(pattern, SEARCH_EXCLUDE, 400);
    const paths = uris
      .map((u) => vscode.workspace.asRelativePath(u, false))
      .sort((a, b) => a.localeCompare(b));
    return { ok: true, paths };
  } catch (err: any) {
    return { ok: false, paths: [], error: err?.message || "bad glob" };
  }
}

export interface SearchHit {
  path: string;
  line: number;
  text: string;
}

export interface SearchResult {
  ok: boolean;
  error?: string;
  hits: SearchHit[];
  filesScanned: number;
  truncated: boolean;
}

/** grep the workspace for a literal string (or regex when `regex` is set),
 *  optionally narrowed by a glob. Bounded so it can't run away on a big repo. */
export async function searchCode(tool: ToolCall): Promise<SearchResult> {
  const empty: SearchResult = { ok: false, hits: [], filesScanned: 0, truncated: false };
  if (!workspaceRoot()) return { ...empty, error: "no folder is open" };
  const query = (tool.query || "").trim();
  if (!query) return { ...empty, error: "search needs a non-empty query" };

  let matcher: RegExp;
  try {
    matcher = tool.regex
      ? new RegExp(query, "i")
      : new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  } catch (err: any) {
    return { ...empty, error: `bad regex: ${err?.message || err}` };
  }

  const glob = (tool.glob || "**/*").replace(/^[\\/]+/, "").replace(/\\/g, "/");
  const MAX_FILES = 700;
  const MAX_HITS = 60;
  const uris = await vscode.workspace.findFiles(glob, SEARCH_EXCLUDE, MAX_FILES);

  const hits: SearchHit[] = [];
  let filesScanned = 0;
  let truncated = uris.length >= MAX_FILES;

  for (const uri of uris) {
    if (hits.length >= MAX_HITS) {
      truncated = true;
      break;
    }
    let text: string;
    try {
      const bytes = await vscode.workspace.fs.readFile(uri);
      if (bytes.byteLength > 512_000 || bytes.includes(0)) continue;
      text = new TextDecoder().decode(bytes);
    } catch {
      continue;
    }
    filesScanned++;
    const rel = vscode.workspace.asRelativePath(uri, false);
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (matcher.test(lines[i])) {
        hits.push({ path: rel, line: i + 1, text: lines[i].trim().slice(0, 240) });
        if (hits.length >= MAX_HITS) {
          truncated = true;
          break;
        }
      }
    }
  }
  return { ok: true, hits, filesScanned, truncated };
}

/* ----------------------------- writing ----------------------------- */
//
// One confirmation only: the Accept / Cancel card in the panel. For edit_file
// we open a native diff the moment the card appears (previewEdit) so the user
// reviews the change there, then Accept applies it with no second modal.

/** Close the diff tab whose right-hand side is our temp file, and delete it. */
async function closePreview(tmp?: vscode.Uri): Promise<void> {
  if (!tmp) return;
  try {
    for (const group of vscode.window.tabGroups.all) {
      for (const tab of group.tabs) {
        const input = tab.input as vscode.TabInputTextDiff | undefined;
        if (
          input &&
          "modified" in input &&
          input.modified?.toString() === tmp.toString()
        ) {
          await vscode.window.tabGroups.close(tab);
        }
      }
    }
  } catch {
    /* best effort */
  }
  await vscode.workspace.fs.delete(tmp).then(undefined, () => {});
}

export interface EditPreview {
  ok: boolean;
  error?: string;
  updated?: string;
  existing?: string;
  tmp?: vscode.Uri;
}

/** Validate an edit_file call and open a side-by-side diff of the result. */
export async function previewEdit(tool: ToolCall): Promise<EditPreview> {
  const resolved = resolveInWorkspace(tool.path || "");
  if ("error" in resolved) return { ok: false, error: resolved.error };
  const target = resolved;

  let existing: string;
  try {
    existing = new TextDecoder().decode(await vscode.workspace.fs.readFile(target));
  } catch {
    return { ok: false, error: `file not found: ${tool.path}` };
  }
  if (!tool.old_text) {
    return { ok: false, error: "edit needs old_text to locate the change" };
  }
  const first = existing.indexOf(tool.old_text);
  if (first === -1) {
    return { ok: false, error: `couldn't find the target text in ${tool.path}` };
  }
  if (existing.indexOf(tool.old_text, first + 1) !== -1) {
    return {
      ok: false,
      error: `the target text appears more than once in ${tool.path} — needs a more specific old_text`,
    };
  }

  const updated = existing.replace(tool.old_text, tool.new_text ?? "");
  const tmp = vscode.Uri.file(
    path.join(os.tmpdir(), `csa-${Date.now()}-${path.basename(tool.path || "file")}`),
  );
  await vscode.workspace.fs.writeFile(tmp, new TextEncoder().encode(updated));
  await vscode.commands.executeCommand(
    "vscode.diff",
    target,
    tmp,
    `${tool.path} ↔ proposed changes`,
    { preview: true },
  );
  return { ok: true, updated, existing, tmp };
}

/** Apply a previewed edit — the card's Accept is the confirmation. */
export async function applyEdit(tool: ToolCall, updated: string, tmp?: vscode.Uri): Promise<boolean> {
  const resolved = resolveInWorkspace(tool.path || "");
  if ("error" in resolved) {
    vscode.window.showErrorMessage(`Can't edit ${tool.path}: ${resolved.error}`);
    await closePreview(tmp);
    return false;
  }
  await closePreview(tmp);

  const doc = await vscode.workspace.openTextDocument(resolved);
  const edit = new vscode.WorkspaceEdit();
  edit.replace(
    doc.uri,
    new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length)),
    updated,
  );
  await vscode.workspace.applyEdit(edit);
  await doc.save();
  await vscode.window.showTextDocument(doc);
  return true;
}

/** Throw away a previewed edit (card Cancel / new message / new chat). */
export async function discardEdit(tmp?: vscode.Uri): Promise<void> {
  await closePreview(tmp);
}

/** Apply an edit_file straight to disk (no diff, no confirmation) — for an
 *  auto-running build. Returns a CreatedEntry so undoCreate can revert it. */
export async function applyEditDirect(
  tool: ToolCall,
): Promise<{ ok: boolean; error?: string; entry?: CreatedEntry }> {
  const resolved = resolveInWorkspace(tool.path || "");
  if ("error" in resolved) return { ok: false, error: resolved.error };
  const target = resolved;

  let existing: string;
  let priorBytes: Uint8Array;
  try {
    priorBytes = await vscode.workspace.fs.readFile(target);
    existing = new TextDecoder().decode(priorBytes);
  } catch {
    return { ok: false, error: `file not found: ${tool.path}` };
  }
  if (!tool.old_text) return { ok: false, error: "edit needs old_text" };
  const first = existing.indexOf(tool.old_text);
  if (first === -1) return { ok: false, error: `target text not found in ${tool.path}` };
  if (existing.indexOf(tool.old_text, first + 1) !== -1) {
    return { ok: false, error: `target text appears more than once in ${tool.path}` };
  }

  const updated = existing.replace(tool.old_text, tool.new_text ?? "");
  try {
    await vscode.workspace.fs.writeFile(target, new TextEncoder().encode(updated));
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
  const d = lineDiff(existing, updated);
  return {
    ok: true,
    entry: {
      path: tool.path || "",
      uri: target,
      existedBefore: true,
      priorContent: priorBytes,
      additions: d.additions,
      deletions: d.deletions,
      addedRanges: d.addedRanges,
    },
  };
}

// create_file / create_files are applied to disk straight away so the user can
// open, read and run the result — the chat card then offers Keep or Undo.

export interface CreatedEntry {
  path: string;
  uri: vscode.Uri;
  existedBefore: boolean;
  /** Bytes to restore on undo (only when the file existed before). */
  priorContent?: Uint8Array;
  additions: number;
  deletions: number;
  /** [startLine, endLineExclusive) ranges in the new file that were added/changed. */
  addedRanges: [number, number][];
}

export interface LineDiff {
  additions: number;
  deletions: number;
  addedRanges: [number, number][];
}

/** Cheap LCS line diff — enough for a "+A −D" summary and gutter decorations. */
export function lineDiff(before: string, after: string): LineDiff {
  const a = before.length ? before.split("\n") : [];
  const b = after.length ? after.split("\n") : [];
  if (a.length > 5000 || b.length > 5000) {
    return { additions: b.length, deletions: a.length, addedRanges: [[0, b.length]] };
  }
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  let i = 0;
  let j = 0;
  let additions = 0;
  let deletions = 0;
  const added: number[] = [];
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      deletions++;
      i++;
    } else {
      additions++;
      added.push(j);
      j++;
    }
  }
  while (i < m) {
    deletions++;
    i++;
  }
  while (j < n) {
    additions++;
    added.push(j);
    j++;
  }
  const addedRanges: [number, number][] = [];
  for (const idx of added) {
    const last = addedRanges[addedRanges.length - 1];
    if (last && last[1] === idx) last[1] = idx + 1;
    else addedRanges.push([idx, idx + 1]);
  }
  return { additions, deletions, addedRanges };
}

export interface ApplyCreateResult {
  entries: CreatedEntry[]; // written OK — carries the undo info
  created: string[]; // brand-new paths
  overwritten: string[]; // paths that already existed
  failed: { path: string; error: string }[];
}

/** Write the proposed file(s) now. No prompts — Undo on the card is the safety
 *  net, and overwritten files keep their previous bytes for restore. */
export async function applyCreate(tool: ToolCall): Promise<ApplyCreateResult> {
  const files: ToolFile[] =
    tool.tool === "create_files"
      ? (tool.files || []).filter((f) => f && f.path)
      : tool.path
      ? [{ path: tool.path, content: tool.content }]
      : [];

  const res: ApplyCreateResult = { entries: [], created: [], overwritten: [], failed: [] };

  for (const f of files) {
    const resolved = resolveInWorkspace(f.path);
    if ("error" in resolved) {
      res.failed.push({ path: f.path, error: resolved.error });
      continue;
    }
    const target = resolved;

    let existedBefore = false;
    let priorContent: Uint8Array | undefined;
    try {
      priorContent = await vscode.workspace.fs.readFile(target);
      existedBefore = true;
    } catch {
      /* brand new */
    }

    try {
      await vscode.workspace.fs.createDirectory(
        vscode.Uri.file(path.dirname(target.fsPath)),
      );
      await vscode.workspace.fs.writeFile(
        target,
        new TextEncoder().encode(f.content || ""),
      );
      const before = existedBefore && priorContent ? new TextDecoder().decode(priorContent) : "";
      const d = lineDiff(before, f.content || "");
      res.entries.push({
        path: f.path,
        uri: target,
        existedBefore,
        priorContent,
        additions: d.additions,
        deletions: d.deletions,
        addedRanges: d.addedRanges,
      });
      (existedBefore ? res.overwritten : res.created).push(f.path);
    } catch (err: any) {
      res.failed.push({ path: f.path, error: err?.message || String(err) });
    }
  }
  return res;
}

/** Revert one change: restore the prior bytes, or delete the new file. */
export async function undoCreateOne(e: CreatedEntry): Promise<"restored" | "removed" | "failed"> {
  try {
    if (e.existedBefore && e.priorContent) {
      await vscode.workspace.fs.writeFile(e.uri, e.priorContent);
      return "restored";
    }
    await vscode.workspace.fs.delete(e.uri, { useTrash: true });
    return "removed";
  } catch {
    return "failed";
  }
}

/** Reverse an applyCreate: delete the new files, restore the overwritten ones. */
export async function undoCreate(
  entries: CreatedEntry[],
): Promise<{ removed: number; restored: number }> {
  let removed = 0;
  let restored = 0;
  for (const e of entries) {
    const r = await undoCreateOne(e);
    if (r === "restored") restored++;
    else if (r === "removed") removed++;
  }
  return { removed, restored };
}

/** Open the freshly-created files so the user can look them over. */
export async function revealCreated(entries: CreatedEntry[]): Promise<void> {
  const first = entries[0];
  if (!first) return;
  try {
    const doc = await vscode.workspace.openTextDocument(first.uri);
    await vscode.window.showTextDocument(doc, { preview: false });
  } catch {
    /* best effort */
  }
}

/* ----------------------------- running commands ----------------------------- */

/** Commands we refuse outright, no matter the trust setting — catastrophic or
 *  clearly hostile. Not a complete sandbox, just a floor. */
const COMMAND_DENYLIST: RegExp[] = [
  /\brm\s+-[rf]{1,2}\b[^\n]*\s(\/|~|\.\.)(\s|$)/i,
  /\bmkfs\b/i,
  /\bdd\s+[^\n]*\bof=\/dev\//i,
  /:\(\)\s*\{\s*:\s*\|\s*:?\s*&\s*\}\s*;/, // fork bomb
  /\bshutdown\b|\breboot\b|\bhalt\b|\bpoweroff\b/i,
  />\s*\/dev\/(sd|nvme|hd)/i,
  /\bchmod\s+-R?\s*777\s+\//i,
  /\bgit\s+push\b[^\n]*--force/i,
  /\bgit\s+reset\s+--hard\b[^\n]*\borigin\//i,
  /\bsudo\b/i,
  /\bcurl\b[^\n|]*\|\s*(sudo\s+)?(ba|z|k)?sh\b/i,
  /\bwget\b[^\n|]*\|\s*(sudo\s+)?(ba|z|k)?sh\b/i,
  /\bnpm\s+publish\b/i,
];

export interface CommandResult {
  ok: boolean;
  blocked: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

/** Run a shell command in the workspace (or a sub-dir), capturing bounded
 *  output. Long-running commands are killed at `timeoutMs`. */
export async function runCommand(
  command: string,
  cwd?: string,
  timeoutMs = 60_000,
): Promise<CommandResult> {
  const base: CommandResult = {
    ok: false,
    blocked: false,
    exitCode: null,
    stdout: "",
    stderr: "",
    timedOut: false,
  };
  const root = workspaceRoot();
  if (!root) return { ...base, stderr: "no folder is open" };

  const cmd = String(command || "").trim();
  if (!cmd) return { ...base, stderr: "empty command" };
  if (cmd.length > 2000) return { ...base, stderr: "command too long" };
  if (COMMAND_DENYLIST.some((re) => re.test(cmd))) {
    return { ...base, blocked: true, stderr: "blocked by the safety filter" };
  }

  let dir = root.fsPath;
  if (cwd) {
    const resolved = resolveInWorkspace(cwd);
    if ("error" in resolved) return { ...base, stderr: `bad cwd: ${resolved.error}` };
    dir = resolved.fsPath;
  }

  const CAP = 12_000;
  return new Promise<CommandResult>((resolve) => {
    let out = "";
    let err = "";
    let timedOut = false;
    let done = false;

    const child = cp.spawn(cmd, {
      cwd: dir,
      shell: true,
      windowsHide: true,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0", PIP_DISABLE_PIP_VERSION_CHECK: "1" },
    });

    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill();
      } catch {
        /* already gone */
      }
    }, timeoutMs);

    child.stdout?.on("data", (d) => {
      if (out.length < CAP) out += d.toString();
    });
    child.stderr?.on("data", (d) => {
      if (err.length < CAP) err += d.toString();
    });

    const finish = (code: number | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({
        ok: !timedOut && code === 0,
        blocked: false,
        exitCode: code,
        stdout: out.slice(0, CAP),
        stderr: err.slice(0, CAP),
        timedOut,
      });
    };

    child.on("close", finish);
    child.on("error", (e) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({ ...base, stderr: (err + "\n" + String(e)).trim(), timedOut });
    });
  });
}
