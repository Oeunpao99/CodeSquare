import * as vscode from "vscode";
import { AgentPanelProvider } from "./agentPanel";
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
        await auth.setToken(result.access_token);
        panelProvider?.refreshLoginState(result.user);
        vscode.window.showInformationMessage(
          `Logged in to CodeSquareAgent as ${result.user.email}`,
        );
      } catch (err: any) {
        vscode.window.showErrorMessage(`Login failed: ${err.message}`);
      }
    }),
  );

  // Logout command
  context.subscriptions.push(
    vscode.commands.registerCommand("codesquare.logout", async () => {
      await auth.clearToken();
      vscode.window.showInformationMessage("Logged out of CodeSquareAgent");
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
