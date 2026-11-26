import { useEffect, useRef, useState } from "react";
import type { ChatState } from "../chatReducer";
import { postMessage } from "../vscode";
import { ToolCard } from "./ToolCard";
import {
  AgentMessage,
  BuildChip,
  BuildSummary,
  ErrorNotice,
  Suggestions,
  SystemNote,
  TaskList,
  TerminalBlocked,
  UserBubble,
} from "./TranscriptItems";

interface Props {
  state: ChatState;
  onSend: (text: string) => void;
  onToolPrimary: (id: number) => void;
  onToolSecondary: (id: number) => void;
  onBuildPlan: () => void;
  onOpenAccountMenu: () => void;
  onTaskToggle: (id: number, index: number) => void;
  onTaskRun: (id: number, index: number) => void;
  onBuildAll: (id: number) => void;
  onStopBuild: () => void;
  onUndoBuild: (runId: string) => void;
  onUndoFile: (runId: string | undefined, path: string) => void;
  onKeepBuild: (id: number, runId?: string) => void;
  onFeedback: (id: number, value: "up" | "down", text: string) => void;
  onEnableTerminal: (id: number) => void;
}

export function Transcript({
  state,
  onSend,
  onToolPrimary,
  onToolSecondary,
  onBuildPlan,
  onOpenAccountMenu,
  onTaskToggle,
  onTaskRun,
  onBuildAll,
  onStopBuild,
  onUndoBuild,
  onUndoFile,
  onKeepBuild,
  onFeedback,
  onEnableTerminal,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  // Follow new output only while the user is already near the bottom — if they
  // scroll up to read while the answer streams, leave them there.
  const stick = useRef(true);
  const prevLen = useRef(0);
  const [pinned, setPinned] = useState(false); // user scrolled away during a stream

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
    stick.current = gap < 60;
    setPinned(!stick.current && state.loading);
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const grew = state.items.length > prevLen.current;
    const last = state.items[state.items.length - 1];
    prevLen.current = state.items.length;
    // A freshly sent user message always snaps to the bottom.
    if (grew && last?.kind === "user") {
      stick.current = true;
      setPinned(false);
    }
    if (stick.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [state.items]);

  useEffect(() => {
    if (!state.loading) setPinned(false);
  }, [state.loading]);

  const jumpToLatest = () => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
    stick.current = true;
    setPinned(false);
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={ref}
        onScroll={onScroll}
        className="flex flex-1 flex-col gap-4 overflow-y-auto p-4"
      >
        {state.items.map((it) => {
          switch (it.kind) {
            case "user":
              return <UserBubble key={it.id} text={it.text} at={it.at} />;
            case "agent":
              return (
                <AgentMessage
                  key={it.id}
                  raw={it.raw}
                  streaming={it.streaming}
                  at={it.at}
                  feedback={it.feedback}
                  onFeedback={(value) => onFeedback(it.id, value, it.raw)}
                />
              );
            case "sys":
              return <SystemNote key={it.id} md={it.md} />;
            case "error":
              return (
                <ErrorNotice
                  key={it.id}
                  message={it.message}
                  status={it.status}
                  accountsCount={state.accounts.length}
                  lastSentText={state.lastSentText}
                  onRetry={() => onSend(state.lastSentText)}
                  onViewUsage={() => postMessage({ type: "usage" })}
                  onSwitchAccount={onOpenAccountMenu}
                  onAddAccount={() => postMessage({ type: "addAccount" })}
                />
              );
            case "toolcard":
              return (
                <ToolCard
                  key={it.id}
                  tool={it.tool}
                  ui={it.ui}
                  state={it.state}
                  result={it.result}
                  changeFiles={it.changeFiles}
                  onPrimary={() => onToolPrimary(it.id)}
                  onSecondary={() => onToolSecondary(it.id)}
                />
              );
            case "suggestions":
              return <Suggestions key={it.id} list={it.list} onPick={onSend} />;
            case "buildchip":
              return <BuildChip key={it.id} onBuild={onBuildPlan} />;
            case "terminalblocked":
              return (
                <TerminalBlocked
                  key={it.id}
                  command={it.command}
                  resolved={it.resolved}
                  onEnable={() => onEnableTerminal(it.id)}
                />
              );
            case "tasklist": {
              const running = state.build?.running === true && state.build.listId === it.id;
              return (
                <TaskList
                  key={it.id}
                  tasks={it.tasks}
                  done={it.done}
                  loading={state.loading}
                  running={running}
                  doing={running ? state.build!.doing : 0}
                  onToggle={(index) => onTaskToggle(it.id, index)}
                  onRun={(index) => onTaskRun(it.id, index)}
                  onBuildAll={() => onBuildAll(it.id)}
                  onStop={onStopBuild}
                />
              );
            }
            case "buildsummary":
              return (
                <BuildSummary
                  key={it.id}
                  runId={it.runId}
                  stopped={it.stopped}
                  failedAt={it.failedAt}
                  total={it.total}
                  files={it.files}
                  undone={it.undone}
                  keptFiles={it.keptFiles}
                  kept={it.kept}
                  verified={it.verified}
                  onUndoFile={(path) => onUndoFile(it.runId, path)}
                  onUndoAll={() => it.runId && onUndoBuild(it.runId)}
                  onKeepAll={() => onKeepBuild(it.id, it.runId)}
                />
              );
            default:
              return null;
          }
        })}
      </div>

      {pinned && (
        <button
          type="button"
          onClick={jumpToLatest}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-line bg-codebg/95 px-3 py-1 font-mono text-[11px] text-dim shadow-lg hover:text-fg"
        >
          <span className="mr-1 inline-block animate-bounce">↓</span>
          generating — jump to latest
        </button>
      )}
    </div>
  );
}
