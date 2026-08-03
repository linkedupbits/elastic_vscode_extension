import * as vscode from 'vscode';
import { NoWorkspaceError } from '../config';
import {
  listFleetAgentPolicies,
  listFleetDownloadSources,
  listFleetProxies,
  listIntegrationPolicies,
} from '../repositories';
import { ElasticTreeItem } from './elasticTreeItem';

const CATEGORIES = [
  {
    id: 'category-proxies',
    label: 'Fleet Proxies',
    icon: 'radio-tower',
  },
  {
    id: 'category-downloadsources',
    label: 'Fleet Download Sources',
    icon: 'cloud-download',
  },
  {
    id: 'category-agentpolicies',
    label: 'Fleet Agent Policies',
    icon: 'shield',
  },
] as const;

export class ElasticTreeProvider implements vscode.TreeDataProvider<ElasticTreeItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<ElasticTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ElasticTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: ElasticTreeItem): Promise<ElasticTreeItem[]> {
    try {
      if (!element) {
        return CATEGORIES.map(
          (c) =>
            new ElasticTreeItem(c.label, vscode.TreeItemCollapsibleState.Collapsed, {
              contextValue: c.id,
              iconPath: new vscode.ThemeIcon(c.icon),
            })
        );
      }

      switch (element.contextValue) {
        case 'category-proxies':
          return this.getProxyItems();
        case 'category-downloadsources':
          return this.getDownloadSourceItems();
        case 'category-agentpolicies':
          return this.getAgentPolicyItems();
        case 'agentpolicy':
          return this.getIntegrationPolicyItems(element.filePath as string);
        default:
          return [];
      }
    } catch (err) {
      if (err instanceof NoWorkspaceError) {
        return [
          new ElasticTreeItem('Open a folder to get started', vscode.TreeItemCollapsibleState.None, {
            contextValue: 'message',
            iconPath: new vscode.ThemeIcon('info'),
          }),
        ];
      }
      throw err;
    }
  }

  private async getProxyItems(): Promise<ElasticTreeItem[]> {
    const proxies = await listFleetProxies();
    return proxies.map(
      ({ filePath, data }) =>
        new ElasticTreeItem(data.name, vscode.TreeItemCollapsibleState.None, {
          contextValue: 'proxy',
          iconPath: new vscode.ThemeIcon('server-process'),
          description: data.url,
          filePath,
          artifactType: 'proxy',
          command: {
            command: 'elasticSource.openArtifact',
            title: 'Open',
            arguments: [{ artifactType: 'proxy', filePath }],
          },
        })
    );
  }

  private async getDownloadSourceItems(): Promise<ElasticTreeItem[]> {
    const sources = await listFleetDownloadSources();
    return sources.map(
      ({ filePath, data }) =>
        new ElasticTreeItem(data.name, vscode.TreeItemCollapsibleState.None, {
          contextValue: 'downloadsource',
          iconPath: new vscode.ThemeIcon('cloud'),
          description: data.is_default ? 'default' : data.host,
          filePath,
          artifactType: 'downloadsource',
          command: {
            command: 'elasticSource.openArtifact',
            title: 'Open',
            arguments: [{ artifactType: 'downloadsource', filePath }],
          },
        })
    );
  }

  private async getAgentPolicyItems(): Promise<ElasticTreeItem[]> {
    const policies = await listFleetAgentPolicies();
    return policies.map(
      ({ filePath, data }) =>
        new ElasticTreeItem(data.name, vscode.TreeItemCollapsibleState.Collapsed, {
          contextValue: 'agentpolicy',
          iconPath: new vscode.ThemeIcon('checklist'),
          description: data.namespace,
          filePath,
          artifactType: 'agentpolicy',
          command: {
            command: 'elasticSource.openArtifact',
            title: 'Open',
            arguments: [{ artifactType: 'agentpolicy', filePath }],
          },
        })
    );
  }

  private async getIntegrationPolicyItems(agentPolicyFilePath: string): Promise<ElasticTreeItem[]> {
    const integrations = await listIntegrationPolicies(agentPolicyFilePath);
    return integrations.map(
      ({ filePath, data }) =>
        new ElasticTreeItem(data.name, vscode.TreeItemCollapsibleState.None, {
          contextValue: 'integrationpolicy',
          iconPath: new vscode.ThemeIcon('plug'),
          description: data.package?.title,
          filePath,
          artifactType: 'integrationpolicy',
          command: {
            command: 'elasticSource.openArtifact',
            title: 'Open',
            arguments: [{ artifactType: 'integrationpolicy', filePath }],
          },
        })
    );
  }
}
