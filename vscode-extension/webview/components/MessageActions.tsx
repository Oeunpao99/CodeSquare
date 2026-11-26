import { useCallback, useState } from "react";

/** Copy text to the clipboard and flash a confirmation label. */
export function useCopy(): [boolean, (text: string) => void] {
  const [copied, setCopied] = useState(false);
  const copy = useCallback((text: string) => {
    const done = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, done);
    else done();
  }, []);
  return [copied, copy];
}

export const timeLabel = (at: number): string =>
  new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const ICON = "h-3.5 w-3.5";

function CopyIcon({ done }: { done: boolean }) {
  return done ? (
    <svg viewBox="0 0 16 16" className={ICON} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3.5 8.5l3 3 6-6.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg viewBox="0 0 16 16" className={ICON} fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.8" />
      <path d="M10.5 5.5v-1a1.8 1.8 0 0 0-1.8-1.8H4.3A1.8 1.8 0 0 0 2.5 4.5v4.4a1.8 1.8 0 0 0 1.8 1.8h1" />
    </svg>
  );
}

function ThumbIcon({ down, filled }: { down?: boolean; filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={`${ICON} ${down ? "rotate-180" : ""}`}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    >
      <path d="M5.4 14V6.9l3-4.6a1.5 1.5 0 0 1 2.6 1.4L10 6.4h2.9a1.6 1.6 0 0 1 1.6 2l-1.2 4.4a1.6 1.6 0 0 1-1.5 1.2H5.4z" />
      <rect x="1.5" y="6.6" width="3" height="7.4" rx="1" />
    </svg>
  );
}

function ActionButton({
  label,
  active,
  danger,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`rounded p-1 transition-colors ${
        active
          ? danger
            ? "text-red"
            : "text-mint"
          : "text-muted hover:bg-white/[0.06] hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}

interface Props {
  text: string;
  at: number;
  /** omit to hide the thumbs (user messages only get copy) */
  feedback?: "up" | "down";
  onFeedback?: (value: "up" | "down") => void;
  align?: "left" | "right";
}

export function MessageActions({ text, at, feedback, onFeedback, align = "left" }: Props) {
  const [copied, copy] = useCopy();
  return (
    <div
      className={`mt-1 flex items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 ${
        align === "right" ? "justify-end" : ""
      }`}
    >
      <ActionButton label={copied ? "Copied" : "Copy"} active={copied} onClick={() => copy(text)}>
        <CopyIcon done={copied} />
      </ActionButton>

      {onFeedback && (
        <>
          <ActionButton
            label="Good response"
            active={feedback === "up"}
            onClick={() => onFeedback("up")}
          >
            <ThumbIcon filled={feedback === "up"} />
          </ActionButton>
          <ActionButton
            label="Bad response"
            danger
            active={feedback === "down"}
            onClick={() => onFeedback("down")}
          >
            <ThumbIcon down filled={feedback === "down"} />
          </ActionButton>
        </>
      )}

      <span className="ml-1 select-none font-mono text-2xs text-muted">{timeLabel(at)}</span>
    </div>
  );
}
