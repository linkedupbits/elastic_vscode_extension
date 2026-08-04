import * as fs from 'fs';
import * as path from 'path';
import { storeApiKey } from '../../src/connections/connectionManager';
import { fetchAgentPolicies, fetchSpaces } from '../../src/connections/kibanaClient';
import { generateId } from '../../src/fileSystem';
import { FleetAgentPolicy, SpaceDefinition } from '../../src/models';
import {
  saveConnection,
  saveFleetAgentPolicy,
  saveFleetDownloadSource,
  saveFleetProxy,
  saveIlmPolicy,
  saveIndexTemplate,
  saveIngestPipeline,
  saveIntegrationPolicy,
  saveRole,
  saveRoleMapping,
  saveSnapshotPolicy,
  saveSpace,
} from '../../src/repositories';
import { ElasticTreeProvider } from '../../src/treeView/elasticTreeProvider';
import { makeTempDir, removeTempDir } from '../helpers/tempDir';
import { vscodeMock } from '../helpers/vscodeMock';

jest.mock('../../src/connections/kibanaClient');
const mockFetchSpaces = fetchSpaces as jest.MockedFunction<typeof fetchSpaces>;
const mockFetchAgentPolicies = fetchAgentPolicies as jest.MockedFunction<typeof fetchAgentPolicies>;

const VALID_CLOUD_ID = `staging:${Buffer.from('us-east-1.aws.found.io$abcd1234$efgh5678', 'utf8').toString(
  'base64'
)}`;

describe('ElasticTreeProvider', () => {
  let workspaceRoot: string;
  let provider: ElasticTreeProvider;
  let secrets: InstanceType<typeof vscodeMock.MockSecretStorage>;

  beforeEach(() => {
    workspaceRoot = makeTempDir();
    vscodeMock.__setWorkspaceFolders(workspaceRoot);
    secrets = new vscodeMock.MockSecretStorage();
    provider = new ElasticTreeProvider(secrets);
    mockFetchSpaces.mockReset();
    mockFetchAgentPolicies.mockReset();
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
        'category-connections',
        'category-proxies',
        'category-downloadsources',
        'category-agentpolicies',
        'category-ilmpolicies',
        'category-ingestpipelines',
        'category-indextemplates',
        'category-roles',
        'category-rolemappings',
        'category-spaces',
        'category-snapshotpolicies',
      ]);
    });

    it('expanding a category with no workspace open shows an "open a folder" message item', async () => {
      vscodeMock.__resetWorkspace();
      const [firstCategory] = await provider.getChildren();
      const children = await provider.getChildren(firstCategory);
      expect(children).toHaveLength(1);
      expect(children[0].contextValue).toBe('message');
    });

    it('shows the top-level categories, all collapsed', async () => {
      const children = await provider.getChildren();
      expect(children.map((c) => c.contextValue)).toEqual([
        'category-connections',
        'category-proxies',
        'category-downloadsources',
        'category-agentpolicies',
        'category-ilmpolicies',
        'category-ingestpipelines',
        'category-indextemplates',
        'category-roles',
        'category-rolemappings',
        'category-spaces',
        'category-snapshotpolicies',
      ]);
      expect(children.map((c) => c.label)).toEqual([
        'Connections',
        'Fleet Proxies',
        'Fleet Download Sources',
        'Fleet Agent Policies',
        'Index Lifecycle Policies',
        'Ingest Pipelines',
        'Index Templates',
        'Roles',
        'Role Mappings',
        'Spaces',
        'Snapshot Policies',
      ]);
      // TreeItemCollapsibleState.Collapsed === 1 in both the mock and the real vscode API
      expect(children.every((c) => c.collapsibleState === 1)).toBe(true);
    });
  });

  describe('Fleet Proxies category', () => {
    it('is empty when no proxies exist', async () => {
      const children = await provider.getChildren();
      const proxiesCategory = children.find((c) => c.contextValue === 'category-proxies')!;
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

      const children = await provider.getChildren();
      const proxiesCategory = children.find((c) => c.contextValue === 'category-proxies')!;
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

  describe('Connections category and its Spaces children', () => {
    it('is empty when no connections exist', async () => {
      const children = await provider.getChildren();
      const category = children.find((c) => c.contextValue === 'category-connections')!;
      expect(await provider.getChildren(category)).toEqual([]);
    });

    it('lists saved connections as collapsible items showing the cloud id as description', async () => {
      await saveConnection(undefined, { id: 'conn-1', name: 'Staging', cloudId: VALID_CLOUD_ID });

      const children = await provider.getChildren();
      const category = children.find((c) => c.contextValue === 'category-connections')!;
      const [item] = await provider.getChildren(category);

      expect(item.label).toBe('Staging');
      expect(item.contextValue).toBe('connection');
      expect(item.artifactType).toBe('connection');
      expect(item.description).toBe(VALID_CLOUD_ID);
      // TreeItemCollapsibleState.Collapsed === 1
      expect(item.collapsibleState).toBe(1);
      const command = item.command as unknown as { command: string; arguments: unknown[] };
      expect(command.command).toBe('elasticSource.openArtifact');
      expect(command.arguments[0]).toEqual({ artifactType: 'connection', filePath: item.filePath });
    });

    it('expanding a connection shows a "Spaces" node and a "Fleet Agent Policies" node', async () => {
      await saveConnection(undefined, { id: 'conn-1', name: 'Staging', cloudId: VALID_CLOUD_ID });

      const children = await provider.getChildren();
      const category = children.find((c) => c.contextValue === 'category-connections')!;
      const [connectionItem] = await provider.getChildren(category);
      const connectionChildren = await provider.getChildren(connectionItem);

      expect(connectionChildren).toHaveLength(2);
      expect(connectionChildren.map((c) => c.contextValue)).toEqual([
        'connection-spaces',
        'connection-agentpolicies',
      ]);
      expect(connectionChildren.map((c) => c.label)).toEqual(['Spaces', 'Fleet Agent Policies']);
      expect(connectionChildren.every((c) => c.collapsibleState === 1)).toBe(true);
    });

    it('shows a message item when no api key is stored for the connection', async () => {
      await saveConnection(undefined, { id: 'conn-1', name: 'Staging', cloudId: VALID_CLOUD_ID });

      const children = await provider.getChildren();
      const category = children.find((c) => c.contextValue === 'category-connections')!;
      const [connectionItem] = await provider.getChildren(category);
      const connectionChildren = await provider.getChildren(connectionItem);
      const spacesNode = connectionChildren.find((c) => c.contextValue === 'connection-spaces')!;
      const agentPoliciesNode = connectionChildren.find((c) => c.contextValue === 'connection-agentpolicies')!;
      const spaceItems = await provider.getChildren(spacesNode);
      const agentPolicyItems = await provider.getChildren(agentPoliciesNode);

      expect(spaceItems).toHaveLength(1);
      expect(spaceItems[0].contextValue).toBe('message');
      expect(spaceItems[0].label).toBe('No API key stored for this connection.');
      expect(mockFetchSpaces).not.toHaveBeenCalled();

      expect(agentPolicyItems).toHaveLength(1);
      expect(agentPolicyItems[0].contextValue).toBe('message');
      expect(agentPolicyItems[0].label).toBe('No API key stored for this connection.');
      expect(mockFetchAgentPolicies).not.toHaveBeenCalled();
    });

    it('lists live spaces fetched from the deployment as leaves with an open command', async () => {
      await saveConnection(undefined, { id: 'conn-1', name: 'Staging', cloudId: VALID_CLOUD_ID });
      await storeApiKey(secrets, 'conn-1', 'my-api-key');
      const spaces: SpaceDefinition[] = [
        { id: 'default', name: 'Default' },
        { id: 'marketing', name: 'Marketing' },
      ];
      mockFetchSpaces.mockResolvedValue(spaces);

      const children = await provider.getChildren();
      const category = children.find((c) => c.contextValue === 'category-connections')!;
      const [connectionItem] = await provider.getChildren(category);
      const connectionChildren = await provider.getChildren(connectionItem);
      const spacesNode = connectionChildren.find((c) => c.contextValue === 'connection-spaces')!;
      const spaceItems = await provider.getChildren(spacesNode);

      expect(mockFetchSpaces).toHaveBeenCalledWith('https://efgh5678.us-east-1.aws.found.io', 'my-api-key');
      expect(spaceItems).toHaveLength(2);
      expect(spaceItems[0].label).toBe('Default');
      expect(spaceItems[0].contextValue).toBe('connection-space');
      expect(spaceItems[0].description).toBe('default');
      expect(spaceItems[0].collapsibleState).toBe(0);
      const command = spaceItems[0].command as unknown as { command: string; arguments: unknown[] };
      expect(command.command).toBe('elasticSource.openLiveSpace');
      expect(command.arguments[0]).toEqual({ connectionName: 'Staging', space: spaces[0] });
    });

    it('shows a message item with the error when the spaces fetch fails', async () => {
      await saveConnection(undefined, { id: 'conn-1', name: 'Staging', cloudId: VALID_CLOUD_ID });
      await storeApiKey(secrets, 'conn-1', 'my-api-key');
      mockFetchSpaces.mockRejectedValue(new Error('Failed to fetch spaces (401 Unauthorized).'));

      const children = await provider.getChildren();
      const category = children.find((c) => c.contextValue === 'category-connections')!;
      const [connectionItem] = await provider.getChildren(category);
      const connectionChildren = await provider.getChildren(connectionItem);
      const spacesNode = connectionChildren.find((c) => c.contextValue === 'connection-spaces')!;
      const spaceItems = await provider.getChildren(spacesNode);

      expect(spaceItems).toHaveLength(1);
      expect(spaceItems[0].contextValue).toBe('message');
      expect(spaceItems[0].label).toBe('Failed to fetch spaces: Failed to fetch spaces (401 Unauthorized).');
    });

    it('lists live agent policies fetched from the deployment as leaves with an open command', async () => {
      await saveConnection(undefined, { id: 'conn-1', name: 'Staging', cloudId: VALID_CLOUD_ID });
      await storeApiKey(secrets, 'conn-1', 'my-api-key');
      const policies: FleetAgentPolicy[] = [
        {
          id: 'policy-1',
          name: 'CMT Default',
          description: '',
          monitoring_enabled: ['logs'],
          inactivity_timeout: 1209600,
          download_source_id: '',
          schema_version: '1.1.0',
          namespace: 'default',
          advanced_settings: {},
        },
      ];
      mockFetchAgentPolicies.mockResolvedValue(policies);

      const children = await provider.getChildren();
      const category = children.find((c) => c.contextValue === 'category-connections')!;
      const [connectionItem] = await provider.getChildren(category);
      const connectionChildren = await provider.getChildren(connectionItem);
      const agentPoliciesNode = connectionChildren.find((c) => c.contextValue === 'connection-agentpolicies')!;
      const agentPolicyItems = await provider.getChildren(agentPoliciesNode);

      expect(mockFetchAgentPolicies).toHaveBeenCalledWith(
        'https://efgh5678.us-east-1.aws.found.io',
        'my-api-key'
      );
      expect(agentPolicyItems).toHaveLength(1);
      expect(agentPolicyItems[0].label).toBe('CMT Default');
      expect(agentPolicyItems[0].contextValue).toBe('connection-agentpolicy');
      expect(agentPolicyItems[0].description).toBe('default');
      expect(agentPolicyItems[0].collapsibleState).toBe(0);
      const command = agentPolicyItems[0].command as unknown as { command: string; arguments: unknown[] };
      expect(command.command).toBe('elasticSource.openLiveAgentPolicy');
      expect(command.arguments[0]).toEqual({ connectionName: 'Staging', policy: policies[0] });
    });

    it('shows a message item with the error when the agent policies fetch fails', async () => {
      await saveConnection(undefined, { id: 'conn-1', name: 'Staging', cloudId: VALID_CLOUD_ID });
      await storeApiKey(secrets, 'conn-1', 'my-api-key');
      mockFetchAgentPolicies.mockRejectedValue(new Error('Failed to fetch agent policies (403 Forbidden).'));

      const children = await provider.getChildren();
      const category = children.find((c) => c.contextValue === 'category-connections')!;
      const [connectionItem] = await provider.getChildren(category);
      const connectionChildren = await provider.getChildren(connectionItem);
      const agentPoliciesNode = connectionChildren.find((c) => c.contextValue === 'connection-agentpolicies')!;
      const agentPolicyItems = await provider.getChildren(agentPoliciesNode);

      expect(agentPolicyItems).toHaveLength(1);
      expect(agentPolicyItems[0].contextValue).toBe('message');
      expect(agentPolicyItems[0].label).toBe(
        'Failed to fetch agent policies: Failed to fetch agent policies (403 Forbidden).'
      );
    });
  });

  describe('Snapshot Policies category', () => {
    it('is empty when no snapshot policies exist', async () => {
      const children = await provider.getChildren();
      const category = children.find((c) => c.contextValue === 'category-snapshotpolicies')!;
      expect(await provider.getChildren(category)).toEqual([]);
    });

    it('shows the policy id as label and the schedule as description', async () => {
      await saveSnapshotPolicy(undefined, {
        policyId: 'daily-snapshots',
        schedule: '0 30 1 * * ?',
        name: '<daily-snap-{now/d}>',
        repository: 'my_repository',
      });

      const children = await provider.getChildren();
      const category = children.find((c) => c.contextValue === 'category-snapshotpolicies')!;
      const [item] = await provider.getChildren(category);

      expect(item.label).toBe('daily-snapshots');
      expect(item.contextValue).toBe('snapshotpolicy');
      expect(item.artifactType).toBe('snapshotpolicy');
      expect(item.description).toBe('0 30 1 * * ?');
      const command = item.command as unknown as { command: string; arguments: unknown[] };
      expect(command.command).toBe('elasticSource.openArtifact');
      expect(command.arguments[0]).toEqual({ artifactType: 'snapshotpolicy', filePath: item.filePath });
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

      const children = await provider.getChildren();
      const proxiesCategory = children.find((c) => c.contextValue === 'category-proxies')!;
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

      const children = await provider.getChildren();
      const proxiesCategory = children.find((c) => c.contextValue === 'category-proxies')!;
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
