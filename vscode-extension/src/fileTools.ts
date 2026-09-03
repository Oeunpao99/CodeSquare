import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";

export interface ToolCall {
  tool: string;
  path?: string;
  paths?: string[];
  content?: string;
  old_text?: string;
  new_text?: string;
}

const MAX_READ_CHARS = 16_000;
const MAX_TREE_CHARS = 12_000;

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
  const exclude =
    "{**/node_modules/**,**/.git/**,**/dist/**,**/build/**,**/out/**," +
    "**/.venv/**,**/venv/**,**/__pycache__/**,**/.next/**,**/.nuxt/**," +
    "**/coverage/**,**/.turbo/**,**/*.lock,**/*.min.*,**/*.map," +
    "**/.DS_Store,**/*.png,**/*.jpg,**/*.jpeg,**/*.gif,**/*.pdf,**/*.zip}";
  const uris = await vscode.workspace.findFiles("**/*", exclude, 600);
  const rels = uris
    .map((u) => vscode.workspace.asRelativePath(u, false))
    .sort((a, b) => a.localeCompare(b));
  let tree = rels.join("\n");
  if (tree.length > MAX_TREE_CHARS) {
    tree = tree.slice(0, MAX_TREE_CHARS) + "\n… (list truncated)";
  }
  return tree;
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
  return { ok: true, updated, tmp };
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

/** Create a new file. The card's Accept is the confirmation; the only prompt
 *  left is the genuine "this would overwrite an existing file" warning. */
export async function createFile(tool: ToolCall): Promise<boolean> {
  const resolved = resolveInWorkspace(tool.path || "");
  if ("error" in resolved) {
    vscode.window.showErrorMessage(`Can't create ${tool.path}: ${resolved.error}`);
    return false;
  }
  const target = resolved;

  let exists = false;
  try {
    await vscode.workspace.fs.stat(target);
    exists = true;
  } catch {
    /* doesn't exist — fine */
  }
  if (exists) {
    const overwrite = await vscode.window.showWarningMessage(
      `${tool.path} already exists — overwrite it?`,
      { modal: true },
      "Overwrite",
    );
    if (overwrite !== "Overwrite") return false;
  }

  await vscode.workspace.fs.createDirectory(
    vscode.Uri.file(path.dirname(target.fsPath)),
  );
  await vscode.workspace.fs.writeFile(
    target,
    new TextEncoder().encode(tool.content || ""),
  );
  const doc = await vscode.workspace.openTextDocument(target);
  await vscode.window.showTextDocument(doc);
  return true;
}
