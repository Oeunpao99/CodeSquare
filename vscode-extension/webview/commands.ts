export interface SlashDef {
  name: string;
  desc: string;
  aliases?: string[];
}

export const SLASH: SlashDef[] = [
  { name: "plan", desc: "Switch to Plan mode (Alt+P) — propose, don't touch files" },
  { name: "build", desc: "Switch to Build mode (Alt+B) — create & edit files" },
  { name: "new", desc: "Start a fresh chat", aliases: ["clear", "reset"] },
  { name: "usage", desc: "Show AI token usage" },
  { name: "account", desc: "Switch account or add another", aliases: ["accounts", "switch"] },
  { name: "help", desc: "List these commands" },
];

export const findSlash = (n: string): SlashDef | undefined =>
  SLASH.find((c) => c.name === n || (c.aliases || []).includes(n));

export interface QuickAction {
  label: string;
  send?: string;
  prefill?: string;
}

export const QUICK: QuickAction[] = [
  { label: "Give an example", send: "Show me a short, complete example." },
  { label: "Fix my code", prefill: "Fix this — here's the code and the error:\n\n" },
  { label: "Explain more", send: "Can you explain that in more detail, with a code sample?" },
];
