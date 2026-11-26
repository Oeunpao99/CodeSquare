import type { PersistedState, WebMessage } from "./types";

interface VsCodeApi {
  postMessage(msg: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

const api: VsCodeApi = acquireVsCodeApi();

export function postMessage(msg: WebMessage): void {
  api.postMessage(msg);
}

export function getState(): PersistedState {
  try {
    const s = api.getState();
    return s && typeof s === "object" ? (s as PersistedState) : {};
  } catch {
    return {};
  }
}

/** The CodeSquare emblem, handed to the webview as a data attribute on #root. */
export const LOGO_URI: string = document.getElementById("root")?.dataset.logo || "";

export function setState(state: PersistedState): void {
  try {
    api.setState(state);
  } catch {
    /* not available in some hosts */
  }
}
