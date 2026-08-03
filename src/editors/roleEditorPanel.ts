import * as vscode from 'vscode';
import { readJsonFile, validateArtifactName } from '../fileSystem';
import {
  ApplicationPrivilegeFormValue,
  buildApplicationPrivilegesJson,
  buildIndexPrivilegesJson,
  buildRemoteClusterPrivilegesJson,
  buildRemoteIndexPrivilegesJson,
  IndexPrivilegeFormValue,
  parseApplicationPrivilegesFromRaw,
  parseIndexPrivilegesFromRaw,
  parseOptionalJsonObject,
  parseRemoteClusterPrivilegesFromRaw,
  parseRemoteIndexPrivilegesFromRaw,
  RemoteClusterPrivilegeFormValue,
  RemoteIndexPrivilegeFormValue,
  toStringArray,
} from '../roles/rolePrivilegeTemplates';
import { RoleDefinition } from '../models';
import { saveRole } from '../repositories';
import { ArtifactPanelBase } from './artifactPanelBase';

interface RoleFormItem {
  name: string;
  description: string;
  cluster: string[];
  runAs: string[];
  indices: IndexPrivilegeFormValue[];
  remoteIndices: RemoteIndexPrivilegeFormValue[];
  applications: ApplicationPrivilegeFormValue[];
  remoteCluster: RemoteClusterPrivilegeFormValue[];
  metadata: string;
  global: string;
}

interface RolePayload {
  isNew: boolean;
  item: RoleFormItem;
}

export class RoleEditorPanel extends ArtifactPanelBase {
  private constructor(
    extensionUri: vscode.Uri,
    filePath: string | undefined,
    private readonly refresh: () => void
  ) {
    super(extensionUri, 'elasticSource.roleEditor', filePath ? 'Role' : 'New Role', filePath, 'roleForm.js');
  }

  static openNew(extensionUri: vscode.Uri, refresh: () => void): void {
    new RoleEditorPanel(extensionUri, undefined, refresh);
  }

  static openExisting(extensionUri: vscode.Uri, refresh: () => void, filePath: string): void {
    if (ArtifactPanelBase.reveal(filePath)) {
      return;
    }
    new RoleEditorPanel(extensionUri, filePath, refresh);
  }

  protected getFormBodyHtml(): string {
    return /* html */ `
    <h1 id="title">Role</h1>
    <p class="subtitle">Defines an Elasticsearch security role. See the <a href="https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-security-put-role">Put Role API</a>.</p>
    <form id="form">
      <div class="field" id="field-name">
        <label for="name">Name</label>
        <input type="text" id="name" />
        <span class="hint">Used as this role's file name and role name.</span>
        <span class="error">Enter a name that is valid as a file name.</span>
      </div>
      <div class="field">
        <label for="description">Description (optional)</label>
        <textarea id="description" rows="2"></textarea>
      </div>
      <div class="field">
        <label for="cluster">Cluster Privileges (optional)</label>
        <textarea id="cluster" rows="2" placeholder="monitor" spellcheck="false"></textarea>
        <span class="hint">One cluster privilege name per line, e.g. monitor, manage_security, all.</span>
      </div>
      <div class="field">
        <label for="runAs">Run As (optional)</label>
        <textarea id="runAs" rows="2" placeholder="other_username" spellcheck="false"></textarea>
        <span class="hint">One username per line this role is allowed to submit requests on behalf of.</span>
      </div>

      <div class="field" style="margin-top:20px">
        <label>Index Privileges (optional)</label>
        <span class="hint">Grants access to specific indices/data streams.</span>
      </div>
      <div id="indices-container"></div>
      <button type="button" class="secondary" id="add-index-privilege">Add Index Privilege</button>

      <div class="field" style="margin-top:20px">
        <label>Remote Index Privileges (optional)</label>
        <span class="hint">Grants access to indices on remote clusters (cross-cluster search/replication).</span>
      </div>
      <div id="remote-indices-container"></div>
      <button type="button" class="secondary" id="add-remote-index-privilege">Add Remote Index Privilege</button>

      <div class="field" style="margin-top:20px">
        <label>Application Privileges (optional)</label>
        <span class="hint">Grants privileges managed by a custom application, not Elasticsearch itself.</span>
      </div>
      <div id="applications-container"></div>
      <button type="button" class="secondary" id="add-application-privilege">Add Application Privilege</button>

      <div class="field" style="margin-top:20px">
        <label>Remote Cluster Privileges (optional)</label>
        <span class="hint">Grants cluster-level privileges (e.g. monitor_enrich) on remote clusters.</span>
      </div>
      <div id="remote-cluster-container"></div>
      <button type="button" class="secondary" id="add-remote-cluster-privilege">Add Remote Cluster Privilege</button>

      <div class="field" id="field-metadata" style="margin-top:20px">
        <label for="metadata">Metadata (optional)</label>
        <textarea id="metadata" rows="4" spellcheck="false"></textarea>
        <span class="hint">Optional JSON object saved as "metadata".</span>
        <span class="error">Metadata must be a valid JSON object.</span>
      </div>
      <div class="field" id="field-global">
        <label for="global">Global Privileges (optional, JSON)</label>
        <textarea id="global" rows="4" spellcheck="false"></textarea>
        <span class="hint">Optional JSON object saved as "global", e.g. conditional application-management privileges.</span>
        <span class="error">Global Privileges must be a valid JSON object.</span>
      </div>
      <div class="actions">
        <button type="submit" class="primary">Save</button>
        <button type="button" class="secondary" id="cancel">Cancel</button>
      </div>
    </form>`;
  }

  protected async loadInitialPayload(): Promise<RolePayload> {
    if (this.filePath) {
      const item = await readJsonFile<RoleDefinition>(this.filePath);
      return {
        isNew: false,
        item: {
          name: item.name,
          description: item.description ?? '',
          cluster: item.cluster ?? [],
          runAs: item.run_as ?? [],
          indices: parseIndexPrivilegesFromRaw(item.indices),
          remoteIndices: parseRemoteIndexPrivilegesFromRaw(item.remote_indices),
          applications: parseApplicationPrivilegesFromRaw(item.applications),
          remoteCluster: parseRemoteClusterPrivilegesFromRaw(item.remote_cluster),
          metadata: item.metadata ? JSON.stringify(item.metadata, null, 2) : '',
          global: item.global ? JSON.stringify(item.global, null, 2) : '',
        },
      };
    }
    return {
      isNew: true,
      item: {
        name: '',
        description: '',
        cluster: [],
        runAs: [],
        indices: [],
        remoteIndices: [],
        applications: [],
        remoteCluster: [],
        metadata: '',
        global: '',
      },
    };
  }

  protected async handleSave(payload: unknown): Promise<{ filePath: string; data: unknown }> {
    const data = payload as {
      name: string;
      description: string;
      cluster: unknown;
      runAs: unknown;
      indices: IndexPrivilegeFormValue[];
      remoteIndices: RemoteIndexPrivilegeFormValue[];
      applications: ApplicationPrivilegeFormValue[];
      remoteCluster: RemoteClusterPrivilegeFormValue[];
      metadata: string;
      global: string;
    };
    const name = (data.name ?? '').trim();
    const nameError = validateArtifactName(name);
    if (nameError) {
      throw new Error(nameError);
    }

    const description = (data.description ?? '').trim();
    const cluster = toStringArray(data.cluster);
    const runAs = toStringArray(data.runAs);

    const indicesRows = data.indices ?? [];
    const indices = indicesRows.length > 0 ? buildIndexPrivilegesJson(indicesRows, 'Index Privilege') : undefined;

    const remoteIndicesRows = data.remoteIndices ?? [];
    const remoteIndices =
      remoteIndicesRows.length > 0 ? buildRemoteIndexPrivilegesJson(remoteIndicesRows, 'Remote Index Privilege') : undefined;

    const applicationsRows = data.applications ?? [];
    const applications =
      applicationsRows.length > 0 ? buildApplicationPrivilegesJson(applicationsRows, 'Application Privilege') : undefined;

    const remoteClusterRows = data.remoteCluster ?? [];
    const remoteCluster =
      remoteClusterRows.length > 0
        ? buildRemoteClusterPrivilegesJson(remoteClusterRows, 'Remote Cluster Privilege')
        : undefined;

    const metadata = parseOptionalJsonObject(data.metadata, 'Metadata');
    const global = parseOptionalJsonObject(data.global, 'Global Privileges');

    const toSave: RoleDefinition = {
      name,
      ...(description ? { description } : {}),
      ...(cluster.length > 0 ? { cluster } : {}),
      ...(indices ? { indices } : {}),
      ...(remoteIndices ? { remote_indices: remoteIndices } : {}),
      ...(applications ? { applications } : {}),
      ...(remoteCluster ? { remote_cluster: remoteCluster } : {}),
      ...(runAs.length > 0 ? { run_as: runAs } : {}),
      ...(metadata ? { metadata } : {}),
      ...(global ? { global } : {}),
    };
    const filePath = await saveRole(this.filePath, toSave);
    this.panel.title = toSave.name;
    return { filePath, data: toSave };
  }

  protected onSaved(): void {
    this.refresh();
  }
}
