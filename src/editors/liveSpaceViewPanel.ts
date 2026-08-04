import * as vscode from 'vscode';
import { SpaceDefinition } from '../models';
import { escapeHtml } from './htmlEscape';

/**
 * Read-only view of a Kibana Space fetched live from a connection. Unlike the structured
 * editors under this folder, there's no save flow and no file backing it, so this doesn't
 * extend `ArtifactPanelBase` - the space data is already in hand (it was fetched to render the
 * tree item this panel opens from), so the HTML is rendered directly rather than via the
 * ready/init webview handshake the file-backed editors use.
 */
export class LiveSpaceViewPanel {
  static open(extensionUri: vscode.Uri, connectionName: string, space: SpaceDefinition): void {
    const panel = vscode.window.createWebviewPanel(
      'elasticSource.liveSpaceView',
      space.name,
      vscode.ViewColumn.One,
      {
        enableScripts: false,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
      }
    );

    const webview = panel.webview;
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'main.css'));

    webview.html = /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; img-src ${webview.cspSource};" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link href="${styleUri}" rel="stylesheet" />
  <title>${escapeHtml(space.name)}</title>
</head>
<body>
  <h1>${escapeHtml(space.name)}</h1>
  <p class="subtitle">Live space on "${escapeHtml(connectionName)}". Read-only - manage this space in Kibana.</p>
  <div class="field">
    <label>ID</label>
    <input type="text" value="${escapeHtml(space.id)}" readonly />
  </div>
  <div class="field">
    <label>Description</label>
    <input type="text" value="${escapeHtml(space.description ?? '')}" readonly />
  </div>
  <div class="field">
    <label>Color</label>
    <input type="text" value="${escapeHtml(space.color ?? '')}" readonly />
  </div>
  <div class="field">
    <label>Initials</label>
    <input type="text" value="${escapeHtml(space.initials ?? '')}" readonly />
  </div>
  <div class="field">
    <label>Avatar Image URL</label>
    <input type="text" value="${escapeHtml(space.imageUrl ?? '')}" readonly />
  </div>
  <div class="field">
    <label>Disabled Features</label>
    <input type="text" value="${escapeHtml((space.disabledFeatures ?? []).join(', '))}" readonly />
  </div>
</body>
</html>`;
  }
}
