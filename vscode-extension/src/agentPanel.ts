import * as fs from "fs";
import * as vscode from "vscode";
import { ApiClient, ChatMessage, UsageResponse } from "./api";
import { AuthManager } from "./auth";
import {
  applyEdit,
  buildWorkspaceTree,
  createFile,
  discardEdit,
  previewEdit,
  readWorkspaceFile,
  ToolCall,
} from "./fileTools";

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
  private readonly MAX_AUTO_STEPS = 3;
  /** An edit_file whose diff is on screen, waiting for the card's Accept/Cancel. */
  private pendingEdit?: { tool: ToolCall; updated: string; tmp?: vscode.Uri };

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
        case "sendMessage":
          await this.handleSendMessage(msg.text);
          break;
        case "acceptTool":
          await this.handleAcceptTool(msg.tool);
          break;
        case "rejectTool":
          await this.clearPendingEdit();
          this.view?.webview.postMessage({ type: "toolRejected" });
          break;
        case "newChat":
          await this.clearPendingEdit();
          this.history = [];
          this.view?.webview.postMessage({ type: "clearChat" });
          break;
        case "login":
          await this.handleLogin();
          break;
        case "loginSubmit":
          await this.handleLogin(msg.email, msg.password);
          break;
        case "usage":
          await this.handleUsage();
          break;
      }
    });

    // Send initial state
    webviewView.webview.postMessage({
      type: "init",
      loggedIn: this.auth.isLoggedIn(),
    });
  }

  refreshLoginState(user: any): void {
    this.view?.webview.postMessage({ type: "loginSuccess", user });
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
      await this.auth.setToken(result.access_token);
      this.view?.webview.postMessage({
        type: "loginSuccess",
        user: result.user,
      });
      vscode.window.showInformationMessage("Logged in to CodeSquareAgent");
    } catch (err: any) {
      vscode.window.showErrorMessage(`Login failed: ${err.message}`);
    }
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
      this.api.chatStream(
        token,
        message,
        this.history.slice(0, -1),
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

  private async handleSendMessage(text: string) {
    const token = this.auth.getToken();
    if (!token) {
      vscode.window.showWarningMessage("Please log in first.");
      this.view?.webview.postMessage({ type: "loginRequired" });
      return;
    }
    if (this.isStreaming) return;
    this.isStreaming = true;
    await this.clearPendingEdit();

    try {
      this.history.push({ role: "user", content: text });
      const options = await this.buildOptions();

      let message = text;
      // Agentic read loop: the model can pull in files before it answers/edits.
      for (let step = 0; ; step++) {
        const { response, toolCall, suggestions } = await this.runTurn(
          token,
          message,
          options,
        );
        this.history.push({ role: "assistant", content: response });

        const isRead = toolCall?.tool === "read_file";
        if (isRead && step < this.MAX_AUTO_STEPS) {
          // Close the current bubble, read the files, feed them back.
          this.view?.webview.postMessage({
            type: "streamDone",
            response,
            suggestions: [],
          });

          const wanted = (
            Array.isArray(toolCall?.paths)
              ? toolCall!.paths!
              : [toolCall?.path]
          )
            .filter((p): p is string => !!p)
            .slice(0, 6);

          const blocks: string[] = [];
          for (const rel of wanted) {
            const r = await readWorkspaceFile(rel);
            this.view?.webview.postMessage({
              type: "sysMessage",
              content: r.ok ? `📖 read \`${rel}\`` : `⚠️ \`${rel}\` — ${r.error}`,
            });
            blocks.push(
              r.ok
                ? `\`${rel}\`:\n\`\`\`\n${r.content}\n\`\`\``
                : `\`${rel}\`: (could not read — ${r.error})`,
            );
          }

          message = `Here are the files you asked for:\n\n${blocks.join("\n\n")}`;
          this.history.push({ role: "user", content: message });
          continue;
        }

        // Terminal turn. For edit_file, open the diff now so the panel card is
        // the single confirmation — Accept applies it, Cancel throws it away.
        let cardTool: ToolCall | undefined;
        if (toolCall && toolCall.tool === "edit_file") {
          const preview = await previewEdit(toolCall);
          if (preview.ok) {
            this.pendingEdit = {
              tool: toolCall,
              updated: preview.updated!,
              tmp: preview.tmp,
            };
            cardTool = toolCall;
          } else {
            this.view?.webview.postMessage({
              type: "sysMessage",
              content: `⚠️ Can't edit \`${toolCall.path}\` — ${preview.error}`,
            });
          }
        } else if (toolCall && toolCall.tool === "create_file") {
          cardTool = toolCall;
        }

        this.view?.webview.postMessage({
          type: "streamDone",
          response,
          toolCall: cardTool,
          suggestions,
        });
        break;
      }
    } catch (err: any) {
      this.view?.webview.postMessage({
        type: "streamError",
        error: err?.message || String(err),
      });
    } finally {
      this.isStreaming = false;
    }
  }

  /** Drop a not-yet-accepted edit preview (Cancel, new message, new chat). */
  private async clearPendingEdit() {
    if (!this.pendingEdit) return;
    const { tmp } = this.pendingEdit;
    this.pendingEdit = undefined;
    await discardEdit(tmp);
  }

  private async handleAcceptTool(tool: ToolCall) {
    let success = false;
    try {
      if (tool.tool === "edit_file" && this.pendingEdit) {
        success = await applyEdit(
          this.pendingEdit.tool,
          this.pendingEdit.updated,
          this.pendingEdit.tmp,
        );
        this.pendingEdit = undefined;
      } else if (tool.tool === "create_file") {
        success = await createFile(tool);
      }
    } catch (err: any) {
      vscode.window.showErrorMessage(
        `Couldn't apply change to ${tool.path}: ${err?.message || err}`,
      );
    }
    this.view?.webview.postMessage({
      type: "toolResult",
      success,
      message: success
        ? `Applied changes to ${tool.path}.`
        : "Change cancelled.",
    });
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = getNonce();
    const file = vscode.Uri.joinPath(this.extensionUri, "webview", "index.html");
    let html = fs.readFileSync(file.fsPath, "utf8");
    return html
      .replace(/__CSP_SOURCE__/g, webview.cspSource)
      .replace(/__NONCE__/g, nonce);
  }
}
