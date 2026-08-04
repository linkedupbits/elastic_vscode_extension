import * as vscode from 'vscode';
import { PackageTemplate } from '../integrations/packageTemplate';
import { resolveIntegrationTemplate } from '../integrations/registry';
import { FleetPackagePolicy } from '../models';
import { escapeHtml } from './htmlEscape';
import { getNonce } from './webviewNonce';

interface LiveIntegrationPolicyPayload {
  agentPolicyName: string;
  policy: FleetPackagePolicy;
  template: PackageTemplate | undefined;
}

/** Escapes `</` so the JSON payload embedded in an inline <script> can't prematurely close it. */
function embeddablePayload(payload: LiveIntegrationPolicyPayload): string {
  return JSON.stringify(payload).replace(/</g, '\\u003c');
}

/**
 * Read-only view of a Fleet Integration Policy fetched live from a connection. Unlike
 * `LiveAgentPolicyViewPanel`/`LiveSpaceViewPanel`, this renders its structured input/stream/var
 * section using the exact same client-side renderer (`media/integrationPolicyRender.js`) the
 * editable `IntegrationPolicyEditorPanel` form uses - the same `PackageTemplate` producing the
 * same layout, with every control disabled instead of editable - so viewing a live integration
 * policy looks and behaves like viewing a downloaded one, just without a Save button. That's why
 * this needs `enableScripts: true` and its own webview JS (`media/liveIntegrationPolicyView.js`)
 * where the other two live views get away with static, server-rendered HTML.
 */
export class LiveIntegrationPolicyViewPanel {
  static open(
    extensionUri: vscode.Uri,
    connectionName: string,
    agentPolicyName: string,
    policy: FleetPackagePolicy
  ): void {
    const template = resolveIntegrationTemplate(policy.package?.name, policy.package?.version);

    const panel = vscode.window.createWebviewPanel(
      'elasticSource.liveIntegrationPolicyView',
      policy.name,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
      }
    );

    const webview = panel.webview;
    const nonce = getNonce();
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'main.css'));
    const renderScriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, 'media', 'integrationPolicyRender.js')
    );
    const viewScriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, 'media', 'liveIntegrationPolicyView.js')
    );
    const payload = embeddablePayload({ agentPolicyName, policy, template });

    webview.html = /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; img-src ${webview.cspSource}; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link href="${styleUri}" rel="stylesheet" />
  <title>${escapeHtml(policy.name)}</title>
</head>
<body>
  <h1>${escapeHtml(policy.name)}</h1>
  <p class="subtitle">Live integration policy on "${escapeHtml(connectionName)}". Read-only - manage this policy in Kibana.</p>
  <div class="banner info" id="fallback-banner"></div>
  <div class="field">
    <label>Integration Type</label>
    <input type="text" id="package-display" readonly />
  </div>
  <div class="field">
    <label>Namespace</label>
    <input type="text" id="namespace-display" readonly />
  </div>
  <div class="field">
    <label>Description</label>
    <input type="text" id="description-display" readonly />
  </div>
  <div class="field">
    <label>Assigned to Agent Policy</label>
    <input type="text" id="agent-policy-display" readonly />
  </div>
  <div id="inputs-container"></div>
  <div class="field" id="field-json-fallback" style="display:none">
    <label for="json-fallback">Inputs (JSON)</label>
    <textarea id="json-fallback" rows="20" spellcheck="false" readonly></textarea>
  </div>
  <script nonce="${nonce}">window.__liveIntegrationPolicy = ${payload};</script>
  <script nonce="${nonce}" src="${renderScriptUri}"></script>
  <script nonce="${nonce}" src="${viewScriptUri}"></script>
</body>
</html>`;
  }
}
