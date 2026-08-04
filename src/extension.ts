import * as vscode from 'vscode';
import { NoWorkspaceError } from './config';
import { deleteApiKey } from './connections/connectionManager';
import { AgentPolicyEditorPanel } from './editors/agentPolicyEditorPanel';
import { ArtifactLoadErrorPanel } from './editors/artifactLoadErrorPanel';
import { ConnectionEditorPanel } from './editors/connectionEditorPanel';
import { DownloadSourceEditorPanel } from './editors/downloadSourceEditorPanel';
import { IlmPolicyEditorPanel } from './editors/ilmPolicyEditorPanel';
import { IndexTemplateEditorPanel } from './editors/indexTemplateEditorPanel';
import { IngestPipelineEditorPanel } from './editors/ingestPipelineEditorPanel';
import { IntegrationPolicyEditorPanel } from './editors/integrationPolicyEditorPanel';
import { LiveAgentPolicyViewPanel } from './editors/liveAgentPolicyViewPanel';
import { LiveSpaceViewPanel } from './editors/liveSpaceViewPanel';
import { ProxyEditorPanel } from './editors/proxyEditorPanel';
import { RoleEditorPanel } from './editors/roleEditorPanel';
import { RoleMappingEditorPanel } from './editors/roleMappingEditorPanel';
import { SnapshotPolicyEditorPanel } from './editors/snapshotPolicyEditorPanel';
import { SpaceEditorPanel } from './editors/spaceEditorPanel';
import { getIntegrationTemplateChoices, resolveIntegrationTemplate } from './integrations/registry';
import { ArtifactType, ElasticTreeItem } from './treeView/elasticTreeItem';
import { ElasticTreeProvider } from './treeView/elasticTreeProvider';
import {
  ArtifactConflictError,
  deleteConnection,
  deleteFleetAgentPolicy,
  deleteFleetDownloadSource,
  deleteFleetProxy,
  deleteIlmPolicy,
  deleteIndexTemplate,
  deleteIngestPipeline,
  deleteIntegrationPolicy,
  deleteRole,
  deleteRoleMapping,
  deleteSnapshotPolicy,
  deleteSpace,
  downloadAgentPolicy,
  downloadSpace,
} from './repositories';
import { readJsonFile } from './fileSystem';
import { FleetAgentPolicy, IntegrationPolicy, SpaceDefinition } from './models';

function reportIfNoWorkspace(err: unknown): boolean {
  if (err instanceof NoWorkspaceError) {
    void vscode.window.showWarningMessage(err.message);
    return true;
  }
  return false;
}

/**
 * Runs a "download to project" attempt; if it fails because a local artifact already occupies
 * that name/id, asks the user to confirm before retrying with `overwrite`. Returns the saved
 * file path, or undefined if the user declined to overwrite.
 */
async function downloadWithOverwriteConfirm(
  attempt: () => Promise<string>,
  retryWithOverwrite: () => Promise<string>
): Promise<string | undefined> {
  try {
    return await attempt();
  } catch (err) {
    if (!(err instanceof ArtifactConflictError)) {
      throw err;
    }
    const confirmed = await vscode.window.showWarningMessage(
      `${err.message} Overwrite it with the downloaded version?`,
      { modal: true },
      'Overwrite'
    );
    if (confirmed !== 'Overwrite') {
      return undefined;
    }
    return await retryWithOverwrite();
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const treeProvider = new ElasticTreeProvider(context.secrets);
  const refresh = () => treeProvider.refresh();

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('elasticSourceExplorer', treeProvider),

    vscode.commands.registerCommand('elasticSource.refresh', () => refresh()),

    vscode.commands.registerCommand('elasticSource.newFleetProxy', () => {
      try {
        ProxyEditorPanel.openNew(context.extensionUri, refresh);
      } catch (err) {
        if (!reportIfNoWorkspace(err)) throw err;
      }
    }),

    vscode.commands.registerCommand('elasticSource.newFleetDownloadSource', () => {
      try {
        DownloadSourceEditorPanel.openNew(context.extensionUri, refresh);
      } catch (err) {
        if (!reportIfNoWorkspace(err)) throw err;
      }
    }),

    vscode.commands.registerCommand('elasticSource.newFleetAgentPolicy', () => {
      try {
        AgentPolicyEditorPanel.openNew(context.extensionUri, refresh);
      } catch (err) {
        if (!reportIfNoWorkspace(err)) throw err;
      }
    }),

    vscode.commands.registerCommand('elasticSource.newIndexLifecyclePolicy', () => {
      try {
        IlmPolicyEditorPanel.openNew(context.extensionUri, refresh);
      } catch (err) {
        if (!reportIfNoWorkspace(err)) throw err;
      }
    }),

    vscode.commands.registerCommand('elasticSource.newIngestPipeline', () => {
      try {
        IngestPipelineEditorPanel.openNew(context.extensionUri, refresh);
      } catch (err) {
        if (!reportIfNoWorkspace(err)) throw err;
      }
    }),

    vscode.commands.registerCommand('elasticSource.newIndexTemplate', () => {
      try {
        IndexTemplateEditorPanel.openNew(context.extensionUri, refresh);
      } catch (err) {
        if (!reportIfNoWorkspace(err)) throw err;
      }
    }),

    vscode.commands.registerCommand('elasticSource.newRole', () => {
      try {
        RoleEditorPanel.openNew(context.extensionUri, refresh);
      } catch (err) {
        if (!reportIfNoWorkspace(err)) throw err;
      }
    }),

    vscode.commands.registerCommand('elasticSource.newRoleMapping', () => {
      try {
        RoleMappingEditorPanel.openNew(context.extensionUri, refresh);
      } catch (err) {
        if (!reportIfNoWorkspace(err)) throw err;
      }
    }),

    vscode.commands.registerCommand('elasticSource.newSpace', () => {
      try {
        SpaceEditorPanel.openNew(context.extensionUri, refresh);
      } catch (err) {
        if (!reportIfNoWorkspace(err)) throw err;
      }
    }),

    vscode.commands.registerCommand('elasticSource.newSnapshotPolicy', () => {
      try {
        SnapshotPolicyEditorPanel.openNew(context.extensionUri, refresh);
      } catch (err) {
        if (!reportIfNoWorkspace(err)) throw err;
      }
    }),

    vscode.commands.registerCommand('elasticSource.newConnection', () => {
      try {
        ConnectionEditorPanel.openNew(context.extensionUri, context.secrets, refresh);
      } catch (err) {
        if (!reportIfNoWorkspace(err)) throw err;
      }
    }),

    vscode.commands.registerCommand(
      'elasticSource.openArtifact',
      async (args: { artifactType: ArtifactType; filePath: string }) => {
        switch (args.artifactType) {
          case 'proxy':
            ProxyEditorPanel.openExisting(context.extensionUri, refresh, args.filePath);
            break;
          case 'downloadsource':
            DownloadSourceEditorPanel.openExisting(context.extensionUri, refresh, args.filePath);
            break;
          case 'agentpolicy':
            AgentPolicyEditorPanel.openExisting(context.extensionUri, refresh, args.filePath);
            break;
          case 'ilmpolicy':
            IlmPolicyEditorPanel.openExisting(context.extensionUri, refresh, args.filePath);
            break;
          case 'ingestpipeline':
            IngestPipelineEditorPanel.openExisting(context.extensionUri, refresh, args.filePath);
            break;
          case 'indextemplate':
            IndexTemplateEditorPanel.openExisting(context.extensionUri, refresh, args.filePath);
            break;
          case 'role':
            RoleEditorPanel.openExisting(context.extensionUri, refresh, args.filePath);
            break;
          case 'rolemapping':
            RoleMappingEditorPanel.openExisting(context.extensionUri, refresh, args.filePath);
            break;
          case 'space':
            SpaceEditorPanel.openExisting(context.extensionUri, refresh, args.filePath);
            break;
          case 'snapshotpolicy':
            SnapshotPolicyEditorPanel.openExisting(context.extensionUri, refresh, args.filePath);
            break;
          case 'connection':
            ConnectionEditorPanel.openExisting(context.extensionUri, context.secrets, refresh, args.filePath);
            break;
          case 'integrationpolicy': {
            const data = await readJsonFile<IntegrationPolicy>(args.filePath);
            const template = resolveIntegrationTemplate(data.package?.name, data.package?.version);
            IntegrationPolicyEditorPanel.openExisting(context.extensionUri, refresh, args.filePath, template);
            break;
          }
        }
      }
    ),

    vscode.commands.registerCommand(
      'elasticSource.openLiveSpace',
      (args: { connectionName: string; space: SpaceDefinition }) => {
        LiveSpaceViewPanel.open(context.extensionUri, args.connectionName, args.space);
      }
    ),

    vscode.commands.registerCommand(
      'elasticSource.openLiveAgentPolicy',
      (args: { connectionName: string; policy: FleetAgentPolicy }) => {
        LiveAgentPolicyViewPanel.open(context.extensionUri, args.connectionName, args.policy);
      }
    ),

    vscode.commands.registerCommand('elasticSource.downloadLiveSpace', async (item: ElasticTreeItem) => {
      if (!item.liveSpace) {
        return;
      }
      const space = item.liveSpace;
      try {
        const filePath = await downloadWithOverwriteConfirm(
          () => downloadSpace(space),
          () => downloadSpace(space, true)
        );
        if (filePath) {
          refresh();
          void vscode.window.showInformationMessage(`Downloaded Space "${space.name}" to the project.`);
        }
      } catch (err) {
        if (!reportIfNoWorkspace(err)) throw err;
      }
    }),

    vscode.commands.registerCommand('elasticSource.downloadLiveAgentPolicy', async (item: ElasticTreeItem) => {
      if (!item.liveAgentPolicy) {
        return;
      }
      const policy = item.liveAgentPolicy;
      try {
        const filePath = await downloadWithOverwriteConfirm(
          () => downloadAgentPolicy(policy),
          () => downloadAgentPolicy(policy, true)
        );
        if (filePath) {
          refresh();
          void vscode.window.showInformationMessage(`Downloaded Fleet Agent Policy "${policy.name}" to the project.`);
        }
      } catch (err) {
        if (!reportIfNoWorkspace(err)) throw err;
      }
    }),

    vscode.commands.registerCommand('elasticSource.newIntegrationPolicy', async (item: ElasticTreeItem) => {
      if (!item.filePath) {
        return;
      }
      const choices = getIntegrationTemplateChoices();
      const selected = await vscode.window.showQuickPick(choices, {
        placeHolder: 'Select an integration type',
      });
      if (!selected) {
        return;
      }
      const template = resolveIntegrationTemplate(selected.id, selected.version);
      if (!template) {
        return;
      }
      IntegrationPolicyEditorPanel.openNew(context.extensionUri, refresh, item.filePath, template);
    }),

    vscode.commands.registerCommand('elasticSource.deleteArtifact', async (item: ElasticTreeItem) => {
      if (!item.filePath || !item.artifactType) {
        return;
      }
      const confirmed = await vscode.window.showWarningMessage(
        `Delete "${item.label}"? This cannot be undone.`,
        { modal: true },
        'Delete'
      );
      if (confirmed !== 'Delete') {
        return;
      }
      switch (item.artifactType) {
        case 'proxy':
          await deleteFleetProxy(item.filePath);
          break;
        case 'downloadsource':
          await deleteFleetDownloadSource(item.filePath);
          break;
        case 'agentpolicy':
          await deleteFleetAgentPolicy(item.filePath);
          break;
        case 'integrationpolicy':
          await deleteIntegrationPolicy(item.filePath);
          break;
        case 'ilmpolicy':
          await deleteIlmPolicy(item.filePath);
          break;
        case 'ingestpipeline':
          await deleteIngestPipeline(item.filePath);
          break;
        case 'indextemplate':
          await deleteIndexTemplate(item.filePath);
          break;
        case 'role':
          await deleteRole(item.filePath);
          break;
        case 'rolemapping':
          await deleteRoleMapping(item.filePath);
          break;
        case 'space':
          await deleteSpace(item.filePath);
          break;
        case 'snapshotpolicy':
          await deleteSnapshotPolicy(item.filePath);
          break;
        case 'connection':
          await deleteConnection(item.filePath);
          if (item.connectionId) {
            await deleteApiKey(context.secrets, item.connectionId);
          }
          break;
      }
      refresh();
    }),

    vscode.commands.registerCommand(
      'elasticSource.showArtifactLoadError',
      (args: { filePath: string; message: string }) => {
        ArtifactLoadErrorPanel.open(context.extensionUri, args.filePath, args.message);
      }
    ),

    vscode.commands.registerCommand('elasticSource.revealInExplorer', (item: ElasticTreeItem) => {
      if (item.filePath) {
        void vscode.commands.executeCommand('revealInExplorer', vscode.Uri.file(item.filePath));
      }
    }),

    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('elasticSource.rootFolder')) {
        refresh();
      }
    }),

    vscode.workspace.onDidChangeWorkspaceFolders(() => refresh())
  );

  const watcherGlob =
    '**/{Fleet_Proxies,Fleet_Download_Sources,Fleet_Agent_Policies,Index_Lifecycle_Policies,Ingest_Pipelines,Index_Templates,Roles,Role_Mappings,Spaces,SnapshotPolicies,Connections}/**/*.json';
  const watcher = vscode.workspace.createFileSystemWatcher(watcherGlob);
  watcher.onDidCreate(() => refresh());
  watcher.onDidChange(() => refresh());
  watcher.onDidDelete(() => refresh());
  context.subscriptions.push(watcher);
}

export function deactivate(): void {}
