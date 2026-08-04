import * as vscode from 'vscode';
import { decodeCloudId } from '../connections/cloudId';
import { storeApiKey } from '../connections/connectionManager';
import { generateId, readJsonFile } from '../fileSystem';
import { ConnectionDefinition } from '../models';
import { saveConnection } from '../repositories';
import { ArtifactPanelBase } from './artifactPanelBase';

interface ConnectionFormItem {
  name: string;
  cloudId: string;
}

interface ConnectionPayload {
  isNew: boolean;
  item: ConnectionFormItem;
}

export class ConnectionEditorPanel extends ArtifactPanelBase {
  private id: string | undefined;

  private constructor(
    extensionUri: vscode.Uri,
    private readonly secrets: vscode.SecretStorage,
    filePath: string | undefined,
    private readonly refresh: () => void
  ) {
    super(
      extensionUri,
      'elasticSource.connectionEditor',
      filePath ? 'Connection' : 'New Connection',
      filePath,
      'connectionForm.js'
    );
  }

  static openNew(extensionUri: vscode.Uri, secrets: vscode.SecretStorage, refresh: () => void): void {
    new ConnectionEditorPanel(extensionUri, secrets, undefined, refresh);
  }

  static openExisting(
    extensionUri: vscode.Uri,
    secrets: vscode.SecretStorage,
    refresh: () => void,
    filePath: string
  ): void {
    if (ArtifactPanelBase.reveal(filePath)) {
      return;
    }
    new ConnectionEditorPanel(extensionUri, secrets, filePath, refresh);
  }

  protected getFormBodyHtml(): string {
    return /* html */ `
    <h1 id="title">Connection</h1>
    <p class="subtitle">Connects to an Elastic Cloud deployment to browse its live data, starting with Kibana Spaces. The API key is stored in VS Code's secure secret storage, never written to disk.</p>
    <form id="form">
      <div class="field" id="field-name">
        <label for="name">Name</label>
        <input type="text" id="name" placeholder="Staging" />
        <span class="hint">A display name for this connection.</span>
        <span class="error">Name is required.</span>
      </div>
      <div class="field" id="field-cloudId">
        <label for="cloudId">Cloud ID</label>
        <textarea id="cloudId" rows="2" spellcheck="false"></textarea>
        <span class="hint">Copied from the deployment's "Copy Cloud ID" action in the Elastic Cloud console.</span>
        <span class="error">Cloud ID is required.</span>
      </div>
      <div class="field" id="field-apiKey">
        <label for="apiKey">API Key</label>
        <input type="password" id="apiKey" autocomplete="off" />
        <span class="hint" id="apiKey-hint"></span>
        <span class="error">API Key is required.</span>
      </div>
      <div class="actions">
        <button type="submit" class="primary">Save</button>
        <button type="button" class="secondary" id="cancel">Cancel</button>
      </div>
    </form>`;
  }

  protected async loadInitialPayload(): Promise<ConnectionPayload> {
    if (this.filePath) {
      const item = await readJsonFile<ConnectionDefinition>(this.filePath);
      this.id = item.id;
      return {
        isNew: false,
        item: { name: item.name, cloudId: item.cloudId },
      };
    }
    return {
      isNew: true,
      item: { name: '', cloudId: '' },
    };
  }

  protected async handleSave(payload: unknown): Promise<{ filePath: string; data: unknown }> {
    const data = payload as { name: string; cloudId: string; apiKey: string };

    const name = (data.name ?? '').trim();
    if (!name) {
      throw new Error('Name is required.');
    }

    const cloudId = (data.cloudId ?? '').trim();
    if (!cloudId) {
      throw new Error('Cloud ID is required.');
    }
    decodeCloudId(cloudId);

    const apiKey = (data.apiKey ?? '').trim();
    if (!this.id && !apiKey) {
      throw new Error('API Key is required.');
    }

    const id = this.id ?? generateId();
    const toSave: ConnectionDefinition = { id, name, cloudId };

    const filePath = await saveConnection(this.filePath, toSave);
    if (apiKey) {
      await storeApiKey(this.secrets, id, apiKey);
    }

    this.id = id;
    this.panel.title = toSave.name;
    return { filePath, data: { name: toSave.name, cloudId: toSave.cloudId } };
  }

  protected onSaved(): void {
    this.refresh();
  }
}
