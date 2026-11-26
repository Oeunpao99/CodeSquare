import * as vscode from "vscode";
import { AgentPanelProvider } from "./agentPanel";
import { AgentCodeLensProvider, AgentFileDecorationProvider } from "./decorations";
import { ApiClient } from "./api";
import { AuthManager } from "./auth";

let api: ApiClient;
let auth: AuthManager;
let panelProvider: AgentPanelProvider;

export async function activate(context: vscode.ExtensionContext) {
  api = new ApiClient();
  auth = await AuthManager.create(context.secrets);

  // Register webview provider
  panelProvider = new AgentPanelProvider(context.extensionUri, api, auth);
  context.subscriptions.push(panelProvider);

  // Explorer badge + in-file "Keep / Undo" lens for whatever the agent just wrote.
  const fileBadges = new AgentFileDecorationProvider(panelProvider.changes);
  const lenses = new AgentCodeLensProvider(panelProvider.changes);

  // Drives the editor title-bar buttons — a CodeLens can get crowded off-screen
  // by other providers on line 1, the toolbar can't.
  const syncContext = () => {
    const uri = vscode.window.activeTextEditor?.document.uri;
    void vscode.commands.executeCommand(
      "setContext",
      "codesquare.fileHasChanges",
      !!uri && panelProvider.changes.has(uri),
    );
  };
  syncContext();

  context.subscriptions.push(
    fileBadges,
    lenses,
    vscode.window.onDidChangeActiveTextEditor(syncContext),
    panelProvider.changes.onChanged(syncContext),
    vscode.window.registerFileDecorationProvider(fileBadges),
    vscode.languages.registerCodeLensProvider({ scheme: "file" }, lenses),
    vscode.commands.registerCommand("codesquare.keepFile", (uri?: vscode.Uri) => {
      const target = uri ?? vscode.window.activeTextEditor?.document.uri;
      if (target) void panelProvider.keepFileByUri(target);
    }),
    vscode.commands.registerCommand("codesquare.undoFile", (uri?: vscode.Uri) => {
      const target = uri ?? vscode.window.activeTextEditor?.document.uri;
      if (target) void panelProvider.undoFileByUri(target);
    }),
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      AgentPanelProvider.viewType,
      panelProvider,
      { webviewOptions: { retainContextWhenHidden: true } },
    ),
  );

  // Login command
  context.subscriptions.push(
    vscode.commands.registerCommand("codesquare.login", async () => {
      const email = await vscode.window.showInputBox({
        prompt: "CodeSphere Email",
        placeHolder: "you@example.com",
        ignoreFocusOut: true,
      });
      if (!email) return;

      const password = await vscode.window.showInputBox({
        prompt: "CodeSphere Password",
        password: true,
        ignoreFocusOut: true,
      });
      if (!password) return;

      try {
        const result = await api.login(email, password);
        const accountEmail = result.user?.email || email;
        await auth.addAccount(accountEmail, result.access_token);
        panelProvider?.refreshLoginState(result.user);
        vscode.window.showInformationMessage(
          `Signed in to CodeSquareAgent as ${accountEmail}`,
        );
      } catch (err: any) {
        vscode.window.showErrorMessage(`Login failed: ${err.message}`);
      }
    }),
  );

  // Switch-account command — pick from stored accounts or add a new one.
  context.subscriptions.push(
    vscode.commands.registerCommand("codesquare.switchAccount", async () => {
      const accounts = auth.listAccounts();
      const active = auth.getActiveEmail();
      const ADD = "$(add) Add another account…";
      const pick = await vscode.window.showQuickPick(
        [...accounts.map((e) => (e === active ? `$(check) ${e}` : `      ${e}`)), ADD],
        { placeHolder: "Switch CodeSquare account" },
      );
      if (!pick) return;
      if (pick === ADD) {
        await vscode.commands.executeCommand("codesquare.login");
        return;
      }
      const email = pick.replace(/^\$\(check\)\s*/, "").trim();
      if (email === active) return;
      if (await auth.switchTo(email)) {
        try {
          const user = await api.getMe(auth.getToken()!);
          panelProvider?.refreshLoginState(user);
        } catch {
          panelProvider?.refreshLoginState({ email });
        }
        vscode.window.showInformationMessage(`Switched to ${email}`);
      }
    }),
  );

  // Logout command
  context.subscriptions.push(
    vscode.commands.registerCommand("codesquare.logout", async () => {
      await auth.signOutActive();
      const next = auth.getActiveEmail();
      vscode.window.showInformationMessage(
        next ? `Signed out — now on ${next}` : "Logged out of CodeSquareAgent",
      );
      if (next) {
        try {
          panelProvider?.refreshLoginState(await api.getMe(auth.getToken()!));
        } catch {
          panelProvider?.refreshLoginState({ email: next });
        }
      }
    }),
  );

  // New chat command
  context.subscriptions.push(
    vscode.commands.registerCommand("codesquare.newChat", () => {
      // The webview handles this internally
      vscode.commands.executeCommand("codesquare.agentPanel.focus");
    }),
  );

  // Open panel command
  context.subscriptions.push(
    vscode.commands.registerCommand("codesquare.openPanel", () => {
      vscode.commands.executeCommand("codesquare.agentPanel.focus");
    }),
  );
}

export function deactivate() {}
