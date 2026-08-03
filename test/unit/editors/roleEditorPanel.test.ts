import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { RoleEditorPanel } from '../../../src/editors/roleEditorPanel';
import { RoleDefinition } from '../../../src/models';
import {
  ApplicationPrivilegeFormValue,
  buildDefaultApplicationPrivilegeValue,
  buildDefaultIndexPrivilegeValue,
  buildDefaultRemoteClusterPrivilegeValue,
  buildDefaultRemoteIndexPrivilegeValue,
  IndexPrivilegeFormValue,
  RemoteClusterPrivilegeFormValue,
  RemoteIndexPrivilegeFormValue,
} from '../../../src/roles/rolePrivilegeTemplates';
import { saveRole } from '../../../src/repositories';
import { makeTempDir, removeTempDir } from '../../helpers/tempDir';
import { vscodeMock } from '../../helpers/vscodeMock';
import { lastPanel, sendReady, sendSave } from '../../helpers/webviewPanel';

const extensionUri = vscode.Uri.file('/ext');

function indexPrivilege(overrides: Partial<IndexPrivilegeFormValue> = {}): IndexPrivilegeFormValue {
  return { ...buildDefaultIndexPrivilegeValue(), ...overrides };
}

function remoteIndexPrivilege(overrides: Partial<RemoteIndexPrivilegeFormValue> = {}): RemoteIndexPrivilegeFormValue {
  return { ...buildDefaultRemoteIndexPrivilegeValue(), ...overrides };
}

function applicationPrivilege(overrides: Partial<ApplicationPrivilegeFormValue> = {}): ApplicationPrivilegeFormValue {
  return { ...buildDefaultApplicationPrivilegeValue(), ...overrides };
}

function remoteClusterPrivilege(overrides: Partial<RemoteClusterPrivilegeFormValue> = {}): RemoteClusterPrivilegeFormValue {
  return { ...buildDefaultRemoteClusterPrivilegeValue(), ...overrides };
}

describe('RoleEditorPanel', () => {
  let workspaceRoot: string;

  beforeEach(() => {
    workspaceRoot = makeTempDir();
    vscodeMock.__setWorkspaceFolders(workspaceRoot);
    vscodeMock.__resetWebviewPanels();
  });

  afterEach(() => {
    vscodeMock.__resetWorkspace();
    removeTempDir(workspaceRoot);
  });

  it('a new panel starts with empty/default values', async () => {
    RoleEditorPanel.openNew(extensionUri, () => undefined);
    const payload = (await sendReady()) as {
      isNew: boolean;
      item: {
        name: string;
        description: string;
        cluster: string[];
        runAs: string[];
        indices: unknown[];
        remoteIndices: unknown[];
        applications: unknown[];
        remoteCluster: unknown[];
        metadata: string;
        global: string;
      };
    };

    expect(payload.isNew).toBe(true);
    expect(payload.item).toEqual({
      name: '',
      description: '',
      cluster: [],
      runAs: [],
      indices: [],
      remoteIndices: [],
      applications: [],
      remoteCluster: [],
      metadata: '',
      global: '',
    });
  });

  it('an existing panel parses a minimal saved role from disk', async () => {
    const saved: RoleDefinition = { name: 'cmt_read_only', cluster: ['monitor'] };
    const filePath = await saveRole(undefined, saved);

    RoleEditorPanel.openExisting(extensionUri, () => undefined, filePath);
    const payload = (await sendReady()) as {
      isNew: boolean;
      item: {
        name: string;
        description: string;
        cluster: string[];
        indices: unknown[];
        metadata: string;
        global: string;
      };
    };

    expect(payload.isNew).toBe(false);
    expect(payload.item.name).toBe('cmt_read_only');
    expect(payload.item.description).toBe('');
    expect(payload.item.cluster).toEqual(['monitor']);
    expect(payload.item.indices).toEqual([]);
    expect(payload.item.metadata).toBe('');
    expect(payload.item.global).toBe('');
  });

  it('an existing panel parses a fully populated saved role from disk', async () => {
    const saved: RoleDefinition = {
      name: 'cmt_read_only',
      description: 'Read-only access to CMT logs/metrics.',
      cluster: ['monitor'],
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
    };
    const filePath = await saveRole(undefined, saved);

    RoleEditorPanel.openExisting(extensionUri, () => undefined, filePath);
    const payload = (await sendReady()) as {
      item: {
        description: string;
        cluster: string[];
        runAs: string[];
        indices: IndexPrivilegeFormValue[];
        remoteIndices: RemoteIndexPrivilegeFormValue[];
        applications: ApplicationPrivilegeFormValue[];
        remoteCluster: RemoteClusterPrivilegeFormValue[];
        metadata: string;
        global: string;
      };
    };

    expect(payload.item.description).toBe('Read-only access to CMT logs/metrics.');
    expect(payload.item.cluster).toEqual(['monitor']);
    expect(payload.item.runAs).toEqual(['cmt_service_account']);
    expect(payload.item.indices).toEqual([
      indexPrivilege({
        names: ['logs-cmt-*'],
        privileges: ['read'],
        fieldSecurityGrant: ['*'],
        fieldSecurityExcept: ['secret'],
        query: '{"match_all": {}}',
        allowRestrictedIndices: true,
      }),
    ]);
    expect(payload.item.remoteIndices).toEqual([
      remoteIndexPrivilege({ clusters: ['cluster-a'], names: ['logs-*'], privileges: ['read'] }),
    ]);
    expect(payload.item.applications).toEqual([
      applicationPrivilege({ application: 'kibana-.kibana', privileges: ['read'], resources: ['*'] }),
    ]);
    expect(payload.item.remoteCluster).toEqual([
      remoteClusterPrivilege({ clusters: ['cluster-a'], privileges: ['monitor_enrich'] }),
    ]);
    expect(JSON.parse(payload.item.metadata)).toEqual({ managed_by: 'cmt' });
    expect(JSON.parse(payload.item.global)).toEqual({ application: { manage: { applications: ['kibana-*'] } } });
  });

  it('an existing panel with no cluster/run_as keys (legacy/malformed file) sends empty arrays', async () => {
    const filePath = await saveRole(undefined, { name: 'legacy-role' });

    RoleEditorPanel.openExisting(extensionUri, () => undefined, filePath);
    const payload = (await sendReady()) as { item: { cluster: string[]; runAs: string[] } };

    expect(payload.item.cluster).toEqual([]);
    expect(payload.item.runAs).toEqual([]);
  });

  it('opening the same filePath twice reveals the existing panel instead of creating a second one', async () => {
    const filePath = await saveRole(undefined, { name: 'cmt_read_only' });

    RoleEditorPanel.openExisting(extensionUri, () => undefined, filePath);
    const firstPanel = lastPanel();

    RoleEditorPanel.openExisting(extensionUri, () => undefined, filePath);

    expect(firstPanel.revealCount).toBe(1);
    expect(lastPanel()).toBe(firstPanel);
  });

  it('saves a minimal role, omitting every unset optional field', async () => {
    RoleEditorPanel.openNew(extensionUri, () => undefined);

    const message = await sendSave({
      name: 'cmt_read_only',
      description: '',
      cluster: [],
      runAs: [],
      indices: [],
      remoteIndices: [],
      applications: [],
      remoteCluster: [],
      metadata: '',
      global: '',
    });

    expect(message.type).toBe('saved');
    expect(message.payload).toEqual({ name: 'cmt_read_only' });
  });

  it('saves a fully populated role', async () => {
    RoleEditorPanel.openNew(extensionUri, () => undefined);

    const message = await sendSave({
      name: 'cmt_read_only',
      description: 'Read-only access to CMT logs/metrics.',
      cluster: ['monitor'],
      runAs: ['cmt_service_account'],
      indices: [
        indexPrivilege({
          names: ['logs-cmt-*'],
          privileges: ['read'],
          fieldSecurityGrant: ['*'],
          fieldSecurityExcept: ['secret'],
          query: '{"match_all": {}}',
          allowRestrictedIndices: true,
        }),
      ],
      remoteIndices: [remoteIndexPrivilege({ clusters: ['cluster-a'], names: ['logs-*'], privileges: ['read'] })],
      applications: [applicationPrivilege({ application: 'kibana-.kibana', privileges: ['read'], resources: ['*'] })],
      remoteCluster: [remoteClusterPrivilege({ clusters: ['cluster-a'], privileges: ['monitor_enrich'] })],
      metadata: '{"managed_by": "cmt"}',
      global: '{"application": {"manage": {"applications": ["kibana-*"]}}}',
    });

    expect(message.type).toBe('saved');
    const data = message.payload as RoleDefinition;
    expect(data).toEqual({
      name: 'cmt_read_only',
      description: 'Read-only access to CMT logs/metrics.',
      cluster: ['monitor'],
      run_as: ['cmt_service_account'],
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
      metadata: { managed_by: 'cmt' },
      global: { application: { manage: { applications: ['kibana-*'] } } },
    });
  });

  it('treats an entirely missing name as invalid', async () => {
    RoleEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({});
    expect(message).toEqual({ type: 'error', message: 'Name is required.' });
  });

  it('rejects a blank name', async () => {
    RoleEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({ name: '' });
    expect(message).toEqual({ type: 'error', message: 'Name is required.' });
  });

  it('rejects a name colliding with an existing role', async () => {
    await saveRole(undefined, { name: 'taken-role' });
    RoleEditorPanel.openNew(extensionUri, () => undefined);

    const message = await sendSave({ name: 'taken-role' });
    expect(message).toEqual({ type: 'error', message: 'A Role named "taken-role" already exists.' });
  });

  it('rejects malformed JSON in the metadata field', async () => {
    RoleEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({ name: 'cmt_read_only', metadata: '{ not valid json' });
    expect(message).toEqual({ type: 'error', message: 'Metadata must be valid JSON.' });
  });

  it('rejects metadata that parses but is not a JSON object', async () => {
    RoleEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({ name: 'cmt_read_only', metadata: '[1, 2, 3]' });
    expect(message).toEqual({ type: 'error', message: 'Metadata must be a JSON object.' });
  });

  it('rejects malformed JSON in the global privileges field', async () => {
    RoleEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({ name: 'cmt_read_only', global: '{ not valid json' });
    expect(message).toEqual({ type: 'error', message: 'Global Privileges must be valid JSON.' });
  });

  it('rejects global privileges that parse but are not a JSON object', async () => {
    RoleEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({ name: 'cmt_read_only', global: '[1, 2, 3]' });
    expect(message).toEqual({ type: 'error', message: 'Global Privileges must be a JSON object.' });
  });

  it('supports the @ character in file names', async () => {
    RoleEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({ name: 'cmt_read_only@custom' });

    expect(message.type).toBe('saved');
    const rolesDir = path.join(workspaceRoot, 'Elastic_Source', 'Roles');
    expect(fs.existsSync(path.join(rolesDir, 'cmt_read_only@custom.json'))).toBe(true);
  });

  describe('Index Privileges', () => {
    it('rejects a row with no index names', async () => {
      RoleEditorPanel.openNew(extensionUri, () => undefined);
      const message = await sendSave({
        name: 'cmt_read_only',
        indices: [indexPrivilege({ privileges: ['read'] })],
      });
      expect(message).toEqual({
        type: 'error',
        message: 'Index Privilege 1: At least one index name/pattern is required.',
      });
    });

    it('rejects a row with no privileges', async () => {
      RoleEditorPanel.openNew(extensionUri, () => undefined);
      const message = await sendSave({
        name: 'cmt_read_only',
        indices: [indexPrivilege({ names: ['logs-*'] })],
      });
      expect(message).toEqual({ type: 'error', message: 'Index Privilege 1: At least one privilege is required.' });
    });

    it('rejects a row with an invalid query', async () => {
      RoleEditorPanel.openNew(extensionUri, () => undefined);
      const message = await sendSave({
        name: 'cmt_read_only',
        indices: [indexPrivilege({ names: ['logs-*'], privileges: ['read'], query: '{ not valid json' })],
      });
      expect(message).toEqual({ type: 'error', message: 'Index Privilege 1: Query must be valid JSON.' });
    });
  });

  describe('Remote Index Privileges', () => {
    it('rejects a row with no clusters', async () => {
      RoleEditorPanel.openNew(extensionUri, () => undefined);
      const message = await sendSave({
        name: 'cmt_read_only',
        remoteIndices: [remoteIndexPrivilege({ names: ['logs-*'], privileges: ['read'] })],
      });
      expect(message).toEqual({
        type: 'error',
        message: 'Remote Index Privilege 1: At least one cluster is required.',
      });
    });
  });

  describe('Application Privileges', () => {
    it('rejects a row with a blank application', async () => {
      RoleEditorPanel.openNew(extensionUri, () => undefined);
      const message = await sendSave({
        name: 'cmt_read_only',
        applications: [applicationPrivilege({ privileges: ['read'], resources: ['*'] })],
      });
      expect(message).toEqual({ type: 'error', message: 'Application Privilege 1: Application is required.' });
    });

    it('rejects a row with no resources', async () => {
      RoleEditorPanel.openNew(extensionUri, () => undefined);
      const message = await sendSave({
        name: 'cmt_read_only',
        applications: [applicationPrivilege({ application: 'kibana-.kibana', privileges: ['read'] })],
      });
      expect(message).toEqual({ type: 'error', message: 'Application Privilege 1: At least one resource is required.' });
    });
  });

  describe('Remote Cluster Privileges', () => {
    it('rejects a row with no privileges', async () => {
      RoleEditorPanel.openNew(extensionUri, () => undefined);
      const message = await sendSave({
        name: 'cmt_read_only',
        remoteCluster: [remoteClusterPrivilege({ clusters: ['cluster-a'] })],
      });
      expect(message).toEqual({
        type: 'error',
        message: 'Remote Cluster Privilege 1: At least one privilege is required.',
      });
    });
  });
});
