"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const fileSystem_1 = require("../../src/fileSystem");
const repositories_1 = require("../../src/repositories");
const tempDir_1 = require("../helpers/tempDir");
const vscodeMock_1 = require("../helpers/vscodeMock");
function proxyFixture(overrides = {}) {
    return {
        id: (0, fileSystem_1.generateId)(),
        name: 'WNP Proxy',
        url: 'http://proxy.internal.example.com:3128',
        certificate_authorities: '',
        certificates: '',
        certificate_key: '',
        is_preconfigured: false,
        ...overrides,
    };
}
function downloadSourceFixture(overrides = {}) {
    return {
        id: (0, fileSystem_1.generateId)(),
        name: 'On-Prem Download Source',
        host: 'https://artifacts.elastic.co/downloads',
        is_default: false,
        proxy_id: '',
        ...overrides,
    };
}
function agentPolicyFixture(overrides = {}) {
    return {
        id: (0, fileSystem_1.generateId)(),
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
function integrationPolicyFixture(agentPolicyId, overrides = {}) {
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
    let workspaceRoot;
    beforeEach(() => {
        workspaceRoot = (0, tempDir_1.makeTempDir)();
        vscodeMock_1.vscodeMock.__setWorkspaceFolders(workspaceRoot);
    });
    afterEach(() => {
        vscodeMock_1.vscodeMock.__resetWorkspace();
        (0, tempDir_1.removeTempDir)(workspaceRoot);
    });
    // ---------- Fleet Proxies ----------
    describe('Fleet Proxies', () => {
        it('saves a new proxy as <name>.json', async () => {
            const filePath = await (0, repositories_1.saveFleetProxy)(undefined, proxyFixture());
            expect(filePath).toBe(path.join(workspaceRoot, 'Elastic_Source', 'Fleet_Proxies', 'WNP Proxy.json'));
            expect(fs.existsSync(filePath)).toBe(true);
        });
        it('lists saved proxies sorted by name', async () => {
            await (0, repositories_1.saveFleetProxy)(undefined, proxyFixture({ name: 'Zeta Proxy' }));
            await (0, repositories_1.saveFleetProxy)(undefined, proxyFixture({ name: 'Alpha Proxy' }));
            const proxies = await (0, repositories_1.listFleetProxies)();
            expect(proxies.map((p) => p.data.name)).toEqual(['Alpha Proxy', 'Zeta Proxy']);
        });
        it('returns [] when the Fleet_Proxies folder does not exist yet', async () => {
            expect(await (0, repositories_1.listFleetProxies)()).toEqual([]);
        });
        it('getFleetProxyRefs projects to {id, name}', async () => {
            const proxy = proxyFixture();
            await (0, repositories_1.saveFleetProxy)(undefined, proxy);
            expect(await (0, repositories_1.getFleetProxyRefs)()).toEqual([{ id: proxy.id, name: proxy.name }]);
        });
        it('renames the file when an existing proxy is saved under a new name', async () => {
            const original = proxyFixture();
            const originalPath = await (0, repositories_1.saveFleetProxy)(undefined, original);
            const renamedPath = await (0, repositories_1.saveFleetProxy)(originalPath, { ...original, name: 'Renamed Proxy' });
            expect(renamedPath).toBe(path.join(workspaceRoot, 'Elastic_Source', 'Fleet_Proxies', 'Renamed Proxy.json'));
            expect(fs.existsSync(originalPath)).toBe(false);
            expect(fs.existsSync(renamedPath)).toBe(true);
        });
        it('updating a proxy without changing its name overwrites the same file (no duplicate)', async () => {
            const original = proxyFixture();
            const originalPath = await (0, repositories_1.saveFleetProxy)(undefined, original);
            const resavedPath = await (0, repositories_1.saveFleetProxy)(originalPath, { ...original, url: 'http://changed:3128' });
            expect(resavedPath).toBe(originalPath);
            expect((await (0, repositories_1.listFleetProxies)()).length).toBe(1);
        });
        it('rejects saving a proxy whose name collides with a different existing proxy', async () => {
            await (0, repositories_1.saveFleetProxy)(undefined, proxyFixture({ name: 'Taken Name' }));
            await expect((0, repositories_1.saveFleetProxy)(undefined, proxyFixture({ name: 'Taken Name' }))).rejects.toBeInstanceOf(repositories_1.ArtifactConflictError);
        });
        it('a pre-existing <id>.json file (legacy naming) is still listed correctly', async () => {
            const proxy = proxyFixture();
            const legacyPath = path.join(workspaceRoot, 'Elastic_Source', 'Fleet_Proxies', `${proxy.id}.json`);
            fs.mkdirSync(path.dirname(legacyPath), { recursive: true });
            fs.writeFileSync(legacyPath, JSON.stringify(proxy));
            const proxies = await (0, repositories_1.listFleetProxies)();
            expect(proxies).toEqual([{ filePath: legacyPath, data: proxy }]);
        });
        it('saving a legacy <id>.json proxy self-heals its filename to <name>.json', async () => {
            const proxy = proxyFixture();
            const legacyPath = path.join(workspaceRoot, 'Elastic_Source', 'Fleet_Proxies', `${proxy.id}.json`);
            fs.mkdirSync(path.dirname(legacyPath), { recursive: true });
            fs.writeFileSync(legacyPath, JSON.stringify(proxy));
            const healedPath = await (0, repositories_1.saveFleetProxy)(legacyPath, proxy);
            expect(healedPath).toBe(path.join(workspaceRoot, 'Elastic_Source', 'Fleet_Proxies', `${proxy.name}.json`));
            expect(fs.existsSync(legacyPath)).toBe(false);
        });
        it('deletes a proxy file', async () => {
            const filePath = await (0, repositories_1.saveFleetProxy)(undefined, proxyFixture());
            await (0, repositories_1.deleteFleetProxy)(filePath);
            expect(fs.existsSync(filePath)).toBe(false);
        });
    });
    // ---------- Fleet Download Sources ----------
    describe('Fleet Download Sources', () => {
        it('saves a new download source as <name>.json', async () => {
            const filePath = await (0, repositories_1.saveFleetDownloadSource)(undefined, downloadSourceFixture());
            expect(filePath).toBe(path.join(workspaceRoot, 'Elastic_Source', 'Fleet_Download_Sources', 'On-Prem Download Source.json'));
        });
        it('getFleetDownloadSourceRefs projects to {id, name}', async () => {
            const ds = downloadSourceFixture();
            await (0, repositories_1.saveFleetDownloadSource)(undefined, ds);
            expect(await (0, repositories_1.getFleetDownloadSourceRefs)()).toEqual([{ id: ds.id, name: ds.name }]);
        });
        it('renames the file when the name changes', async () => {
            const original = downloadSourceFixture();
            const originalPath = await (0, repositories_1.saveFleetDownloadSource)(undefined, original);
            const renamedPath = await (0, repositories_1.saveFleetDownloadSource)(originalPath, { ...original, name: 'Renamed DS' });
            expect(fs.existsSync(originalPath)).toBe(false);
            expect(fs.existsSync(renamedPath)).toBe(true);
        });
        it('rejects a duplicate name', async () => {
            await (0, repositories_1.saveFleetDownloadSource)(undefined, downloadSourceFixture({ name: 'Taken' }));
            await expect((0, repositories_1.saveFleetDownloadSource)(undefined, downloadSourceFixture({ name: 'Taken' }))).rejects.toBeInstanceOf(repositories_1.ArtifactConflictError);
        });
        it('deletes a download source file', async () => {
            const filePath = await (0, repositories_1.saveFleetDownloadSource)(undefined, downloadSourceFixture());
            await (0, repositories_1.deleteFleetDownloadSource)(filePath);
            expect(fs.existsSync(filePath)).toBe(false);
        });
        it('lists download sources sorted by name', async () => {
            await (0, repositories_1.saveFleetDownloadSource)(undefined, downloadSourceFixture({ name: 'Zeta DS' }));
            await (0, repositories_1.saveFleetDownloadSource)(undefined, downloadSourceFixture({ name: 'Alpha DS' }));
            const sources = await (0, repositories_1.listFleetDownloadSources)();
            expect(sources.map((s) => s.data.name)).toEqual(['Alpha DS', 'Zeta DS']);
        });
    });
    // ---------- Fleet Agent Policies ----------
    describe('Fleet Agent Policies', () => {
        it('saves a new policy at Fleet_Agent_Policies/<name>/<name>.json', async () => {
            const filePath = await (0, repositories_1.saveFleetAgentPolicy)(undefined, agentPolicyFixture());
            expect(filePath).toBe(path.join(workspaceRoot, 'Elastic_Source', 'Fleet_Agent_Policies', 'CMT Default', 'CMT Default.json'));
            expect(fs.existsSync(filePath)).toBe(true);
        });
        it('lists policies, ignoring folders that lack the expected <foldername>.json file', async () => {
            await (0, repositories_1.saveFleetAgentPolicy)(undefined, agentPolicyFixture());
            fs.mkdirSync(path.join(workspaceRoot, 'Elastic_Source', 'Fleet_Agent_Policies', 'Empty Folder'), {
                recursive: true,
            });
            const policies = await (0, repositories_1.listFleetAgentPolicies)();
            expect(policies.map((p) => p.data.name)).toEqual(['CMT Default']);
        });
        it('renames the folder and file when the policy name changes', async () => {
            const original = agentPolicyFixture();
            const originalPath = await (0, repositories_1.saveFleetAgentPolicy)(undefined, original);
            const originalFolder = path.dirname(originalPath);
            const renamedPath = await (0, repositories_1.saveFleetAgentPolicy)(originalPath, { ...original, name: 'CMT Renamed' });
            const renamedFolder = path.dirname(renamedPath);
            expect(renamedPath).toBe(path.join(renamedFolder, 'CMT Renamed.json'));
            expect(fs.existsSync(originalFolder)).toBe(false);
            expect(fs.existsSync(renamedPath)).toBe(true);
            // No stale <old-name>.json left behind inside the renamed folder.
            expect(fs.readdirSync(renamedFolder)).toEqual(['CMT Renamed.json']);
        });
        it('preserves sibling files (e.g. an Integrations folder) across a rename', async () => {
            const original = agentPolicyFixture();
            const originalPath = await (0, repositories_1.saveFleetAgentPolicy)(undefined, original);
            await (0, repositories_1.saveIntegrationPolicy)(undefined, originalPath, integrationPolicyFixture(original.id));
            const renamedPath = await (0, repositories_1.saveFleetAgentPolicy)(originalPath, { ...original, name: 'CMT Renamed' });
            const integrations = await (0, repositories_1.listIntegrationPolicies)(renamedPath);
            expect(integrations).toHaveLength(1);
            expect(integrations[0].data.name).toBe('system-cmt-default');
        });
        it('rejects creating a new policy whose name collides with an existing policy folder', async () => {
            await (0, repositories_1.saveFleetAgentPolicy)(undefined, agentPolicyFixture({ name: 'Taken' }));
            await expect((0, repositories_1.saveFleetAgentPolicy)(undefined, agentPolicyFixture({ name: 'Taken' }))).rejects.toBeInstanceOf(repositories_1.ArtifactConflictError);
        });
        it('rejects renaming a policy onto an existing policy folder name', async () => {
            await (0, repositories_1.saveFleetAgentPolicy)(undefined, agentPolicyFixture({ name: 'Existing' }));
            const other = agentPolicyFixture({ name: 'Other' });
            const otherPath = await (0, repositories_1.saveFleetAgentPolicy)(undefined, other);
            await expect((0, repositories_1.saveFleetAgentPolicy)(otherPath, { ...other, name: 'Existing' })).rejects.toBeInstanceOf(repositories_1.ArtifactConflictError);
        });
        it('updating without a name change overwrites in place', async () => {
            const original = agentPolicyFixture();
            const originalPath = await (0, repositories_1.saveFleetAgentPolicy)(undefined, original);
            const resavedPath = await (0, repositories_1.saveFleetAgentPolicy)(originalPath, { ...original, namespace: 'changed' });
            expect(resavedPath).toBe(originalPath);
            expect((await (0, repositories_1.listFleetAgentPolicies)()).length).toBe(1);
        });
        it('deletes the whole policy folder, including any Integrations subfolder', async () => {
            const policy = agentPolicyFixture();
            const filePath = await (0, repositories_1.saveFleetAgentPolicy)(undefined, policy);
            await (0, repositories_1.saveIntegrationPolicy)(undefined, filePath, integrationPolicyFixture(policy.id));
            await (0, repositories_1.deleteFleetAgentPolicy)(filePath);
            expect(fs.existsSync(path.dirname(filePath))).toBe(false);
        });
    });
    // ---------- Integration Policies ----------
    describe('Integration Policies', () => {
        let agentPolicy;
        let agentPolicyPath;
        beforeEach(async () => {
            agentPolicy = agentPolicyFixture();
            agentPolicyPath = await (0, repositories_1.saveFleetAgentPolicy)(undefined, agentPolicy);
        });
        it('saves under <Agent Policy>/Integrations/<name>.json', async () => {
            const filePath = await (0, repositories_1.saveIntegrationPolicy)(undefined, agentPolicyPath, integrationPolicyFixture(agentPolicy.id));
            expect(filePath).toBe(path.join(path.dirname(agentPolicyPath), 'Integrations', 'system-cmt-default.json'));
        });
        it('getIntegrationsDir matches the folder actually used by save/list', async () => {
            const filePath = await (0, repositories_1.saveIntegrationPolicy)(undefined, agentPolicyPath, integrationPolicyFixture(agentPolicy.id));
            expect(path.dirname(filePath)).toBe((0, repositories_1.getIntegrationsDir)(agentPolicyPath));
        });
        it('an integration may be named the same as its owning agent policy (separate folders)', async () => {
            const filePath = await (0, repositories_1.saveIntegrationPolicy)(undefined, agentPolicyPath, integrationPolicyFixture(agentPolicy.id, { name: agentPolicy.name }));
            expect(fs.existsSync(filePath)).toBe(true);
            expect(fs.existsSync(agentPolicyPath)).toBe(true);
        });
        it('lists integration policies for the given agent policy', async () => {
            await (0, repositories_1.saveIntegrationPolicy)(undefined, agentPolicyPath, integrationPolicyFixture(agentPolicy.id, { name: 'z-int' }));
            await (0, repositories_1.saveIntegrationPolicy)(undefined, agentPolicyPath, integrationPolicyFixture(agentPolicy.id, { name: 'a-int' }));
            const integrations = await (0, repositories_1.listIntegrationPolicies)(agentPolicyPath);
            expect(integrations.map((i) => i.data.name)).toEqual(['a-int', 'z-int']);
        });
        it('renames the file when the integration name changes', async () => {
            const original = integrationPolicyFixture(agentPolicy.id);
            const originalPath = await (0, repositories_1.saveIntegrationPolicy)(undefined, agentPolicyPath, original);
            const renamedPath = await (0, repositories_1.saveIntegrationPolicy)(originalPath, agentPolicyPath, {
                ...original,
                name: 'system-renamed',
            });
            expect(fs.existsSync(originalPath)).toBe(false);
            expect(fs.existsSync(renamedPath)).toBe(true);
        });
        it('rejects a duplicate integration name within the same agent policy', async () => {
            await (0, repositories_1.saveIntegrationPolicy)(undefined, agentPolicyPath, integrationPolicyFixture(agentPolicy.id, { name: 'dup' }));
            await expect((0, repositories_1.saveIntegrationPolicy)(undefined, agentPolicyPath, integrationPolicyFixture(agentPolicy.id, { name: 'dup' }))).rejects.toBeInstanceOf(repositories_1.ArtifactConflictError);
        });
        it('the same integration name is allowed under a different agent policy', async () => {
            const otherAgentPolicy = agentPolicyFixture({ name: 'Other Policy' });
            const otherAgentPolicyPath = await (0, repositories_1.saveFleetAgentPolicy)(undefined, otherAgentPolicy);
            await (0, repositories_1.saveIntegrationPolicy)(undefined, agentPolicyPath, integrationPolicyFixture(agentPolicy.id, { name: 'shared-name' }));
            await expect((0, repositories_1.saveIntegrationPolicy)(undefined, otherAgentPolicyPath, integrationPolicyFixture(otherAgentPolicy.id, { name: 'shared-name' }))).resolves.toEqual(expect.any(String));
        });
        it('deletes an integration policy file without touching the owning agent policy', async () => {
            const filePath = await (0, repositories_1.saveIntegrationPolicy)(undefined, agentPolicyPath, integrationPolicyFixture(agentPolicy.id));
            await (0, repositories_1.deleteIntegrationPolicy)(filePath);
            expect(fs.existsSync(filePath)).toBe(false);
            expect(fs.existsSync(agentPolicyPath)).toBe(true);
        });
        it('returns [] for an agent policy with no Integrations folder yet', async () => {
            expect(await (0, repositories_1.listIntegrationPolicies)(agentPolicyPath)).toEqual([]);
        });
    });
});
//# sourceMappingURL=repositories.test.js.map