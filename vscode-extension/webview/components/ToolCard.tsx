import type { ChangedFile, ToolCall } from "../types";
import { DiffStat } from "./TranscriptItems";

interface Props {
  tool: ToolCall;
  ui: "review" | "undo";
  state: "idle" | "busy" | "ok" | "err";
  result?: string;
  changeFiles?: ChangedFile[];
  onPrimary: () => void; // Accept (review) / Keep (undo)
  onSecondary: () => void; // Cancel (review) / Undo (undo)
}

export function ToolCard({
  tool,
  ui,
  state,
  result,
  changeFiles,
  onPrimary,
  onSecondary,
}: Props) {
  const statFor = (p?: string) => changeFiles?.find((f) => f.path === p);
  const totals = (changeFiles || []).reduce(
    (s, f) => ({ a: s.a + f.additions, d: s.d + f.deletions }),
    { a: 0, d: 0 },
  );
  const isCreateMany = tool.tool === "create_files";
  const files = Array.isArray(tool.files) ? tool.files : [];
  const shown = files.slice(0, 20);
  const label = tool.tool === "create_file" ? "Create File" : "Edit File";
  const content = tool.content || tool.new_text || "";
  const busyLabel = ui === "undo" ? "Undoing…" : "Applying…";

  return (
    <div className="rounded-lg border border-line bg-codebg p-3">
      {isCreateMany ? (
        <>
          <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold">
            <span className="flex-1">
              Create {shown.length}
              {files.length > shown.length ? "+" : ""} File{files.length === 1 ? "" : "s"}
            </span>
            {changeFiles?.length ? <DiffStat additions={totals.a} deletions={totals.d} /> : null}
          </div>
          <div className="mb-2 flex max-h-80 flex-col gap-1.5 overflow-y-auto">
            {shown.map((f, i) => {
              const st = statFor(f.path);
              return (
                <div key={i} className="rounded bg-bg p-2">
                  <div className="mb-[3px] flex items-center gap-2">
                    <span className="flex-1 truncate font-mono text-xs text-primary">
                      {f.path || ""}
                    </span>
                    {st && <DiffStat additions={st.additions} deletions={st.deletions} />}
                  </div>
                  <div className="max-h-[90px] overflow-hidden whitespace-pre font-mono text-[11px] text-dim">
                    {(f.content || "").slice(0, 600)}
                  </div>
                </div>
              );
            })}
            {files.length > shown.length && (
              <div className="px-0.5 py-0.5 font-mono text-[11px] text-muted">
                + {files.length - shown.length} more file(s)
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold">
            <span>{label}</span>
            <span className="font-mono text-xs text-primary">{tool.path || ""}</span>
          </div>
          <div className="mb-2 max-h-[200px] overflow-auto whitespace-pre rounded bg-bg p-2 font-mono text-xs">
            {content.slice(0, 2000)}
          </div>
        </>
      )}

      {ui === "undo" && state === "idle" && (
        <div className="mb-2 font-mono text-[11px] text-muted">
          Written to your project — open and run it, then Keep or Undo.
        </div>
      )}

      <div className="flex min-h-[26px] items-center justify-end gap-2">
        {state === "ok" || state === "err" ? (
          <span className={`font-mono text-xs ${state === "ok" ? "text-green" : "text-red"}`}>
            {state === "ok" ? "✓ " : "✗ "}
            {result || ""}
          </span>
        ) : state === "busy" ? (
          <span className="font-mono text-xs text-dim">{busyLabel}</span>
        ) : ui === "undo" ? (
          <>
            <button
              type="button"
              onClick={onSecondary}
              className="rounded border border-line px-3.5 py-[5px] text-xs text-dim hover:text-fg"
            >
              Undo
            </button>
            <button
              type="button"
              onClick={onPrimary}
              className="rounded bg-green px-3.5 py-[5px] text-xs font-semibold text-[#06210f]"
            >
              Keep
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onSecondary}
              className="rounded border border-line px-3.5 py-[5px] text-xs text-dim hover:text-fg"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onPrimary}
              className="rounded bg-green px-3.5 py-[5px] text-xs font-semibold text-[#06210f]"
            >
              Accept
            </button>
          </>
        )}
      </div>
    </div>
  );
}
