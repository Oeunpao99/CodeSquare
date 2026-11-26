import { useState } from "react";
import { Markdown } from "../lib/markdown";
import { useRevealedText } from "../lib/reveal";
import type { ChangedFile } from "../types";
import { MessageActions, useCopy } from "./MessageActions";

export function UserBubble({ text, at }: { text: string; at: number }) {
  return (
    <div className="group flex flex-col items-end">
      <div className="max-w-[88%] whitespace-pre-wrap break-words rounded-lg border border-line bg-primary/[0.12] px-3.5 py-2 font-mono text-[13px] leading-[1.55] text-primary">
        <span className="select-none font-bold text-mint">❯&nbsp;</span>
        {text}
      </div>
      <MessageActions text={text} at={at} align="right" />
    </div>
  );
}

function Label({
  tone,
  live,
  children,
}: {
  tone: string;
  live?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`mb-1.5 flex items-center gap-1.5 font-mono text-2xs uppercase tracking-[0.18em] ${tone}`}>
      {live ? (
        <span className="relative flex h-[5px] w-[5px]">
          <span className="absolute inline-flex h-full w-full animate-[ping_1.4s_cubic-bezier(0,0,0.2,1)_infinite] rounded-full bg-current opacity-75" />
          <span className="relative inline-flex h-[5px] w-[5px] rounded-full bg-current" />
        </span>
      ) : (
        <span className="h-[5px] w-[5px] rounded-full bg-current" />
      )}
      {children}
    </div>
  );
}

interface AgentMessageProps {
  raw: string;
  streaming: boolean;
  at: number;
  feedback?: "up" | "down";
  onFeedback: (value: "up" | "down") => void;
}

export function AgentMessage({ raw, streaming, at, feedback, onFeedback }: AgentMessageProps) {
  const text = useRevealedText(raw, streaming);
  return (
    <div className="group w-full">
      <Label tone="text-cyan" live={streaming}>
        codesquare_agent
      </Label>
      <div className={streaming ? "cs-streaming" : undefined}>
        <Markdown src={text} />
      </div>
      {!streaming && raw.trim() && (
        <MessageActions text={raw} at={at} feedback={feedback} onFeedback={onFeedback} />
      )}
    </div>
  );
}

export function SystemNote({ md }: { md: string }) {
  return (
    <div className="w-full">
      <Label tone="text-muted">system</Label>
      <div className="rounded-lg border border-line bg-overlay px-3.5 py-2.5">
        <Markdown src={md} />
      </div>
    </div>
  );
}

interface ErrorProps {
  message: string;
  status?: number;
  accountsCount: number;
  lastSentText: string;
  onRetry: () => void;
  onViewUsage: () => void;
  onSwitchAccount: () => void;
  onAddAccount: () => void;
}

export function ErrorNotice(p: ErrorProps) {
  const isRate = p.status === 429;
  const text = (p.message || "").trim() || "Something went wrong.";
  const cut = text.search(/\.\s+/);
  let head = text;
  let sub = "";
  if (cut > 0) {
    head = text.slice(0, cut + 1).trim();
    sub = text.slice(cut + 2).trim();
  }
  if (!isRate && cut < 0) {
    head = "Something went wrong";
    sub = text;
  }

  return (
    <div className="w-full">
      <div
        className={`flex gap-3 rounded-[10px] border p-[13px_15px] ${
          isRate ? "border-orange/30 bg-orange/[0.07]" : "border-red/30 bg-red/[0.07]"
        }`}
      >
        <div
          className={`mt-px flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full font-mono text-[13px] font-bold ${
            isRate ? "bg-orange/[0.16] text-orange" : "bg-red/[0.16] text-red"
          }`}
        >
          {isRate ? "i" : "!"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-ui text-[13px] font-semibold leading-[1.45] text-fg">{head}</div>
          {sub && <div className="mt-0.5 font-ui text-xs leading-normal text-dim">{sub}</div>}
          <div className="mt-[11px] flex flex-wrap gap-2">
            {isRate ? (
              <>
                <button
                  type="button"
                  onClick={p.onViewUsage}
                  className="rounded-md border border-orange/40 bg-orange/[0.12] px-3 py-[5px] font-mono text-[11px] text-orange hover:bg-orange/[0.22]"
                >
                  View usage
                </button>
                <button
                  type="button"
                  onClick={p.accountsCount > 1 ? p.onSwitchAccount : p.onAddAccount}
                  className="rounded-md border border-line bg-overlay px-3 py-[5px] font-mono text-[11px] text-dim hover:text-fg"
                >
                  {p.accountsCount > 1 ? "Switch account" : "Use another account"}
                </button>
              </>
            ) : (
              p.lastSentText && (
                <button
                  type="button"
                  onClick={p.onRetry}
                  className="rounded-md border border-line bg-overlay px-3 py-[5px] font-mono text-[11px] text-dim hover:text-fg"
                >
                  Try again
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Suggestions({ list, onPick }: { list: string[]; onPick: (s: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {list.map((s, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onPick(s)}
          className="rounded-md border border-line bg-overlay px-2.5 py-1 font-mono text-[11px] text-dim hover:border-primary/40 hover:text-primary"
        >
          <span className="select-none text-green">$ </span>
          {s}
        </button>
      ))}
    </div>
  );
}

/** Modern task state icons — filled check, spinner, hollow ring. */
function TaskIcon({ state }: { state: "done" | "active" | "todo" }) {
  if (state === "done") {
    return (
      <svg viewBox="0 0 16 16" className="h-[15px] w-[15px] shrink-0" aria-hidden="true">
        <circle cx="8" cy="8" r="7.25" fill="var(--mint)" />
        <path
          d="M4.6 8.2l2.2 2.2 4.6-4.6"
          fill="none"
          stroke="#08150c"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (state === "active") {
    return (
      <svg
        viewBox="0 0 16 16"
        className="h-[15px] w-[15px] shrink-0 animate-[spin_1.1s_linear_infinite]"
        aria-hidden="true"
      >
        <circle cx="8" cy="8" r="6.5" fill="none" stroke="var(--line)" strokeWidth="2" />
        <path
          d="M8 1.5a6.5 6.5 0 0 1 6.5 6.5"
          fill="none"
          stroke="var(--cyan)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" className="h-[15px] w-[15px] shrink-0" aria-hidden="true">
      <circle
        cx="8"
        cy="8"
        r="6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.5"
      />
    </svg>
  );
}

interface TaskListProps {
  tasks: string[];
  done: boolean[];
  loading: boolean;
  running: boolean;
  doing: number;
  onToggle: (index: number) => void;
  onRun: (index: number) => void;
  onBuildAll: () => void;
  onStop: () => void;
}

export function TaskList({
  tasks,
  done,
  loading,
  running,
  doing,
  onToggle,
  onRun,
  onBuildAll,
  onStop,
}: TaskListProps) {
  const complete = done.filter(Boolean).length;
  const next = done.findIndex((d) => !d);

  return (
    <div className="rounded-lg border border-line bg-codebg p-3">
      <div className="mb-2 flex items-center justify-between text-[13px] font-semibold text-fg">
        <span>Plan</span>
        <span className="font-mono text-2xs text-muted">
          {complete}/{tasks.length} done
        </span>
      </div>
      <ol className="flex flex-col gap-1.5">
        {tasks.map((t, i) => {
          const active = running && i === doing && !done[i];
          return (
            <li key={i} className="flex items-start gap-2 font-mono text-xs">
              <button
                type="button"
                onClick={() => onToggle(i)}
                disabled={running}
                className="mt-[1px] shrink-0 text-muted hover:text-fg disabled:opacity-70"
                aria-label={done[i] ? "mark not done" : "mark done"}
              >
                <TaskIcon state={done[i] ? "done" : active ? "active" : "todo"} />
              </button>
              <span
                className={
                  done[i] ? "text-muted line-through" : active ? "text-cyan" : "text-dim"
                }
              >
                {t}
              </span>
            </li>
          );
        })}
      </ol>

      {running ? (
        <div className="mt-3 flex items-center gap-2">
          <span className="font-mono text-[11px] text-cyan">
            building task {Math.min(doing + 1, tasks.length)} of {tasks.length}…
          </span>
          <button
            type="button"
            onClick={onStop}
            className="rounded-md border border-line px-2.5 py-[3px] font-mono text-[11px] text-dim hover:text-red"
          >
            Stop
          </button>
        </div>
      ) : next >= 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={onBuildAll}
            className="rounded-md border border-primary/40 bg-primary/15 px-3 py-[5px] font-mono text-[11px] text-primary hover:bg-primary/25 disabled:opacity-40"
          >
            {complete === 0 ? "Build all" : "Build the rest"} ({tasks.length - complete}) →
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => onRun(next)}
            className="rounded-md border border-line bg-overlay px-3 py-[5px] font-mono text-[11px] text-dim hover:text-fg disabled:opacity-40"
          >
            Just task {next + 1}
          </button>
        </div>
      ) : (
        <div className="mt-2 font-mono text-[11px] text-mint">All tasks done.</div>
      )}
    </div>
  );
}

/** "+12 −3" in diff colours. */
export function DiffStat({ additions, deletions }: { additions: number; deletions: number }) {
  return (
    <span className="shrink-0 font-mono text-[11px] tabular-nums">
      {additions > 0 && <span className="text-mint">+{additions}</span>}
      {additions > 0 && deletions > 0 && " "}
      {deletions > 0 && <span className="text-red">−{deletions}</span>}
      {additions === 0 && deletions === 0 && <span className="text-muted">no change</span>}
    </span>
  );
}

interface BuildSummaryProps {
  runId?: string;
  stopped: boolean;
  failedAt?: number;
  total: number;
  files: ChangedFile[];
  undone: string[];
  keptFiles: string[];
  kept: boolean;
  verified?: "passed" | "failed" | "skipped";
  onUndoFile: (path: string) => void;
  onUndoAll: () => void;
  onKeepAll: () => void;
}

export function BuildSummary({
  runId,
  stopped,
  failedAt,
  total,
  files,
  undone,
  keptFiles,
  kept,
  verified,
  onUndoFile,
  onUndoAll,
  onKeepAll,
}: BuildSummaryProps) {
  const [open, setOpen] = useState(files.length <= 6);
  const live = files.filter((f) => !undone.includes(f.path));
  const additions = live.reduce((s, f) => s + f.additions, 0);
  const deletions = live.reduce((s, f) => s + f.deletions, 0);
  const actionable = !!runId && !kept && live.length > 0;

  const headline = failedAt
    ? `Paused at task ${failedAt} of ${total}`
    : stopped
    ? "Build stopped"
    : `Build finished — ${total} task${total === 1 ? "" : "s"}`;

  return (
    <div className="w-full">
      <Label tone={failedAt ? "text-orange" : "text-mint"}>build</Label>
      <div className="overflow-hidden rounded-lg border border-line bg-codebg">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-2 border-b border-line bg-white/[0.03] px-3 py-2 text-left"
        >
          <span className="w-2.5 shrink-0 font-mono text-[10px] text-muted">
            {open ? "▾" : "▸"}
          </span>
          <span className="flex-1 truncate font-ui text-[13px] font-semibold text-fg">
            {live.length} file{live.length === 1 ? "" : "s"} changed
          </span>
          {verified === "passed" && (
            <span className="shrink-0 rounded border border-mint/40 bg-mint/10 px-1.5 py-px font-mono text-[10px] text-mint">
              ✓ tests pass
            </span>
          )}
          {verified === "failed" && (
            <span className="shrink-0 rounded border border-red/40 bg-red/10 px-1.5 py-px font-mono text-[10px] text-red">
              ✗ tests fail
            </span>
          )}
          <DiffStat additions={additions} deletions={deletions} />
        </button>

        {open && (
          <div className="flex max-h-64 flex-col overflow-y-auto">
            {files.map((f) => {
              const gone = undone.includes(f.path);
              const settled = keptFiles.includes(f.path);
              return (
                <div
                  key={f.path}
                  className="flex items-center gap-2 border-b border-line/60 px-3 py-1.5 last:border-b-0"
                >
                  <span
                    className={`flex-1 truncate font-mono text-[11px] ${
                      gone ? "text-muted line-through" : settled ? "text-dim" : "text-primary"
                    }`}
                    title={f.path}
                  >
                    {f.path}
                  </span>
                  {gone ? (
                    <span className="font-mono text-[11px] text-muted">undone</span>
                  ) : (
                    <>
                      <DiffStat additions={f.additions} deletions={f.deletions} />
                      {settled ? (
                        <span className="shrink-0 font-mono text-[10px] text-mint">kept</span>
                      ) : (
                        actionable && (
                          <button
                            type="button"
                            onClick={() => onUndoFile(f.path)}
                            className="shrink-0 rounded border border-line px-1.5 py-px font-mono text-[10px] text-muted hover:border-red/50 hover:text-red"
                          >
                            undo
                          </button>
                        )
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-2 px-3 py-2">
          <span className="flex-1 font-mono text-[11px] text-muted">
            {kept
              ? "Kept."
              : live.length === 0
              ? "All changes rolled back."
              : headline}
          </span>
          {actionable && (
            <>
              <button
                type="button"
                onClick={onUndoAll}
                className="rounded-md border border-line px-2.5 py-[3px] font-mono text-[11px] text-dim hover:border-red/50 hover:text-red"
              >
                Undo all
              </button>
              <button
                type="button"
                onClick={onKeepAll}
                className="rounded-md bg-green px-2.5 py-[3px] font-mono text-[11px] font-semibold text-[#06210f]"
              >
                Keep all
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** The agent asked to run something but the terminal is off — offer the switch
 *  right here instead of making the user hunt for the ⚡ in the header. */
export function TerminalBlocked({
  command,
  resolved,
  onEnable,
}: {
  command: string;
  resolved: boolean;
  onEnable: () => void;
}) {
  const [copied, copy] = useCopy();
  return (
    <div className="w-full">
      <Label tone="text-orange">terminal off</Label>
      <div className="rounded-[10px] border border-orange/30 bg-orange/[0.07] p-[13px_15px]">
        <div className="font-ui text-[13px] font-semibold text-fg">
          {resolved ? "Terminal enabled" : "The agent wants to run a command"}
        </div>
        <div className="mt-0.5 font-ui text-xs text-dim">
          {resolved
            ? "Ask it again and it will run this itself."
            : "Shell access is off by default. Turn it on and it can install deps, run your tests, and curl your endpoints on its own."}
        </div>
        <div className="mt-2 flex items-center gap-2 rounded-md border border-line bg-codebg px-2.5 py-1.5">
          <code className="flex-1 overflow-x-auto whitespace-pre font-mono text-[11px] text-primary">
            $ {command}
          </code>
          <button
            type="button"
            onClick={() => copy(command)}
            className="shrink-0 font-mono text-[10px] text-muted hover:text-fg"
          >
            {copied ? "copied" : "copy"}
          </button>
        </div>
        {!resolved && (
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onEnable}
              className="rounded-md border border-orange/40 bg-orange/[0.12] px-3 py-[5px] font-mono text-[11px] text-orange hover:bg-orange/[0.22]"
            >
              ⚡ Enable terminal
            </button>
            <span className="self-center font-mono text-[10px] text-muted">
              or toggle ⚡ in the header any time
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function BuildChip({ onBuild }: { onBuild: () => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button"
        onClick={onBuild}
        className="rounded-md border border-orange/40 bg-overlay px-2.5 py-1 font-mono text-[11px] text-orange hover:bg-orange/10"
      >
        <span className="select-none">▸ </span>Build this plan
      </button>
    </div>
  );
}
