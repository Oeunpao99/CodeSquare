import { useEffect, useRef, useState } from "react";

/**
 * Smoothly reveals `raw` while it's still streaming in — advancing on every
 * animation frame, a few words at a time, faster when there's a big backlog,
 * and never stopping mid-word. Once `streaming` is false it snaps to the full
 * text immediately.
 */
export function useRevealedText(raw: string, streaming: boolean): string {
  const rawRef = useRef(raw);
  rawRef.current = raw;
  const [shown, setShown] = useState(() => (streaming ? 0 : raw.length));

  useEffect(() => {
    if (!streaming) {
      setShown(rawRef.current.length);
      return;
    }
    let live = true;
    let cur = 0;
    let handle = 0;

    const tick = () => {
      if (!live) return;
      const total = rawRef.current.length;
      if (cur < total) {
        const backlog = total - cur;
        let next = cur + Math.max(2, Math.min(18, Math.round(backlog / 6)));
        // Extend to the next whitespace so a word never appears half-formed.
        const rest = rawRef.current.slice(next);
        const ws = rest.search(/\s/);
        if (ws >= 0 && ws < 32) next += ws + 1;
        else if (total - next < 32) next = total;
        cur = Math.min(next, total);
        setShown(cur);
      }
      handle = requestAnimationFrame(tick);
    };
    handle = requestAnimationFrame(tick);

    return () => {
      live = false;
      cancelAnimationFrame(handle);
    };
  }, [streaming]);

  return streaming ? rawRef.current.slice(0, shown) : raw;
}
