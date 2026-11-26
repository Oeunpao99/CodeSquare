import { useRef } from "react";
import type { Mode } from "../types";
import { LOGO_URI, postMessage } from "../vscode";
import { AccountMenu } from "./AccountMenu";

interface Props {
  accounts: string[];
  activeEmail: string | null;
  mode: Mode;
  loading: boolean;
  onMode: (m: Mode) => void;
  menuOpen: boolean;
  setMenuOpen: (v: boolean) => void;
  allowCommands: boolean;
  onToggleCommands: () => void;
  /** live "building task 2 of 6" text while a plan is auto-running */
  buildStatus?: string;
}

export function Header({
  accounts,
  activeEmail,
  mode,
  loading,
  onMode,
  menuOpen,
  setMenuOpen,
  allowCommands,
  onToggleCommands,
  buildStatus,
}: Props) {
  const avatarRef = useRef<HTMLDivElement>(null);
  const multi = accounts.length > 1;

  return (
    <header className="relative flex items-center gap-2.5 border-b border-primary/20 bg-white/[0.03] px-3.5 py-2.5">
      <div
        ref={avatarRef}
        role="button"
        tabIndex={0}
        title={activeEmail ? `Account: ${activeEmail}` : "Account"}
        onClick={() => setMenuOpen(!menuOpen)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setMenuOpen(!menuOpen);
          }
        }}
        className="relative flex h-[30px] w-[30px] shrink-0 cursor-pointer items-center justify-center rounded-md hover:brightness-110"
      >
        {LOGO_URI ? (
          <img src={LOGO_URI} alt="CodeSquare" className="h-[30px] w-[30px] object-contain" />
        ) : (
          <span
            className="flex h-[30px] w-[30px] items-center justify-center rounded-md font-mono text-[15px] font-bold text-[#0b0e14]"
            style={{ background: "linear-gradient(135deg, var(--primary), var(--cyan))" }}
          >
            &#10095;
          </span>
        )}
        <span className="absolute -bottom-[3px] -right-[3px] flex h-3 w-3 items-center justify-center rounded-full bg-bg">
          <span
            className="h-0 w-0 border-x-[3px] border-x-transparent border-t-[4px]"
            style={{ borderTopColor: multi ? "var(--mint)" : "var(--dim)" }}
          />
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate font-mono text-[13px] font-semibold text-fg">
          <span className="text-mint">&#10095;&nbsp;</span>codesquare_agent --live
        </div>
        <div
          className={`mt-px flex items-center gap-1.5 font-mono text-[11px] ${
            loading || buildStatus ? "text-cyan" : mode === "plan" ? "text-orange" : "text-green"
          }`}
        >
          {loading || buildStatus ? (
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-[ping_1.4s_cubic-bezier(0,0,0.2,1)_infinite] rounded-full bg-cyan opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan" />
            </span>
          ) : (
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                mode === "plan"
                  ? "bg-orange"
                  : "animate-[pulse_1.8s_ease-in-out_infinite] bg-green"
              }`}
            />
          )}
          {buildStatus
            ? buildStatus
            : loading
            ? "generating response…"
            : mode === "plan"
            ? "planning — no files touched"
            : "ready for input"}
        </div>
      </div>

      <div className="flex shrink-0 overflow-hidden rounded-md border border-line" role="group" aria-label="Agent mode">
        <button
          type="button"
          title="Plan mode — investigate & propose only (Alt+P)"
          onClick={() => onMode("plan")}
          className={`font-mono text-[11px] px-2.5 py-[5px] ${
            mode === "plan" ? "bg-orange/[0.18] text-orange" : "bg-overlay text-dim hover:text-fg"
          }`}
        >
          Plan
        </button>
        <button
          type="button"
          title="Build mode — reads & writes files (Alt+B)"
          onClick={() => onMode("build")}
          className={`border-l border-line font-mono text-[11px] px-2.5 py-[5px] ${
            mode === "build" ? "bg-primary/[0.18] text-primary" : "bg-overlay text-dim hover:text-fg"
          }`}
        >
          Build
        </button>
      </div>

      <button
        type="button"
        onClick={onToggleCommands}
        title={
          allowCommands
            ? "Terminal ON — the agent can run shell commands (pip, npm, pytest, curl…). Click to turn off."
            : "Terminal OFF — click to let the agent run shell commands to install deps and test its work."
        }
        className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-[5px] font-mono text-[11px] ${
          allowCommands
            ? "border-cyan/50 bg-cyan/[0.15] text-cyan"
            : "border-line bg-overlay text-muted hover:text-fg"
        }`}
      >
        ⚡<span>{allowCommands ? "on" : "off"}</span>
      </button>

      <button
        type="button"
        onClick={() => postMessage({ type: "newChat" })}
        className="inline-flex items-center gap-1.5 rounded-md border border-line bg-overlay px-2.5 py-[5px] font-mono text-[11px] text-dim hover:border-primary/40 hover:text-primary"
      >
        + new
      </button>

      {menuOpen && (
        <AccountMenu
          accounts={accounts}
          activeEmail={activeEmail}
          anchorRef={avatarRef}
          onClose={() => setMenuOpen(false)}
        />
      )}
    </header>
  );
}
