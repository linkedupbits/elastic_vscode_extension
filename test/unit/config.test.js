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
const path = __importStar(require("path"));
const config_1 = require("../../src/config");
const vscodeMock_1 = require("../helpers/vscodeMock");
const { __resetWorkspace, __setConfigValue, __setWorkspaceFolders } = vscodeMock_1.vscodeMock;
describe('config', () => {
    afterEach(() => {
        __resetWorkspace();
    });
    describe('getElasticSourceRoot', () => {
        it('throws NoWorkspaceError when no workspace folder is open', () => {
            expect(() => (0, config_1.getElasticSourceRoot)()).toThrow(config_1.NoWorkspaceError);
        });
        it('defaults to "<workspace>/Elastic_Source" when no rootFolder setting is configured', () => {
            __setWorkspaceFolders('/ws');
            expect((0, config_1.getElasticSourceRoot)()).toBe(path.join('/ws', 'Elastic_Source'));
        });
        it('honors a custom elasticSource.rootFolder setting', () => {
            __setWorkspaceFolders('/ws');
            __setConfigValue('rootFolder', 'MyElasticProject');
            expect((0, config_1.getElasticSourceRoot)()).toBe(path.join('/ws', 'MyElasticProject'));
        });
        it('falls back to "Elastic_Source" if the setting is explicitly empty', () => {
            __setWorkspaceFolders('/ws');
            __setConfigValue('rootFolder', '');
            expect((0, config_1.getElasticSourceRoot)()).toBe(path.join('/ws', 'Elastic_Source'));
        });
    });
    describe('artifact directory helpers', () => {
        beforeEach(() => {
            __setWorkspaceFolders('/ws');
        });
        it('getFleetProxiesDir', () => {
            expect((0, config_1.getFleetProxiesDir)()).toBe(path.join('/ws', 'Elastic_Source', 'Fleet_Proxies'));
        });
        it('getFleetDownloadSourcesDir', () => {
            expect((0, config_1.getFleetDownloadSourcesDir)()).toBe(path.join('/ws', 'Elastic_Source', 'Fleet_Download_Sources'));
        });
        it('getFleetAgentPoliciesDir', () => {
            expect((0, config_1.getFleetAgentPoliciesDir)()).toBe(path.join('/ws', 'Elastic_Source', 'Fleet_Agent_Policies'));
        });
        it('each helper propagates NoWorkspaceError when the workspace closes', () => {
            __resetWorkspace();
            expect(() => (0, config_1.getFleetProxiesDir)()).toThrow(config_1.NoWorkspaceError);
            expect(() => (0, config_1.getFleetDownloadSourcesDir)()).toThrow(config_1.NoWorkspaceError);
            expect(() => (0, config_1.getFleetAgentPoliciesDir)()).toThrow(config_1.NoWorkspaceError);
        });
    });
});
//# sourceMappingURL=config.test.js.map