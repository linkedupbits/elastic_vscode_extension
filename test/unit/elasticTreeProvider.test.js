"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fileSystem_1 = require("../../src/fileSystem");
const repositories_1 = require("../../src/repositories");
const elasticTreeProvider_1 = require("../../src/treeView/elasticTreeProvider");
const tempDir_1 = require("../helpers/tempDir");
const vscodeMock_1 = require("../helpers/vscodeMock");
describe('ElasticTreeProvider', () => {
    let workspaceRoot;
    let provider;
    beforeEach(() => {
        workspaceRoot = (0, tempDir_1.makeTempDir)();
        vscodeMock_1.vscodeMock.__setWorkspaceFolders(workspaceRoot);
        provider = new elasticTreeProvider_1.ElasticTreeProvider();
    });
    afterEach(() => {
        vscodeMock_1.vscodeMock.__resetWorkspace();
        (0, tempDir_1.removeTempDir)(workspaceRoot);
    });
    it('getTreeItem returns the element unchanged', () => {
        const fake = { label: 'x' };
        expect(provider.getTreeItem(fake)).toBe(fake);
    });
    describe('root level', () => {
        it('shows the three top-level categories even when no workspace is open (they only fail on expand)', async () => {
            vscodeMock_1.vscodeMock.__resetWorkspace();
            const children = await provider.getChildren();
            expect(children.map((c) => c.contextValue)).toEqual([
                'category-proxies',
                'category-downloadsources',
                'category-agentpolicies',
            ]);
        });
        it('expanding a category with no workspace open shows an "open a folder" message item', async () => {
            vscodeMock_1.vscodeMock.__resetWorkspace();
            const [proxiesCategory] = await provider.getChildren();
            const children = await provider.getChildren(proxiesCategory);
            expect(children).toHaveLength(1);
            expect(children[0].contextValue).toBe('message');
        });
        it('shows the three top-level categories, all collapsed', async () => {
            const children = await provider.getChildren();
            expect(children.map((c) => c.contextValue)).toEqual([
                'category-proxies',
                'category-downloadsources',
                'category-agentpolicies',
            ]);
            expect(children.map((c) => c.label)).toEqual([
                'Fleet Proxies',
                'Fleet Download Sources',
                'Fleet Agent Policies',
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
            await (0, repositories_1.saveFleetProxy)(undefined, {
                id: (0, fileSystem_1.generateId)(),
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
            const command = proxyItem.command;
            expect(command.command).toBe('elasticSource.openArtifact');
            expect(command.arguments[0]).toEqual({ artifactType: 'proxy', filePath: proxyItem.filePath });
        });
    });
    describe('Fleet Agent Policies category and its Integration Policy children', () => {
        it('agent policy items are collapsible (so their Integrations can expand)', async () => {
            await (0, repositories_1.saveFleetAgentPolicy)(undefined, {
                id: (0, fileSystem_1.generateId)(),
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
            const agentPoliciesCategory = children.find((c) => c.contextValue === 'category-agentpolicies');
            const [policyItem] = await provider.getChildren(agentPoliciesCategory);
            expect(policyItem.label).toBe('CMT Default');
            expect(policyItem.contextValue).toBe('agentpolicy');
            // TreeItemCollapsibleState.Collapsed === 1
            expect(policyItem.collapsibleState).toBe(1);
        });
        it('expanding an agent policy item lists its integration policies', async () => {
            const agentPolicyId = (0, fileSystem_1.generateId)();
            const agentPolicyPath = await (0, repositories_1.saveFleetAgentPolicy)(undefined, {
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
            await (0, repositories_1.saveIntegrationPolicy)(undefined, agentPolicyPath, {
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
            const agentPoliciesCategory = children.find((c) => c.contextValue === 'category-agentpolicies');
            const [policyItem] = await provider.getChildren(agentPoliciesCategory);
            const integrationItems = await provider.getChildren(policyItem);
            expect(integrationItems).toHaveLength(1);
            expect(integrationItems[0].label).toBe('system-cmt-default');
            expect(integrationItems[0].contextValue).toBe('integrationpolicy');
            expect(integrationItems[0].artifactType).toBe('integrationpolicy');
            expect(integrationItems[0].description).toBe('System');
        });
        it('an agent policy with no integrations yet expands to an empty list', async () => {
            await (0, repositories_1.saveFleetAgentPolicy)(undefined, {
                id: (0, fileSystem_1.generateId)(),
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
            const agentPoliciesCategory = children.find((c) => c.contextValue === 'category-agentpolicies');
            const [policyItem] = await provider.getChildren(agentPoliciesCategory);
            expect(await provider.getChildren(policyItem)).toEqual([]);
        });
    });
    describe('an item with an unrecognized contextValue', () => {
        it('returns an empty list rather than throwing', async () => {
            const bogus = { contextValue: 'something-unexpected' };
            expect(await provider.getChildren(bogus)).toEqual([]);
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
//# sourceMappingURL=elasticTreeProvider.test.js.map