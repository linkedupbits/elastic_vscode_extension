import * as fs from 'fs';
import * as path from 'path';
import { generateId } from '../../src/fileSystem';
import {
  FleetAgentPolicy,
  FleetDownloadSource,
  FleetProxy,
  IlmPolicyDefinition,
  IndexTemplateDefinition,
  IngestPipelineDefinition,
  IntegrationPolicy,
  RoleDefinition,
  RoleMappingDefinition,
} from '../../src/models';
import {
  ArtifactConflictError,
  deleteFleetAgentPolicy,
  deleteFleetDownloadSource,
  deleteFleetProxy,
  deleteIlmPolicy,
  deleteIndexTemplate,
  deleteIngestPipeline,
  deleteIntegrationPolicy,
  deleteRole,
  deleteRoleMapping,
  getFleetDownloadSourceRefs,
  getFleetProxyRefs,
  getIntegrationsDir,
  listFleetAgentPolicies,
  listFleetDownloadSources,
  listFleetProxies,
  listIlmPolicies,
  listIndexTemplates,
  listIngestPipelines,
  listIntegrationPolicies,
  listRoleMappings,
  listRoles,
  saveFleetAgentPolicy,
  saveFleetDownloadSource,
  saveFleetProxy,
  saveIlmPolicy,
  saveIndexTemplate,
  saveIngestPipeline,
  saveIntegrationPolicy,
  saveRole,
  saveRoleMapping,
} from '../../src/repositories';
import { makeTempDir, removeTempDir } from '../helpers/tempDir';
import { vscodeMock } from '../helpers/vscodeMock';

function proxyFixture(overrides: Partial<FleetProxy> = {}): FleetProxy {
  return {
    id: generateId(),
    name: 'WNP Proxy',
    url: 'http://proxy.internal.example.com:3128',
    certificate_authorities: '',
    certificates: '',
    certificate_key: '',
    is_preconfigured: false,
    ...overrides,
  };
}

function downloadSourceFixture(overrides: Partial<FleetDownloadSource> = {}): FleetDownloadSource {
  return {
    id: generateId(),
    name: 'On-Prem Download Source',
    host: 'https://artifacts.elastic.co/downloads',
    is_default: false,
    proxy_id: '',
    ...overrides,
  };
}

function agentPolicyFixture(overrides: Partial<FleetAgentPolicy> = {}): FleetAgentPolicy {
  return {
    id: generateId(),
    name: 'CMT Default',
    description: 'Default Agent Policy for CMT servers',
    monitoring_enabled: ['logs', 'metrics'],
    inactivity_timeout: 1209600,
    download_source_id: '',
    schema_version: '1.1.0',
    namespace: 'default',
    advanced_settings: {},
    ...overrides,
  };
}

function ilmPolicyFixture(overrides: Partial<IlmPolicyDefinition> = {}): IlmPolicyDefinition {
  return {
    name: 'logs-default-policy',
    policy: {
      phases: {
        hot: { min_age: '0ms', actions: { rollover: { max_primary_shard_size: '50gb', max_age: '30d' } } },
        delete: { min_age: '90d', actions: { delete: {} } },
      },
    },
    integration_lifecycle_mappings: [],
    ...overrides,
  };
}

function ingestPipelineFixture(overrides: Partial<IngestPipelineDefinition> = {}): IngestPipelineDefinition {
  return {
    name: 'logs-emailengine_wildfly@custom',
    processors: [{ set: { field: 'event.dataset', value: 'emailengine.wildfly' } }],
    ...overrides,
  };
}

function indexTemplateFixture(overrides: Partial<IndexTemplateDefinition> = {}): IndexTemplateDefinition {
  return {
    name: 'logs-myapp',
    index_patterns: ['logs-myapp-*'],
    ...overrides,
  };
}

function roleFixture(overrides: Partial<RoleDefinition> = {}): RoleDefinition {
  return {
    name: 'cmt_read_only',
    cluster: ['monitor'],
    ...overrides,
  };
}

function roleMappingFixture(overrides: Partial<RoleMappingDefinition> = {}): RoleMappingDefinition {
  return {
    name: 'cmt_ldap_admins',
    roles: ['cmt_read_only'],
    rules: { field: { username: '*' } },
    ...overrides,
  };
}

function integrationPolicyFixture(agentPolicyId: string, overrides: Partial<IntegrationPolicy> = {}): IntegrationPolicy {
  return {
    name: 'system-cmt-default',
    namespace: '',
    description: '',
    package: { name: 'system', title: 'System', version: '2.22.1', requires_root: true },
    policy_id: agentPolicyId,
    policy_ids: [agentPolicyId],
    inputs: {},
    output_id: null,
    vars: {},
    ...overrides,
  };
}

describe('repositories', () => {
  let workspaceRoot: string;

  beforeEach(() => {
    workspaceRoot = makeTempDir();
    vscodeMock.__setWorkspaceFolders(workspaceRoot);
  });

  afterEach(() => {
    vscodeMock.__resetWorkspace();
    removeTempDir(workspaceRoot);
  });

  // ---------- Fleet Proxies ----------

  describe('Fleet Proxies', () => {
    it('saves a new proxy as <name>.json', async () => {
      const filePath = await saveFleetProxy(undefined, proxyFixture());
      expect(filePath).toBe(path.join(workspaceRoot, 'Elastic_Source', 'Fleet_Proxies', 'WNP Proxy.json'));
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('lists saved proxies sorted by name', async () => {
      await saveFleetProxy(undefined, proxyFixture({ name: 'Zeta Proxy' }));
      await saveFleetProxy(undefined, proxyFixture({ name: 'Alpha Proxy' }));

      const proxies = await listFleetProxies();
      expect(proxies.map((p) => p.data.name)).toEqual(['Alpha Proxy', 'Zeta Proxy']);
    });

    it('returns [] when the Fleet_Proxies folder does not exist yet', async () => {
      expect(await listFleetProxies()).toEqual([]);
    });

    it('getFleetProxyRefs projects to {id, name}', async () => {
      const proxy = proxyFixture();
      await saveFleetProxy(undefined, proxy);
      expect(await getFleetProxyRefs()).toEqual([{ id: proxy.id, name: proxy.name }]);
    });

    it('renames the file when an existing proxy is saved under a new name', async () => {
      const original = proxyFixture();
      const originalPath = await saveFleetProxy(undefined, original);

      const renamedPath = await saveFleetProxy(originalPath, { ...original, name: 'Renamed Proxy' });

      expect(renamedPath).toBe(path.join(workspaceRoot, 'Elastic_Source', 'Fleet_Proxies', 'Renamed Proxy.json'));
      expect(fs.existsSync(originalPath)).toBe(false);
      expect(fs.existsSync(renamedPath)).toBe(true);
    });

    it('updating a proxy without changing its name overwrites the same file (no duplicate)', async () => {
      const original = proxyFixture();
      const originalPath = await saveFleetProxy(undefined, original);

      const resavedPath = await saveFleetProxy(originalPath, { ...original, url: 'http://changed:3128' });

      expect(resavedPath).toBe(originalPath);
      expect((await listFleetProxies()).length).toBe(1);
    });

    it('rejects saving a proxy whose name collides with a different existing proxy', async () => {
      await saveFleetProxy(undefined, proxyFixture({ name: 'Taken Name' }));

      await expect(saveFleetProxy(undefined, proxyFixture({ name: 'Taken Name' }))).rejects.toBeInstanceOf(
        ArtifactConflictError
      );
    });

    it('a pre-existing <id>.json file (legacy naming) is still listed correctly', async () => {
      const proxy = proxyFixture();
      const legacyPath = path.join(workspaceRoot, 'Elastic_Source', 'Fleet_Proxies', `${proxy.id}.json`);
      fs.mkdirSync(path.dirname(legacyPath), { recursive: true });
      fs.writeFileSync(legacyPath, JSON.stringify(proxy));

      const proxies = await listFleetProxies();
      expect(proxies).toEqual([{ filePath: legacyPath, data: proxy }]);
    });

    it('saving a legacy <id>.json proxy self-heals its filename to <name>.json', async () => {
      const proxy = proxyFixture();
      const legacyPath = path.join(workspaceRoot, 'Elastic_Source', 'Fleet_Proxies', `${proxy.id}.json`);
      fs.mkdirSync(path.dirname(legacyPath), { recursive: true });
      fs.writeFileSync(legacyPath, JSON.stringify(proxy));

      const healedPath = await saveFleetProxy(legacyPath, proxy);

      expect(healedPath).toBe(path.join(workspaceRoot, 'Elastic_Source', 'Fleet_Proxies', `${proxy.name}.json`));
      expect(fs.existsSync(legacyPath)).toBe(false);
    });

    it('deletes a proxy file', async () => {
      const filePath = await saveFleetProxy(undefined, proxyFixture());
      await deleteFleetProxy(filePath);
      expect(fs.existsSync(filePath)).toBe(false);
    });
  });

  // ---------- Fleet Download Sources ----------

  describe('Fleet Download Sources', () => {
    it('saves a new download source as <name>.json', async () => {
      const filePath = await saveFleetDownloadSource(undefined, downloadSourceFixture());
      expect(filePath).toBe(
        path.join(workspaceRoot, 'Elastic_Source', 'Fleet_Download_Sources', 'On-Prem Download Source.json')
      );
    });

    it('getFleetDownloadSourceRefs projects to {id, name}', async () => {
      const ds = downloadSourceFixture();
      await saveFleetDownloadSource(undefined, ds);
      expect(await getFleetDownloadSourceRefs()).toEqual([{ id: ds.id, name: ds.name }]);
    });

    it('renames the file when the name changes', async () => {
      const original = downloadSourceFixture();
      const originalPath = await saveFleetDownloadSource(undefined, original);

      const renamedPath = await saveFleetDownloadSource(originalPath, { ...original, name: 'Renamed DS' });

      expect(fs.existsSync(originalPath)).toBe(false);
      expect(fs.existsSync(renamedPath)).toBe(true);
    });

    it('rejects a duplicate name', async () => {
      await saveFleetDownloadSource(undefined, downloadSourceFixture({ name: 'Taken' }));
      await expect(
        saveFleetDownloadSource(undefined, downloadSourceFixture({ name: 'Taken' }))
      ).rejects.toBeInstanceOf(ArtifactConflictError);
    });

    it('deletes a download source file', async () => {
      const filePath = await saveFleetDownloadSource(undefined, downloadSourceFixture());
      await deleteFleetDownloadSource(filePath);
      expect(fs.existsSync(filePath)).toBe(false);
    });

    it('lists download sources sorted by name', async () => {
      await saveFleetDownloadSource(undefined, downloadSourceFixture({ name: 'Zeta DS' }));
      await saveFleetDownloadSource(undefined, downloadSourceFixture({ name: 'Alpha DS' }));
      const sources = await listFleetDownloadSources();
      expect(sources.map((s) => s.data.name)).toEqual(['Alpha DS', 'Zeta DS']);
    });
  });

  // ---------- Fleet Agent Policies ----------

  describe('Fleet Agent Policies', () => {
    it('saves a new policy at Fleet_Agent_Policies/<name>/<name>.json', async () => {
      const filePath = await saveFleetAgentPolicy(undefined, agentPolicyFixture());
      expect(filePath).toBe(
        path.join(workspaceRoot, 'Elastic_Source', 'Fleet_Agent_Policies', 'CMT Default', 'CMT Default.json')
      );
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('lists agent policies sorted by name', async () => {
      await saveFleetAgentPolicy(undefined, agentPolicyFixture({ id: generateId(), name: 'Zeta Policy' }));
      await saveFleetAgentPolicy(undefined, agentPolicyFixture({ id: generateId(), name: 'Alpha Policy' }));

      const policies = await listFleetAgentPolicies();
      expect(policies.map((p) => p.data.name)).toEqual(['Alpha Policy', 'Zeta Policy']);
    });

    it('lists policies, ignoring folders that lack the expected <foldername>.json file', async () => {
      await saveFleetAgentPolicy(undefined, agentPolicyFixture());
      fs.mkdirSync(path.join(workspaceRoot, 'Elastic_Source', 'Fleet_Agent_Policies', 'Empty Folder'), {
        recursive: true,
      });

      const policies = await listFleetAgentPolicies();
      expect(policies.map((p) => p.data.name)).toEqual(['CMT Default']);
    });

    it('renames the folder and file when the policy name changes', async () => {
      const original = agentPolicyFixture();
      const originalPath = await saveFleetAgentPolicy(undefined, original);
      const originalFolder = path.dirname(originalPath);

      const renamedPath = await saveFleetAgentPolicy(originalPath, { ...original, name: 'CMT Renamed' });
      const renamedFolder = path.dirname(renamedPath);

      expect(renamedPath).toBe(path.join(renamedFolder, 'CMT Renamed.json'));
      expect(fs.existsSync(originalFolder)).toBe(false);
      expect(fs.existsSync(renamedPath)).toBe(true);
      // No stale <old-name>.json left behind inside the renamed folder.
      expect(fs.readdirSync(renamedFolder)).toEqual(['CMT Renamed.json']);
    });

    it('does not delete anything extra when the passed-in existingFilePath already matches the new name', async () => {
      // Simulates a stray/mismatched existingFilePath whose basename already equals
      // `${data.name}.json` even though it lived in the old (pre-rename) folder - the
      // staleFile-vs-targetFile guard should skip deletion instead of removing the file
      // that's about to be (re)written as the actual save target.
      const original = agentPolicyFixture();
      const originalPath = await saveFleetAgentPolicy(undefined, original);
      const originalFolder = path.dirname(originalPath);
      const strayPath = path.join(originalFolder, 'CMT Renamed.json');
      fs.writeFileSync(strayPath, JSON.stringify(original));

      const renamedPath = await saveFleetAgentPolicy(strayPath, { ...original, name: 'CMT Renamed' });

      expect(fs.existsSync(renamedPath)).toBe(true);
      expect(JSON.parse(fs.readFileSync(renamedPath, 'utf8')).name).toBe('CMT Renamed');
    });

    it('preserves sibling files (e.g. an Integrations folder) across a rename', async () => {
      const original = agentPolicyFixture();
      const originalPath = await saveFleetAgentPolicy(undefined, original);
      await saveIntegrationPolicy(undefined, originalPath, integrationPolicyFixture(original.id));

      const renamedPath = await saveFleetAgentPolicy(originalPath, { ...original, name: 'CMT Renamed' });

      const integrations = await listIntegrationPolicies(renamedPath);
      expect(integrations).toHaveLength(1);
      expect(integrations[0].data.name).toBe('system-cmt-default');
    });

    it('rejects creating a new policy whose name collides with an existing policy folder', async () => {
      await saveFleetAgentPolicy(undefined, agentPolicyFixture({ name: 'Taken' }));
      await expect(saveFleetAgentPolicy(undefined, agentPolicyFixture({ name: 'Taken' }))).rejects.toBeInstanceOf(
        ArtifactConflictError
      );
    });

    it('rejects renaming a policy onto an existing policy folder name', async () => {
      await saveFleetAgentPolicy(undefined, agentPolicyFixture({ name: 'Existing' }));
      const other = agentPolicyFixture({ name: 'Other' });
      const otherPath = await saveFleetAgentPolicy(undefined, other);

      await expect(saveFleetAgentPolicy(otherPath, { ...other, name: 'Existing' })).rejects.toBeInstanceOf(
        ArtifactConflictError
      );
    });

    it('updating without a name change overwrites in place', async () => {
      const original = agentPolicyFixture();
      const originalPath = await saveFleetAgentPolicy(undefined, original);
      const resavedPath = await saveFleetAgentPolicy(originalPath, { ...original, namespace: 'changed' });
      expect(resavedPath).toBe(originalPath);
      expect((await listFleetAgentPolicies()).length).toBe(1);
    });

    it('deletes the whole policy folder, including any Integrations subfolder', async () => {
      const policy = agentPolicyFixture();
      const filePath = await saveFleetAgentPolicy(undefined, policy);
      await saveIntegrationPolicy(undefined, filePath, integrationPolicyFixture(policy.id));

      await deleteFleetAgentPolicy(filePath);

      expect(fs.existsSync(path.dirname(filePath))).toBe(false);
    });
  });

  // ---------- Integration Policies ----------

  describe('Integration Policies', () => {
    let agentPolicy: FleetAgentPolicy;
    let agentPolicyPath: string;

    beforeEach(async () => {
      agentPolicy = agentPolicyFixture();
      agentPolicyPath = await saveFleetAgentPolicy(undefined, agentPolicy);
    });

    it('saves under <Agent Policy>/Integrations/<name>.json', async () => {
      const filePath = await saveIntegrationPolicy(undefined, agentPolicyPath, integrationPolicyFixture(agentPolicy.id));
      expect(filePath).toBe(
        path.join(path.dirname(agentPolicyPath), 'Integrations', 'system-cmt-default.json')
      );
    });

    it('getIntegrationsDir matches the folder actually used by save/list', async () => {
      const filePath = await saveIntegrationPolicy(undefined, agentPolicyPath, integrationPolicyFixture(agentPolicy.id));
      expect(path.dirname(filePath)).toBe(getIntegrationsDir(agentPolicyPath));
    });

    it('an integration may be named the same as its owning agent policy (separate folders)', async () => {
      const filePath = await saveIntegrationPolicy(
        undefined,
        agentPolicyPath,
        integrationPolicyFixture(agentPolicy.id, { name: agentPolicy.name })
      );
      expect(fs.existsSync(filePath)).toBe(true);
      expect(fs.existsSync(agentPolicyPath)).toBe(true);
    });

    it('lists integration policies for the given agent policy', async () => {
      await saveIntegrationPolicy(undefined, agentPolicyPath, integrationPolicyFixture(agentPolicy.id, { name: 'z-int' }));
      await saveIntegrationPolicy(undefined, agentPolicyPath, integrationPolicyFixture(agentPolicy.id, { name: 'a-int' }));

      const integrations = await listIntegrationPolicies(agentPolicyPath);
      expect(integrations.map((i) => i.data.name)).toEqual(['a-int', 'z-int']);
    });

    it('renames the file when the integration name changes', async () => {
      const original = integrationPolicyFixture(agentPolicy.id);
      const originalPath = await saveIntegrationPolicy(undefined, agentPolicyPath, original);

      const renamedPath = await saveIntegrationPolicy(originalPath, agentPolicyPath, {
        ...original,
        name: 'system-renamed',
      });

      expect(fs.existsSync(originalPath)).toBe(false);
      expect(fs.existsSync(renamedPath)).toBe(true);
    });

    it('rejects a duplicate integration name within the same agent policy', async () => {
      await saveIntegrationPolicy(undefined, agentPolicyPath, integrationPolicyFixture(agentPolicy.id, { name: 'dup' }));
      await expect(
        saveIntegrationPolicy(undefined, agentPolicyPath, integrationPolicyFixture(agentPolicy.id, { name: 'dup' }))
      ).rejects.toBeInstanceOf(ArtifactConflictError);
    });

    it('the same integration name is allowed under a different agent policy', async () => {
      const otherAgentPolicy = agentPolicyFixture({ name: 'Other Policy' });
      const otherAgentPolicyPath = await saveFleetAgentPolicy(undefined, otherAgentPolicy);

      await saveIntegrationPolicy(undefined, agentPolicyPath, integrationPolicyFixture(agentPolicy.id, { name: 'shared-name' }));
      await expect(
        saveIntegrationPolicy(undefined, otherAgentPolicyPath, integrationPolicyFixture(otherAgentPolicy.id, { name: 'shared-name' }))
      ).resolves.toEqual(expect.any(String));
    });

    it('deletes an integration policy file without touching the owning agent policy', async () => {
      const filePath = await saveIntegrationPolicy(undefined, agentPolicyPath, integrationPolicyFixture(agentPolicy.id));
      await deleteIntegrationPolicy(filePath);
      expect(fs.existsSync(filePath)).toBe(false);
      expect(fs.existsSync(agentPolicyPath)).toBe(true);
    });

    it('returns [] for an agent policy with no Integrations folder yet', async () => {
      expect(await listIntegrationPolicies(agentPolicyPath)).toEqual([]);
    });
  });

  // ---------- Index Lifecycle Policies ----------

  describe('Index Lifecycle Policies', () => {
    it('saves a new policy as <name>.json', async () => {
      const filePath = await saveIlmPolicy(undefined, ilmPolicyFixture());
      expect(filePath).toBe(
        path.join(workspaceRoot, 'Elastic_Source', 'Index_Lifecycle_Policies', 'logs-default-policy.json')
      );
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('lists saved policies sorted by name', async () => {
      await saveIlmPolicy(undefined, ilmPolicyFixture({ name: 'zeta-policy' }));
      await saveIlmPolicy(undefined, ilmPolicyFixture({ name: 'alpha-policy' }));

      const policies = await listIlmPolicies();
      expect(policies.map((p) => p.data.name)).toEqual(['alpha-policy', 'zeta-policy']);
    });

    it('returns [] when the Index_Lifecycle_Policies folder does not exist yet', async () => {
      expect(await listIlmPolicies()).toEqual([]);
    });

    it('renames the file when an existing policy is saved under a new name', async () => {
      const original = ilmPolicyFixture();
      const originalPath = await saveIlmPolicy(undefined, original);

      const renamedPath = await saveIlmPolicy(originalPath, { ...original, name: 'renamed-policy' });

      expect(renamedPath).toBe(
        path.join(workspaceRoot, 'Elastic_Source', 'Index_Lifecycle_Policies', 'renamed-policy.json')
      );
      expect(fs.existsSync(originalPath)).toBe(false);
      expect(fs.existsSync(renamedPath)).toBe(true);
    });

    it('updating a policy without changing its name overwrites the same file (no duplicate)', async () => {
      const original = ilmPolicyFixture();
      const originalPath = await saveIlmPolicy(undefined, original);

      const resavedPath = await saveIlmPolicy(originalPath, {
        ...original,
        policy: { phases: { delete: { min_age: '30d', actions: { delete: {} } } } },
      });

      expect(resavedPath).toBe(originalPath);
      expect((await listIlmPolicies()).length).toBe(1);
    });

    it('rejects saving a policy whose name collides with a different existing policy', async () => {
      await saveIlmPolicy(undefined, ilmPolicyFixture({ name: 'taken-name' }));

      await expect(saveIlmPolicy(undefined, ilmPolicyFixture({ name: 'taken-name' }))).rejects.toBeInstanceOf(
        ArtifactConflictError
      );
    });

    it('persists an optional policy._meta object', async () => {
      const withMeta = ilmPolicyFixture({ policy: { phases: { delete: { actions: { delete: {} } } }, _meta: { owner: 'platform-team' } } });
      const filePath = await saveIlmPolicy(undefined, withMeta);

      const [saved] = await listIlmPolicies();
      expect(saved.filePath).toBe(filePath);
      expect(saved.data.policy._meta).toEqual({ owner: 'platform-team' });
    });

    it('deletes a policy file', async () => {
      const filePath = await saveIlmPolicy(undefined, ilmPolicyFixture());
      await deleteIlmPolicy(filePath);
      expect(fs.existsSync(filePath)).toBe(false);
    });
  });

  // ---------- Ingest Pipelines ----------

  describe('Ingest Pipelines', () => {
    it('saves a new pipeline as <name>.json', async () => {
      const filePath = await saveIngestPipeline(undefined, ingestPipelineFixture());
      expect(filePath).toBe(
        path.join(
          workspaceRoot,
          'Elastic_Source',
          'Ingest_Pipelines',
          'logs-emailengine_wildfly@custom.json'
        )
      );
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('lists saved pipelines sorted by name', async () => {
      await saveIngestPipeline(undefined, ingestPipelineFixture({ name: 'zeta-pipeline' }));
      await saveIngestPipeline(undefined, ingestPipelineFixture({ name: 'alpha-pipeline' }));

      const pipelines = await listIngestPipelines();
      expect(pipelines.map((p) => p.data.name)).toEqual(['alpha-pipeline', 'zeta-pipeline']);
    });

    it('returns [] when the Ingest_Pipelines folder does not exist yet', async () => {
      expect(await listIngestPipelines()).toEqual([]);
    });

    it('renames the file when an existing pipeline is saved under a new name', async () => {
      const original = ingestPipelineFixture();
      const originalPath = await saveIngestPipeline(undefined, original);

      const renamedPath = await saveIngestPipeline(originalPath, { ...original, name: 'renamed-pipeline' });

      expect(renamedPath).toBe(
        path.join(workspaceRoot, 'Elastic_Source', 'Ingest_Pipelines', 'renamed-pipeline.json')
      );
      expect(fs.existsSync(originalPath)).toBe(false);
      expect(fs.existsSync(renamedPath)).toBe(true);
    });

    it('updating a pipeline without changing its name overwrites the same file (no duplicate)', async () => {
      const original = ingestPipelineFixture();
      const originalPath = await saveIngestPipeline(undefined, original);

      const resavedPath = await saveIngestPipeline(originalPath, {
        ...original,
        processors: [{ remove: { field: 'unwanted' } }],
      });

      expect(resavedPath).toBe(originalPath);
      expect((await listIngestPipelines()).length).toBe(1);
    });

    it('rejects saving a pipeline whose name collides with a different existing pipeline', async () => {
      await saveIngestPipeline(undefined, ingestPipelineFixture({ name: 'taken-name' }));

      await expect(
        saveIngestPipeline(undefined, ingestPipelineFixture({ name: 'taken-name' }))
      ).rejects.toBeInstanceOf(ArtifactConflictError);
    });

    it('persists optional description/version/_meta/deprecated fields', async () => {
      const full = ingestPipelineFixture({
        description: 'Adds a few custom fields.',
        version: 3,
        _meta: { managed_by: 'cmt' },
        deprecated: true,
        on_failure: [{ set: { field: 'error.message', value: '{{ _ingest.on_failure_message }}' } }],
      });
      const filePath = await saveIngestPipeline(undefined, full);

      const [saved] = await listIngestPipelines();
      expect(saved.filePath).toBe(filePath);
      expect(saved.data).toEqual(full);
    });

    it('deletes a pipeline file', async () => {
      const filePath = await saveIngestPipeline(undefined, ingestPipelineFixture());
      await deleteIngestPipeline(filePath);
      expect(fs.existsSync(filePath)).toBe(false);
    });
  });

  // ---------- Index Templates ----------

  describe('Index Templates', () => {
    it('saves a new template as <name>.json', async () => {
      const filePath = await saveIndexTemplate(undefined, indexTemplateFixture());
      expect(filePath).toBe(
        path.join(workspaceRoot, 'Elastic_Source', 'Index_Templates', 'logs-myapp.json')
      );
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('lists saved templates sorted by name', async () => {
      await saveIndexTemplate(undefined, indexTemplateFixture({ name: 'zeta-template' }));
      await saveIndexTemplate(undefined, indexTemplateFixture({ name: 'alpha-template' }));

      const templates = await listIndexTemplates();
      expect(templates.map((t) => t.data.name)).toEqual(['alpha-template', 'zeta-template']);
    });

    it('returns [] when the Index_Templates folder does not exist yet', async () => {
      expect(await listIndexTemplates()).toEqual([]);
    });

    it('renames the file when an existing template is saved under a new name', async () => {
      const original = indexTemplateFixture();
      const originalPath = await saveIndexTemplate(undefined, original);

      const renamedPath = await saveIndexTemplate(originalPath, { ...original, name: 'renamed-template' });

      expect(renamedPath).toBe(
        path.join(workspaceRoot, 'Elastic_Source', 'Index_Templates', 'renamed-template.json')
      );
      expect(fs.existsSync(originalPath)).toBe(false);
      expect(fs.existsSync(renamedPath)).toBe(true);
    });

    it('updating a template without changing its name overwrites the same file (no duplicate)', async () => {
      const original = indexTemplateFixture();
      const originalPath = await saveIndexTemplate(undefined, original);

      const resavedPath = await saveIndexTemplate(originalPath, {
        ...original,
        priority: 200,
      });

      expect(resavedPath).toBe(originalPath);
      expect((await listIndexTemplates()).length).toBe(1);
    });

    it('rejects saving a template whose name collides with a different existing template', async () => {
      await saveIndexTemplate(undefined, indexTemplateFixture({ name: 'taken-name' }));

      await expect(
        saveIndexTemplate(undefined, indexTemplateFixture({ name: 'taken-name' }))
      ).rejects.toBeInstanceOf(ArtifactConflictError);
    });

    it('persists optional composed_of/priority/version/_meta/template/data_stream/allow_auto_create/ignore_missing_component_templates/deprecated fields', async () => {
      const full = indexTemplateFixture({
        composed_of: ['logs-mappings', 'logs-settings'],
        priority: 200,
        version: 3,
        _meta: { managed_by: 'cmt' },
        template: {
          settings: { number_of_shards: 1 },
          mappings: { properties: { message: { type: 'text' } } },
          aliases: { 'logs-myapp-alias': {} },
        },
        data_stream: { hidden: true, allow_custom_routing: true },
        allow_auto_create: true,
        ignore_missing_component_templates: ['maybe-missing'],
        deprecated: true,
      });
      const filePath = await saveIndexTemplate(undefined, full);

      const [saved] = await listIndexTemplates();
      expect(saved.filePath).toBe(filePath);
      expect(saved.data).toEqual(full);
    });

    it('deletes a template file', async () => {
      const filePath = await saveIndexTemplate(undefined, indexTemplateFixture());
      await deleteIndexTemplate(filePath);
      expect(fs.existsSync(filePath)).toBe(false);
    });
  });

  // ---------- Roles ----------

  describe('Roles', () => {
    it('saves a new role as <name>.json', async () => {
      const filePath = await saveRole(undefined, roleFixture());
      expect(filePath).toBe(path.join(workspaceRoot, 'Elastic_Source', 'Roles', 'cmt_read_only.json'));
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('lists saved roles sorted by name', async () => {
      await saveRole(undefined, roleFixture({ name: 'zeta-role' }));
      await saveRole(undefined, roleFixture({ name: 'alpha-role' }));

      const roles = await listRoles();
      expect(roles.map((r) => r.data.name)).toEqual(['alpha-role', 'zeta-role']);
    });

    it('returns [] when the Roles folder does not exist yet', async () => {
      expect(await listRoles()).toEqual([]);
    });

    it('renames the file when an existing role is saved under a new name', async () => {
      const original = roleFixture();
      const originalPath = await saveRole(undefined, original);

      const renamedPath = await saveRole(originalPath, { ...original, name: 'renamed-role' });

      expect(renamedPath).toBe(path.join(workspaceRoot, 'Elastic_Source', 'Roles', 'renamed-role.json'));
      expect(fs.existsSync(originalPath)).toBe(false);
      expect(fs.existsSync(renamedPath)).toBe(true);
    });

    it('updating a role without changing its name overwrites the same file (no duplicate)', async () => {
      const original = roleFixture();
      const originalPath = await saveRole(undefined, original);

      const resavedPath = await saveRole(originalPath, { ...original, description: 'Updated' });

      expect(resavedPath).toBe(originalPath);
      expect((await listRoles()).length).toBe(1);
    });

    it('rejects saving a role whose name collides with a different existing role', async () => {
      await saveRole(undefined, roleFixture({ name: 'taken-name' }));

      await expect(saveRole(undefined, roleFixture({ name: 'taken-name' }))).rejects.toBeInstanceOf(ArtifactConflictError);
    });

    it('persists optional description/indices/remote_indices/applications/remote_cluster/run_as/metadata/global fields', async () => {
      const full = roleFixture({
        description: 'Read-only access to CMT logs/metrics.',
        indices: [
          {
            names: ['logs-cmt-*'],
            privileges: ['read'],
            field_security: { grant: ['*'], except: ['secret'] },
            query: '{"match_all": {}}',
            allow_restricted_indices: true,
          },
        ],
        remote_indices: [{ clusters: ['cluster-a'], names: ['logs-*'], privileges: ['read'] }],
        applications: [{ application: 'kibana-.kibana', privileges: ['read'], resources: ['*'] }],
        remote_cluster: [{ clusters: ['cluster-a'], privileges: ['monitor_enrich'] }],
        run_as: ['cmt_service_account'],
        metadata: { managed_by: 'cmt' },
        global: { application: { manage: { applications: ['kibana-*'] } } },
      });
      const filePath = await saveRole(undefined, full);

      const [saved] = await listRoles();
      expect(saved.filePath).toBe(filePath);
      expect(saved.data).toEqual(full);
    });

    it('deletes a role file', async () => {
      const filePath = await saveRole(undefined, roleFixture());
      await deleteRole(filePath);
      expect(fs.existsSync(filePath)).toBe(false);
    });
  });

  // ---------- Role Mappings ----------

  describe('Role Mappings', () => {
    it('saves a new role mapping as <name>.json', async () => {
      const filePath = await saveRoleMapping(undefined, roleMappingFixture());
      expect(filePath).toBe(path.join(workspaceRoot, 'Elastic_Source', 'Role_Mappings', 'cmt_ldap_admins.json'));
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('lists saved role mappings sorted by name', async () => {
      await saveRoleMapping(undefined, roleMappingFixture({ name: 'zeta-mapping' }));
      await saveRoleMapping(undefined, roleMappingFixture({ name: 'alpha-mapping' }));

      const mappings = await listRoleMappings();
      expect(mappings.map((m) => m.data.name)).toEqual(['alpha-mapping', 'zeta-mapping']);
    });

    it('returns [] when the Role_Mappings folder does not exist yet', async () => {
      expect(await listRoleMappings()).toEqual([]);
    });

    it('renames the file when an existing role mapping is saved under a new name', async () => {
      const original = roleMappingFixture();
      const originalPath = await saveRoleMapping(undefined, original);

      const renamedPath = await saveRoleMapping(originalPath, { ...original, name: 'renamed-mapping' });

      expect(renamedPath).toBe(path.join(workspaceRoot, 'Elastic_Source', 'Role_Mappings', 'renamed-mapping.json'));
      expect(fs.existsSync(originalPath)).toBe(false);
      expect(fs.existsSync(renamedPath)).toBe(true);
    });

    it('updating a role mapping without changing its name overwrites the same file (no duplicate)', async () => {
      const original = roleMappingFixture();
      const originalPath = await saveRoleMapping(undefined, original);

      const resavedPath = await saveRoleMapping(originalPath, { ...original, enabled: false });

      expect(resavedPath).toBe(originalPath);
      expect((await listRoleMappings()).length).toBe(1);
    });

    it('rejects saving a role mapping whose name collides with a different existing role mapping', async () => {
      await saveRoleMapping(undefined, roleMappingFixture({ name: 'taken-name' }));

      await expect(saveRoleMapping(undefined, roleMappingFixture({ name: 'taken-name' }))).rejects.toBeInstanceOf(
        ArtifactConflictError
      );
    });

    it('persists optional enabled/role_templates/metadata fields', async () => {
      const full = roleMappingFixture({
        enabled: false,
        role_templates: [{ template: { source: '{{username}}' }, format: 'string' }],
        metadata: { managed_by: 'cmt' },
      });
      const filePath = await saveRoleMapping(undefined, full);

      const [saved] = await listRoleMappings();
      expect(saved.filePath).toBe(filePath);
      expect(saved.data).toEqual(full);
    });

    it('deletes a role mapping file', async () => {
      const filePath = await saveRoleMapping(undefined, roleMappingFixture());
      await deleteRoleMapping(filePath);
      expect(fs.existsSync(filePath)).toBe(false);
    });
  });
});
