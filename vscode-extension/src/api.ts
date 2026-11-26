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

/** An HTTP error from the backend, with the status code attached and the
 *  message pulled out of `{"detail": "..."}` instead of the raw JSON body. */
export class ApiError extends Error {
    constructor(public status: number, message: string) {
        super(message);
        this.name = 'ApiError';
    }
}

/** Turn a non-OK response body into a clean error message: FastAPI's
 *  `{"detail": "..."}` becomes just the detail text; anything else falls
 *  back to a short, status-coded message instead of dumping raw JSON/HTML. */
async function toApiError(resp: Response, fallback: string): Promise<ApiError> {
    let detail = '';
    try {
        const text = await resp.text();
        try {
            const parsed = JSON.parse(text);
            detail =
                typeof parsed.detail === 'string'
                    ? parsed.detail
                    : Array.isArray(parsed.detail)
                        ? parsed.detail.map((d: any) => d.msg || JSON.stringify(d)).join('; ')
                        : '';
        } catch {
            detail = text.length < 200 ? text : '';
        }
    } catch {
        /* body already consumed or unreadable — use the fallback */
    }
    return new ApiError(resp.status, detail || `${fallback} (${resp.status})`);
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
            throw await toApiError(resp, 'Request failed');
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
            throw await toApiError(resp, 'Login failed');
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
            mode?: 'plan' | 'build';
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
                mode: options.mode || 'build',
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
                onError(await toApiError(resp, 'The agent is unavailable right now'));
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
