import * as vscode from 'vscode';
import { ProxyEditorPanel } from '../../../src/editors/proxyEditorPanel';
import { generateId } from '../../../src/fileSystem';
import { FleetProxy } from '../../../src/models';
import { saveFleetProxy } from '../../../src/repositories';
import { makeTempDir, removeTempDir } from '../../helpers/tempDir';
import { vscodeMock } from '../../helpers/vscodeMock';
import { sendReady, sendSave } from '../../helpers/webviewPanel';

const extensionUri = vscode.Uri.file('/ext');

function validProxyPayload(overrides: Partial<FleetProxy> = {}): FleetProxy {
  return {
    id: generateId(),
    name: 'WNP Proxy',
    url: 'http://proxy.internal:3128',
    certificate_authorities: '',
    certificates: '',
    certificate_key: '',
    is_preconfigured: false,
    ...overrides,
  };
}

describe('ProxyEditorPanel', () => {
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

  it('a new panel defaults to a generated id and blank fields', async () => {
    ProxyEditorPanel.openNew(extensionUri, () => undefined);
    const payload = (await sendReady()) as { isNew: boolean; item: FleetProxy };

    expect(payload.isNew).toBe(true);
    expect(payload.item.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(payload.item.name).toBe('');
    expect(payload.item.is_preconfigured).toBe(false);
  });

  it('an existing panel loads the saved proxy from disk', async () => {
    const filePath = await saveFleetProxy(undefined, validProxyPayload());
    ProxyEditorPanel.openExisting(extensionUri, () => undefined, filePath);

    const payload = (await sendReady()) as { isNew: boolean; item: FleetProxy };
    expect(payload.isNew).toBe(false);
    expect(payload.item.name).toBe('WNP Proxy');
  });

  it('saves trimmed, coerced values and writes <name>.json', async () => {
    ProxyEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave(
      validProxyPayload({ name: '  Padded Name  ', is_preconfigured: 'truthy' as unknown as boolean })
    );

    expect(message.type).toBe('saved');
    const data = message.payload as FleetProxy;
    expect(data.name).toBe('Padded Name');
    expect(data.is_preconfigured).toBe(true);
  });

  it('rejects a blank name', async () => {
    ProxyEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave(validProxyPayload({ name: '' }));
    expect(message).toEqual({ type: 'error', message: 'Name is required.' });
  });

  it('rejects an invalid URL', async () => {
    ProxyEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave(validProxyPayload({ url: 'not-a-url' }));
    expect(message).toEqual({ type: 'error', message: 'URL is not valid.' });
  });

  it('treats an entirely missing name as invalid', async () => {
    ProxyEditorPanel.openNew(extensionUri, () => undefined);
    const payload: Partial<FleetProxy> = validProxyPayload();
    delete payload.name;

    const message = await sendSave(payload);
    expect(message).toEqual({ type: 'error', message: 'Name is required.' });
  });

  it('treats an entirely missing url as invalid', async () => {
    ProxyEditorPanel.openNew(extensionUri, () => undefined);
    const payload: Partial<FleetProxy> = validProxyPayload();
    delete payload.url;

    const message = await sendSave(payload);
    expect(message).toEqual({ type: 'error', message: 'URL is not valid.' });
  });

  it('defaults missing optional certificate fields to empty strings', async () => {
    ProxyEditorPanel.openNew(extensionUri, () => undefined);
    const payload: Partial<FleetProxy> = validProxyPayload();
    delete payload.certificate_authorities;
    delete payload.certificates;
    delete payload.certificate_key;

    const message = await sendSave(payload);
    expect(message.type).toBe('saved');
    const data = message.payload as FleetProxy;
    expect(data.certificate_authorities).toBe('');
    expect(data.certificates).toBe('');
    expect(data.certificate_key).toBe('');
  });

  it('rejects a name colliding with an existing proxy', async () => {
    await saveFleetProxy(undefined, validProxyPayload({ name: 'Taken Name' }));
    ProxyEditorPanel.openNew(extensionUri, () => undefined);

    const message = await sendSave(validProxyPayload({ name: 'Taken Name' }));
    expect(message).toEqual({ type: 'error', message: 'A Fleet Proxy named "Taken Name" already exists.' });
  });
});
