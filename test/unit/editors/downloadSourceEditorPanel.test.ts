import * as vscode from 'vscode';
import { DownloadSourceEditorPanel } from '../../../src/editors/downloadSourceEditorPanel';
import { generateId } from '../../../src/fileSystem';
import { FleetDownloadSource, FleetProxy } from '../../../src/models';
import { saveFleetDownloadSource, saveFleetProxy } from '../../../src/repositories';
import { makeTempDir, removeTempDir } from '../../helpers/tempDir';
import { vscodeMock } from '../../helpers/vscodeMock';
import { lastPanel, sendReady, sendSave } from '../../helpers/webviewPanel';

const extensionUri = vscode.Uri.file('/ext');

function validDownloadSourcePayload(overrides: Partial<FleetDownloadSource> = {}): FleetDownloadSource {
  return {
    id: generateId(),
    name: 'On-Prem Download Source',
    host: 'https://artifacts.elastic.co/downloads',
    is_default: false,
    proxy_id: '',
    ...overrides,
  };
}

async function saveProxy(overrides: Partial<FleetProxy> = {}): Promise<FleetProxy> {
  const proxy: FleetProxy = {
    id: generateId(),
    name: 'WNP Proxy',
    url: 'http://proxy.internal:3128',
    certificate_authorities: '',
    certificates: '',
    certificate_key: '',
    is_preconfigured: false,
    ...overrides,
  };
  await saveFleetProxy(undefined, proxy);
  return proxy;
}

describe('DownloadSourceEditorPanel', () => {
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

  it('a new panel includes the current proxy list for the dropdown', async () => {
    await saveProxy({ name: 'Zeta Proxy' });
    await saveProxy({ name: 'Alpha Proxy' });

    DownloadSourceEditorPanel.openNew(extensionUri, () => undefined);
    const payload = (await sendReady()) as { proxies: { name: string }[] };

    expect(payload.proxies.map((p) => p.name)).toEqual(['Alpha Proxy', 'Zeta Proxy']);
  });

  it('an existing panel loads the saved download source from disk', async () => {
    const filePath = await saveFleetDownloadSource(undefined, validDownloadSourcePayload());
    DownloadSourceEditorPanel.openExisting(extensionUri, () => undefined, filePath);

    const payload = (await sendReady()) as { isNew: boolean; item: FleetDownloadSource };
    expect(payload.isNew).toBe(false);
    expect(payload.item.name).toBe('On-Prem Download Source');
  });

  it('opening the same filePath twice reveals the existing panel instead of creating a second one', async () => {
    const filePath = await saveFleetDownloadSource(undefined, validDownloadSourcePayload());

    DownloadSourceEditorPanel.openExisting(extensionUri, () => undefined, filePath);
    const firstPanel = lastPanel();

    DownloadSourceEditorPanel.openExisting(extensionUri, () => undefined, filePath);

    expect(firstPanel.revealCount).toBe(1);
    expect(lastPanel()).toBe(firstPanel);
  });

  it('saves trimmed values and defaults an unset proxy_id to an empty string', async () => {
    DownloadSourceEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave(validDownloadSourcePayload({ name: '  Padded  ', proxy_id: undefined }));

    expect(message.type).toBe('saved');
    expect((message.payload as FleetDownloadSource).name).toBe('Padded');
    expect((message.payload as FleetDownloadSource).proxy_id).toBe('');
  });

  it('rejects a blank name', async () => {
    DownloadSourceEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave(validDownloadSourcePayload({ name: '' }));
    expect(message).toEqual({ type: 'error', message: 'Name is required.' });
  });

  it('rejects an invalid host URL', async () => {
    DownloadSourceEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave(validDownloadSourcePayload({ host: 'not-a-url' }));
    expect(message).toEqual({ type: 'error', message: 'Host is not a valid URL.' });
  });

  it('treats an entirely missing name as invalid', async () => {
    DownloadSourceEditorPanel.openNew(extensionUri, () => undefined);
    const payload: Partial<FleetDownloadSource> = validDownloadSourcePayload();
    delete payload.name;

    const message = await sendSave(payload);
    expect(message).toEqual({ type: 'error', message: 'Name is required.' });
  });

  it('treats an entirely missing host as invalid', async () => {
    DownloadSourceEditorPanel.openNew(extensionUri, () => undefined);
    const payload: Partial<FleetDownloadSource> = validDownloadSourcePayload();
    delete payload.host;

    const message = await sendSave(payload);
    expect(message).toEqual({ type: 'error', message: 'Host is not a valid URL.' });
  });

  it('accepts a proxy_id that references an existing proxy', async () => {
    const proxy = await saveProxy();
    DownloadSourceEditorPanel.openNew(extensionUri, () => undefined);

    const message = await sendSave(validDownloadSourcePayload({ proxy_id: proxy.id }));
    expect(message.type).toBe('saved');
  });

  it('rejects a proxy_id that does not reference any existing proxy', async () => {
    DownloadSourceEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave(validDownloadSourcePayload({ proxy_id: 'does-not-exist' }));
    expect(message).toEqual({
      type: 'error',
      message: 'Selected proxy no longer exists. Reopen this form to refresh the list.',
    });
  });

  it('rejects a name colliding with an existing download source', async () => {
    await saveFleetDownloadSource(undefined, validDownloadSourcePayload({ name: 'Taken' }));
    DownloadSourceEditorPanel.openNew(extensionUri, () => undefined);

    const message = await sendSave(validDownloadSourcePayload({ name: 'Taken' }));
    expect(message).toEqual({
      type: 'error',
      message: 'A Fleet Download Source named "Taken" already exists.',
    });
  });
});
