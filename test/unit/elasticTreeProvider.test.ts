import * as fs from 'fs';
import * as path from 'path';
import { generateId } from '../../src/fileSystem';
import {
  saveFleetAgentPolicy,
  saveFleetDownloadSource,
  saveFleetProxy,
  saveIlmPolicy,
  saveIntegrationPolicy,
} from '../../src/repositories';
import { ElasticTreeProvider } from '../../src/treeView/elasticTreeProvider';
import { makeTempDir, removeTempDir } from '../helpers/tempDir';
import { vscodeMock } from '../helpers/vscodeMock';

describe('ElasticTreeProvider', () => {
  let workspaceRoot: string;
  let provider: ElasticTreeProvider;

  beforeEach(() => {
    workspaceRoot = makeTempDir();
    vscodeMock.__setWorkspaceFolders(workspaceRoot);
    provider = new ElasticTreeProvider();
  });

  afterEach(() => {
    vscodeMock.__resetWorkspace();
    removeTempDir(workspaceRoot);
  });

  it('getTreeItem returns the element unchanged', () => {
    const fake = { label: 'x' } as never;
    expect(provider.getTreeItem(fake)).toBe(fake);
  });

  describe('root level', () => {
    it('shows the top-level categories even when no workspace is open (they only fail on expand)', async () => {
      vscodeMock.__resetWorkspace();
      const children = await provider.getChildren();
      expect(children.map((c) => c.contextValue)).toEqual([
        'category-proxies',
        'category-downloadsources',
        'category-agentpolicies',
        'category-ilmpolicies',
      ]);
    });

    it('expanding a category with no workspace open shows an "open a folder" message item', async () => {
      vscodeMock.__resetWorkspace();
      const [proxiesCategory] = await provider.getChildren();
      const children = await provider.getChildren(proxiesCategory);
      expect(children).toHaveLength(1);
      expect(children[0].contextValue).toBe('message');
    });

    it('shows the top-level categories, all collapsed', async () => {
      const children = await provider.getChildren();
      expect(children.map((c) => c.contextValue)).toEqual([
        'category-proxies',
        'category-downloadsources',
        'category-agentpolicies',
        'category-ilmpolicies',
      ]);
      expect(children.map((c) => c.label)).toEqual([
        'Fleet Proxies',
        'Fleet Download Sources',
        'Fleet Agent Policies',
        'Index Lifecycle Policies',
      ]);
      // TreeItemCollapsibleState.Collapsed === 1 in both the mock and the real vscode API
      expect(children.every((c) => c.collapsibleState === 1)).toBe(true);
    });
  });

  describe('Fleet Proxies category', () => {
    it('is empty when no proxies exist', async () => {
      const [proxiesCategory] = await provider.getChildren();
      expect(await provider.getChildren(proxiesCategory)).toEqual([]);
    });

    it('lists saved proxies as leaf items with an open command', async () => {
      await saveFleetProxy(undefined, {
        id: generateId(),
        name: 'WNP Proxy',
        url: 'http://proxy.internal:3128',
        certificate_authorities: '',
        certificates: '',
        certificate_key: '',
        is_preconfigured: false,
      });

      const [proxiesCategory] = await provider.getChildren();
      const [proxyItem] = await provider.getChildren(proxiesCategory);

      expect(proxyItem.label).toBe('WNP Proxy');
      expect(proxyItem.contextValue).toBe('proxy');
      expect(proxyItem.artifactType).toBe('proxy');
      expect(proxyItem.description).toBe('http://proxy.internal:3128');
      const command = proxyItem.command as unknown as { command: string; arguments: unknown[] };
      expect(command.command).toBe('elasticSource.openArtifact');
      expect(command.arguments[0]).toEqual({ artifactType: 'proxy', filePath: proxyItem.filePath });
    });
  });

  describe('Fleet Download Sources category', () => {
    it('shows the host as description for a non-default source', async () => {
      await saveFleetDownloadSource(undefined, {
        id: generateId(),
        name: 'On-Prem Download Source',
        host: 'https://artifacts.elastic.co/downloads',
        is_default: false,
        proxy_id: '',
      });

      const children = await provider.getChildren();
      const downloadSourcesCategory = children.find((c) => c.contextValue === 'category-downloadsources')!;
      const [item] = await provider.getChildren(downloadSourcesCategory);

      expect(item.label).toBe('On-Prem Download Source');
      expect(item.contextValue).toBe('downloadsource');
      expect(item.artifactType).toBe('downloadsource');
      expect(item.description).toBe('https://artifacts.elastic.co/downloads');
    });

    it('shows "default" as description for the default download source', async () => {
      await saveFleetDownloadSource(undefined, {
        id: generateId(),
        name: 'Default Source',
        host: 'https://artifacts.elastic.co/downloads',
        is_default: true,
        proxy_id: '',
      });

      const children = await provider.getChildren();
      const downloadSourcesCategory = children.find((c) => c.contextValue === 'category-downloadsources')!;
      const [item] = await provider.getChildren(downloadSourcesCategory);

      expect(item.description).toBe('default');
    });
  });

  describe('Fleet Agent Policies category and its Integration Policy children', () => {
    it('agent policy items are collapsible (so their Integrations can expand)', async () => {
      await saveFleetAgentPolicy(undefined, {
        id: generateId(),
        name: 'CMT Default',
        description: '',
        monitoring_enabled: [],
        inactivity_timeout: 0,
        download_source_id: '',
        schema_version: '1.0.0',
        namespace: 'default',
        advanced_settings: {},
      });

      const children = await provider.getChildren();
      const agentPoliciesCategory = children.find((c) => c.contextValue === 'category-agentpolicies')!;
      const [policyItem] = await provider.getChildren(agentPoliciesCategory);

      expect(policyItem.label).toBe('CMT Default');
      expect(policyItem.contextValue).toBe('agentpolicy');
      // TreeItemCollapsibleState.Collapsed === 1
      expect(policyItem.collapsibleState).toBe(1);
    });

    it('expanding an agent policy item lists its integration policies', async () => {
      const agentPolicyId = generateId();
      const agentPolicyPath = await saveFleetAgentPolicy(undefined, {
        id: agentPolicyId,
        name: 'CMT Default',
        description: '',
        monitoring_enabled: [],
        inactivity_timeout: 0,
        download_source_id: '',
        schema_version: '1.0.0',
        namespace: 'default',
        advanced_settings: {},
      });
      await saveIntegrationPolicy(undefined, agentPolicyPath, {
        name: 'system-cmt-default',
        namespace: '',
        description: '',
        package: { name: 'system', title: 'System', version: '2.22.1', requires_root: true },
        policy_id: agentPolicyId,
        policy_ids: [agentPolicyId],
        inputs: {},
        output_id: null,
        vars: {},
      });

      const children = await provider.getChildren();
      const agentPoliciesCategory = children.find((c) => c.contextValue === 'category-agentpolicies')!;
      const [policyItem] = await provider.getChildren(agentPoliciesCategory);
      const integrationItems = await provider.getChildren(policyItem);

      expect(integrationItems).toHaveLength(1);
      expect(integrationItems[0].label).toBe('system-cmt-default');
      expect(integrationItems[0].contextValue).toBe('integrationpolicy');
      expect(integrationItems[0].artifactType).toBe('integrationpolicy');
      expect(integrationItems[0].description).toBe('System');
    });

    it('an agent policy with no integrations yet expands to an empty list', async () => {
      await saveFleetAgentPolicy(undefined, {
        id: generateId(),
        name: 'Empty Policy',
        description: '',
        monitoring_enabled: [],
        inactivity_timeout: 0,
        download_source_id: '',
        schema_version: '1.0.0',
        namespace: 'default',
        advanced_settings: {},
      });

      const children = await provider.getChildren();
      const agentPoliciesCategory = children.find((c) => c.contextValue === 'category-agentpolicies')!;
      const [policyItem] = await provider.getChildren(agentPoliciesCategory);

      expect(await provider.getChildren(policyItem)).toEqual([]);
    });
  });

  describe('Index Lifecycle Policies category', () => {
    it('is empty when no policies exist', async () => {
      const children = await provider.getChildren();
      const ilmCategory = children.find((c) => c.contextValue === 'category-ilmpolicies')!;
      expect(await provider.getChildren(ilmCategory)).toEqual([]);
    });

    it('lists saved policies as leaf items describing their phases', async () => {
      await saveIlmPolicy(undefined, {
        name: 'logs-default-policy',
        policy: {
          phases: {
            hot: { min_age: '0ms', actions: { rollover: { max_primary_shard_size: '50gb' } } },
            delete: { min_age: '90d', actions: { delete: {} } },
          },
        },
        integration_lifecycle_mappings: [],
      });

      const children = await provider.getChildren();
      const ilmCategory = children.find((c) => c.contextValue === 'category-ilmpolicies')!;
      const [item] = await provider.getChildren(ilmCategory);

      expect(item.label).toBe('logs-default-policy');
      expect(item.contextValue).toBe('ilmpolicy');
      expect(item.artifactType).toBe('ilmpolicy');
      expect(item.description).toBe('hot, delete');
      const command = item.command as unknown as { command: string; arguments: unknown[] };
      expect(command.command).toBe('elasticSource.openArtifact');
      expect(command.arguments[0]).toEqual({ artifactType: 'ilmpolicy', filePath: item.filePath });
    });

    it('falls back to an empty description for a legacy/malformed file with no policy.phases', async () => {
      const ilmDir = path.join(workspaceRoot, 'Elastic_Source', 'Index_Lifecycle_Policies');
      fs.mkdirSync(ilmDir, { recursive: true });
      fs.writeFileSync(path.join(ilmDir, 'legacy-policy.json'), JSON.stringify({ name: 'legacy-policy' }));

      const children = await provider.getChildren();
      const ilmCategory = children.find((c) => c.contextValue === 'category-ilmpolicies')!;
      const [item] = await provider.getChildren(ilmCategory);

      expect(item.description).toBe('');
    });
  });

  describe('an item with an unrecognized contextValue', () => {
    it('returns an empty list rather than throwing', async () => {
      const bogus = { contextValue: 'something-unexpected' } as never;
      expect(await provider.getChildren(bogus)).toEqual([]);
    });
  });

  describe('errors other than NoWorkspaceError', () => {
    it('propagate instead of being swallowed as the "open a folder" message', async () => {
      // A corrupt json file makes readJsonFile throw a SyntaxError, not NoWorkspaceError.
      const proxiesDir = path.join(workspaceRoot, 'Elastic_Source', 'Fleet_Proxies');
      fs.mkdirSync(proxiesDir, { recursive: true });
      fs.writeFileSync(path.join(proxiesDir, 'corrupt.json'), '{ not valid json');

      const [proxiesCategory] = await provider.getChildren();
      await expect(provider.getChildren(proxiesCategory)).rejects.toBeInstanceOf(SyntaxError);
    });
  });

  describe('refresh', () => {
    it('fires onDidChangeTreeData', () => {
      const listener = jest.fn();
      provider.onDidChangeTreeData(listener);
      provider.refresh();
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });
});
