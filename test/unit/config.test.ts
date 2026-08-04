import * as path from 'path';
import {
  getElasticSourceRoot,
  getFleetAgentPoliciesDir,
  getFleetDownloadSourcesDir,
  getFleetProxiesDir,
  getIndexLifecyclePoliciesDir,
  getIndexTemplatesDir,
  getIngestPipelinesDir,
  getRoleMappingsDir,
  getRolesDir,
  getSnapshotPoliciesDir,
  getSpacesDir,
  NoWorkspaceError,
} from '../../src/config';
import { vscodeMock } from '../helpers/vscodeMock';

const { __resetWorkspace, __setConfigValue, __setWorkspaceFolders } = vscodeMock;

describe('config', () => {
  afterEach(() => {
    __resetWorkspace();
  });

  describe('getElasticSourceRoot', () => {
    it('throws NoWorkspaceError when no workspace folder is open', () => {
      expect(() => getElasticSourceRoot()).toThrow(NoWorkspaceError);
    });

    it('defaults to "<workspace>/Elastic_Source" when no rootFolder setting is configured', () => {
      __setWorkspaceFolders('/ws');
      expect(getElasticSourceRoot()).toBe(path.join('/ws', 'Elastic_Source'));
    });

    it('honors a custom elasticSource.rootFolder setting', () => {
      __setWorkspaceFolders('/ws');
      __setConfigValue('rootFolder', 'MyElasticProject');
      expect(getElasticSourceRoot()).toBe(path.join('/ws', 'MyElasticProject'));
    });

    it('falls back to "Elastic_Source" if the setting is explicitly empty', () => {
      __setWorkspaceFolders('/ws');
      __setConfigValue('rootFolder', '');
      expect(getElasticSourceRoot()).toBe(path.join('/ws', 'Elastic_Source'));
    });
  });

  describe('artifact directory helpers', () => {
    beforeEach(() => {
      __setWorkspaceFolders('/ws');
    });

    it('getFleetProxiesDir', () => {
      expect(getFleetProxiesDir()).toBe(path.join('/ws', 'Elastic_Source', 'Fleet_Proxies'));
    });

    it('getFleetDownloadSourcesDir', () => {
      expect(getFleetDownloadSourcesDir()).toBe(path.join('/ws', 'Elastic_Source', 'Fleet_Download_Sources'));
    });

    it('getFleetAgentPoliciesDir', () => {
      expect(getFleetAgentPoliciesDir()).toBe(path.join('/ws', 'Elastic_Source', 'Fleet_Agent_Policies'));
    });

    it('getIndexLifecyclePoliciesDir', () => {
      expect(getIndexLifecyclePoliciesDir()).toBe(
        path.join('/ws', 'Elastic_Source', 'Index_Lifecycle_Policies')
      );
    });

    it('getIngestPipelinesDir', () => {
      expect(getIngestPipelinesDir()).toBe(path.join('/ws', 'Elastic_Source', 'Ingest_Pipelines'));
    });

    it('getIndexTemplatesDir', () => {
      expect(getIndexTemplatesDir()).toBe(path.join('/ws', 'Elastic_Source', 'Index_Templates'));
    });

    it('getRolesDir', () => {
      expect(getRolesDir()).toBe(path.join('/ws', 'Elastic_Source', 'Roles'));
    });

    it('getRoleMappingsDir', () => {
      expect(getRoleMappingsDir()).toBe(path.join('/ws', 'Elastic_Source', 'Role_Mappings'));
    });

    it('getSpacesDir', () => {
      expect(getSpacesDir()).toBe(path.join('/ws', 'Elastic_Source', 'Spaces'));
    });

    it('getSnapshotPoliciesDir', () => {
      expect(getSnapshotPoliciesDir()).toBe(path.join('/ws', 'Elastic_Source', 'SnapshotPolicies'));
    });

    it('each helper propagates NoWorkspaceError when the workspace closes', () => {
      __resetWorkspace();
      expect(() => getFleetProxiesDir()).toThrow(NoWorkspaceError);
      expect(() => getFleetDownloadSourcesDir()).toThrow(NoWorkspaceError);
      expect(() => getFleetAgentPoliciesDir()).toThrow(NoWorkspaceError);
      expect(() => getIndexLifecyclePoliciesDir()).toThrow(NoWorkspaceError);
      expect(() => getIngestPipelinesDir()).toThrow(NoWorkspaceError);
      expect(() => getIndexTemplatesDir()).toThrow(NoWorkspaceError);
      expect(() => getRolesDir()).toThrow(NoWorkspaceError);
      expect(() => getRoleMappingsDir()).toThrow(NoWorkspaceError);
      expect(() => getSpacesDir()).toThrow(NoWorkspaceError);
      expect(() => getSnapshotPoliciesDir()).toThrow(NoWorkspaceError);
    });
  });
});
