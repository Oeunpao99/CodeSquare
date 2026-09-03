import * as vscode from 'vscode';

const SECRET_KEY = 'codesquare.token';

export class AuthManager {
    private static instance: AuthManager;
    private token: string | null = null;
    private secretStorage: vscode.SecretStorage;

    private constructor(secretStorage: vscode.SecretStorage) {
        this.secretStorage = secretStorage;
    }

    static async create(secretStorage: vscode.SecretStorage): Promise<AuthManager> {
        if (!AuthManager.instance) {
            AuthManager.instance = new AuthManager(secretStorage);
            AuthManager.instance.token = (await secretStorage.get(SECRET_KEY)) || null;
        }
        return AuthManager.instance;
    }

    getToken(): string | null {
        return this.token;
    }

    isLoggedIn(): boolean {
        return this.token !== null;
    }

    async setToken(token: string): Promise<void> {
        this.token = token;
        await this.secretStorage.store(SECRET_KEY, token);
    }

    async clearToken(): Promise<void> {
        this.token = null;
        await this.secretStorage.delete(SECRET_KEY);
    }
}

export async function promptLogin(apiClient: { login: (e: string, p: string) => Promise<{ access_token: string }> }): Promise<string | null> {
    const email = await vscode.window.showInputBox({
        prompt: 'CodeSphere Email',
        placeHolder: 'you@example.com',
        ignoreFocusOut: true,
    });
    if (!email) return null;

    const password = await vscode.window.showInputBox({
        prompt: 'CodeSphere Password',
        password: true,
        ignoreFocusOut: true,
    });
    if (!password) return null;

    const result = await apiClient.login(email, password);
    return result.access_token;
}
