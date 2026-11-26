import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, forwardRef } from "react";
import type { Mode } from "../types";
import { SLASH, QUICK } from "../commands";

export interface ComposerHandle {
  focus: () => void;
  setValue: (v: string) => void;
}

interface Props {
  mode: Mode;
  loading: boolean;
  onSend: (text: string) => void;
  onRunSlash: (raw: string) => void;
}

export const Composer = forwardRef<ComposerHandle, Props>(function Composer(
  { mode, loading, onSend, onRunSlash },
  ref,
) {
  const [value, setValue] = useState("");
  const [menuIdx, setMenuIdx] = useState(0);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => taRef.current?.focus(),
    setValue: (v: string) => setValue(v),
  }));

  useLayoutEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [value]);

  const slashMatch = /^\/(\S*)$/.exec(value);
  const menuItems = slashMatch
    ? SLASH.filter((c) => c.name.startsWith(slashMatch[1].toLowerCase()))
    : [];
  const menuOpen = menuItems.length > 0;

  useEffect(() => {
    if (menuIdx >= menuItems.length) setMenuIdx(0);
  }, [menuItems.length, menuIdx]);

  const submit = (text: string) => {
    const msg = text.trim();
    if (!msg || loading) return;
    setValue("");
    if (msg.startsWith("/")) onRunSlash(msg);
    else onSend(msg);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (menuOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMenuIdx((i) => (i + 1) % menuItems.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMenuIdx((i) => (i - 1 + menuItems.length) % menuItems.length);
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        setValue("/" + menuItems[menuIdx].name + " ");
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setValue("");
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submit("/" + menuItems[menuIdx].name);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit(value);
    }
  };

  return (
    <div className="relative border-t border-line p-3">
      {menuOpen && (
        <div className="absolute inset-x-3 bottom-full z-20 mb-2 overflow-hidden rounded-lg border border-line bg-codebg">
          <div className="border-b border-line px-3 py-[5px] font-mono text-2xs uppercase tracking-[0.18em] text-muted">
            // commands
          </div>
          {menuItems.map((c, i) => (
            <button
              key={c.name}
              type="button"
              onMouseEnter={() => setMenuIdx(i)}
              onClick={() => submit("/" + c.name)}
              className={`flex w-full items-baseline gap-2 px-3 py-[7px] text-left ${
                i === menuIdx ? "bg-primary/[0.12]" : ""
              }`}
            >
              <span className="font-mono text-[13px] text-primary">/{c.name}</span>
              <span className="font-mono text-[11px] text-muted">{c.desc}</span>
            </button>
          ))}
          <div className="border-t border-line px-3 py-[5px] font-mono text-2xs text-muted">
            ↑↓ select · Tab complete · ↵ run
          </div>
        </div>
      )}

      <div className="mb-2 flex flex-wrap gap-1.5">
        {QUICK.map((q) => (
          <button
            key={q.label}
            type="button"
            disabled={loading}
            onClick={() => {
              if (q.send) submit(q.send);
              else {
                setValue(q.prefill || "");
                taRef.current?.focus();
              }
            }}
            className="rounded-md border border-line bg-overlay px-2.5 py-1 font-mono text-[11px] text-dim hover:border-primary/40 hover:text-primary disabled:opacity-40"
          >
            <span className="select-none text-green">$ </span>
            {q.label}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(value);
        }}
        className={`rounded-xl border bg-overlay transition-colors ${
          mode === "plan" ? "border-orange/35 focus-within:border-orange/60" : "border-line focus-within:border-primary/50"
        }`}
      >
        <div className="flex items-start gap-2 px-3.5 pb-1 pt-2.5">
          <span
            className={`select-none font-mono text-[13px] leading-[1.55] ${
              mode === "plan" ? "text-orange" : "text-green"
            }`}
          >
            $
          </span>
          <textarea
            ref={taRef}
            rows={1}
            value={value}
            disabled={loading}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={
              mode === "plan"
                ? "describe what you want — I'll propose a plan…"
                : "ask, paste an error, or type / for commands…"
            }
            className="max-h-[200px] flex-1 resize-none border-0 bg-transparent font-mono text-[13px] leading-[1.55] text-fg outline-none placeholder:text-muted"
          />
        </div>
        <div className="flex items-center gap-1.5 border-t border-line px-2 py-[7px]">
          <button
            type="button"
            onClick={() => {
              if (!value.startsWith("/")) setValue("/");
              taRef.current?.focus();
            }}
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-line bg-overlay px-2 font-mono text-xs text-dim hover:border-primary/40 hover:text-primary"
          >
            / <span className="text-green">commands</span>
          </button>
          <span className="flex-1" />
          <span className="mr-1 font-mono text-2xs text-muted">Shift+Enter = newline</span>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-primary/40 bg-primary/15 px-3.5 font-mono text-xs text-primary hover:bg-primary/25 disabled:opacity-40"
          >
            ➤ run
          </button>
        </div>
      </form>

      <p className="mt-2 font-mono text-2xs text-muted">
        Try{" "}
        {["/new", "/usage", "/account"].map((c, i) => (
          <span key={c}>
            {i > 0 && " "}
            <button
              type="button"
              onClick={() => onRunSlash(c)}
              className="text-primary hover:underline"
            >
              {c}
            </button>
          </span>
        ))}
        {"  ·  "}
        <span className="text-muted">Alt+P plan · Alt+B build</span>
      </p>
    </div>
  );
});
