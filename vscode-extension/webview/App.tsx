import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { reducer, initialState } from "./chatReducer";
import { findSlash, SLASH } from "./commands";
import type { ExtMessage, Mode } from "./types";
import { getState, postMessage, setState } from "./vscode";
import { Composer, type ComposerHandle } from "./components/Composer";
import { Header } from "./components/Header";
import { Login } from "./components/Login";
import { Transcript } from "./components/Transcript";

const persisted = getState();
const startMode: Mode = persisted.mode === "plan" ? "plan" : "build";

export function App() {
  const [state, dispatch] = useReducer(reducer, startMode, initialState);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [allowCommands, setAllowCommandsState] = useState(persisted.allowCommands === true);
  const composerRef = useRef<ComposerHandle>(null);

  const setAllowCommands = useCallback((on: boolean) => {
    setAllowCommandsState(on);
    setState({ ...getState(), allowCommands: on });
    postMessage({ type: "setAllowCommands", on });
  }, []);

  // Tell the host once on mount so a persisted "on" survives a reload.
  useEffect(() => {
    if (allowCommands) postMessage({ type: "setAllowCommands", on: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- messages from the extension host ---- */
  useEffect(() => {
    const onMsg = (event: MessageEvent) => {
      const msg = event.data as ExtMessage;
      const accounts = "accounts" in msg && Array.isArray(msg.accounts) ? msg.accounts : [];
      const activeEmail = "activeEmail" in msg ? (msg.activeEmail ?? null) : null;

      switch (msg.type) {
        case "init":
          dispatch({ t: "init", loggedIn: msg.loggedIn, accounts, activeEmail });
          break;
        case "loginSuccess":
          dispatch({ t: "loginSuccess", email: msg.user?.email, accounts, activeEmail });
          break;
        case "accountSwitched":
          dispatch({
            t: "accountSwitched",
            who: msg.user?.email || activeEmail || "another account",
            signedOut: msg.signedOut,
            accounts,
            activeEmail,
          });
          break;
        case "accounts":
          dispatch({ t: "accounts", accounts, activeEmail });
          break;
        case "loggedOut":
          dispatch({ t: "loggedOut" });
          break;
        case "loginRequired":
          dispatch({ t: "loginRequired" });
          break;
        case "clearChat":
          dispatch({ t: "clearChat" });
          break;
        case "streamStart":
          dispatch({ t: "streamStart" });
          break;
        case "streamToken":
          dispatch({ t: "streamToken", token: msg.token });
          break;
        case "streamDone":
          dispatch({
            t: "streamDone",
            response: msg.response,
            toolCall: msg.toolCall,
            changeId: msg.changeId,
            applied: msg.applied,
            tasks: msg.tasks,
            changeFiles: msg.changeFiles,
            suggestions: msg.suggestions,
          });
          composerRef.current?.focus();
          break;
        case "streamError":
          dispatch({ t: "streamError", message: msg.error || "", status: msg.status });
          break;
        case "sysMessage":
          dispatch({ t: "sys", md: msg.content || "" });
          break;
        case "toolResult":
          dispatch({
            t: "toolResult",
            success: !!msg.success,
            message: msg.message || "",
            changeId: msg.changeId,
          });
          break;
        case "buildStart":
          dispatch({ t: "buildStart", listId: msg.listId });
          break;
        case "buildProgress":
          dispatch({
            t: "buildProgress",
            listId: msg.listId,
            index: msg.index,
            state: msg.state,
          });
          break;
        case "buildDone":
          dispatch({
            t: "buildDone",
            listId: msg.listId,
            runId: msg.runId,
            count: msg.count,
            stopped: msg.stopped,
            failedAt: msg.failedAt,
            total: msg.total,
            verified: msg.verified,
            files: msg.files,
          });
          break;
        case "fileUndone":
          if (msg.ok) dispatch({ t: "fileUndone", path: msg.path });
          else dispatch({ t: "sys", md: msg.message });
          break;
        case "fileKept":
          dispatch({ t: "fileKept", path: msg.path });
          break;
        case "terminalBlocked":
          dispatch({ t: "terminalBlocked", command: msg.command });
          break;
      }
    };
    window.addEventListener("message", onMsg);
    // Tell the host we're mounted and ready to receive the initial state — it
    // waits for this so `init` is never posted before the listener exists.
    postMessage({ type: "ready" });
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const setMode = useCallback((m: Mode) => {
    dispatch({ t: "setMode", mode: m, announce: true });
    setState({ mode: m });
  }, []);

  /* ---- Alt+P / Alt+B mode switch from anywhere ---- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      const k = e.key.toLowerCase();
      if (k === "p") {
        e.preventDefault();
        setMode("plan");
      } else if (k === "b") {
        e.preventDefault();
        setMode("build");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setMode]);

  const send = useCallback(
    (text: string) => {
      const msg = text.trim();
      if (!msg || state.loading) return;
      dispatch({ t: "submit", text: msg, mode: state.mode });
      postMessage({ type: "sendMessage", text: msg, mode: state.mode });
    },
    [state.loading, state.mode],
  );

  const runSlash = useCallback(
    (raw: string) => {
      const cmd = raw.slice(1).trim().split(/\s+/)[0].toLowerCase();
      const def = findSlash(cmd);
      if (!def) {
        dispatch({ t: "sys", md: `Unknown command \`/${cmd}\`. Type \`/help\` for the list.` });
        return;
      }
      switch (def.name) {
        case "plan":
          setMode("plan");
          break;
        case "build":
          setMode("build");
          break;
        case "new":
          postMessage({ type: "newChat" });
          break;
        case "usage":
          postMessage({ type: "usage" });
          break;
        case "account":
          setTimeout(() => setAccountMenuOpen(true), 0);
          break;
        case "help":
          dispatch({
            t: "sys",
            md: "Commands:\n" + SLASH.map((c) => `- \`/${c.name}\` — ${c.desc}`).join("\n"),
          });
          break;
      }
    },
    [setMode],
  );

  // Always-visible progress while a plan is auto-building, even if the
  // checklist card has scrolled out of view.
  let buildStatus: string | undefined;
  if (state.build?.running) {
    const list = state.items.find(
      (it) => it.kind === "tasklist" && it.id === state.build!.listId,
    );
    const total = list && list.kind === "tasklist" ? list.tasks.length : 0;
    buildStatus = `building task ${Math.min(state.build.doing + 1, total || 1)} of ${total || "?"}…`;
  }

  if (state.view === "login") return <Login />;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Header
        accounts={state.accounts}
        activeEmail={state.activeEmail}
        mode={state.mode}
        loading={state.loading}
        onMode={setMode}
        menuOpen={accountMenuOpen}
        setMenuOpen={setAccountMenuOpen}
        allowCommands={allowCommands}
        onToggleCommands={() => setAllowCommands(!allowCommands)}
        buildStatus={buildStatus}
      />
      <Transcript
        state={state}
        onSend={send}
        onToolPrimary={(id) => {
          const it = state.items.find((x) => x.id === id);
          if (!it || it.kind !== "toolcard") return;
          if (it.ui === "review") {
            dispatch({ t: "toolBusy", id });
            postMessage({ type: "acceptTool", tool: it.tool, changeId: it.changeId });
          } else {
            dispatch({ t: "toolResult", changeId: it.changeId, success: true, message: "Kept." });
            if (it.changeId) postMessage({ type: "keepTool", changeId: it.changeId });
          }
        }}
        onToolSecondary={(id) => {
          const it = state.items.find((x) => x.id === id);
          if (!it || it.kind !== "toolcard") return;
          if (it.ui === "review") {
            dispatch({ t: "dropItem", id });
            postMessage({ type: "rejectTool" });
          } else {
            dispatch({ t: "toolBusy", id });
            if (it.changeId) postMessage({ type: "undoTool", changeId: it.changeId });
            else
              dispatch({
                t: "toolResult",
                success: false,
                message: "Can't undo this one — start a new chat for a clean slate.",
              });
          }
        }}
        onBuildPlan={() => {
          dispatch({ t: "setMode", mode: "build" });
          send("Please implement the plan you just proposed, file by file.");
        }}
        onOpenAccountMenu={() => setAccountMenuOpen(true)}
        onTaskToggle={(id, index) => {
          const it = state.items.find((x) => x.id === id);
          if (it && it.kind === "tasklist") {
            dispatch({ t: "setTaskDone", id, index, done: !it.done[index] });
          }
        }}
        onTaskRun={(id, index) => {
          const it = state.items.find((x) => x.id === id);
          if (!it || it.kind !== "tasklist") return;
          dispatch({ t: "setTaskDone", id, index, done: true });
          send(
            `Implement task ${index + 1} of the plan: ${it.tasks[index]}. ` +
              `Make exactly one file change for this task, then stop.`,
          );
        }}
        onBuildAll={(id) => {
          const it = state.items.find((x) => x.id === id);
          if (!it || it.kind !== "tasklist") return;
          if (it.done.some((d) => !d)) {
            postMessage({ type: "runPlan", listId: id, tasks: it.tasks, done: it.done });
          }
        }}
        onStopBuild={() => postMessage({ type: "stopPlan" })}
        onUndoBuild={(runId) => postMessage({ type: "undoBuild", runId })}
        onUndoFile={(runId, path) => postMessage({ type: "undoFile", runId, path })}
        onKeepBuild={(id, runId) => {
          dispatch({ t: "keepChanges", id });
          postMessage({ type: "keepBuild", runId });
        }}
        onEnableTerminal={(id) => {
          setAllowCommands(true);
          dispatch({ t: "resolveTerminalBlock", id });
        }}
        onFeedback={(id, value, text) => {
          const prev = state.items.find((x) => x.id === id);
          const cleared = prev && prev.kind === "agent" && prev.feedback === value;
          dispatch({ t: "feedback", id, value });
          postMessage({
            type: "feedback",
            value: cleared ? null : value,
            text: text.slice(0, 4000),
          });
        }}
      />
      <Composer
        ref={composerRef}
        mode={state.mode}
        loading={state.loading || state.build?.running === true}
        onSend={send}
        onRunSlash={runSlash}
      />
    </div>
  );
}
