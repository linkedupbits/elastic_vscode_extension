import * as vscode from 'vscode';
import { generateId, readJsonFile, validateArtifactName } from '../fileSystem';
import { FleetAgentPolicy, NamedRef } from '../models';
import { getFleetDownloadSourceRefs, saveFleetAgentPolicy } from '../repositories';
import { ArtifactPanelBase } from './artifactPanelBase';

interface AgentPolicyPayload {
  isNew: boolean;
  item: FleetAgentPolicy;
  downloadSources: NamedRef[];
}

export class AgentPolicyEditorPanel extends ArtifactPanelBase {
  private constructor(
    extensionUri: vscode.Uri,
    filePath: string | undefined,
    private readonly refresh: () => void
  ) {
    super(
      extensionUri,
      'elasticSource.agentPolicyEditor',
      filePath ? 'Fleet Agent Policy' : 'New Fleet Agent Policy',
      filePath,
      'agentPolicyForm.js'
    );
  }

  static openNew(extensionUri: vscode.Uri, refresh: () => void): void {
    new AgentPolicyEditorPanel(extensionUri, undefined, refresh);
  }

  static openExisting(extensionUri: vscode.Uri, refresh: () => void, filePath: string): void {
    if (ArtifactPanelBase.reveal(filePath)) {
      return;
    }
    new AgentPolicyEditorPanel(extensionUri, filePath, refresh);
  }

  protected getFormBodyHtml(): string {
    return /* html */ `
    <h1 id="title">Fleet Agent Policy</h1>
    <p class="subtitle">The folder and file name always match the policy name.</p>
    <form id="form">
      <div class="field">
        <label for="id">ID</label>
        <input type="text" id="id" readonly />
        <span class="hint">Generated automatically. Read-only.</span>
      </div>
      <div class="field" id="field-name">
        <label for="name">Name</label>
        <input type="text" id="name" />
        <span class="hint">Used as the policy's folder and file name.</span>
        <span class="error">Enter a name that is valid as a file/folder name.</span>
      </div>
      <div class="field">
        <label for="description">Description</label>
        <textarea id="description"></textarea>
      </div>
      <div class="field">
        <label>Monitoring Enabled</label>
        <div class="checkbox-group">
          <label><input type="checkbox" id="monitoring_logs" value="logs" /> Logs</label>
          <label><input type="checkbox" id="monitoring_metrics" value="metrics" /> Metrics</label>
        </div>
      </div>
      <div class="field" id="field-inactivity_timeout">
        <label for="inactivity_timeout">Inactivity Timeout (seconds)</label>
        <input type="number" id="inactivity_timeout" min="0" step="1" />
        <span class="error">Enter a whole number of seconds, 0 or greater.</span>
      </div>
      <div class="field">
        <label for="download_source_id">Download Source</label>
        <select id="download_source_id">
          <option value="">(none)</option>
        </select>
      </div>
      <div class="field" id="field-namespace">
        <label for="namespace">Namespace</label>
        <input type="text" id="namespace" />
        <span class="error">Namespace is required.</span>
      </div>
      <div class="field" id="field-schema_version">
        <label for="schema_version">Schema Version</label>
        <input type="text" id="schema_version" placeholder="1.1.0" />
        <span class="error">Schema version is required.</span>
      </div>
      <div class="field">
        <label for="agent_logging_level">Advanced: Agent Logging Level</label>
        <select id="agent_logging_level">
          <option value="">(default)</option>
          <option value="error">error</option>
          <option value="warning">warning</option>
          <option value="info">info</option>
          <option value="debug">debug</option>
        </select>
      </div>
      <div class="actions">
        <button type="submit" class="primary">Save</button>
        <button type="button" class="secondary" id="cancel">Cancel</button>
      </div>
    </form>`;
  }

  protected async loadInitialPayload(): Promise<AgentPolicyPayload> {
    const downloadSources = await getFleetDownloadSourceRefs();
    if (this.filePath) {
      const item = await readJsonFile<FleetAgentPolicy>(this.filePath);
      return { isNew: false, item, downloadSources };
    }
    return {
      isNew: true,
      item: {
        id: generateId(),
        name: '',
        description: '',
        monitoring_enabled: [],
        inactivity_timeout: 1209600,
        download_source_id: '',
        schema_version: '1.1.0',
        namespace: 'default',
        advanced_settings: { agent_logging_level: '' },
      },
      downloadSources,
    };
  }

  protected async handleSave(payload: unknown): Promise<{ filePath: string; data: unknown }> {
    const data = payload as FleetAgentPolicy;
    const name = (data.name ?? '').trim();
    const nameError = validateArtifactName(name);
    if (nameError) {
      throw new Error(nameError);
    }
    if (!data.namespace || !data.namespace.trim()) {
      throw new Error('Namespace is required.');
    }
    if (!data.schema_version || !data.schema_version.trim()) {
      throw new Error('Schema version is required.');
    }
    const inactivityTimeout = Number(data.inactivity_timeout);
    if (!Number.isFinite(inactivityTimeout) || inactivityTimeout < 0 || !Number.isInteger(inactivityTimeout)) {
      throw new Error('Inactivity timeout must be a whole number of seconds, 0 or greater.');
    }
    if (data.download_source_id) {
      const downloadSources = await getFleetDownloadSourceRefs();
      if (!downloadSources.some((d) => d.id === data.download_source_id)) {
        throw new Error(
          'Selected download source no longer exists. Reopen this form to refresh the list.'
        );
      }
    }

    const toSave: FleetAgentPolicy = {
      id: data.id,
      name,
      description: data.description ?? '',
      monitoring_enabled: Array.isArray(data.monitoring_enabled) ? data.monitoring_enabled : [],
      inactivity_timeout: inactivityTimeout,
      download_source_id: data.download_source_id ?? '',
      schema_version: data.schema_version.trim(),
      namespace: data.namespace.trim(),
      advanced_settings: {
        agent_logging_level: data.advanced_settings?.agent_logging_level ?? '',
      },
    };

    const filePath = await saveFleetAgentPolicy(this.filePath, toSave);
    this.panel.title = toSave.name;
    return { filePath, data: toSave };
  }

  protected onSaved(): void {
    this.refresh();
  }
}
