import * as vscode from 'vscode';
import { NoWorkspaceError } from '../config';
import {
  listFleetAgentPolicies,
  listFleetDownloadSources,
  listFleetProxies,
  listIlmPolicies,
  listIndexTemplates,
  listIngestPipelines,
  listIntegrationPolicies,
  listRoleMappings,
  listRoles,
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

  private async getIlmPolicyItems(): Promise<ElasticTreeItem[]> {
    const policies = await listIlmPolicies();
    return policies.map(
      ({ filePath, data }) =>
        new ElasticTreeItem(data.name, vscode.TreeItemCollapsibleState.None, {
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
        })
    );
  }

  private async getIngestPipelineItems(): Promise<ElasticTreeItem[]> {
    const pipelines = await listIngestPipelines();
    return pipelines.map(
      ({ filePath, data }) =>
        new ElasticTreeItem(data.name, vscode.TreeItemCollapsibleState.None, {
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
        })
    );
  }

  private async getIndexTemplateItems(): Promise<ElasticTreeItem[]> {
    const templates = await listIndexTemplates();
    return templates.map(
      ({ filePath, data }) =>
        new ElasticTreeItem(data.name, vscode.TreeItemCollapsibleState.None, {
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
        })
    );
  }

  private async getRoleItems(): Promise<ElasticTreeItem[]> {
    const roles = await listRoles();
    return roles.map(
      ({ filePath, data }) =>
        new ElasticTreeItem(data.name, vscode.TreeItemCollapsibleState.None, {
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
        })
    );
  }

  private async getRoleMappingItems(): Promise<ElasticTreeItem[]> {
    const roleMappings = await listRoleMappings();
    return roleMappings.map(({ filePath, data }) => {
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
