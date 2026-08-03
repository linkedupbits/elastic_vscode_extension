/**
 * Minimal runtime stand-in for the `vscode` module, used only by Jest (wired via
 * jest.config.js's moduleNameMapper). Type-checking still resolves `import * as vscode
 * from 'vscode'` against the real @types/vscode declarations — this file only needs to
 * behave correctly for the specific runtime operations our source actually performs
 * (constructing TreeItem/ThemeIcon/EventEmitter, reading workspace state), not satisfy
 * the full API surface.
 */
import * as path from 'path';

// ---------- workspace ----------

interface WorkspaceFolderLike {
  uri: { fsPath: string };
}

let workspaceFolders: WorkspaceFolderLike[] | undefined;
let configValues: Record<string, unknown> = {};

export const workspace = {
  get workspaceFolders(): WorkspaceFolderLike[] | undefined {
    return workspaceFolders;
  },
  getConfiguration(_section?: string) {
    return {
      get<T>(key: string, defaultValue?: T): T {
        const value = configValues[key];
        return (value === undefined ? defaultValue : value) as T;
      },
    };
  },
  onDidChangeConfiguration: () => ({ dispose: () => undefined }),
  onDidChangeWorkspaceFolders: () => ({ dispose: () => undefined }),
  createFileSystemWatcher: () => ({
    onDidCreate: () => ({ dispose: () => undefined }),
    onDidChange: () => ({ dispose: () => undefined }),
    onDidDelete: () => ({ dispose: () => undefined }),
    dispose: () => undefined,
  }),
};

/** Test helper: point the mocked workspace at a single root folder (or clear it). */
export function __setWorkspaceFolders(root: string | undefined): void {
  workspaceFolders = root === undefined ? undefined : [{ uri: { fsPath: root } }];
}

/** Test helper: set a single `elasticSource.<key>` configuration value. */
export function __setConfigValue(key: string, value: unknown): void {
  configValues[key] = value;
}

/** Test helper: reset all mocked workspace/config state between tests. */
export function __resetWorkspace(): void {
  workspaceFolders = undefined;
  configValues = {};
}

// ---------- window / commands ----------

/**
 * Minimal fake of vscode.Webview: records outgoing postMessage calls in `posted` and lets
 * tests simulate an incoming message from the webview via `__receive`, returning whatever
 * promise the extension host's message handler produced so tests can `await` it.
 */
class MockWebview {
  html = '';
  cspSource = 'vscode-resource:';
  readonly posted: Array<{ type: string; [key: string]: unknown }> = [];
  private messageHandler?: (message: unknown) => unknown;

  asWebviewUri(uri: Uri): Uri {
    return uri;
  }

  onDidReceiveMessage(handler: (message: unknown) => unknown): { dispose: () => void } {
    this.messageHandler = handler;
    return { dispose: () => undefined };
  }

  postMessage(message: { type: string; [key: string]: unknown }): Promise<boolean> {
    this.posted.push(message);
    return Promise.resolve(true);
  }

  /** Test helper: simulate the webview posting `message` to the extension host. */
  __receive(message: unknown): unknown {
    return this.messageHandler?.(message);
  }
}

/** Minimal fake of vscode.WebviewPanel, returned by the mocked window.createWebviewPanel. */
export class MockWebviewPanel {
  readonly webview = new MockWebview();
  title: string;
  disposed = false;
  revealCount = 0;
  private disposeHandler?: () => void;

  constructor(
    public readonly viewType: string,
    title: string,
    public readonly viewColumn: unknown,
    public readonly options: unknown
  ) {
    this.title = title;
  }

  onDidDispose(handler: () => void): { dispose: () => void } {
    this.disposeHandler = handler;
    return { dispose: () => undefined };
  }

  reveal(): void {
    this.revealCount++;
  }

  dispose(): void {
    this.disposed = true;
    this.disposeHandler?.();
  }
}

const createdWebviewPanels: MockWebviewPanel[] = [];

/** Test helper: the most recently created mock webview panel (i.e. the one just opened). */
export function __getLastCreatedWebviewPanel(): MockWebviewPanel | undefined {
  return createdWebviewPanels[createdWebviewPanels.length - 1];
}

/** Test helper: clears the record of created webview panels between tests. */
export function __resetWebviewPanels(): void {
  createdWebviewPanels.length = 0;
}

export const window = {
  createWebviewPanel: (viewType: string, title: string, viewColumn: unknown, options: unknown): MockWebviewPanel => {
    const panel = new MockWebviewPanel(viewType, title, viewColumn, options);
    createdWebviewPanels.push(panel);
    return panel;
  },
  showWarningMessage: async () => undefined,
  showInformationMessage: async () => undefined,
  showQuickPick: async () => undefined,
  registerTreeDataProvider: () => ({ dispose: () => undefined }),
};

export const commands = {
  registerCommand: () => ({ dispose: () => undefined }),
  executeCommand: async () => undefined,
};

// ---------- tree view ----------

export enum TreeItemCollapsibleState {
  None = 0,
  Collapsed = 1,
  Expanded = 2,
}

export class ThemeIcon {
  constructor(public id: string) {}
}

export class TreeItem {
  label?: string;
  collapsibleState?: TreeItemCollapsibleState;
  contextValue?: string;
  iconPath?: unknown;
  description?: string;
  tooltip?: string;
  command?: unknown;

  constructor(label: string, collapsibleState?: TreeItemCollapsibleState) {
    this.label = label;
    this.collapsibleState = collapsibleState;
  }
}

export class EventEmitter<T> {
  private readonly listeners: Array<(e: T) => void> = [];

  event = (listener: (e: T) => void) => {
    this.listeners.push(listener);
    return { dispose: () => undefined };
  };

  fire(data?: T): void {
    for (const listener of this.listeners) {
      listener(data as T);
    }
  }
}

// ---------- Uri ----------

export class Uri {
  private constructor(public readonly fsPath: string) {}

  static file(fsPath: string): Uri {
    return new Uri(fsPath);
  }

  static joinPath(base: { fsPath: string }, ...segments: string[]): Uri {
    return new Uri(path.join(base.fsPath, ...segments));
  }
}

export enum ViewColumn {
  One = 1,
}
