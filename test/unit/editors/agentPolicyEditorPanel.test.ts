import * as vscode from 'vscode';
import { AgentPolicyEditorPanel } from '../../../src/editors/agentPolicyEditorPanel';
import { generateId } from '../../../src/fileSystem';
import { FleetAgentPolicy, FleetDownloadSource } from '../../../src/models';
import { saveFleetAgentPolicy, saveFleetDownloadSource } from '../../../src/repositories';
import { makeTempDir, removeTempDir } from '../../helpers/tempDir';
import { vscodeMock } from '../../helpers/vscodeMock';
import { lastPanel, sendReady, sendSave } from '../../helpers/webviewPanel';

const extensionUri = vscode.Uri.file('/ext');

function validAgentPolicyPayload(overrides: Partial<FleetAgentPolicy> = {}): FleetAgentPolicy {
  return {
    id: generateId(),
    name: 'CMT Default',
    description: '',
    monitoring_enabled: ['logs', 'metrics'],
    inactivity_timeout: 1209600,
    download_source_id: '',
    schema_version: '1.1.0',
    namespace: 'default',
    advanced_settings: {},
    ...overrides,
  };
}

async function saveDownloadSource(overrides: Partial<FleetDownloadSource> = {}): Promise<FleetDownloadSource> {
  const ds: FleetDownloadSource = {
    id: generateId(),
    name: 'Default Source',
    host: 'https://artifacts.elastic.co/downloads',
    is_default: true,
    proxy_id: '',
    ...overrides,
  };
  await saveFleetDownloadSource(undefined, ds);
  return ds;
}

describe('AgentPolicyEditorPanel', () => {
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

  it('a new panel defaults schema_version, namespace and inactivity_timeout, and lists download sources', async () => {
    await saveDownloadSource({ name: 'Zeta Source' });
    await saveDownloadSource({ name: 'Alpha Source' });

    AgentPolicyEditorPanel.openNew(extensionUri, () => undefined);
    const payload = (await sendReady()) as {
      item: FleetAgentPolicy;
      downloadSources: { name: string }[];
    };

    expect(payload.item.schema_version).toBe('1.1.0');
    expect(payload.item.namespace).toBe('default');
    expect(payload.item.inactivity_timeout).toBe(1209600);
    expect(payload.downloadSources.map((d) => d.name)).toEqual(['Alpha Source', 'Zeta Source']);
  });

  it('an existing panel loads the saved policy from disk', async () => {
    const filePath = await saveFleetAgentPolicy(undefined, validAgentPolicyPayload());
    AgentPolicyEditorPanel.openExisting(extensionUri, () => undefined, filePath);

    const payload = (await sendReady()) as { isNew: boolean; item: FleetAgentPolicy };
    expect(payload.isNew).toBe(false);
    expect(payload.item.name).toBe('CMT Default');
  });

  it('opening the same filePath twice reveals the existing panel instead of creating a second one', async () => {
    const filePath = await saveFleetAgentPolicy(undefined, validAgentPolicyPayload());

    AgentPolicyEditorPanel.openExisting(extensionUri, () => undefined, filePath);
    const firstPanel = lastPanel();

    AgentPolicyEditorPanel.openExisting(extensionUri, () => undefined, filePath);

    expect(firstPanel.revealCount).toBe(1);
    expect(lastPanel()).toBe(firstPanel);
  });

  it('saves trimmed values, defaulting monitoring_enabled/advanced_settings when malformed', async () => {
    AgentPolicyEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave(
      validAgentPolicyPayload({
        name: '  Padded  ',
        namespace: '  cmtdev  ',
        schema_version: '  1.1.1  ',
        monitoring_enabled: 'not-an-array' as unknown as ('logs' | 'metrics')[],
        advanced_settings: undefined as unknown as FleetAgentPolicy['advanced_settings'],
      })
    );

    expect(message.type).toBe('saved');
    const data = message.payload as FleetAgentPolicy;
    expect(data.name).toBe('Padded');
    expect(data.namespace).toBe('cmtdev');
    expect(data.schema_version).toBe('1.1.1');
    expect(data.monitoring_enabled).toEqual([]);
    expect(data.advanced_settings).toEqual({ agent_logging_level: '' });
  });

  it('rejects a blank name', async () => {
    AgentPolicyEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave(validAgentPolicyPayload({ name: '' }));
    expect(message).toEqual({ type: 'error', message: 'Name is required.' });
  });

  it('treats an entirely missing name as invalid', async () => {
    AgentPolicyEditorPanel.openNew(extensionUri, () => undefined);
    const payload: Partial<FleetAgentPolicy> = validAgentPolicyPayload();
    delete payload.name;

    const message = await sendSave(payload);
    expect(message).toEqual({ type: 'error', message: 'Name is required.' });
  });

  it('defaults missing optional description and download_source_id fields to empty strings', async () => {
    AgentPolicyEditorPanel.openNew(extensionUri, () => undefined);
    const payload: Partial<FleetAgentPolicy> = validAgentPolicyPayload();
    delete payload.description;
    delete payload.download_source_id;

    const message = await sendSave(payload);
    expect(message.type).toBe('saved');
    const data = message.payload as FleetAgentPolicy;
    expect(data.description).toBe('');
    expect(data.download_source_id).toBe('');
  });

  it('rejects a blank namespace', async () => {
    AgentPolicyEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave(validAgentPolicyPayload({ namespace: '   ' }));
    expect(message).toEqual({ type: 'error', message: 'Namespace is required.' });
  });

  it('rejects a blank schema_version', async () => {
    AgentPolicyEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave(validAgentPolicyPayload({ schema_version: '' }));
    expect(message).toEqual({ type: 'error', message: 'Schema version is required.' });
  });

  it.each([
    ['non-numeric', 'not-a-number' as unknown as number],
    ['negative', -1],
    ['non-integer', 1.5],
  ])('rejects an inactivity_timeout that is %s', async (_label, inactivity_timeout) => {
    AgentPolicyEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave(validAgentPolicyPayload({ inactivity_timeout }));
    expect(message).toEqual({
      type: 'error',
      message: 'Inactivity timeout must be a whole number of seconds, 0 or greater.',
    });
  });

  it('accepts an inactivity_timeout of exactly 0', async () => {
    AgentPolicyEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave(validAgentPolicyPayload({ inactivity_timeout: 0 }));
    expect(message.type).toBe('saved');
  });

  it('accepts a download_source_id that references an existing download source', async () => {
    const ds = await saveDownloadSource();
    AgentPolicyEditorPanel.openNew(extensionUri, () => undefined);

    const message = await sendSave(validAgentPolicyPayload({ download_source_id: ds.id }));
    expect(message.type).toBe('saved');
  });

  it('rejects a download_source_id that does not reference any existing download source', async () => {
    AgentPolicyEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave(validAgentPolicyPayload({ download_source_id: 'does-not-exist' }));
    expect(message).toEqual({
      type: 'error',
      message: 'Selected download source no longer exists. Reopen this form to refresh the list.',
    });
  });

  it('rejects a name colliding with an existing agent policy folder', async () => {
    await saveFleetAgentPolicy(undefined, validAgentPolicyPayload({ name: 'Taken' }));
    AgentPolicyEditorPanel.openNew(extensionUri, () => undefined);

    const message = await sendSave(validAgentPolicyPayload({ name: 'Taken' }));
    expect(message).toEqual({
      type: 'error',
      message: 'An agent policy folder named "Taken" already exists.',
    });
  });
});
