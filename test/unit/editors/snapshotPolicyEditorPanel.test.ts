import * as vscode from 'vscode';
import { SnapshotPolicyEditorPanel } from '../../../src/editors/snapshotPolicyEditorPanel';
import { SnapshotPolicyDefinition } from '../../../src/models';
import { saveSnapshotPolicy } from '../../../src/repositories';
import { makeTempDir, removeTempDir } from '../../helpers/tempDir';
import { vscodeMock } from '../../helpers/vscodeMock';
import { sendReady, sendSave } from '../../helpers/webviewPanel';

const extensionUri = vscode.Uri.file('/ext');

function validSnapshotPolicyPayload(overrides: Partial<SnapshotPolicyDefinition> = {}): SnapshotPolicyDefinition {
  return {
    policyId: 'daily-snapshots',
    schedule: '0 30 1 * * ?',
    name: '<daily-snap-{now/d}>',
    repository: 'my_repository',
    ...overrides,
  };
}

describe('SnapshotPolicyEditorPanel', () => {
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

  it('a new panel starts with blank fields', async () => {
    SnapshotPolicyEditorPanel.openNew(extensionUri, () => undefined);
    const payload = (await sendReady()) as {
      isNew: boolean;
      item: { policyId: string; schedule: string; name: string; repository: string; config: string; retention: string };
    };

    expect(payload.isNew).toBe(true);
    expect(payload.item).toEqual({
      policyId: '',
      schedule: '',
      name: '',
      repository: '',
      config: '',
      retention: '',
    });
  });

  it('an existing panel loads the saved policy from disk, keyed by policy id', async () => {
    const filePath = await saveSnapshotPolicy(undefined, validSnapshotPolicyPayload());
    SnapshotPolicyEditorPanel.openExisting(extensionUri, () => undefined, filePath);

    const payload = (await sendReady()) as { isNew: boolean; item: SnapshotPolicyDefinition };
    expect(payload.isNew).toBe(false);
    expect(payload.item.policyId).toBe('daily-snapshots');
    expect(payload.item.schedule).toBe('0 30 1 * * ?');
    expect(payload.item.name).toBe('<daily-snap-{now/d}>');
    expect(payload.item.repository).toBe('my_repository');
  });

  it('parses config/retention JSON fields when populated', async () => {
    const filePath = await saveSnapshotPolicy(
      undefined,
      validSnapshotPolicyPayload({
        config: { indices: ['data-*'], ignore_unavailable: false },
        retention: { expire_after: '30d', min_count: 5, max_count: 50 },
      })
    );
    SnapshotPolicyEditorPanel.openExisting(extensionUri, () => undefined, filePath);

    const payload = (await sendReady()) as { item: { config: string; retention: string } };
    expect(JSON.parse(payload.item.config)).toEqual({ indices: ['data-*'], ignore_unavailable: false });
    expect(JSON.parse(payload.item.retention)).toEqual({ expire_after: '30d', min_count: 5, max_count: 50 });
  });

  it('saves trimmed values and writes <policyId>.json', async () => {
    SnapshotPolicyEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave(validSnapshotPolicyPayload({ policyId: '  daily-snapshots  ' }));

    expect(message.type).toBe('saved');
    const data = message.payload as SnapshotPolicyDefinition;
    expect(data.policyId).toBe('daily-snapshots');
  });

  it('rejects a blank policy id', async () => {
    SnapshotPolicyEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave(validSnapshotPolicyPayload({ policyId: '' }));
    expect(message).toEqual({ type: 'error', message: 'Name is required.' });
  });

  it('rejects a blank schedule', async () => {
    SnapshotPolicyEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave(validSnapshotPolicyPayload({ schedule: '' }));
    expect(message).toEqual({ type: 'error', message: 'Schedule is required.' });
  });

  it('rejects a blank snapshot name', async () => {
    SnapshotPolicyEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave(validSnapshotPolicyPayload({ name: '' }));
    expect(message).toEqual({ type: 'error', message: 'Snapshot Name is required.' });
  });

  it('rejects a blank repository', async () => {
    SnapshotPolicyEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave(validSnapshotPolicyPayload({ repository: '' }));
    expect(message).toEqual({ type: 'error', message: 'Repository is required.' });
  });

  it('rejects invalid JSON in config', async () => {
    SnapshotPolicyEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({ ...validSnapshotPolicyPayload(), config: '{ not valid json' });
    expect(message).toEqual({ type: 'error', message: 'Config must be valid JSON.' });
  });

  it('rejects invalid JSON in retention', async () => {
    SnapshotPolicyEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({ ...validSnapshotPolicyPayload(), retention: '{ not valid json' });
    expect(message).toEqual({ type: 'error', message: 'Retention must be valid JSON.' });
  });

  it('rejects a policy id colliding with an existing snapshot policy', async () => {
    await saveSnapshotPolicy(undefined, validSnapshotPolicyPayload());
    SnapshotPolicyEditorPanel.openNew(extensionUri, () => undefined);

    const message = await sendSave(validSnapshotPolicyPayload());
    expect(message).toEqual({
      type: 'error',
      message: 'A Snapshot Policy with id "daily-snapshots" already exists.',
    });
  });
});
