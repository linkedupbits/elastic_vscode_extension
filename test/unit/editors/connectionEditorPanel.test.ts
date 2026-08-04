import * as vscode from 'vscode';
import { getApiKey } from '../../../src/connections/connectionManager';
import { ConnectionEditorPanel } from '../../../src/editors/connectionEditorPanel';
import { isLoadedArtifact, listConnections, saveConnection } from '../../../src/repositories';
import { makeTempDir, removeTempDir } from '../../helpers/tempDir';
import { vscodeMock } from '../../helpers/vscodeMock';
import { sendReady, sendSave } from '../../helpers/webviewPanel';

const extensionUri = vscode.Uri.file('/ext');

const VALID_CLOUD_ID = `staging:${Buffer.from('us-east-1.aws.found.io$abcd1234$efgh5678', 'utf8').toString(
  'base64'
)}`;

function validConnectionPayload(overrides: Partial<{ name: string; cloudId: string; apiKey: string }> = {}) {
  return {
    name: 'Staging',
    cloudId: VALID_CLOUD_ID,
    apiKey: 'my-api-key',
    ...overrides,
  };
}

describe('ConnectionEditorPanel', () => {
  let workspaceRoot: string;
  let secrets: InstanceType<typeof vscodeMock.MockSecretStorage>;

  beforeEach(() => {
    workspaceRoot = makeTempDir();
    vscodeMock.__setWorkspaceFolders(workspaceRoot);
    vscodeMock.__resetWebviewPanels();
    secrets = new vscodeMock.MockSecretStorage();
  });

  afterEach(() => {
    vscodeMock.__resetWorkspace();
    removeTempDir(workspaceRoot);
  });

  it('a new panel starts with blank fields', async () => {
    ConnectionEditorPanel.openNew(extensionUri, secrets, () => undefined);
    const payload = (await sendReady()) as { isNew: boolean; item: { name: string; cloudId: string } };

    expect(payload.isNew).toBe(true);
    expect(payload.item.name).toBe('');
    expect(payload.item.cloudId).toBe('');
  });

  it('an existing panel loads the saved connection from disk, without exposing the api key', async () => {
    const filePath = await saveConnection(undefined, {
      id: 'conn-1',
      name: 'Staging',
      cloudId: VALID_CLOUD_ID,
    });
    ConnectionEditorPanel.openExisting(extensionUri, secrets, () => undefined, filePath);

    const payload = (await sendReady()) as { isNew: boolean; item: { name: string; cloudId: string } };
    expect(payload.isNew).toBe(false);
    expect(payload.item.name).toBe('Staging');
    expect(payload.item.cloudId).toBe(VALID_CLOUD_ID);
    expect(payload.item).not.toHaveProperty('apiKey');
  });

  it('saves a new connection and stores its api key in SecretStorage', async () => {
    ConnectionEditorPanel.openNew(extensionUri, secrets, () => undefined);
    const message = await sendSave(validConnectionPayload());

    expect(message.type).toBe('saved');
    const data = message.payload as { name: string; cloudId: string };
    expect(data.name).toBe('Staging');
    expect(data.cloudId).toBe(VALID_CLOUD_ID);

    const items = await listConnections();
    expect(items).toHaveLength(1);
    const [saved] = items;
    if (!isLoadedArtifact(saved)) {
      throw new Error(`Expected connection to load successfully, got: ${saved.error.message}`);
    }
    expect(await getApiKey(secrets, saved.data.id)).toBe('my-api-key');
  });

  it('rejects creating a connection without an api key', async () => {
    ConnectionEditorPanel.openNew(extensionUri, secrets, () => undefined);
    const message = await sendSave(validConnectionPayload({ apiKey: '' }));
    expect(message).toEqual({ type: 'error', message: 'API Key is required.' });
  });

  it('rejects a blank name', async () => {
    ConnectionEditorPanel.openNew(extensionUri, secrets, () => undefined);
    const message = await sendSave(validConnectionPayload({ name: '' }));
    expect(message).toEqual({ type: 'error', message: 'Name is required.' });
  });

  it('rejects a blank cloud id', async () => {
    ConnectionEditorPanel.openNew(extensionUri, secrets, () => undefined);
    const message = await sendSave(validConnectionPayload({ cloudId: '' }));
    expect(message).toEqual({ type: 'error', message: 'Cloud ID is required.' });
  });

  it('rejects a malformed cloud id', async () => {
    ConnectionEditorPanel.openNew(extensionUri, secrets, () => undefined);
    const message = await sendSave(validConnectionPayload({ cloudId: 'not-a-cloud-id' }));
    expect(message).toEqual({
      type: 'error',
      message: 'Cloud ID must be in the form "<name>:<encoded>".',
    });
  });

  it('editing an existing connection with a blank api key keeps the currently stored key', async () => {
    const filePath = await saveConnection(undefined, {
      id: 'conn-1',
      name: 'Staging',
      cloudId: VALID_CLOUD_ID,
    });
    await secrets.store('elasticSource.connection.conn-1.apiKey', 'original-key');

    ConnectionEditorPanel.openExisting(extensionUri, secrets, () => undefined, filePath);
    await sendReady();
    const message = await sendSave(validConnectionPayload({ apiKey: '' }));

    expect(message.type).toBe('saved');
    expect(await getApiKey(secrets, 'conn-1')).toBe('original-key');
  });

  it('editing an existing connection with a new api key rotates the stored key', async () => {
    const filePath = await saveConnection(undefined, {
      id: 'conn-1',
      name: 'Staging',
      cloudId: VALID_CLOUD_ID,
    });
    await secrets.store('elasticSource.connection.conn-1.apiKey', 'original-key');

    ConnectionEditorPanel.openExisting(extensionUri, secrets, () => undefined, filePath);
    await sendReady();
    const message = await sendSave(validConnectionPayload({ apiKey: 'rotated-key' }));

    expect(message.type).toBe('saved');
    expect(await getApiKey(secrets, 'conn-1')).toBe('rotated-key');
  });

  it('updating an existing connection keeps its original id and file path', async () => {
    const filePath = await saveConnection(undefined, {
      id: 'conn-1',
      name: 'Staging',
      cloudId: VALID_CLOUD_ID,
    });

    ConnectionEditorPanel.openExisting(extensionUri, secrets, () => undefined, filePath);
    await sendReady();
    const message = await sendSave(validConnectionPayload({ name: 'Renamed Staging', apiKey: '' }));

    expect(message.type).toBe('saved');
    const data = message.payload as { name: string };
    expect(data.name).toBe('Renamed Staging');

    const items = await listConnections();
    expect(items).toHaveLength(1);
    const [item] = items;
    if (!isLoadedArtifact(item)) {
      throw new Error(`Expected connection to load successfully, got: ${item.error.message}`);
    }
    expect(item.filePath).toBe(filePath);
    expect(item.data.id).toBe('conn-1');
  });
});
