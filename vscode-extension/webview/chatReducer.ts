import type { ChangedFile, Mode, ToolCall } from "./types";

let seq = 0;
const nextId = () => ++seq;

const GREETING =
  "Hi — I'm CodeSquareAgent. Ask a question, paste an error, or share broken code and I'll help you fix it. I can write full examples too.";

export type Item =
  | { id: number; kind: "user"; text: string; at: number }
  | {
      id: number;
      kind: "agent";
      raw: string;
      streaming: boolean;
      at: number;
      feedback?: "up" | "down";
    }
  | { id: number; kind: "sys"; md: string }
  | { id: number; kind: "error"; message: string; status?: number }
  | {
      id: number;
      kind: "toolcard";
      tool: ToolCall;
      changeId?: string;
      /** "review" = not yet applied (Accept/Cancel); "undo" = already on disk (Keep/Undo) */
      ui: "review" | "undo";
      state: "idle" | "busy" | "ok" | "err";
      result?: string;
      changeFiles?: ChangedFile[];
    }
  | { id: number; kind: "suggestions"; list: string[] }
  | { id: number; kind: "buildchip" }
  | { id: number; kind: "terminalblocked"; command: string; resolved: boolean }
  | { id: number; kind: "tasklist"; tasks: string[]; done: boolean[] }
  | {
      id: number;
      kind: "buildsummary";
      runId?: string;
      count: number;
      stopped: boolean;
      failedAt?: number;
      total: number;
      files: ChangedFile[];
      verified?: "passed" | "failed" | "skipped";
      /** paths already rolled back from this run */
      undone: string[];
      /** paths individually kept (from the in-file lens) */
      keptFiles: string[];
      kept: boolean;
    };

export interface ChatState {
  view: "login" | "chat";
  accounts: string[];
  activeEmail: string | null;
  mode: Mode;
  loading: boolean;
  lastSentMode: Mode;
  lastSentText: string;
  items: Item[];
  streamingId: number | null;
  /** an auto-running plan build, or null */
  build: { listId: number; running: boolean; doing: number } | null;
}

export function initialState(mode: Mode): ChatState {
  return {
    view: "login",
    accounts: [],
    activeEmail: null,
    mode,
    loading: false,
    lastSentMode: mode,
    lastSentText: "",
    items: [],
    streamingId: null,
    build: null,
  };
}

const greetingItem = (): Item => ({
  id: nextId(),
  kind: "agent",
  raw: GREETING,
  streaming: false,
  at: Date.now(),
});
const sysItem = (md: string): Item => ({ id: nextId(), kind: "sys", md });

export type Action =
  | { t: "init"; loggedIn: boolean; accounts: string[]; activeEmail: string | null }
  | { t: "loginSuccess"; email?: string; accounts: string[]; activeEmail: string | null }
  | {
      t: "accountSwitched";
      who: string;
      signedOut?: string;
      accounts: string[];
      activeEmail: string | null;
    }
  | { t: "accounts"; accounts: string[]; activeEmail: string | null }
  | { t: "loggedOut" }
  | { t: "loginRequired" }
  | { t: "clearChat" }
  | { t: "sys"; md: string }
  | { t: "setMode"; mode: Mode; announce?: boolean }
  | { t: "submit"; text: string; mode: Mode }
  | { t: "streamStart" }
  | { t: "streamToken"; token: string }
  | {
      t: "streamDone";
      response?: string;
      toolCall?: ToolCall;
      changeId?: string;
      applied?: boolean;
      tasks?: string[];
      changeFiles?: ChangedFile[];
      suggestions?: string[];
    }
  | { t: "streamError"; message: string; status?: number }
  | { t: "toolResult"; success: boolean; message: string; changeId?: string }
  | { t: "toolBusy"; id: number }
  | { t: "dropItem"; id: number }
  | { t: "setTaskDone"; id: number; index: number; done: boolean }
  | { t: "buildStart"; listId: number }
  | { t: "buildProgress"; listId: number; index: number; state: "doing" | "done" }
  | {
      t: "buildDone";
      listId: number;
      runId?: string;
      count: number;
      stopped: boolean;
      failedAt?: number;
      total: number;
      verified?: "passed" | "failed" | "skipped";
      files?: ChangedFile[];
    }
  | { t: "fileUndone"; path: string }
  | { t: "fileKept"; path: string }
  | { t: "keepChanges"; id: number }
  | { t: "feedback"; id: number; value: "up" | "down" }
  | { t: "terminalBlocked"; command: string }
  | { t: "resolveTerminalBlock"; id: number };

const MODE_NOTE: Record<Mode, string> = {
  plan: "**Plan mode** — I'll investigate and propose a numbered plan. No files are created or edited.",
  build: "**Build mode** — I can create and edit files (with a diff to review first).",
};

export function reducer(state: ChatState, a: Action): ChatState {
  switch (a.t) {
    case "init":
      return {
        ...state,
        accounts: a.accounts,
        activeEmail: a.activeEmail,
        view: a.loggedIn ? "chat" : "login",
        items: a.loggedIn && state.items.length === 0 ? [greetingItem()] : state.items,
      };

    case "loginSuccess":
      return {
        ...state,
        accounts: a.accounts,
        activeEmail: a.activeEmail,
        view: "chat",
        loading: false,
        streamingId: null,
        items: [
          greetingItem(),
          ...(a.email ? [sysItem(`Signed in as **${a.email}**`)] : []),
        ],
      };

    case "accountSwitched":
      return {
        ...state,
        accounts: a.accounts,
        activeEmail: a.activeEmail,
        view: "chat",
        loading: false,
        streamingId: null,
        items: [
          greetingItem(),
          sysItem(
            a.signedOut
              ? `Signed out of **${a.signedOut}** — now on **${a.who}**.`
              : `Switched to **${a.who}**. Fresh chat, and this account has its own AI limit.`,
          ),
        ],
      };

    case "accounts":
      return { ...state, accounts: a.accounts, activeEmail: a.activeEmail };

    case "loggedOut":
      return {
        ...state,
        view: "login",
        accounts: [],
        activeEmail: null,
        loading: false,
        streamingId: null,
        items: [],
      };

    case "loginRequired":
      return { ...state, loading: false, items: [...state.items, sysItem("Please log in first.")] };

    case "clearChat":
      return {
        ...state,
        loading: false,
        streamingId: null,
        items: [greetingItem(), sysItem("New chat started")],
      };

    case "sys":
      return { ...state, loading: false, items: [...state.items, sysItem(a.md)] };

    case "setMode": {
      if (a.mode === state.mode) return state;
      return {
        ...state,
        mode: a.mode,
        items: a.announce ? [...state.items, sysItem(MODE_NOTE[a.mode])] : state.items,
      };
    }

    case "submit":
      return {
        ...state,
        loading: true,
        lastSentMode: a.mode,
        lastSentText: a.text,
        items: [...state.items, { id: nextId(), kind: "user", text: a.text, at: Date.now() }],
      };

    case "streamStart": {
      const id = nextId();
      return {
        ...state,
        loading: true,
        streamingId: id,
        items: [...state.items, { id, kind: "agent", raw: "", streaming: true, at: Date.now() }],
      };
    }

    case "streamToken":
      if (state.streamingId == null) return state;
      return {
        ...state,
        items: state.items.map((it) =>
          it.id === state.streamingId && it.kind === "agent"
            ? { ...it, raw: it.raw + a.token }
            : it,
        ),
      };

    case "streamDone": {
      const items = state.items.map((it) =>
        it.id === state.streamingId && it.kind === "agent"
          ? { ...it, raw: a.response || it.raw, streaming: false }
          : it,
      );
      if (a.toolCall) {
        items.push({
          id: nextId(),
          kind: "toolcard",
          tool: a.toolCall,
          changeId: a.changeId,
          ui: a.applied ? "undo" : "review",
          state: "idle",
          changeFiles: a.changeFiles,
        });
      }
      if (a.tasks && a.tasks.length) {
        items.push({
          id: nextId(),
          kind: "tasklist",
          tasks: a.tasks,
          done: a.tasks.map(() => false),
        });
      }
      if (a.suggestions && a.suggestions.length) {
        items.push({ id: nextId(), kind: "suggestions", list: a.suggestions });
      }
      if (state.lastSentMode === "plan") {
        items.push({ id: nextId(), kind: "buildchip" });
      }
      return { ...state, loading: false, streamingId: null, items };
    }

    case "streamError": {
      const items = state.items.map((it) =>
        it.id === state.streamingId && it.kind === "agent" ? { ...it, streaming: false } : it,
      );
      items.push({ id: nextId(), kind: "error", message: a.message, status: a.status });
      return { ...state, loading: false, streamingId: null, items };
    }

    case "toolResult": {
      // Settle by changeId; fall back to the most recent card still working.
      let done = false;
      const items = [...state.items].reverse().map((it) => {
        if (done || it.kind !== "toolcard") return it;
        const match = a.changeId ? it.changeId === a.changeId : it.state === "busy";
        if (match) {
          done = true;
          return { ...it, state: a.success ? "ok" : "err", result: a.message } as Item;
        }
        return it;
      });
      items.reverse();
      return { ...state, items };
    }

    case "toolBusy":
      return {
        ...state,
        items: state.items.map((it) =>
          it.id === a.id && it.kind === "toolcard" ? { ...it, state: "busy" } : it,
        ),
      };

    case "dropItem":
      return { ...state, items: state.items.filter((it) => it.id !== a.id) };

    case "setTaskDone":
      return {
        ...state,
        items: state.items.map((it) =>
          it.id === a.id && it.kind === "tasklist"
            ? { ...it, done: it.done.map((d, i) => (i === a.index ? a.done : d)) }
            : it,
        ),
      };

    case "buildStart":
      return { ...state, build: { listId: a.listId, running: true, doing: 0 } };

    case "buildProgress":
      return {
        ...state,
        build: state.build
          ? { ...state.build, doing: a.state === "done" ? a.index + 1 : a.index }
          : { listId: a.listId, running: true, doing: a.index },
        items:
          a.state === "done"
            ? state.items.map((it) =>
                it.kind === "tasklist" && it.id === a.listId
                  ? { ...it, done: it.done.map((d, i) => (i === a.index ? true : d)) }
                  : it,
              )
            : state.items,
      };

    case "buildDone":
      return {
        ...state,
        build: null,
        items: [
          ...state.items,
          {
            id: nextId(),
            kind: "buildsummary",
            runId: a.runId,
            count: a.count,
            stopped: a.stopped,
            failedAt: a.failedAt,
            total: a.total,
            verified: a.verified,
            files: a.files || [],
            undone: [],
            keptFiles: [],
            kept: false,
          },
        ],
      };

    case "fileUndone":
      return {
        ...state,
        items: state.items.map((it) =>
          it.kind === "buildsummary" && !it.undone.includes(a.path)
            ? { ...it, undone: [...it.undone, a.path] }
            : it,
        ),
      };

    case "fileKept":
      return {
        ...state,
        items: state.items.map((it) =>
          it.kind === "buildsummary" && !it.keptFiles.includes(a.path)
            ? { ...it, keptFiles: [...it.keptFiles, a.path] }
            : it,
        ),
      };

    case "feedback":
      return {
        ...state,
        items: state.items.map((it) =>
          it.id === a.id && it.kind === "agent"
            ? { ...it, feedback: it.feedback === a.value ? undefined : a.value }
            : it,
        ),
      };

    case "terminalBlocked":
      return {
        ...state,
        items: [
          ...state.items,
          { id: nextId(), kind: "terminalblocked", command: a.command, resolved: false },
        ],
      };

    case "resolveTerminalBlock":
      return {
        ...state,
        items: state.items.map((it) =>
          it.id === a.id && it.kind === "terminalblocked" ? { ...it, resolved: true } : it,
        ),
      };

    case "keepChanges":
      return {
        ...state,
        items: state.items.map((it) =>
          it.id === a.id && it.kind === "buildsummary" ? { ...it, kept: true } : it,
        ),
      };

    default:
      return state;
  }
}
