// Shape of the messages exchanged with the extension host (src/agentPanel.ts).

export type Mode = "plan" | "build";

export interface ToolCall {
  tool: string;
  path?: string;
  paths?: string[];
  content?: string;
  new_text?: string;
  old_text?: string;
  files?: { path: string; content?: string }[];
  query?: string;
  glob?: string;
  regex?: boolean;
}

export interface AccountInfo {
  accounts?: string[];
  activeEmail?: string | null;
}

/** One file the agent wrote, with its line delta. */
export interface ChangedFile {
  path: string;
  additions: number;
  deletions: number;
}

/** Messages FROM the extension host. */
export type ExtMessage =
  | ({ type: "init"; loggedIn: boolean } & AccountInfo)
  | ({ type: "loginSuccess"; user?: { email?: string } } & AccountInfo)
  | ({ type: "accountSwitched"; user?: { email?: string }; signedOut?: string } & AccountInfo)
  | ({ type: "accounts" } & AccountInfo)
  | { type: "loggedOut" }
  | { type: "loginRequired" }
  | { type: "clearChat" }
  | { type: "streamStart" }
  | { type: "streamToken"; token: string }
  | {
      type: "streamDone";
      response?: string;
      toolCall?: ToolCall;
      /** id that ties this card to its pending change on the host */
      changeId?: string;
      /** true when the files are already written (create_*) — card shows Keep/Undo */
      applied?: boolean;
      /** a plan_tasks checklist */
      tasks?: string[];
      /** per-file diff stats for the files this turn wrote */
      changeFiles?: ChangedFile[];
      suggestions?: string[];
    }
  | { type: "streamError"; error?: string; status?: number }
  | { type: "sysMessage"; content?: string }
  | { type: "toolResult"; success?: boolean; message?: string; changeId?: string }
  | { type: "toolRejected" }
  | { type: "buildStart"; listId: number }
  | { type: "buildProgress"; listId: number; index: number; state: "doing" | "done" }
  | {
      type: "buildDone";
      listId: number;
      runId?: string;
      count: number;
      stopped: boolean;
      failedAt?: number;
      total: number;
      verified?: "passed" | "failed" | "skipped";
      files?: ChangedFile[];
    }
  | { type: "fileUndone"; runId?: string; path: string; ok: boolean; message: string }
  | { type: "fileKept"; path: string }
  | { type: "terminalBlocked"; command: string };

/** Messages TO the extension host. */
export type WebMessage =
  | { type: "ready" }
  | { type: "sendMessage"; text: string; mode: Mode }
  | { type: "login" }
  | { type: "loginSubmit"; email: string; password: string }
  | { type: "addAccount" }
  | { type: "switchAccount"; email: string }
  | { type: "signOut" }
  | { type: "usage" }
  | { type: "newChat" }
  | { type: "acceptTool"; tool: ToolCall; changeId?: string }
  | { type: "rejectTool" }
  | { type: "keepTool"; changeId: string }
  | { type: "undoTool"; changeId: string }
  | { type: "runPlan"; listId: number; tasks: string[]; done: boolean[] }
  | { type: "stopPlan" }
  | { type: "undoBuild"; runId: string }
  | { type: "undoFile"; runId?: string; path: string }
  | { type: "keepBuild"; runId?: string }
  | { type: "setAllowCommands"; on: boolean }
  | { type: "feedback"; value: "up" | "down" | null; text: string };

export interface PersistedState {
  mode?: Mode;
  allowCommands?: boolean;
}
