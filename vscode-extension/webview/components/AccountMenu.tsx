import { useEffect, useRef } from "react";
import { postMessage } from "../vscode";

interface Props {
  accounts: string[];
  activeEmail: string | null;
  anchorRef: React.RefObject<HTMLElement>;
  onClose: () => void;
}

export function AccountMenu({ accounts, activeEmail, anchorRef, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !anchorRef.current?.contains(t)) onClose();
    };
    // Defer so the click that opened the menu doesn't immediately close it.
    const id = setTimeout(() => document.addEventListener("click", onDoc), 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener("click", onDoc);
    };
  }, [anchorRef, onClose]);

  const pick = (fn: () => void) => () => {
    onClose();
    fn();
  };

  return (
    <div
      ref={ref}
      className="absolute left-3 top-[calc(100%+4px)] z-30 min-w-[210px] max-w-[calc(100%-24px)] overflow-hidden rounded-lg border border-line bg-codebg shadow-[0_10px_28px_rgba(0,0,0,0.4)]"
    >
      <div className="border-b border-line px-3 py-1.5 font-mono text-2xs uppercase tracking-[0.16em] text-muted">
        accounts
      </div>

      {accounts.map((email) => {
        const on = email === activeEmail;
        return (
          <button
            key={email}
            type="button"
            onClick={pick(() => {
              if (!on) postMessage({ type: "switchAccount", email });
            })}
            className={`flex w-full items-center gap-2 px-3 py-2 text-left font-mono text-xs hover:bg-primary/10 ${
              on ? "text-fg" : "text-dim hover:text-fg"
            }`}
          >
            <span className="w-2.5 shrink-0 text-center text-mint">{on ? "✓" : ""}</span>
            <span className="truncate">{email}</span>
          </button>
        );
      })}

      <div className="my-0.5 h-px bg-line" />

      <button
        type="button"
        onClick={pick(() => postMessage({ type: "addAccount" }))}
        className="flex w-full items-center gap-2 px-3 py-2 text-left font-mono text-xs text-primary hover:bg-primary/10"
      >
        <span className="w-2.5 shrink-0 text-center">+</span>
        <span>Add another account</span>
      </button>

      {activeEmail && (
        <button
          type="button"
          onClick={pick(() => postMessage({ type: "signOut" }))}
          className="flex w-full items-center gap-2 px-3 py-2 text-left font-mono text-xs text-red hover:bg-red/10"
        >
          <span className="w-2.5 shrink-0" />
          <span>Sign out</span>
        </button>
      )}
    </div>
  );
}
