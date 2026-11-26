import * as vscode from "vscode";

/** Green wash + overview-ruler ticks on the lines the agent just wrote. */
const ADDED = vscode.window.createTextEditorDecorationType({
  isWholeLine: true,
  backgroundColor: "rgba(63, 185, 80, 0.10)",
  overviewRulerColor: "rgba(63, 185, 80, 0.65)",
  overviewRulerLane: vscode.OverviewRulerLane.Left,
  borderWidth: "0 0 0 2px",
  borderStyle: "solid",
  borderColor: "rgba(63, 185, 80, 0.55)",
});

/**
 * The single source of truth for "the agent just touched this file": drives the
 * editor gutter, the Explorer badge, and the in-file Keep/Undo CodeLens.
 */
export class ChangeTracker implements vscode.Disposable {
  private ranges = new Map<string, vscode.Range[]>();
  private uriByKey = new Map<string, vscode.Uri>();
  private readonly emitter = new vscode.EventEmitter<vscode.Uri[]>();
  /** Fires with the files whose "changed" state just flipped. */
  readonly onChanged = this.emitter.event;
  private sub: vscode.Disposable;

  constructor() {
    this.sub = vscode.window.onDidChangeVisibleTextEditors(() => this.paint());
  }

  mark(uri: vscode.Uri, lineRanges: [number, number][]): void {
    if (!lineRanges.length) return;
    const key = uri.toString();
    this.ranges.set(
      key,
      lineRanges.map(([s, e]) => new vscode.Range(Math.max(0, s), 0, Math.max(0, e - 1), 0)),
    );
    this.uriByKey.set(key, uri);
    this.paint();
    this.emitter.fire([uri]);
  }

  clear(uri: vscode.Uri): void {
    const key = uri.toString();
    if (!this.ranges.delete(key)) return;
    this.uriByKey.delete(key);
    this.paint();
    this.emitter.fire([uri]);
  }

  clearAll(): void {
    const gone = [...this.uriByKey.values()];
    this.ranges.clear();
    this.uriByKey.clear();
    for (const ed of vscode.window.visibleTextEditors) ed.setDecorations(ADDED, []);
    if (gone.length) this.emitter.fire(gone);
  }

  has(uri: vscode.Uri): boolean {
    return this.ranges.has(uri.toString());
  }

  rangesFor(uri: vscode.Uri): vscode.Range[] | undefined {
    return this.ranges.get(uri.toString());
  }

  private paint(): void {
    for (const ed of vscode.window.visibleTextEditors) {
      ed.setDecorations(ADDED, this.ranges.get(ed.document.uri.toString()) || []);
    }
  }

  dispose(): void {
    this.sub.dispose();
    this.emitter.dispose();
    ADDED.dispose();
  }
}

/** A dot in the Explorer next to every file the agent wrote (and its folders). */
export class AgentFileDecorationProvider
  implements vscode.FileDecorationProvider, vscode.Disposable
{
  private readonly emitter = new vscode.EventEmitter<vscode.Uri | vscode.Uri[]>();
  readonly onDidChangeFileDecorations = this.emitter.event;
  private sub: vscode.Disposable;

  constructor(private readonly tracker: ChangeTracker) {
    this.sub = tracker.onChanged((uris) => this.emitter.fire(uris));
  }

  provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
    if (!this.tracker.has(uri)) return undefined;
    return {
      badge: "●",
      color: new vscode.ThemeColor("gitDecoration.addedResourceForeground"),
      tooltip: "Written by CodeSquareAgent — not kept yet",
      propagate: true,
    };
  }

  dispose(): void {
    this.sub.dispose();
    this.emitter.dispose();
  }
}

/** "✓ Keep · ↶ Undo" pinned above the first changed line of the file. */
export class AgentCodeLensProvider implements vscode.CodeLensProvider, vscode.Disposable {
  private readonly emitter = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this.emitter.event;
  private sub: vscode.Disposable;

  constructor(private readonly tracker: ChangeTracker) {
    this.sub = tracker.onChanged(() => this.emitter.fire());
  }

  provideCodeLenses(doc: vscode.TextDocument): vscode.CodeLens[] {
    const ranges = this.tracker.rangesFor(doc.uri);
    if (!ranges || !ranges.length) return [];
    const line = Math.min(ranges[0].start.line, Math.max(0, doc.lineCount - 1));
    const at = new vscode.Range(line, 0, line, 0);
    return [
      new vscode.CodeLens(at, {
        title: "$(check) Keep",
        tooltip: "Keep the agent's changes to this file",
        command: "codesquare.keepFile",
        arguments: [doc.uri],
      }),
      new vscode.CodeLens(at, {
        title: "$(discard) Undo",
        tooltip: "Roll this file back to how it was",
        command: "codesquare.undoFile",
        arguments: [doc.uri],
      }),
    ];
  }

  dispose(): void {
    this.sub.dispose();
    this.emitter.dispose();
  }
}
