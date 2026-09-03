import * as vscode from 'vscode';

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

export interface ChatResponse {
    response: string;
    tool_call?: {
        tool: string;
        path: string;
        content?: string;
        old_text?: string;
        new_text?: string;
    };
    suggestions?: string[];
}

export interface UsageResponse {
    plan: string;
    plan_label: string;
    session: { used: number; limit: number; percent: number };
    weekly: { used: number; limit: number; percent: number };
}

export class ApiClient {
    private baseUrl: string;

    constructor() {
        const config = vscode.workspace.getConfiguration('codesquare');
        this.baseUrl = config.get<string>('apiUrl', 'http://localhost:8000');
    }

    getApiUrl(): string {
        return this.baseUrl;
    }

    private async request<T>(
        method: string,
        path: string,
        token: string,
        body?: any
    ): Promise<T> {
        const url = `${this.baseUrl}${path}`;
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        };

        const resp = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
        });

        if (!resp.ok) {
            const text = await resp.text();
            throw new Error(`API error ${resp.status}: ${text}`);
        }

        return (await resp.json()) as T;
    }

    async login(email: string, password: string): Promise<{ access_token: string; user: any }> {
        const url = `${this.baseUrl}/api/auth/vscode-login`;
        const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });

        if (!resp.ok) {
            const text = await resp.text();
            throw new Error(`Login failed: ${text}`);
        }

        return (await resp.json()) as { access_token: string; user: any };
    }

    async getMe(token: string): Promise<any> {
        return this.request<any>('GET', '/api/auth/me', token);
    }

    async getUsage(token: string): Promise<UsageResponse> {
        return this.request<UsageResponse>('GET', '/api/ai/usage', token);
    }

    async chat(
        token: string,
        message: string,
        history: ChatMessage[],
        options: {
            language?: string;
            activeFile?: string;
            activeFileContent?: string;
            workspacePath?: string;
        } = {}
    ): Promise<ChatResponse> {
        return this.request<ChatResponse>('POST', '/api/ai/vscode/chat', token, {
            message,
            history,
            language: options.language,
            active_file: options.activeFile,
            active_file_content: options.activeFileContent,
            workspace_path: options.workspacePath,
        });
    }

    async chatStream(
        token: string,
        message: string,
        history: ChatMessage[],
        onToken: (token: string) => void,
        onDone: (fullText: string, toolCall?: any, suggestions?: string[]) => void,
        onError: (err: Error) => void,
        options: {
            language?: string;
            activeFile?: string;
            activeFileContent?: string;
            workspacePath?: string;
            workspaceTree?: string;
        } = {}
    ): Promise<void> {
        const url = `${this.baseUrl}/api/ai/vscode/chat/stream`;

        let body: any;
        try {
            body = JSON.stringify({
                message,
                history,
                language: options.language,
                active_file: options.activeFile,
                active_file_content: options.activeFileContent,
                workspace_path: options.workspacePath,
                workspace_tree: options.workspaceTree,
            });
        } catch (e) {
            onError(new Error('Failed to serialize request'));
            return;
        }

        try {
            const resp = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body,
            });

            if (!resp.ok) {
                const text = await resp.text();
                onError(new Error(`Stream error ${resp.status}: ${text}`));
                return;
            }

            const reader = resp.body?.getReader();
            if (!reader) {
                onError(new Error('No response body'));
                return;
            }

            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed.startsWith('data: ')) continue;

                    try {
                        const data = JSON.parse(trimmed.slice(6));

                        if (data.kind === 'token') {
                            onToken(data.token);
                        } else if (data.kind === 'done') {
                            onDone(data.response || '', data.tool_call, data.suggestions);
                        } else if (data.kind === 'reply') {
                            onDone(data.response || '', undefined, data.suggestions);
                        }
                    } catch {
                        // skip malformed lines
                    }
                }
            }
        } catch (err: any) {
            onError(err);
        }
    }
}
