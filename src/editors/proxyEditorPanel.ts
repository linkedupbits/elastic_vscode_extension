import * as vscode from 'vscode';
import { generateId } from '../fileSystem';
import { FleetProxy } from '../models';
import { readJsonFile } from '../fileSystem';
import { saveFleetProxy } from '../repositories';
import { ArtifactPanelBase } from './artifactPanelBase';

interface ProxyPayload {
  isNew: boolean;
  item: FleetProxy;
}

function isValidUrl(value: string): boolean {
  try {
    // eslint-disable-next-line no-new
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export class ProxyEditorPanel extends ArtifactPanelBase {
  private constructor(
    extensionUri: vscode.Uri,
    filePath: string | undefined,
    private readonly refresh: () => void
  ) {
    super(extensionUri, 'elasticSource.proxyEditor', filePath ? 'Fleet Proxy' : 'New Fleet Proxy', filePath, 'proxyForm.js');
  }

  static openNew(extensionUri: vscode.Uri, refresh: () => void): void {
    new ProxyEditorPanel(extensionUri, undefined, refresh);
  }

  static openExisting(extensionUri: vscode.Uri, refresh: () => void, filePath: string): void {
    if (ArtifactPanelBase.reveal(filePath)) {
      return;
    }
    new ProxyEditorPanel(extensionUri, filePath, refresh);
  }

  protected getFormBodyHtml(): string {
    return /* html */ `
    <h1 id="title">Fleet Proxy</h1>
    <p class="subtitle">Defines an on-prem proxy server that can be referenced by a Fleet Download Source.</p>
    <form id="form">
      <div class="field">
        <label for="id">ID</label>
        <input type="text" id="id" readonly />
        <span class="hint">Generated automatically. Read-only.</span>
      </div>
      <div class="field" id="field-name">
        <label for="name">Name</label>
        <input type="text" id="name" />
        <span class="error">Name is required.</span>
      </div>
      <div class="field" id="field-url">
        <label for="url">URL</label>
        <input type="text" id="url" placeholder="http://proxy.internal.example.com:3128" />
        <span class="error">Enter a valid URL, e.g. http://proxy.internal.example.com:3128</span>
      </div>
      <div class="field">
        <label for="certificate_authorities">Certificate Authorities</label>
        <textarea id="certificate_authorities"></textarea>
      </div>
      <div class="field">
        <label for="certificates">Certificate</label>
        <textarea id="certificates"></textarea>
      </div>
      <div class="field">
        <label for="certificate_key">Certificate Key</label>
        <textarea id="certificate_key"></textarea>
      </div>
      <div class="field">
        <div class="checkbox-row">
          <input type="checkbox" id="is_preconfigured" />
          <label for="is_preconfigured" style="margin:0">Is Preconfigured</label>
        </div>
      </div>
      <div class="actions">
        <button type="submit" class="primary">Save</button>
        <button type="button" class="secondary" id="cancel">Cancel</button>
      </div>
    </form>`;
  }

  protected async loadInitialPayload(): Promise<ProxyPayload> {
    if (this.filePath) {
      const item = await readJsonFile<FleetProxy>(this.filePath);
      return { isNew: false, item };
    }
    return {
      isNew: true,
      item: {
        id: generateId(),
        name: '',
        url: '',
        certificate_authorities: '',
        certificates: '',
        certificate_key: '',
        is_preconfigured: false,
      },
    };
  }

  protected async handleSave(payload: unknown): Promise<{ filePath: string; data: unknown }> {
    const data = payload as FleetProxy;
    const name = (data.name ?? '').trim();
    if (!name) {
      throw new Error('Name is required.');
    }
    if (!isValidUrl(data.url ?? '')) {
      throw new Error('URL is not valid.');
    }
    const toSave: FleetProxy = {
      id: data.id,
      name,
      url: data.url.trim(),
      certificate_authorities: data.certificate_authorities ?? '',
      certificates: data.certificates ?? '',
      certificate_key: data.certificate_key ?? '',
      is_preconfigured: Boolean(data.is_preconfigured),
    };
    const filePath = await saveFleetProxy(this.filePath, toSave);
    this.panel.title = toSave.name;
    return { filePath, data: toSave };
  }

  protected onSaved(): void {
    this.refresh();
  }
}
