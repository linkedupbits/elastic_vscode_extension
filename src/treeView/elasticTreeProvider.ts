import * as path from 'path';
import * as vscode from 'vscode';
import { decodeCloudId } from '../connections/cloudId';
import { getApiKey } from '../connections/connectionManager';
import { fetchAgentPolicies, fetchSpaces } from '../connections/kibanaClient';
import { NoWorkspaceError } from '../config';
import { readJsonFile } from '../fileSystem';
import { ConnectionDefinition } from '../models';
import {
  FailedArtifact,
  isLoadedArtifact,
  listConnections,
  listFleetAgentPolicies,
  listFleetDownloadSources,
  listFleetProxies,
  listIlmPolicies,
  listIndexTemplates,
  listIngestPipelines,
  listIntegrationPolicies,
  listRoleMappings,
  listRoles,
  listSnapshotPolicies,
  listSpaces,
} from '../repositories';
import { ElasticTreeItem } from './elasticTreeItem';

const CATEGORIES = [
  {
    id: 'category-connections',
    label: 'Connections',
    icon: 'plug',
  },
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
  {
    id: 'category-ilmpolicies',
    label: 'Index Lifecycle Policies',
    icon: 'history',
  },
  {
    id: 'category-ingestpipelines',
    label: 'Ingest Pipelines',
    icon: 'gear',
  },
  {
    id: 'category-indextemplates',
    label: 'Index Templates',
    icon: 'layers',
  },
  {
    id: 'category-roles',
    label: 'Roles',
    icon: 'key',
  },
  {
    id: 'category-rolemappings',
    label: 'Role Mappings',
    icon: 'link',
  },
  {
    id: 'category-spaces',
    label: 'Spaces',
    icon: 'symbol-namespace',
  },
  {
    id: 'category-snapshotpolicies',
    label: 'Snapshot Policies',
    icon: 'archive',
  },
] as const;

export class ElasticTreeProvider implements vscode.TreeDataProvider<ElasticTreeItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<ElasticTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly secrets: vscode.SecretStorage) {}

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
        case 'category-connections':
          return await this.getConnectionItems();
        case 'connection':
          return [
            new ElasticTreeItem('Spaces', vscode.TreeItemCollapsibleState.Collapsed, {
              contextValue: 'connection-spaces',
              iconPath: new vscode.ThemeIcon('symbol-namespace'),
              filePath: element.filePath,
              connectionId: element.connectionId,
            }),
            new ElasticTreeItem('Fleet Agent Policies', vscode.TreeItemCollapsibleState.Collapsed, {
              contextValue: 'connection-agentpolicies',
              iconPath: new vscode.ThemeIcon('checklist'),
              filePath: element.filePath,
              connectionId: element.connectionId,
            }),
          ];
        case 'connection-spaces':
          return await this.getLiveSpaceItems(element);
        case 'connection-agentpolicies':
          return await this.getLiveAgentPolicyItems(element);
        case 'category-proxies':
          return await this.getProxyItems();
        case 'category-downloadsources':
          return await this.getDownloadSourceItems();
        case 'category-agentpolicies':
          return await this.getAgentPolicyItems();
        case 'category-ilmpolicies':
          return await this.getIlmPolicyItems();
        case 'category-ingestpipelines':
          return await this.getIngestPipelineItems();
        case 'category-indextemplates':
          return await this.getIndexTemplateItems();
        case 'category-roles':
          return await this.getRoleItems();
        case 'category-rolemappings':
          return await this.getRoleMappingItems();
        case 'category-spaces':
          return await this.getSpaceItems();
        case 'category-snapshotpolicies':
          return await this.getSnapshotPolicyItems();
        case 'agentpolicy':
          return await this.getIntegrationPolicyItems(element.filePath as string);
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

  /** Placeholder shown in place of an artifact whose file failed to load (e.g. invalid JSON). */
  private buildErrorItem({ filePath, error }: FailedArtifact): ElasticTreeItem {
    return new ElasticTreeItem(path.basename(filePath), vscode.TreeItemCollapsibleState.None, {
      contextValue: 'load-error',
      iconPath: new vscode.ThemeIcon('error'),
      description: 'Failed to load',
      tooltip: error.message,
      filePath,
      command: {
        command: 'elasticSource.showArtifactLoadError',
        title: 'Show Load Error',
        arguments: [{ filePath, message: error.message }],
      },
    });
  }

  /** A single informational/error leaf, used where a category has nothing to show but shouldn't render empty. */
  private buildMessageItem(label: string, icon: string, tooltip?: string): ElasticTreeItem {
    return new ElasticTreeItem(label, vscode.TreeItemCollapsibleState.None, {
      contextValue: 'message',
      iconPath: new vscode.ThemeIcon(icon),
      tooltip,
    });
  }

  private async getConnectionItems(): Promise<ElasticTreeItem[]> {
    const connections = await listConnections();
    return connections.map((item) => {
      if (!isLoadedArtifact(item)) {
        return this.buildErrorItem(item);
      }
      const { filePath, data } = item;
      return new ElasticTreeItem(data.name, vscode.TreeItemCollapsibleState.Collapsed, {
        contextValue: 'connection',
        iconPath: new vscode.ThemeIcon('cloud'),
        description: data.cloudId,
        filePath,
        artifactType: 'connection',
        connectionId: data.id,
        command: {
          command: 'elasticSource.openArtifact',
          title: 'Open',
          arguments: [{ artifactType: 'connection', filePath }],
        },
      });
    });
  }

  /**
   * Shared shape behind every "live" tree node under a connection: resolve its stored API key
   * (bailing out with a message item if there isn't one), decode the connection's Cloud ID,
   * fetch `items` from the deployment, and turn each into a leaf `ElasticTreeItem` via `toItem`
   * - or a message item if the fetch itself fails. `noun` only affects wording of that message.
   */
  private async getLiveItems<T>(
    element: ElasticTreeItem,
    noun: string,
    fetchItems: (kibanaUrl: string, apiKey: string) => Promise<T[]>,
    toItem: (item: T, connectionName: string) => ElasticTreeItem
  ): Promise<ElasticTreeItem[]> {
    const connectionFilePath = element.filePath as string;
    const connectionId = element.connectionId as string;

    const apiKey = await getApiKey(this.secrets, connectionId);
    if (!apiKey) {
      return [this.buildMessageItem('No API key stored for this connection.', 'warning')];
    }

    try {
      const connection = await readJsonFile<ConnectionDefinition>(connectionFilePath);
      const { kibanaUrl } = decodeCloudId(connection.cloudId);
      const items = await fetchItems(kibanaUrl, apiKey);
      return items.map((item) => toItem(item, connection.name));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return [this.buildMessageItem(`Failed to fetch ${noun}: ${message}`, 'error', message)];
    }
  }

  private async getLiveSpaceItems(element: ElasticTreeItem): Promise<ElasticTreeItem[]> {
    return this.getLiveItems(element, 'spaces', fetchSpaces, (space, connectionName) => {
      return new ElasticTreeItem(space.name, vscode.TreeItemCollapsibleState.None, {
        contextValue: 'connection-space',
        iconPath: new vscode.ThemeIcon('symbol-namespace'),
        description: space.id,
        liveSpace: space,
        command: {
          command: 'elasticSource.openLiveSpace',
          title: 'Open',
          arguments: [{ connectionName, space }],
        },
      });
    });
  }

  private async getLiveAgentPolicyItems(element: ElasticTreeItem): Promise<ElasticTreeItem[]> {
    return this.getLiveItems(element, 'agent policies', fetchAgentPolicies, (policy, connectionName) => {
      return new ElasticTreeItem(policy.name, vscode.TreeItemCollapsibleState.None, {
        contextValue: 'connection-agentpolicy',
        iconPath: new vscode.ThemeIcon('checklist'),
        description: policy.namespace,
        liveAgentPolicy: policy,
        command: {
          command: 'elasticSource.openLiveAgentPolicy',
          title: 'Open',
          arguments: [{ connectionName, policy }],
        },
      });
    });
  }

  private async getProxyItems(): Promise<ElasticTreeItem[]> {
    const proxies = await listFleetProxies();
    return proxies.map((item) => {
      if (!isLoadedArtifact(item)) {
        return this.buildErrorItem(item);
      }
      const { filePath, data } = item;
      return new ElasticTreeItem(data.name, vscode.TreeItemCollapsibleState.None, {
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
      });
    });
  }

  private async getDownloadSourceItems(): Promise<ElasticTreeItem[]> {
    const sources = await listFleetDownloadSources();
    return sources.map((item) => {
      if (!isLoadedArtifact(item)) {
        return this.buildErrorItem(item);
      }
      const { filePath, data } = item;
      return new ElasticTreeItem(data.name, vscode.TreeItemCollapsibleState.None, {
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
      });
    });
  }

  private async getAgentPolicyItems(): Promise<ElasticTreeItem[]> {
    const policies = await listFleetAgentPolicies();
    return policies.map((item) => {
      if (!isLoadedArtifact(item)) {
        return this.buildErrorItem(item);
      }
      const { filePath, data } = item;
      return new ElasticTreeItem(data.name, vscode.TreeItemCollapsibleState.Collapsed, {
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
      });
    });
  }

  private async getIlmPolicyItems(): Promise<ElasticTreeItem[]> {
    const policies = await listIlmPolicies();
    return policies.map((item) => {
      if (!isLoadedArtifact(item)) {
        return this.buildErrorItem(item);
      }
      const { filePath, data } = item;
      return new ElasticTreeItem(data.name, vscode.TreeItemCollapsibleState.None, {
        contextValue: 'ilmpolicy',
        iconPath: new vscode.ThemeIcon('history'),
        description: Object.keys(data.policy?.phases ?? {}).join(', '),
        filePath,
        artifactType: 'ilmpolicy',
        command: {
          command: 'elasticSource.openArtifact',
          title: 'Open',
          arguments: [{ artifactType: 'ilmpolicy', filePath }],
        },
      });
    });
  }

  private async getIngestPipelineItems(): Promise<ElasticTreeItem[]> {
    const pipelines = await listIngestPipelines();
    return pipelines.map((item) => {
      if (!isLoadedArtifact(item)) {
        return this.buildErrorItem(item);
      }
      const { filePath, data } = item;
      return new ElasticTreeItem(data.name, vscode.TreeItemCollapsibleState.None, {
        contextValue: 'ingestpipeline',
        iconPath: new vscode.ThemeIcon('gear'),
        description: data.description || `${(data.processors ?? []).length} processor(s)`,
        filePath,
        artifactType: 'ingestpipeline',
        command: {
          command: 'elasticSource.openArtifact',
          title: 'Open',
          arguments: [{ artifactType: 'ingestpipeline', filePath }],
        },
      });
    });
  }

  private async getIndexTemplateItems(): Promise<ElasticTreeItem[]> {
    const templates = await listIndexTemplates();
    return templates.map((item) => {
      if (!isLoadedArtifact(item)) {
        return this.buildErrorItem(item);
      }
      const { filePath, data } = item;
      return new ElasticTreeItem(data.name, vscode.TreeItemCollapsibleState.None, {
        contextValue: 'indextemplate',
        iconPath: new vscode.ThemeIcon('layers'),
        description: (data.index_patterns ?? []).join(', '),
        filePath,
        artifactType: 'indextemplate',
        command: {
          command: 'elasticSource.openArtifact',
          title: 'Open',
          arguments: [{ artifactType: 'indextemplate', filePath }],
        },
      });
    });
  }

  private async getRoleItems(): Promise<ElasticTreeItem[]> {
    const roles = await listRoles();
    return roles.map((item) => {
      if (!isLoadedArtifact(item)) {
        return this.buildErrorItem(item);
      }
      const { filePath, data } = item;
      return new ElasticTreeItem(data.name, vscode.TreeItemCollapsibleState.None, {
        contextValue: 'role',
        iconPath: new vscode.ThemeIcon('key'),
        description: data.description || (data.cluster ?? []).join(', '),
        filePath,
        artifactType: 'role',
        command: {
          command: 'elasticSource.openArtifact',
          title: 'Open',
          arguments: [{ artifactType: 'role', filePath }],
        },
      });
    });
  }

  private async getRoleMappingItems(): Promise<ElasticTreeItem[]> {
    const roleMappings = await listRoleMappings();
    return roleMappings.map((item) => {
      if (!isLoadedArtifact(item)) {
        return this.buildErrorItem(item);
      }
      const { filePath, data } = item;
      const summary = (data.roles ?? []).join(', ') || `${(data.role_templates ?? []).length} template(s)`;
      return new ElasticTreeItem(data.name, vscode.TreeItemCollapsibleState.None, {
        contextValue: 'rolemapping',
        iconPath: new vscode.ThemeIcon('link'),
        description: data.enabled === false ? `${summary} (disabled)` : summary,
        filePath,
        artifactType: 'rolemapping',
        command: {
          command: 'elasticSource.openArtifact',
          title: 'Open',
          arguments: [{ artifactType: 'rolemapping', filePath }],
        },
      });
    });
  }

  private async getSpaceItems(): Promise<ElasticTreeItem[]> {
    const spaces = await listSpaces();
    return spaces.map((item) => {
      if (!isLoadedArtifact(item)) {
        return this.buildErrorItem(item);
      }
      const { filePath, data } = item;
      return new ElasticTreeItem(data.name, vscode.TreeItemCollapsibleState.None, {
        contextValue: 'space',
        iconPath: new vscode.ThemeIcon('symbol-namespace'),
        description: data.id,
        filePath,
        artifactType: 'space',
        command: {
          command: 'elasticSource.openArtifact',
          title: 'Open',
          arguments: [{ artifactType: 'space', filePath }],
        },
      });
    });
  }

  private async getSnapshotPolicyItems(): Promise<ElasticTreeItem[]> {
    const policies = await listSnapshotPolicies();
    return policies.map((item) => {
      if (!isLoadedArtifact(item)) {
        return this.buildErrorItem(item);
      }
      const { filePath, data } = item;
      return new ElasticTreeItem(data.policyId, vscode.TreeItemCollapsibleState.None, {
        contextValue: 'snapshotpolicy',
        iconPath: new vscode.ThemeIcon('archive'),
        description: data.schedule,
        filePath,
        artifactType: 'snapshotpolicy',
        command: {
          command: 'elasticSource.openArtifact',
          title: 'Open',
          arguments: [{ artifactType: 'snapshotpolicy', filePath }],
        },
      });
    });
  }

  private async getIntegrationPolicyItems(agentPolicyFilePath: string): Promise<ElasticTreeItem[]> {
    const integrations = await listIntegrationPolicies(agentPolicyFilePath);
    return integrations.map((item) => {
      if (!isLoadedArtifact(item)) {
        return this.buildErrorItem(item);
      }
      const { filePath, data } = item;
      return new ElasticTreeItem(data.name, vscode.TreeItemCollapsibleState.None, {
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
      });
    });
  }
}
