import * as vscode from 'vscode';
import { FleetAgentPolicy } from '../models';
import { escapeHtml } from './htmlEscape';

/**
 * Read-only view of a Fleet Agent Policy fetched live from a connection. Mirrors
 * `LiveSpaceViewPanel`: no save flow and no file backing it, so this doesn't extend
 * `ArtifactPanelBase` - the policy data is already in hand (it was fetched to render the tree
 * item this panel opens from), so the HTML is rendered directly rather than via the ready/init
 * webview handshake the file-backed editors use.
 */
export class LiveAgentPolicyViewPanel {
  static open(extensionUri: vscode.Uri, connectionName: string, policy: FleetAgentPolicy): void {
    const panel = vscode.window.createWebviewPanel(
      'elasticSource.liveAgentPolicyView',
      policy.name,
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
  <title>${escapeHtml(policy.name)}</title>
</head>
<body>
  <h1>${escapeHtml(policy.name)}</h1>
  <p class="subtitle">Live Fleet Agent Policy on "${escapeHtml(connectionName)}". Read-only - manage this policy in Kibana.</p>
  <div class="field">
    <label>ID</label>
    <input type="text" value="${escapeHtml(policy.id)}" readonly />
  </div>
  <div class="field">
    <label>Description</label>
    <input type="text" value="${escapeHtml(policy.description ?? '')}" readonly />
  </div>
  <div class="field">
    <label>Namespace</label>
    <input type="text" value="${escapeHtml(policy.namespace ?? '')}" readonly />
  </div>
  <div class="field">
    <label>Monitoring Enabled</label>
    <input type="text" value="${escapeHtml((policy.monitoring_enabled ?? []).join(', '))}" readonly />
  </div>
  <div class="field">
    <label>Inactivity Timeout (seconds)</label>
    <input type="text" value="${escapeHtml(String(policy.inactivity_timeout ?? ''))}" readonly />
  </div>
  <div class="field">
    <label>Download Source ID</label>
    <input type="text" value="${escapeHtml(policy.download_source_id ?? '')}" readonly />
  </div>
  <div class="field">
    <label>Schema Version</label>
    <input type="text" value="${escapeHtml(policy.schema_version ?? '')}" readonly />
  </div>
  <div class="field">
    <label>Agent Logging Level</label>
    <input type="text" value="${escapeHtml(policy.advanced_settings?.agent_logging_level ?? '')}" readonly />
  </div>
</body>
</html>`;
  }
}
