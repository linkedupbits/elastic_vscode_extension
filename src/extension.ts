import * as vscode from 'vscode';
import { NoWorkspaceError } from './config';
import { AgentPolicyEditorPanel } from './editors/agentPolicyEditorPanel';
import { DownloadSourceEditorPanel } from './editors/downloadSourceEditorPanel';
import { ProxyEditorPanel } from './editors/proxyEditorPanel';
import { ArtifactType, ElasticTreeItem } from './treeView/elasticTreeItem';
import { ElasticTreeProvider } from './treeView/elasticTreeProvider';
import {
  deleteFleetAgentPolicy,
  deleteFleetDownloadSource,
  deleteFleetProxy,
} from './repositories';

function reportIfNoWorkspace(err: unknown): boolean {
  if (err instanceof NoWorkspaceError) {
    void vscode.window.showWarningMessage(err.message);
    return true;
  }
  return false;
}

export function activate(context: vscode.ExtensionContext): void {
  const treeProvider = new ElasticTreeProvider();
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

    vscode.commands.registerCommand(
      'elasticSource.openArtifact',
      (args: { artifactType: ArtifactType; filePath: string }) => {
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
        }
      }
    ),

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
      }
      refresh();
    }),

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

  const watcherGlob = '**/{Fleet_Proxies,Fleet_Download_Sources,Fleet_Agent_Policies}/**/*.json';
  const watcher = vscode.workspace.createFileSystemWatcher(watcherGlob);
  watcher.onDidCreate(() => refresh());
  watcher.onDidChange(() => refresh());
  watcher.onDidDelete(() => refresh());
  context.subscriptions.push(watcher);
}

export function deactivate(): void {}
