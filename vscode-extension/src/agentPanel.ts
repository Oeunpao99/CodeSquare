import * as vscode from "vscode";
import { ApiClient, ChatMessage, UsageResponse } from "./api";
import { AuthManager } from "./auth";
import { ChangeTracker } from "./decorations";
import {
  applyCreate,
  applyEdit,
  applyEditDirect,
  buildWorkspaceTree,
  CreatedEntry,
  discardEdit,
  lineDiff,
  listFiles,
  previewEdit,
  readWorkspaceFile,
  revealCreated,
  runCommand,
  searchCode,
  ToolCall,
  undoCreate,
  undoCreateOne,
} from "./fileTools";

/** Tools the agent may chain automatically inside one turn (results feed back). */
const GATHER_TOOLS = new Set(["read_file", "search_code", "list_files", "run_command"]);

function getNonce(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 32; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

const meter = (pct: number): string => {
  const filled = Math.round(Math.min(100, Math.max(0, pct)) / 10);
  return "█".repeat(filled) + "░".repeat(10 - filled);
};

function usageMarkdown(u: UsageResponse): string {
  const line = (label: string, w: { used: number; limit: number; percent: number }) =>
    `\`${label.padEnd(10)}\` ${meter(w.percent)} **${w.percent}%**  ` +
    `${(w.used || 0).toLocaleString()} / ${(w.limit || 0).toLocaleString()}`;
  return (
    `**Plan:** ${u.plan_label}\n\n` +
    `${line("session", u.session)}\n\n${line("weekly", u.weekly)}\n\n` +
    `Limits are soft — nothing is blocked.`
  );
}

export class AgentPanelProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "codesquare.agentPanel";
  private view?: vscode.WebviewView;
  private history: ChatMessage[] = [];
  private isStreaming = false;
  /** How many explore/run steps the agent may chain before it must answer or edit. */
  private readonly MAX_AUTO_STEPS = 8;
  /** Whether the agent is allowed to run shell commands this session (opt-in). */
  private allowCommands = false;
  /**
   * The one change whose chat card is still live:
   *  - "edit": a diff is on screen, waiting for Accept / Cancel (not yet written)
   *  - "create": files are already on disk, waiting for Keep / Undo
   */
  private pendingChange?:
    | { kind: "edit"; id: string; tool: ToolCall; updated: string; existing: string; tmp?: vscode.Uri }
    | { kind: "create"; id: string; tool: ToolCall; entries: CreatedEntry[] };

  /** An auto-running plan_tasks build — applies each file without a per-step
   *  confirmation. Only set while the run is in progress. */
  private buildRun?: {
    runId: string;
    listId: number;
    tasks: string[];
    index: number;
    entries: CreatedEntry[];
    stop: boolean;
  };
  /** The finished build's changes, kept so "Undo this build" works until the
   *  next message / new chat / next build. */
  private lastBuild?: { runId: string; entries: CreatedEntry[] };

  /** Files the agent just wrote — drives the gutter, Explorer badge, CodeLens. */
  readonly changes = new ChangeTracker();

  dispose(): void {
    this.changes.dispose();
  }

  /** Remember + paint the changed lines for each written file. */
  private decorate(entries: CreatedEntry[]): void {
    for (const e of entries) this.changes.mark(e.uri, e.addedRanges);
  }

  /* ---- Keep / Undo driven from the CodeLens inside the file itself ---- */

  async keepFileByUri(uri: vscode.Uri): Promise<void> {
    const path = this.pathForUri(uri);
    this.changes.clear(uri);
    this.dropEntry(uri);
    if (path) this.view?.webview.postMessage({ type: "fileKept", path });
  }

  async undoFileByUri(uri: vscode.Uri): Promise<void> {
    const entry = this.findEntry(uri);
    const path = entry?.path ?? vscode.workspace.asRelativePath(uri, false);
    this.changes.clear(uri);
    if (!entry) {
      vscode.window.showInformationMessage(`${path} is no longer undoable.`);
      return;
    }
    this.dropEntry(uri);
    const r = await undoCreateOne(entry);
    this.view?.webview.postMessage({
      type: "fileUndone",
      path,
      ok: r !== "failed",
      message: r === "restored" ? `Restored ${path}` : `Removed ${path}`,
    });
  }

  private pathForUri(uri: vscode.Uri): string {
    return this.findEntry(uri)?.path ?? vscode.workspace.asRelativePath(uri, false);
  }

  private findEntry(uri: vscode.Uri): CreatedEntry | undefined {
    const key = uri.toString();
    return (
      this.lastBuild?.entries.find((e) => e.uri.toString() === key) ??
      (this.pendingChange?.kind === "create"
        ? this.pendingChange.entries.find((e) => e.uri.toString() === key)
        : undefined)
    );
  }

  private dropEntry(uri: vscode.Uri): void {
    const key = uri.toString();
    if (this.lastBuild) {
      this.lastBuild.entries = this.lastBuild.entries.filter((e) => e.uri.toString() !== key);
      if (!this.lastBuild.entries.length) this.lastBuild = undefined;
    }
    if (this.pendingChange?.kind === "create") {
      this.pendingChange.entries = this.pendingChange.entries.filter(
        (e) => e.uri.toString() !== key,
      );
      if (!this.pendingChange.entries.length) this.pendingChange = undefined;
    }
  }

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly api: ApiClient,
    private readonly auth: AuthManager,
  ) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (msg) => {
      switch (msg.type) {
        case "ready":
          this.postInit();
          break;
        case "sendMessage":
          await this.handleSendMessage(msg.text, msg.mode === "plan" ? "plan" : "build");
          break;
        case "acceptTool":
          await this.handleAcceptTool(msg.tool, msg.changeId);
          break;
        case "rejectTool":
          await this.clearPendingChange();
          this.view?.webview.postMessage({ type: "toolRejected" });
          break;
        case "keepTool":
          if (this.pendingChange?.id === msg.changeId) this.pendingChange = undefined;
          break;
        case "undoTool":
          await this.handleUndoTool(msg.changeId);
          break;
        case "runPlan":
          await this.handleRunPlan(msg.listId, msg.tasks || [], msg.done || []);
          break;
        case "stopPlan":
          if (this.buildRun) this.buildRun.stop = true;
          break;
        case "setAllowCommands":
          this.allowCommands = !!msg.on;
          break;
        case "feedback":
          // Local only for now — swap for a POST to /api/ai/feedback when the
          // backend grows an endpoint for it.
          console.log("[codesquare] feedback", msg.value, (msg.text || "").slice(0, 120));
          break;
        case "undoBuild":
          await this.handleUndoBuild(msg.runId);
          break;
        case "undoFile":
          await this.handleUndoFile(msg.runId, msg.path);
          break;
        case "keepBuild":
          this.keepBuildChanges(msg.runId);
          break;
        case "newChat":
          await this.clearPendingChange();
          this.buildRun = undefined;
          this.lastBuild = undefined;
          this.changes.clearAll();
          this.history = [];
          this.view?.webview.postMessage({ type: "clearChat" });
          break;
        case "login":
          await this.handleLogin();
          break;
        case "loginSubmit":
          await this.handleLogin(msg.email, msg.password);
          break;
        case "addAccount":
          await this.handleLogin();
          break;
        case "switchAccount":
          await this.handleSwitchAccount(msg.email);
          break;
        case "signOut":
          await this.handleSignOut();
          break;
        case "usage":
          await this.handleUsage();
          break;
      }
    });

    // Also push once now; the webview re-requests via "ready" once it mounts,
    // which is the message that actually lands after a cold start.
    this.postInit();
  }

  private postInit(): void {
    this.view?.webview.postMessage({
      type: "init",
      loggedIn: this.auth.isLoggedIn(),
      accounts: this.auth.listAccounts(),
      activeEmail: this.auth.getActiveEmail(),
    });
  }

  refreshLoginState(user: any): void {
    this.view?.webview.postMessage({
      type: "loginSuccess",
      user,
      accounts: this.auth.listAccounts(),
      activeEmail: this.auth.getActiveEmail(),
    });
  }

  private async handleLogin(email?: string, password?: string) {
    if (!email) {
      email = await vscode.window.showInputBox({
        prompt: "CodeSphere Email",
        placeHolder: "you@example.com",
        ignoreFocusOut: true,
      });
    }
    if (!email) return;

    if (!password) {
      password = await vscode.window.showInputBox({
        prompt: "CodeSphere Password",
        password: true,
        ignoreFocusOut: true,
      });
    }
    if (!password) return;

    try {
      const result = await this.api.login(email, password);
      const accountEmail = result.user?.email || email;
      await this.auth.addAccount(accountEmail, result.access_token);
      this.history = [];
      this.view?.webview.postMessage({
        type: "loginSuccess",
        user: result.user,
        accounts: this.auth.listAccounts(),
        activeEmail: this.auth.getActiveEmail(),
      });
      vscode.window.showInformationMessage(`Signed in as ${accountEmail}`);
    } catch (err: any) {
      vscode.window.showErrorMessage(`Login failed: ${err.message}`);
      this.view?.webview.postMessage({
        type: "sysMessage",
        content: `Couldn't sign in — ${err?.message || "please try again"}.`,
      });
    }
  }

  /** Swap to an already-stored account. Verifies the token still works; if it
   *  has expired, asks the user to sign in to that account again. */
  private async handleSwitchAccount(email: string) {
    if (!email || this.auth.getActiveEmail() === email) return;
    const ok = await this.auth.switchTo(email);
    if (!ok) return;

    const token = this.auth.getToken();
    let user: any;
    try {
      user = await this.api.getMe(token!);
    } catch {
      // Token no longer valid — fall back to a fresh login for this account.
      this.view?.webview.postMessage({
        type: "sysMessage",
        content: `Your session for \`${email}\` expired. Sign in again to use it.`,
      });
      await this.handleLogin(email);
      return;
    }

    this.history = [];
    await this.clearPendingChange();
    this.view?.webview.postMessage({
      type: "accountSwitched",
      user,
      accounts: this.auth.listAccounts(),
      activeEmail: this.auth.getActiveEmail(),
    });
    vscode.window.showInformationMessage(`Switched to ${email}`);
  }

  private async handleSignOut() {
    const gone = this.auth.getActiveEmail();
    await this.auth.signOutActive();
    this.history = [];
    await this.clearPendingChange();
    const next = this.auth.getActiveEmail();
    if (next) {
      let user: any;
      try {
        user = await this.api.getMe(this.auth.getToken()!);
      } catch {
        user = { email: next };
      }
      this.view?.webview.postMessage({
        type: "accountSwitched",
        user,
        accounts: this.auth.listAccounts(),
        activeEmail: next,
        signedOut: gone,
      });
    } else {
      this.view?.webview.postMessage({ type: "loggedOut" });
    }
    vscode.window.showInformationMessage(gone ? `Signed out of ${gone}` : "Signed out");
  }

  private async handleUsage() {
    const token = this.auth.getToken();
    if (!token) {
      this.view?.webview.postMessage({ type: "loginRequired" });
      return;
    }
    try {
      const u = await this.api.getUsage(token);
      this.view?.webview.postMessage({
        type: "sysMessage",
        content: usageMarkdown(u),
      });
    } catch {
      this.view?.webview.postMessage({
        type: "sysMessage",
        content: "Couldn't read usage right now.",
      });
    }
  }

  /** Active-editor + workspace context sent with every turn. */
  private async buildOptions(): Promise<Record<string, unknown>> {
    const options: Record<string, unknown> = {};
    const ws = vscode.workspace.workspaceFolders?.[0];
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.uri.scheme === "file") {
      options.activeFile = ws
        ? vscode.workspace.asRelativePath(editor.document.uri, false)
        : editor.document.fileName;
      options.activeFileContent = editor.document.getText().slice(0, 24_000);
    }
    if (ws) {
      options.workspacePath = ws.uri.fsPath;
      options.workspaceTree = await buildWorkspaceTree();
    }
    return options;
  }

  /** One model turn. Resolves with the final text + any tool call. */
  private runTurn(
    token: string,
    message: string,
    options: Record<string, unknown>,
  ): Promise<{ response: string; toolCall?: ToolCall; suggestions?: string[] }> {
    return new Promise((resolve, reject) => {
      let full = "";
      this.view?.webview.postMessage({ type: "streamStart" });
      // Send a generous but bounded window — the server keeps only its most
      // recent turns, and the request body has a hard cap.
      const priorHistory = this.history.slice(0, -1).slice(-80);
      this.api.chatStream(
        token,
        message,
        priorHistory,
        (t) => {
          full += t;
          this.view?.webview.postMessage({ type: "streamToken", token: t });
        },
        (response, toolCall, suggestions) =>
          resolve({ response: response || full, toolCall, suggestions }),
        (err) => reject(err),
        options,
      );
    });
  }

  private async handleSendMessage(text: string, mode: "plan" | "build" = "build") {
    const token = this.auth.getToken();
    if (!token) {
      vscode.window.showWarningMessage("Please log in first.");
      this.view?.webview.postMessage({ type: "loginRequired" });
      return;
    }
    if (this.isStreaming) return;
    this.isStreaming = true;
    // A stale edit diff is confusing, so drop it — but keep a create's Undo
    // available across follow-up questions (only a new write or an explicit
    // Keep/Undo settles it).
    if (this.pendingChange?.kind === "edit") await this.clearPendingChange();
    // The last build's per-file Undo stays available across follow-up questions —
    // only a new build, an explicit Keep/Undo, or a new chat retires it.

    try {
      this.history.push({ role: "user", content: text });
      const options = await this.buildOptions();
      options.mode = mode;
      // The workspace tree + active file are only useful for deciding what to
      // read — resending them on every read-loop hop just burns tokens for no
      // benefit, since the model already acted on them once.
      const { workspaceTree: _wt, activeFileContent: _afc, ...lightOptions } = options;

      let message = text;
      let editRetries = 0;
      // Agentic explore loop: the model can list files, grep the code, and read
      // files — chaining several — before it answers or edits.
      const HARD_CAP = this.MAX_AUTO_STEPS + 1;
      for (let step = 0; ; step++) {
        const { response, toolCall, suggestions } = await this.runTurn(
          token,
          message,
          step === 0 ? options : lightOptions,
        );
        this.history.push({ role: "assistant", content: response });

        // run_command never runs in Plan mode.
        const gatherable =
          toolCall &&
          GATHER_TOOLS.has(toolCall.tool) &&
          !(mode === "plan" && toolCall.tool === "run_command");

        if (gatherable && step < HARD_CAP) {
          // Close the current bubble; run the tool, feed the result back.
          this.view?.webview.postMessage({ type: "streamDone", response, suggestions: [] });

          if (step >= this.MAX_AUTO_STEPS) {
            message =
              "You've hit the exploration limit for this turn. Answer or make " +
              "the edit now using what you already have — no more list_files / " +
              "search_code / read_file calls.";
            this.history.push({ role: "user", content: message });
            continue;
          }

          message = await this.runGatherTool(toolCall);
          this.history.push({ role: "user", content: message });
          continue;
        }

        // Terminal turn.
        //  - edit_file : open a diff now; the card's Accept applies it, Cancel drops it.
        //  - create_*  : write the files to disk now so the user can open & run
        //                them; the card offers Keep or Undo.
        // Plan mode never writes — the server strips write tool calls for it too,
        // but gate here as well in case that's ever bypassed.
        let cardTool: ToolCall | undefined;
        let changeId: string | undefined;
        let applied = false;
        let tasks: string[] | undefined;
        let changeFiles: { path: string; additions: number; deletions: number }[] | undefined;

        if (toolCall && toolCall.tool === "plan_tasks") {
          tasks = (toolCall.tasks || [])
            .map((t) => String(t || "").trim())
            .filter(Boolean)
            .slice(0, 25);
        } else if (mode === "plan" && toolCall && toolCall.tool !== "read_file") {
          this.view?.webview.postMessage({
            type: "sysMessage",
            content: "Ignored a build action while in Plan mode.",
          });
        } else if (toolCall && toolCall.tool === "edit_file") {
          const preview = await previewEdit(toolCall);
          if (preview.ok) {
            changeId = getNonce();
            this.pendingChange = {
              kind: "edit",
              id: changeId,
              tool: toolCall,
              updated: preview.updated!,
              existing: preview.existing ?? "",
              tmp: preview.tmp,
            };
            cardTool = toolCall;
          } else if (editRetries++ < 2) {
            // Give the model the real file so it can fix old_text or rewrite.
            const cur = await readWorkspaceFile(toolCall.path || "");
            this.view?.webview.postMessage({
              type: "sysMessage",
              content: `\`${toolCall.path}\` edit missed — retrying…`,
            });
            message =
              `edit_file failed — ${preview.error}.\n\n` +
              (cur.ok
                ? `Current \`${toolCall.path}\`:\n\`\`\`\n${cur.content}\n\`\`\`\n\n` +
                  "Fix old_text to an EXACT unique substring, or rewrite the whole file with create_file."
                : "Write the whole file with create_file instead.");
            this.history.push({ role: "user", content: message });
            continue;
          } else {
            this.view?.webview.postMessage({
              type: "sysMessage",
              content: `Couldn't edit \`${toolCall.path}\` — ${preview.error}`,
            });
          }
        } else if (
          toolCall &&
          (toolCall.tool === "create_file" || toolCall.tool === "create_files")
        ) {
          await this.clearPendingChange();
          const r = await applyCreate(toolCall);
          if (r.failed.length) {
            this.view?.webview.postMessage({
              type: "sysMessage",
              content: `Couldn't write ${r.failed
                .map((f) => `\`${f.path}\` (${f.error})`)
                .join(", ")}`,
            });
          }
          if (r.entries.length) {
            changeId = getNonce();
            this.pendingChange = {
              kind: "create",
              id: changeId,
              tool: toolCall,
              entries: r.entries,
            };
            applied = true;
            cardTool = toolCall;
            this.decorate(r.entries);
            await revealCreated(r.entries);
            changeFiles = r.entries.map((e) => ({
              path: e.path,
              additions: e.additions,
              deletions: e.deletions,
            }));
          }
        }

        this.view?.webview.postMessage({
          type: "streamDone",
          response,
          toolCall: cardTool,
          changeId,
          applied,
          tasks,
          changeFiles,
          suggestions,
        });
        break;
      }
    } catch (err: any) {
      this.view?.webview.postMessage({
        type: "streamError",
        error: err?.message || String(err),
        status: typeof err?.status === "number" ? err.status : undefined,
      });
    } finally {
      this.isStreaming = false;
    }
  }

  /** Run an explore / command tool and return the text to feed back to the model. */
  private async runGatherTool(toolCall: ToolCall): Promise<string> {
    if (toolCall.tool === "run_command") {
      const cmd = String(toolCall.command || "").trim();
      if (!cmd) return "run_command needs a command.";
      if (!this.allowCommands) {
        // Surface it as an actionable card, not a note the user has to decode.
        this.view?.webview.postMessage({ type: "terminalBlocked", command: cmd });
        return (
          "Command execution is turned OFF by the user. Do NOT call run_command " +
          `again. Tell the user to run this themselves:\n\n\`${cmd}\`\n\nthen continue.`
        );
      }
      this.view?.webview.postMessage({ type: "sysMessage", content: `$ \`${cmd}\`` });
      const r = await runCommand(cmd, toolCall.cwd);
      const body = [r.stdout, r.stderr].filter(Boolean).join("\n").trim();
      const tail = body.length > 2500 ? body.slice(-2500) : body;
      this.view?.webview.postMessage({
        type: "sysMessage",
        content:
          "```\n$ " +
          cmd +
          "\n" +
          (r.blocked
            ? "blocked by the safety filter"
            : `[exit ${r.exitCode ?? "?"}${r.timedOut ? ", timed out" : ""}]\n${tail || "(no output)"}`) +
          "\n```",
      });
      if (r.blocked) {
        return `\`${cmd}\` was blocked by a safety filter. Use a safer approach or ask the user.`;
      }
      return (
        `$ ${cmd}\n[exit ${r.exitCode ?? "?"}${r.timedOut ? ", timed out after 60s" : ""}]\n` +
        (body ? body.slice(0, 8000) : "(no output)")
      );
    }

    if (toolCall.tool === "list_files") {
      const r = await listFiles(toolCall.glob);
      this.view?.webview.postMessage({
        type: "sysMessage",
        content: r.ok
          ? `Listed ${r.paths.length} file${r.paths.length === 1 ? "" : "s"} matching \`${toolCall.glob || "**/*"}\``
          : `list_files failed — ${r.error}`,
      });
      if (!r.ok) return `list_files failed: ${r.error}`;
      const head = r.paths.slice(0, 300);
      return (
        `Files matching \`${toolCall.glob || "**/*"}\` (${r.paths.length}` +
        `${r.paths.length > head.length ? ", first 300 shown" : ""}):\n` +
        head.join("\n")
      );
    }

    if (toolCall.tool === "search_code") {
      const r = await searchCode(toolCall);
      if (!r.ok) return `search_code failed: ${r.error}`;
      this.view?.webview.postMessage({
        type: "sysMessage",
        content: r.hits.length
          ? `Search \`${toolCall.query}\` — ${r.hits.length} match${r.hits.length === 1 ? "" : "es"}` +
            `${r.truncated ? " (capped)" : ""}`
          : `Search \`${toolCall.query}\` — no matches`,
      });
      if (!r.hits.length) {
        return `No matches for \`${toolCall.query}\`${toolCall.glob ? ` in \`${toolCall.glob}\`` : ""} (${r.filesScanned} files scanned).`;
      }
      const lines = r.hits.map((h) => `${h.path}:${h.line}: ${h.text}`);
      return (
        `Matches for \`${toolCall.query}\`${r.truncated ? " (capped — narrow with a glob if you need more)" : ""}:\n` +
        lines.join("\n")
      );
    }

    // read_file
    const wanted = (
      Array.isArray(toolCall.paths) ? toolCall.paths : [toolCall.path]
    )
      .filter((p): p is string => !!p)
      .slice(0, 6);

    const blocks: string[] = [];
    const readErr: string[] = [];
    for (const rel of wanted) {
      const r = await readWorkspaceFile(rel);
      if (r.ok) {
        blocks.push(`\`${rel}\`:\n\`\`\`\n${r.content}\n\`\`\``);
      } else {
        readErr.push(`\`${rel}\` — ${r.error}`);
        blocks.push(`\`${rel}\`: (could not read — ${r.error})`);
      }
    }
    if (readErr.length) {
      this.view?.webview.postMessage({
        type: "sysMessage",
        content: `Couldn't read ${readErr.join(", ")}`,
      });
    }
    return `Here are the files you asked for:\n\n${blocks.join("\n\n")}`;
  }

  /* -------------------- auto-running a plan_tasks build -------------------- */

  private async handleRunPlan(listId: number, tasks: string[], done: boolean[]) {
    const token = this.auth.getToken();
    if (!token) {
      this.view?.webview.postMessage({ type: "loginRequired" });
      return;
    }
    if (this.isStreaming || this.buildRun) return;
    if (!tasks.length) return;

    await this.clearPendingChange();
    // A fresh build retires the previous one's undo window.
    this.keepBuildChanges();
    this.buildRun = { runId: getNonce(), listId, tasks, index: 0, entries: [], stop: false };
    this.view?.webview.postMessage({ type: "buildStart", listId });

    let failedAt = -1;
    for (let i = 0; i < tasks.length; i++) {
      if (this.buildRun.stop) break;
      if (done[i]) continue; // already ticked — skip, keep indices aligned
      const task = String(tasks[i] || "").trim();
      if (!task) continue;
      this.buildRun.index = i;
      this.view?.webview.postMessage({ type: "buildProgress", listId, index: i, state: "doing" });
      const ok = await this.runOneBuildTask(token, task, i, tasks.length);
      if (!ok) {
        failedAt = i;
        break;
      }
      this.view?.webview.postMessage({ type: "buildProgress", listId, index: i, state: "done" });
    }

    // Every task landed — have the agent prove it works before handing it over.
    let verified: "passed" | "failed" | "skipped" = "skipped";
    if (failedAt < 0 && !this.buildRun.stop && this.allowCommands) {
      verified = await this.runVerifyPhase(token);
      this.view?.webview.postMessage({
        type: "sysMessage",
        content:
          verified === "passed"
            ? "✓ Verified — the check passed."
            : verified === "failed"
            ? "The check is still failing. Review the output above before you keep this."
            : "Couldn't verify automatically — run the project yourself to confirm.",
      });
    }

    const run = this.buildRun;
    this.buildRun = undefined;

    // A file rewritten across tasks → one row. Keep the FIRST entry's undo info
    // (real original state) but the LATEST entry's +/- counts.
    const byPath = new Map<string, CreatedEntry>();
    for (const e of run?.entries ?? []) {
      const first = byPath.get(e.path);
      if (first) {
        first.additions = e.additions;
        first.deletions = e.deletions;
        first.addedRanges = e.addedRanges;
      } else {
        byPath.set(e.path, { ...e });
      }
    }
    const merged = [...byPath.values()];
    if (run && merged.length) this.lastBuild = { runId: run.runId, entries: merged };
    this.view?.webview.postMessage({
      type: "buildDone",
      listId,
      runId: merged.length ? run!.runId : undefined,
      count: merged.length,
      stopped: !!run?.stop,
      failedAt: failedAt >= 0 ? failedAt + 1 : undefined,
      total: tasks.length,
      verified,
      files: merged.map((e) => ({
        path: e.path,
        additions: e.additions,
        deletions: e.deletions,
      })),
    });
  }

  /**
   * After the last task: make the agent prove its own work. It picks a check
   * (install deps, run the tests, import the app), we run it, and on a non-zero
   * exit we hand the failure back so it can fix and re-check — bounded.
   */
  private async runVerifyPhase(token: string): Promise<"passed" | "failed" | "skipped"> {
    const MAX_FIX_ROUNDS = 3;
    const MAX_STEPS = 10;
    let fixes = 0;
    let lastCmd = "";

    this.view?.webview.postMessage({
      type: "sysMessage",
      content: "Verifying the build…",
    });

    let message =
      "Every plan task is done. Now VERIFY it actually works.\n\n" +
      "Emit exactly ONE run_command that proves it — install missing deps first if " +
      "needed, then run the tests, or an import / smoke check (e.g. a pytest run, or " +
      "`python -c` that imports the app, or a FastAPI TestClient request). Prefer a " +
      "real test run. If no test file exists yet, create one first with create_file. " +
      "No prose, just the tool call.";
    this.history.push({ role: "user", content: message });

    this.isStreaming = true;
    try {
      for (let step = 0; step < MAX_STEPS; step++) {
        if (this.buildRun?.stop) return "skipped";

        const options = await this.buildOptions();
        options.mode = "build";
        const { workspaceTree: _wt, activeFileContent: _afc, ...light } = options;

        const { response, toolCall } = await this.runTurn(token, message, light);
        this.history.push({ role: "assistant", content: response });
        this.view?.webview.postMessage({ type: "streamDone", response, suggestions: [] });

        // The check itself.
        if (toolCall?.tool === "run_command") {
          lastCmd = String(toolCall.command || "").trim();
          const r = await runCommand(lastCmd, toolCall.cwd, 120_000);
          const body = [r.stdout, r.stderr].filter(Boolean).join("\n").trim();
          this.view?.webview.postMessage({
            type: "sysMessage",
            content:
              "```\n$ " +
              lastCmd +
              `\n[exit ${r.exitCode ?? "?"}${r.timedOut ? ", timed out" : ""}]\n` +
              (body.length > 2500 ? body.slice(-2500) : body || "(no output)") +
              "\n```",
          });

          if (r.ok) return "passed";
          if (r.blocked) return "skipped";
          if (++fixes > MAX_FIX_ROUNDS) return "failed";

          message =
            `The check failed:\n\n$ ${lastCmd}\n[exit ${r.exitCode ?? "?"}]\n` +
            `${body.slice(0, 6000) || "(no output)"}\n\n` +
            "Fix the cause with ONE write tool call (create_file to rewrite the whole " +
            "file is fine), then I'll re-run the check.";
          this.history.push({ role: "user", content: message });
          continue;
        }

        // A fix — apply it, then go back round and re-run the check.
        if (toolCall && (toolCall.tool === "create_file" || toolCall.tool === "create_files")) {
          const r = await applyCreate(toolCall);
          this.buildRun?.entries.push(...r.entries);
          if (r.entries.length) this.decorate(r.entries);
          message = lastCmd
            ? `Applied. Re-run the check now: \`${lastCmd}\` (one run_command, no prose).`
            : "Applied. Now emit one run_command that verifies the build.";
          this.history.push({ role: "user", content: message });
          continue;
        }
        if (toolCall && toolCall.tool === "edit_file") {
          const r = await applyEditDirect(toolCall);
          if (r.ok && r.entry) {
            this.buildRun?.entries.push(r.entry);
            this.decorate([r.entry]);
          }
          message = r.ok
            ? lastCmd
              ? `Applied. Re-run the check now: \`${lastCmd}\` (one run_command, no prose).`
              : "Applied. Now emit one run_command that verifies the build."
            : `edit_file failed — ${r.error}. Rewrite the whole file with create_file instead.`;
          this.history.push({ role: "user", content: message });
          continue;
        }

        // Reading around to work out what to check is fine too.
        if (toolCall && GATHER_TOOLS.has(toolCall.tool)) {
          message = await this.runGatherTool(toolCall);
          this.history.push({ role: "user", content: message });
          continue;
        }

        // No tool call — it has nothing more to run.
        return lastCmd ? "failed" : "skipped";
      }
      return "failed";
    } catch {
      return "skipped";
    } finally {
      this.isStreaming = false;
    }
  }

  /** One task of an auto build: run the explore loop, then apply the write
   *  directly (no per-file confirmation). Returns false to pause the build. */
  private async runOneBuildTask(
    token: string,
    task: string,
    i: number,
    n: number,
  ): Promise<boolean> {
    this.isStreaming = true;
    try {
      const planList = (this.buildRun?.tasks || [])
        .map((t, k) => `${k + 1}. ${t}${k === i ? "   ← THIS TASK" : k < i ? "   ✓" : ""}`)
        .join("\n");
      let message =
        `Build plan:\n${planList}\n\n` +
        `Do task ${i + 1} of ${n} now: ${task}\n\n` +
        "ONE write tool call, for the file this task names — nothing from other " +
        "tasks. If that file was created earlier in this build, rewrite it whole " +
        "with create_file, not edit_file. read_file anything you need to stay consistent.";
      this.history.push({ role: "user", content: message });

      const options = await this.buildOptions();
      options.mode = "build";
      const { workspaceTree: _wt, activeFileContent: _afc, ...light } = options;

      let writeErrors = 0;
      const MAX_WRITE_RETRIES = 2;

      for (let step = 0; ; step++) {
        const { response, toolCall } = await this.runTurn(
          token,
          message,
          step === 0 ? options : light,
        );
        this.history.push({ role: "assistant", content: response });

        if (toolCall && GATHER_TOOLS.has(toolCall.tool) && step < this.MAX_AUTO_STEPS) {
          this.view?.webview.postMessage({ type: "streamDone", response, suggestions: [] });
          message = await this.runGatherTool(toolCall);
          this.history.push({ role: "user", content: message });
          continue;
        }

        this.view?.webview.postMessage({ type: "streamDone", response, suggestions: [] });

        if (toolCall && (toolCall.tool === "create_file" || toolCall.tool === "create_files")) {
          const r = await applyCreate(toolCall);
          this.buildRun?.entries.push(...r.entries);
          if (r.entries.length) {
            this.decorate(r.entries);
            await revealCreated(r.entries);
          }
          if (r.failed.length && !r.entries.length) {
            if (++writeErrors <= MAX_WRITE_RETRIES) {
              message =
                `That write failed: ${r.failed.map((f) => `${f.path} (${f.error})`).join("; ")}. ` +
                "Try again.";
              this.history.push({ role: "user", content: message });
              continue;
            }
            this.view?.webview.postMessage({
              type: "sysMessage",
              content: `Task ${i + 1} — couldn't write the file after ${MAX_WRITE_RETRIES} tries. Build paused.`,
            });
            return false;
          }
          return true;
        }

        if (toolCall && toolCall.tool === "edit_file") {
          const r = await applyEditDirect(toolCall);
          if (!r.ok) {
            if (++writeErrors <= MAX_WRITE_RETRIES) {
              // Hand back the real file so it can fix old_text or switch to a rewrite.
              const cur = await readWorkspaceFile(toolCall.path || "");
              message =
                `edit_file failed — ${r.error}.\n\n` +
                (cur.ok
                  ? `Current \`${toolCall.path}\`:\n\`\`\`\n${cur.content}\n\`\`\`\n\n` +
                    "Fix old_text to be an EXACT unique substring, or rewrite the whole file with create_file."
                  : "Use create_file to write the whole file instead.");
              this.history.push({ role: "user", content: message });
              continue;
            }
            this.view?.webview.postMessage({
              type: "sysMessage",
              content: `Task ${i + 1} — ${r.error} (after ${MAX_WRITE_RETRIES} tries). Build paused.`,
            });
            return false;
          }
          if (r.entry) {
            this.buildRun?.entries.push(r.entry);
            this.decorate([r.entry]);
          }
          return true;
        }

        // No write emitted. Nudge once, then accept it as "nothing needed".
        if (step < 2) {
          message =
            `Task ${i + 1} isn't done — you haven't written a file. ` +
            "Emit one create_file or edit_file now, or say clearly why no change is needed.";
          this.history.push({ role: "user", content: message });
          continue;
        }
        return true;
      }
    } catch (err: any) {
      this.view?.webview.postMessage({
        type: "streamError",
        error: err?.message || String(err),
        status: typeof err?.status === "number" ? err.status : undefined,
      });
      return false;
    } finally {
      this.isStreaming = false;
    }
  }

  private async handleUndoBuild(runId?: string) {
    const last = this.lastBuild;
    if (!last || (runId && last.runId !== runId) || !last.entries.length) {
      this.view?.webview.postMessage({
        type: "sysMessage",
        content: "Nothing left to undo from that build.",
      });
      return;
    }
    this.lastBuild = undefined;
    for (const e of last.entries) this.changes.clear(e.uri);
    const { removed, restored } = await undoCreate(last.entries);
    const bits: string[] = [];
    if (removed) bits.push(`removed ${removed} file${removed === 1 ? "" : "s"}`);
    if (restored) bits.push(`restored ${restored} file${restored === 1 ? "" : "s"}`);
    this.view?.webview.postMessage({
      type: "sysMessage",
      content: bits.length ? `Build undone — ${bits.join(", ")}.` : "Build undone.",
    });
  }

  /** Roll back a single file from the last build, leaving the rest in place. */
  private async handleUndoFile(runId: string | undefined, filePath: string) {
    const last = this.lastBuild;
    const entry =
      last && (!runId || last.runId === runId)
        ? last.entries.find((e) => e.path === filePath)
        : undefined;
    if (!last || !entry) {
      this.view?.webview.postMessage({
        type: "fileUndone",
        runId,
        path: filePath,
        ok: false,
        message: "That file is no longer undoable.",
      });
      return;
    }
    this.changes.clear(entry.uri);
    const r = await undoCreateOne(entry);
    last.entries = last.entries.filter((e) => e !== entry);
    if (!last.entries.length) this.lastBuild = undefined;
    this.view?.webview.postMessage({
      type: "fileUndone",
      runId,
      path: filePath,
      ok: r !== "failed",
      message:
        r === "restored"
          ? `Restored ${filePath}`
          : r === "removed"
          ? `Removed ${filePath}`
          : `Couldn't undo ${filePath}`,
    });
  }

  /** Stop showing the green "just changed" gutter for this build's files. */
  private keepBuildChanges(runId?: string) {
    const last = this.lastBuild;
    if (!last || (runId && last.runId !== runId)) return;
    for (const e of last.entries) this.changes.clear(e.uri);
    this.lastBuild = undefined;
  }

  /**
   * Let go of the live change:
   *  - edit  : throw away the un-applied diff preview
   *  - create: files are already on disk and the user moved on — settle the card
   *            as "kept" so it stops offering Undo.
   */
  private async clearPendingChange() {
    const p = this.pendingChange;
    if (!p) return;
    this.pendingChange = undefined;
    if (p.kind === "edit") {
      await discardEdit(p.tmp);
    } else {
      for (const e of p.entries) this.changes.clear(e.uri);
      this.view?.webview.postMessage({
        type: "toolResult",
        changeId: p.id,
        success: true,
        message: "Kept.",
      });
    }
  }

  /** Accept applies to edit_file only — create_* is already written. */
  private async handleAcceptTool(tool: ToolCall, changeId?: string) {
    const p = this.pendingChange;
    if (!p || p.kind !== "edit" || (changeId && p.id !== changeId)) {
      this.view?.webview.postMessage({
        type: "toolResult",
        changeId,
        success: false,
        message: "That change is no longer pending.",
      });
      return;
    }
    let success = false;
    let message = "Change cancelled.";
    let stat = "";
    try {
      success = await applyEdit(p.tool, p.updated, p.tmp);
      if (success) {
        const d = lineDiff(p.existing, p.updated);
        stat = ` (+${d.additions} −${d.deletions})`;
        const target = vscode.Uri.joinPath(
          vscode.workspace.workspaceFolders?.[0]?.uri ?? vscode.Uri.file("/"),
          (p.tool.path || "").replace(/^[\\/]+/, ""),
        );
        this.changes.mark(target, d.addedRanges);
      }
      message = success ? `Applied changes to ${tool.path}${stat}.` : "Change cancelled.";
    } catch (err: any) {
      message = `Couldn't apply change to ${tool.path}: ${err?.message || err}`;
    }
    this.pendingChange = undefined;
    this.view?.webview.postMessage({ type: "toolResult", changeId: p.id, success, message });
  }

  /** Undo a create_* that's already on disk: delete new files, restore overwrites. */
  private async handleUndoTool(changeId?: string) {
    const p = this.pendingChange;
    if (!p || p.kind !== "create" || (changeId && p.id !== changeId)) {
      this.view?.webview.postMessage({
        type: "toolResult",
        changeId,
        success: false,
        message: "Nothing left to undo — start a new chat if you need a clean slate.",
      });
      return;
    }
    this.pendingChange = undefined;
    for (const e of p.entries) this.changes.clear(e.uri);
    const { removed, restored } = await undoCreate(p.entries);
    const bits: string[] = [];
    if (removed) bits.push(`removed ${removed} file${removed === 1 ? "" : "s"}`);
    if (restored) bits.push(`restored ${restored} file${restored === 1 ? "" : "s"}`);
    this.view?.webview.postMessage({
      type: "toolResult",
      changeId: p.id,
      success: true,
      message: bits.length ? `Undone — ${bits.join(", ")}.` : "Undone.",
    });
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = getNonce();
    const asset = (name: string) =>
      webview.asWebviewUri(
        vscode.Uri.joinPath(this.extensionUri, "out", "webview", name),
      );
    const logo = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "assets", "logo.png"),
    );
    const cs = webview.cspSource;
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; img-src ${cs} https: data:; font-src ${cs}; style-src ${cs} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <link rel="stylesheet" href="${asset("style.css")}" />
  <title>CodeSquareAgent</title>
</head>
<body>
  <div id="root" data-logo="${logo}" style="display:flex;flex-direction:column;height:100%;"></div>
  <script nonce="${nonce}" src="${asset("main.js")}"></script>
</body>
</html>`;
  }
}
