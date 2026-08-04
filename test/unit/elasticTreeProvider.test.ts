import * as fs from 'fs';
import * as path from 'path';
import { generateId } from '../../src/fileSystem';
import {
  saveFleetAgentPolicy,
  saveFleetDownloadSource,
  saveFleetProxy,
  saveIlmPolicy,
  saveIndexTemplate,
  saveIngestPipeline,
  saveIntegrationPolicy,
  saveRole,
  saveRoleMapping,
  saveSpace,
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
        'category-ingestpipelines',
        'category-indextemplates',
        'category-roles',
        'category-rolemappings',
        'category-spaces',
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
        'category-ingestpipelines',
        'category-indextemplates',
        'category-roles',
        'category-rolemappings',
        'category-spaces',
      ]);
      expect(children.map((c) => c.label)).toEqual([
        'Fleet Proxies',
        'Fleet Download Sources',
        'Fleet Agent Policies',
        'Index Lifecycle Policies',
        'Ingest Pipelines',
        'Index Templates',
        'Roles',
        'Role Mappings',
        'Spaces',
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

  describe('Ingest Pipelines category', () => {
    it('is empty when no pipelines exist', async () => {
      const children = await provider.getChildren();
      const category = children.find((c) => c.contextValue === 'category-ingestpipelines')!;
      expect(await provider.getChildren(category)).toEqual([]);
    });

    it('shows the description field as description when set', async () => {
      await saveIngestPipeline(undefined, {
        name: 'logs-emailengine_wildfly@custom',
        description: 'Adds custom fields.',
        processors: [{ set: { field: 'event.dataset', value: 'emailengine.wildfly' } }],
      });

      const children = await provider.getChildren();
      const category = children.find((c) => c.contextValue === 'category-ingestpipelines')!;
      const [item] = await provider.getChildren(category);

      expect(item.label).toBe('logs-emailengine_wildfly@custom');
      expect(item.contextValue).toBe('ingestpipeline');
      expect(item.artifactType).toBe('ingestpipeline');
      expect(item.description).toBe('Adds custom fields.');
      const command = item.command as unknown as { command: string; arguments: unknown[] };
      expect(command.command).toBe('elasticSource.openArtifact');
      expect(command.arguments[0]).toEqual({ artifactType: 'ingestpipeline', filePath: item.filePath });
    });

    it('falls back to a processor count when no description is set', async () => {
      await saveIngestPipeline(undefined, {
        name: 'no-description-pipeline',
        processors: [{ set: { field: 'a', value: '1' } }, { remove: { field: 'b' } }],
      });

      const children = await provider.getChildren();
      const category = children.find((c) => c.contextValue === 'category-ingestpipelines')!;
      const [item] = await provider.getChildren(category);

      expect(item.description).toBe('2 processor(s)');
    });

    it('treats a legacy/malformed file with no processors key as having 0 processors', async () => {
      const ingestDir = path.join(workspaceRoot, 'Elastic_Source', 'Ingest_Pipelines');
      fs.mkdirSync(ingestDir, { recursive: true });
      fs.writeFileSync(path.join(ingestDir, 'legacy-pipeline.json'), JSON.stringify({}));

      const children = await provider.getChildren();
      const category = children.find((c) => c.contextValue === 'category-ingestpipelines')!;
      const [item] = await provider.getChildren(category);

      expect(item.description).toBe('0 processor(s)');
    });
  });

  describe('Index Templates category', () => {
    it('is empty when no templates exist', async () => {
      const children = await provider.getChildren();
      const category = children.find((c) => c.contextValue === 'category-indextemplates')!;
      expect(await provider.getChildren(category)).toEqual([]);
    });

    it('shows the joined index patterns as description', async () => {
      await saveIndexTemplate(undefined, {
        name: 'logs-myapp',
        index_patterns: ['logs-myapp-*', 'logs-myapp-legacy-*'],
      });

      const children = await provider.getChildren();
      const category = children.find((c) => c.contextValue === 'category-indextemplates')!;
      const [item] = await provider.getChildren(category);

      expect(item.label).toBe('logs-myapp');
      expect(item.contextValue).toBe('indextemplate');
      expect(item.artifactType).toBe('indextemplate');
      expect(item.description).toBe('logs-myapp-*, logs-myapp-legacy-*');
      const command = item.command as unknown as { command: string; arguments: unknown[] };
      expect(command.command).toBe('elasticSource.openArtifact');
      expect(command.arguments[0]).toEqual({ artifactType: 'indextemplate', filePath: item.filePath });
    });

    it('treats a legacy/malformed file with no index_patterns key as an empty description', async () => {
      const indexTemplatesDir = path.join(workspaceRoot, 'Elastic_Source', 'Index_Templates');
      fs.mkdirSync(indexTemplatesDir, { recursive: true });
      fs.writeFileSync(path.join(indexTemplatesDir, 'legacy-template.json'), JSON.stringify({ name: 'legacy-template' }));

      const children = await provider.getChildren();
      const category = children.find((c) => c.contextValue === 'category-indextemplates')!;
      const [item] = await provider.getChildren(category);

      expect(item.description).toBe('');
    });
  });

  describe('Roles category', () => {
    it('is empty when no roles exist', async () => {
      const children = await provider.getChildren();
      const category = children.find((c) => c.contextValue === 'category-roles')!;
      expect(await provider.getChildren(category)).toEqual([]);
    });

    it('shows the description field as description when set', async () => {
      await saveRole(undefined, {
        name: 'cmt_read_only',
        description: 'Read-only access to CMT logs/metrics.',
        cluster: ['monitor'],
      });

      const children = await provider.getChildren();
      const category = children.find((c) => c.contextValue === 'category-roles')!;
      const [item] = await provider.getChildren(category);

      expect(item.label).toBe('cmt_read_only');
      expect(item.contextValue).toBe('role');
      expect(item.artifactType).toBe('role');
      expect(item.description).toBe('Read-only access to CMT logs/metrics.');
      const command = item.command as unknown as { command: string; arguments: unknown[] };
      expect(command.command).toBe('elasticSource.openArtifact');
      expect(command.arguments[0]).toEqual({ artifactType: 'role', filePath: item.filePath });
    });

    it('falls back to the joined cluster privileges when no description is set', async () => {
      await saveRole(undefined, { name: 'cmt_monitor', cluster: ['monitor', 'manage_own_api_key'] });

      const children = await provider.getChildren();
      const category = children.find((c) => c.contextValue === 'category-roles')!;
      const [item] = await provider.getChildren(category);

      expect(item.description).toBe('monitor, manage_own_api_key');
    });

    it('treats a legacy/malformed file with no cluster key as an empty description', async () => {
      const rolesDir = path.join(workspaceRoot, 'Elastic_Source', 'Roles');
      fs.mkdirSync(rolesDir, { recursive: true });
      fs.writeFileSync(path.join(rolesDir, 'legacy-role.json'), JSON.stringify({ 'legacy-role': {} }));

      const children = await provider.getChildren();
      const category = children.find((c) => c.contextValue === 'category-roles')!;
      const [item] = await provider.getChildren(category);

      expect(item.description).toBe('');
    });
  });

  describe('Role Mappings category', () => {
    it('is empty when no role mappings exist', async () => {
      const children = await provider.getChildren();
      const category = children.find((c) => c.contextValue === 'category-rolemappings')!;
      expect(await provider.getChildren(category)).toEqual([]);
    });

    it('shows the joined roles as description', async () => {
      await saveRoleMapping(undefined, {
        name: 'cmt_ldap_admins',
        roles: ['cmt_read_only', 'cmt_write'],
        rules: { field: { username: '*' } },
      });

      const children = await provider.getChildren();
      const category = children.find((c) => c.contextValue === 'category-rolemappings')!;
      const [item] = await provider.getChildren(category);

      expect(item.label).toBe('cmt_ldap_admins');
      expect(item.contextValue).toBe('rolemapping');
      expect(item.artifactType).toBe('rolemapping');
      expect(item.description).toBe('cmt_read_only, cmt_write');
      const command = item.command as unknown as { command: string; arguments: unknown[] };
      expect(command.command).toBe('elasticSource.openArtifact');
      expect(command.arguments[0]).toEqual({ artifactType: 'rolemapping', filePath: item.filePath });
    });

    it('falls back to a role_templates count when no roles are set', async () => {
      await saveRoleMapping(undefined, {
        name: 'cmt_templated',
        role_templates: [{ template: { source: '{{username}}' } }],
        rules: { field: { username: '*' } },
      });

      const children = await provider.getChildren();
      const category = children.find((c) => c.contextValue === 'category-rolemappings')!;
      const [item] = await provider.getChildren(category);

      expect(item.description).toBe('1 template(s)');
    });

    it('appends "(disabled)" when enabled is explicitly false', async () => {
      await saveRoleMapping(undefined, {
        name: 'cmt_disabled',
        enabled: false,
        roles: ['cmt_read_only'],
        rules: { field: { username: '*' } },
      });

      const children = await provider.getChildren();
      const category = children.find((c) => c.contextValue === 'category-rolemappings')!;
      const [item] = await provider.getChildren(category);

      expect(item.description).toBe('cmt_read_only (disabled)');
    });

    it('treats a legacy/malformed file with no roles/role_templates key as an empty-count description', async () => {
      const roleMappingsDir = path.join(workspaceRoot, 'Elastic_Source', 'Role_Mappings');
      fs.mkdirSync(roleMappingsDir, { recursive: true });
      fs.writeFileSync(path.join(roleMappingsDir, 'legacy-mapping.json'), JSON.stringify({ 'legacy-mapping': {} }));

      const children = await provider.getChildren();
      const category = children.find((c) => c.contextValue === 'category-rolemappings')!;
      const [item] = await provider.getChildren(category);

      expect(item.description).toBe('0 template(s)');
    });
  });

  describe('Spaces category', () => {
    it('is empty when no spaces exist', async () => {
      const children = await provider.getChildren();
      const category = children.find((c) => c.contextValue === 'category-spaces')!;
      expect(await provider.getChildren(category)).toEqual([]);
    });

    it('shows the space id as description', async () => {
      await saveSpace(undefined, { id: 'marketing', name: 'Marketing' });

      const children = await provider.getChildren();
      const category = children.find((c) => c.contextValue === 'category-spaces')!;
      const [item] = await provider.getChildren(category);

      expect(item.label).toBe('Marketing');
      expect(item.contextValue).toBe('space');
      expect(item.artifactType).toBe('space');
      expect(item.description).toBe('marketing');
      const command = item.command as unknown as { command: string; arguments: unknown[] };
      expect(command.command).toBe('elasticSource.openArtifact');
      expect(command.arguments[0]).toEqual({ artifactType: 'space', filePath: item.filePath });
    });
  });

  describe('an item with an unrecognized contextValue', () => {
    it('returns an empty list rather than throwing', async () => {
      const bogus = { contextValue: 'something-unexpected' } as never;
      expect(await provider.getChildren(bogus)).toEqual([]);
    });
  });

  describe('a file that fails to load', () => {
    it('is shown as an error placeholder instead of failing the whole list', async () => {
      // A corrupt json file makes readJsonFile throw a SyntaxError.
      const proxiesDir = path.join(workspaceRoot, 'Elastic_Source', 'Fleet_Proxies');
      fs.mkdirSync(proxiesDir, { recursive: true });
      fs.writeFileSync(path.join(proxiesDir, 'corrupt.json'), '{ not valid json');
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
      const items = await provider.getChildren(proxiesCategory);

      expect(items.map((i) => i.contextValue)).toEqual(expect.arrayContaining(['proxy', 'load-error']));
      const errorItem = items.find((i) => i.contextValue === 'load-error')!;
      expect(errorItem.label).toBe('corrupt.json');
      expect((errorItem.iconPath as { id: string }).id).toBe('error');
    });

    it('shows a minimal error message when the placeholder is selected', async () => {
      const proxiesDir = path.join(workspaceRoot, 'Elastic_Source', 'Fleet_Proxies');
      fs.mkdirSync(proxiesDir, { recursive: true });
      fs.writeFileSync(path.join(proxiesDir, 'corrupt.json'), '{ not valid json');

      const [proxiesCategory] = await provider.getChildren();
      const [errorItem] = await provider.getChildren(proxiesCategory);

      const command = errorItem.command as unknown as { command: string; arguments: unknown[] };
      expect(command.command).toBe('elasticSource.showArtifactLoadError');
      expect(command.arguments[0]).toEqual({
        filePath: path.join(proxiesDir, 'corrupt.json'),
        message: expect.any(String),
      });
    });

    it('also flags a syntactically-valid json Role file whose value is not a JSON object', async () => {
      const rolesDir = path.join(workspaceRoot, 'Elastic_Source', 'Roles');
      fs.mkdirSync(rolesDir, { recursive: true });
      fs.writeFileSync(path.join(rolesDir, 'errorRole.json'), JSON.stringify({ BadlyFormatted: 'Json' }));

      const children = await provider.getChildren();
      const rolesCategory = children.find((c) => c.contextValue === 'category-roles')!;
      const [item] = await provider.getChildren(rolesCategory);

      expect(item.contextValue).toBe('load-error');
      expect(item.tooltip).toMatch(/must be a JSON object/);
    });

    it('also flags a Role file with no root key (name)', async () => {
      const rolesDir = path.join(workspaceRoot, 'Elastic_Source', 'Roles');
      fs.mkdirSync(rolesDir, { recursive: true });
      fs.writeFileSync(path.join(rolesDir, 'empty.json'), JSON.stringify({}));

      const children = await provider.getChildren();
      const rolesCategory = children.find((c) => c.contextValue === 'category-roles')!;
      const [item] = await provider.getChildren(rolesCategory);

      expect(item.contextValue).toBe('load-error');
      expect(item.tooltip).toMatch(/exactly one root key/);
    });

    it('also flags a Role Mapping file whose value is not a JSON object', async () => {
      const roleMappingsDir = path.join(workspaceRoot, 'Elastic_Source', 'Role_Mappings');
      fs.mkdirSync(roleMappingsDir, { recursive: true });
      fs.writeFileSync(path.join(roleMappingsDir, 'errorfile.json'), JSON.stringify({ BadlyFormatted: 'Json' }));

      const children = await provider.getChildren();
      const category = children.find((c) => c.contextValue === 'category-rolemappings')!;
      const [item] = await provider.getChildren(category);

      expect(item.contextValue).toBe('load-error');
      expect(item.tooltip).toMatch(/must be a JSON object/);
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
