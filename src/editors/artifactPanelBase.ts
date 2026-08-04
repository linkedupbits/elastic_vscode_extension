import * as vscode from 'vscode';
import { getNonce } from './webviewNonce';

type OutgoingMessage =
  | { type: 'init'; payload: unknown }
  | { type: 'saved'; payload: unknown }
  | { type: 'error'; message: string };

/**
 * Shared plumbing for the structured (webview-based) artifact editors: panel
 * singleton-per-file tracking, CSP/nonce HTML shell, and the ready/init/save/cancel
 * message handshake. Subclasses supply the form markup, the data sent to the webview,
 * and how a save is persisted to disk.
 */
export abstract class ArtifactPanelBase {
  private static readonly openPanels = new Map<string, ArtifactPanelBase>();

  protected readonly panel: vscode.WebviewPanel;
  /** Absolute path of the backing json file, or undefined until the first successful save. */
  protected filePath: string | undefined;
  private readonly registryKey: string;
  private disposed = false;

  protected constructor(
    private readonly extensionUri: vscode.Uri,
    viewType: string,
    title: string,
    filePath: string | undefined,
    /** One script, or several loaded in order (e.g. a shared renderer followed by the form itself that uses it). */
    private readonly scriptFileNames: string | string[]
  ) {
    this.filePath = filePath;
    this.registryKey = filePath ?? `${viewType}:new:${Date.now()}:${Math.random()}`;

    this.panel = vscode.window.createWebviewPanel(viewType, title, vscode.ViewColumn.One, {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
    });

    ArtifactPanelBase.openPanels.set(this.registryKey, this);
    this.panel.onDidDispose(() => {
      this.disposed = true;
      ArtifactPanelBase.openPanels.delete(this.registryKey);
    });
    this.panel.webview.onDidReceiveMessage((message) => this.handleMessage(message));
    this.panel.webview.html = this.renderHtml();
  }

  /** Reveals an already-open panel for `filePath`, if there is one. */
  protected static reveal(filePath: string): boolean {
    const existing = ArtifactPanelBase.openPanels.get(filePath);
    if (existing) {
      existing.panel.reveal();
      return true;
    }
    return false;
  }

  private async handleMessage(message: { type: string; payload?: unknown }): Promise<void> {
    switch (message.type) {
      case 'ready': {
        const payload = await this.loadInitialPayload();
        this.post({ type: 'init', payload });
        return;
      }
      case 'save': {
        try {
          const result = await this.handleSave(message.payload);
          this.filePath = result.filePath;
          this.onSaved();
          this.post({ type: 'saved', payload: result.data });
        } catch (err) {
          this.post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
        }
        return;
      }
      case 'cancel':
        this.panel.dispose();
        return;
      case 'openInEditor':
        if (this.filePath) {
          void vscode.window.showTextDocument(vscode.Uri.file(this.filePath));
        }
        return;
    }
  }

  private post(message: OutgoingMessage): void {
    if (!this.disposed) {
      void this.panel.webview.postMessage(message);
    }
  }

  private renderHtml(): string {
    const webview = this.panel.webview;
    const nonce = getNonce();
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'main.css'));
    const scriptFileNames = Array.isArray(this.scriptFileNames) ? this.scriptFileNames : [this.scriptFileNames];
    const scriptTags = scriptFileNames
      .map((fileName) => {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', fileName));
        return `<script nonce="${nonce}" src="${scriptUri}"></script>`;
      })
      .join('\n  ');
    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; img-src ${webview.cspSource}; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link href="${styleUri}" rel="stylesheet" />
  <title>${this.panel.title}</title>
</head>
<body>
  <div class="banner error" id="error-banner"></div>
  ${this.getFormBodyHtml()}
  ${scriptTags}
</body>
</html>`;
  }

  /** The <h1>/<form> markup for this artifact type; ids are wired up by the matching media/*.js file. */
  protected abstract getFormBodyHtml(): string;

  /** Data (and any reference lists for dropdowns) sent to the webview once it signals it's ready. */
  protected abstract loadInitialPayload(): Promise<unknown>;

  /** Persists a save message from the webview. Throw to surface a validation/IO error back to the form. */
  protected abstract handleSave(
    payload: unknown
  ): Promise<{ filePath: string; data: unknown }>;

  /** Called after a successful save so the caller can refresh the tree view. */
  protected abstract onSaved(): void;
}
