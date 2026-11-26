import * as vscode from 'vscode';

/** Legacy single-token key — migrated into the multi-account store on load. */
const LEGACY_KEY = 'codesquare.token';
const STORE_KEY = 'codesquare.accounts.v1';

export interface Account {
    email: string;
    token: string;
}

interface Store {
    accounts: Account[];
    activeEmail: string | null;
}

const sameEmail = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Holds one or more signed-in CodeSquare accounts and which one is active.
 * Switching accounts is just swapping `activeEmail` — the tokens are already
 * stored, so a user who hit their AI limit on one account can jump to another
 * without re-entering a password (until that token expires).
 */
export class AuthManager {
    private static instance: AuthManager;
    private accounts: Account[] = [];
    private activeEmail: string | null = null;
    private secretStorage: vscode.SecretStorage;

    private constructor(secretStorage: vscode.SecretStorage) {
        this.secretStorage = secretStorage;
    }

    static async create(secretStorage: vscode.SecretStorage): Promise<AuthManager> {
        if (!AuthManager.instance) {
            AuthManager.instance = new AuthManager(secretStorage);
            await AuthManager.instance.load();
        }
        return AuthManager.instance;
    }

    private async load(): Promise<void> {
        const raw = await this.secretStorage.get(STORE_KEY);
        if (raw) {
            try {
                const parsed = JSON.parse(raw) as Store;
                this.accounts = Array.isArray(parsed.accounts) ? parsed.accounts.filter((a) => a && a.email && a.token) : [];
                this.activeEmail = parsed.activeEmail ?? this.accounts[0]?.email ?? null;
                return;
            } catch {
                /* fall through to legacy migration */
            }
        }
        // Migrate a pre-multi-account token, if any. It has no email attached,
        // so it lands under a placeholder the user can rename by re-adding it.
        const legacy = await this.secretStorage.get(LEGACY_KEY);
        if (legacy) {
            this.accounts = [{ email: 'signed-in account', token: legacy }];
            this.activeEmail = this.accounts[0].email;
            await this.persist();
        }
    }

    private async persist(): Promise<void> {
        const store: Store = { accounts: this.accounts, activeEmail: this.activeEmail };
        await this.secretStorage.store(STORE_KEY, JSON.stringify(store));
    }

    /** Token of the active account, or null when nobody is signed in. */
    getToken(): string | null {
        const a = this.accounts.find((x) => this.activeEmail && sameEmail(x.email, this.activeEmail));
        return a ? a.token : null;
    }

    isLoggedIn(): boolean {
        return this.getToken() !== null;
    }

    getActiveEmail(): string | null {
        return this.activeEmail;
    }

    /** Emails of every signed-in account, active one first. */
    listAccounts(): string[] {
        const active = this.accounts.filter((a) => this.activeEmail && sameEmail(a.email, this.activeEmail));
        const rest = this.accounts.filter((a) => !this.activeEmail || !sameEmail(a.email, this.activeEmail));
        return [...active, ...rest].map((a) => a.email);
    }

    /** Add a freshly-authenticated account (or refresh its token) and make it active. */
    async addAccount(email: string, token: string): Promise<void> {
        const i = this.accounts.findIndex((a) => sameEmail(a.email, email));
        if (i >= 0) {
            this.accounts[i] = { email, token };
        } else {
            this.accounts.push({ email, token });
        }
        this.activeEmail = email;
        await this.persist();
    }

    /** Switch the active account. Returns false if that email isn't stored. */
    async switchTo(email: string): Promise<boolean> {
        const a = this.accounts.find((x) => sameEmail(x.email, email));
        if (!a) return false;
        this.activeEmail = a.email;
        await this.persist();
        return true;
    }

    /** Sign out the active account. Falls back to another stored account if one exists. */
    async signOutActive(): Promise<void> {
        this.accounts = this.accounts.filter((a) => !this.activeEmail || !sameEmail(a.email, this.activeEmail));
        this.activeEmail = this.accounts[0]?.email ?? null;
        await this.persist();
    }

    /** Forget every account. */
    async clearAll(): Promise<void> {
        this.accounts = [];
        this.activeEmail = null;
        await this.persist();
        await this.secretStorage.delete(LEGACY_KEY);
    }

    // ---- back-compat shims (single-account callers) ----

    /** @deprecated use {@link addAccount} with the account email. */
    async setToken(token: string, email = 'signed-in account'): Promise<void> {
        await this.addAccount(email, token);
    }

    /** @deprecated use {@link signOutActive} or {@link clearAll}. */
    async clearToken(): Promise<void> {
        await this.signOutActive();
    }
}
