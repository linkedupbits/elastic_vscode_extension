import * as vscode from 'vscode';
import { validateArtifactName } from '../fileSystem';
import { parseOptionalJsonObject } from '../roles/rolePrivilegeTemplates';
import { SnapshotPolicyDefinition } from '../models';
import { loadSnapshotPolicy, saveSnapshotPolicy } from '../repositories';
import { ArtifactPanelBase } from './artifactPanelBase';

interface SnapshotPolicyFormItem {
  policyId: string;
  schedule: string;
  name: string;
  repository: string;
  config: string;
  retention: string;
}

interface SnapshotPolicyPayload {
  isNew: boolean;
  item: SnapshotPolicyFormItem;
}

export class SnapshotPolicyEditorPanel extends ArtifactPanelBase {
  private constructor(
    extensionUri: vscode.Uri,
    filePath: string | undefined,
    private readonly refresh: () => void
  ) {
    super(
      extensionUri,
      'elasticSource.snapshotPolicyEditor',
      filePath ? 'Snapshot Policy' : 'New Snapshot Policy',
      filePath,
      'snapshotPolicyForm.js'
    );
  }

  static openNew(extensionUri: vscode.Uri, refresh: () => void): void {
    new SnapshotPolicyEditorPanel(extensionUri, undefined, refresh);
  }

  static openExisting(extensionUri: vscode.Uri, refresh: () => void, filePath: string): void {
    if (ArtifactPanelBase.reveal(filePath)) {
      return;
    }
    new SnapshotPolicyEditorPanel(extensionUri, filePath, refresh);
  }

  protected getFormBodyHtml(): string {
    return /* html */ `
    <h1 id="title">Snapshot Policy</h1>
    <p class="subtitle">Defines an Elasticsearch Snapshot Lifecycle Management policy. See the <a href="https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-slm-put-lifecycle">Put Snapshot Lifecycle Policy API</a>.</p>
    <form id="form">
      <div class="field" id="field-policyId">
        <label for="policyId">Policy ID</label>
        <input type="text" id="policyId" placeholder="daily-snapshots" />
        <span class="hint">Used as this policy's file name and snapshot lifecycle policy id.</span>
        <span class="error">Enter a policy id that is valid as a file name.</span>
      </div>
      <div class="field" id="field-schedule">
        <label for="schedule">Schedule</label>
        <input type="text" id="schedule" placeholder="0 30 1 * * ?" />
        <span class="hint">Cron expression for when the snapshot should be taken.</span>
        <span class="error">Schedule is required.</span>
      </div>
      <div class="field" id="field-name">
        <label for="name">Snapshot Name</label>
        <input type="text" id="name" placeholder="&lt;daily-snap-{now/d}&gt;" />
        <span class="hint">Name given to each snapshot; supports date math templating.</span>
        <span class="error">Snapshot Name is required.</span>
      </div>
      <div class="field" id="field-repository">
        <label for="repository">Repository</label>
        <input type="text" id="repository" placeholder="my_repository" />
        <span class="hint">Name of the existing snapshot repository to store snapshots in.</span>
        <span class="error">Repository is required.</span>
      </div>
      <div class="field" id="field-config">
        <label for="config">Config (optional)</label>
        <textarea id="config" rows="6" spellcheck="false"></textarea>
        <span class="hint">Optional JSON object saved as "config", e.g. indices, ignore_unavailable, include_global_state.</span>
        <span class="error">Config must be a valid JSON object.</span>
      </div>
      <div class="field" id="field-retention">
        <label for="retention">Retention (optional)</label>
        <textarea id="retention" rows="4" spellcheck="false"></textarea>
        <span class="hint">Optional JSON object saved as "retention", e.g. expire_after, min_count, max_count.</span>
        <span class="error">Retention must be a valid JSON object.</span>
      </div>
      <div class="actions">
        <button type="submit" class="primary">Save</button>
        <button type="button" class="secondary" id="cancel">Cancel</button>
      </div>
    </form>`;
  }

  protected async loadInitialPayload(): Promise<SnapshotPolicyPayload> {
    if (this.filePath) {
      const item = await loadSnapshotPolicy(this.filePath);
      return {
        isNew: false,
        item: {
          policyId: item.policyId,
          schedule: item.schedule,
          name: item.name,
          repository: item.repository,
          config: item.config ? JSON.stringify(item.config, null, 2) : '',
          retention: item.retention ? JSON.stringify(item.retention, null, 2) : '',
        },
      };
    }
    return {
      isNew: true,
      item: { policyId: '', schedule: '', name: '', repository: '', config: '', retention: '' },
    };
  }

  protected async handleSave(payload: unknown): Promise<{ filePath: string; data: unknown }> {
    const data = payload as {
      policyId: string;
      schedule: string;
      name: string;
      repository: string;
      config: string;
      retention: string;
    };
    const policyId = (data.policyId ?? '').trim();
    const policyIdError = validateArtifactName(policyId);
    if (policyIdError) {
      throw new Error(policyIdError);
    }

    const schedule = (data.schedule ?? '').trim();
    if (!schedule) {
      throw new Error('Schedule is required.');
    }

    const name = (data.name ?? '').trim();
    if (!name) {
      throw new Error('Snapshot Name is required.');
    }

    const repository = (data.repository ?? '').trim();
    if (!repository) {
      throw new Error('Repository is required.');
    }

    const config = parseOptionalJsonObject(data.config, 'Config');
    const retention = parseOptionalJsonObject(data.retention, 'Retention');

    const toSave: SnapshotPolicyDefinition = {
      policyId,
      schedule,
      name,
      repository,
      ...(config ? { config } : {}),
      ...(retention ? { retention } : {}),
    };
    const filePath = await saveSnapshotPolicy(this.filePath, toSave);
    this.panel.title = toSave.policyId;
    return { filePath, data: toSave };
  }

  protected onSaved(): void {
    this.refresh();
  }
}
