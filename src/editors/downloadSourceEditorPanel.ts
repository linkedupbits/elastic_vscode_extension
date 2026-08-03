import * as vscode from 'vscode';
import { generateId, readJsonFile } from '../fileSystem';
import { FleetDownloadSource, NamedRef } from '../models';
import { getFleetProxyRefs, saveFleetDownloadSource } from '../repositories';
import { ArtifactPanelBase } from './artifactPanelBase';

interface DownloadSourcePayload {
  isNew: boolean;
  item: FleetDownloadSource;
  proxies: NamedRef[];
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

export class DownloadSourceEditorPanel extends ArtifactPanelBase {
  private constructor(
    extensionUri: vscode.Uri,
    filePath: string | undefined,
    private readonly refresh: () => void
  ) {
    super(
      extensionUri,
      'elasticSource.downloadSourceEditor',
      filePath ? 'Fleet Download Source' : 'New Fleet Download Source',
      filePath,
      'downloadSourceForm.js'
    );
  }

  static openNew(extensionUri: vscode.Uri, refresh: () => void): void {
    new DownloadSourceEditorPanel(extensionUri, undefined, refresh);
  }

  static openExisting(extensionUri: vscode.Uri, refresh: () => void, filePath: string): void {
    if (ArtifactPanelBase.reveal(filePath)) {
      return;
    }
    new DownloadSourceEditorPanel(extensionUri, filePath, refresh);
  }

  protected getFormBodyHtml(): string {
    return /* html */ `
    <h1 id="title">Fleet Download Source</h1>
    <p class="subtitle">Defines a Fleet artifact download source that can be referenced by an Agent Policy.</p>
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
      <div class="field" id="field-host">
        <label for="host">Host</label>
        <input type="text" id="host" placeholder="https://artifacts.elastic.co/downloads" />
        <span class="error">Enter a valid URL, e.g. https://artifacts.elastic.co/downloads</span>
      </div>
      <div class="field">
        <label for="proxy_id">Proxy</label>
        <select id="proxy_id">
          <option value="">(none)</option>
        </select>
      </div>
      <div class="field">
        <div class="checkbox-row">
          <input type="checkbox" id="is_default" />
          <label for="is_default" style="margin:0">Is Default</label>
        </div>
      </div>
      <div class="actions">
        <button type="submit" class="primary">Save</button>
        <button type="button" class="secondary" id="cancel">Cancel</button>
      </div>
    </form>`;
  }

  protected async loadInitialPayload(): Promise<DownloadSourcePayload> {
    const proxies = await getFleetProxyRefs();
    if (this.filePath) {
      const item = await readJsonFile<FleetDownloadSource>(this.filePath);
      return { isNew: false, item, proxies };
    }
    return {
      isNew: true,
      item: { id: generateId(), name: '', host: '', is_default: false, proxy_id: '' },
      proxies,
    };
  }

  protected async handleSave(payload: unknown): Promise<{ filePath: string; data: unknown }> {
    const data = payload as FleetDownloadSource;
    const name = (data.name ?? '').trim();
    if (!name) {
      throw new Error('Name is required.');
    }
    if (!isValidUrl(data.host ?? '')) {
      throw new Error('Host is not a valid URL.');
    }
    if (data.proxy_id) {
      const proxies = await getFleetProxyRefs();
      if (!proxies.some((p) => p.id === data.proxy_id)) {
        throw new Error('Selected proxy no longer exists. Reopen this form to refresh the list.');
      }
    }
    const toSave: FleetDownloadSource = {
      id: data.id,
      name,
      host: data.host.trim(),
      is_default: Boolean(data.is_default),
      proxy_id: data.proxy_id ?? '',
    };
    const filePath = await saveFleetDownloadSource(this.filePath, toSave);
    this.panel.title = toSave.name;
    return { filePath, data: toSave };
  }

  protected onSaved(): void {
    this.refresh();
  }
}
