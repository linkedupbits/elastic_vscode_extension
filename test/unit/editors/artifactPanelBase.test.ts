import * as vscode from 'vscode';
import { ArtifactPanelBase } from '../../../src/editors/artifactPanelBase';
import { ProxyEditorPanel } from '../../../src/editors/proxyEditorPanel';
import { generateId } from '../../../src/fileSystem';
import { saveFleetProxy } from '../../../src/repositories';
import { makeTempDir, removeTempDir } from '../../helpers/tempDir';
import { vscodeMock } from '../../helpers/vscodeMock';
import { lastPanel, sendCancel, sendReady, sendSave } from '../../helpers/webviewPanel';

/** Exercises the defensive `err instanceof Error ? ... : String(err)` fallback in ArtifactPanelBase's save handler. */
class ThrowingPanel extends ArtifactPanelBase {
  constructor(extensionUri: vscode.Uri) {
    super(extensionUri, 'test.throwingPanel', 'Throwing Panel', undefined, 'proxyForm.js');
  }
  protected getFormBodyHtml(): string {
    return '<form id="form"></form>';
  }
  protected async loadInitialPayload(): Promise<unknown> {
    return {};
  }
  protected async handleSave(): Promise<{ filePath: string; data: unknown }> {
    // eslint-disable-next-line @typescript-eslint/no-throw-literal
    throw 'a plain string rejection';
  }
  protected onSaved(): void {
    // no-op
  }
}

// ArtifactPanelBase has no concrete subclass of its own; its shared plumbing (HTML shell,
// ready/save/cancel handshake, per-file singleton tracking) is exercised here through the
// simplest concrete subclass, ProxyEditorPanel. Panel-specific validation/persistence logic
// is covered separately in proxyEditorPanel.test.ts.
describe('ArtifactPanelBase (via ProxyEditorPanel)', () => {
  let workspaceRoot: string;
  const extensionUri = vscode.Uri.file('/ext');

  beforeEach(() => {
    workspaceRoot = makeTempDir();
    vscodeMock.__setWorkspaceFolders(workspaceRoot);
    vscodeMock.__resetWebviewPanels();
  });

  afterEach(() => {
    vscodeMock.__resetWorkspace();
    removeTempDir(workspaceRoot);
  });

  it('renders an HTML shell with a CSP nonce and the subclass-provided form body', () => {
    ProxyEditorPanel.openNew(extensionUri, () => undefined);
    const html = lastPanel().webview.html;
    expect(html).toContain('Content-Security-Policy');
    expect(html).toMatch(/nonce-[A-Za-z0-9]{32}/);
    expect(html).toContain('<h1 id="title">Fleet Proxy</h1>');
    expect(html).toContain('New Fleet Proxy'); // <title> reflects the constructor-supplied title
  });

  it('responds to "ready" with an "init" message carrying loadInitialPayload()', async () => {
    ProxyEditorPanel.openNew(extensionUri, () => undefined);
    const payload = (await sendReady()) as { isNew: boolean };
    expect(payload.isNew).toBe(true);
  });

  it('a successful "save" posts "saved", updates the panel title, and calls onSaved (refresh)', async () => {
    const refresh = jest.fn();
    ProxyEditorPanel.openNew(extensionUri, refresh);

    const message = await sendSave({
      id: generateId(),
      name: 'WNP Proxy',
      url: 'http://proxy.internal:3128',
      certificate_authorities: '',
      certificates: '',
      certificate_key: '',
      is_preconfigured: false,
    });

    expect(message.type).toBe('saved');
    expect(lastPanel().title).toBe('WNP Proxy');
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('a failing "save" posts "error" with the thrown message and does not call onSaved', async () => {
    const refresh = jest.fn();
    ProxyEditorPanel.openNew(extensionUri, refresh);

    const message = await sendSave({ id: generateId(), name: '', url: 'not-a-url' });

    expect(message).toEqual({ type: 'error', message: 'Name is required.' });
    expect(refresh).not.toHaveBeenCalled();
  });

  it('a save that throws a non-Error value still posts an "error" message', async () => {
    new ThrowingPanel(extensionUri);
    const message = await sendSave({});
    expect(message).toEqual({ type: 'error', message: 'a plain string rejection' });
  });

  it('"cancel" disposes the panel', async () => {
    ProxyEditorPanel.openNew(extensionUri, () => undefined);
    const panel = lastPanel();
    expect(panel.disposed).toBe(false);

    await sendCancel();

    expect(panel.disposed).toBe(true);
  });

  it('an unrecognized message type is a no-op', async () => {
    ProxyEditorPanel.openNew(extensionUri, () => undefined);
    const panel = lastPanel();
    const before = panel.webview.posted.length;

    await panel.webview.__receive({ type: 'unknown-type' });

    expect(panel.webview.posted.length).toBe(before);
  });

  it('messages posted after the panel is disposed are dropped', async () => {
    ProxyEditorPanel.openNew(extensionUri, () => undefined);
    const panel = lastPanel();
    await sendCancel();
    const before = panel.webview.posted.length;

    await panel.webview.__receive({ type: 'ready' });

    expect(panel.webview.posted.length).toBe(before);
  });

  describe('openExisting / reveal singleton behavior', () => {
    it('opening a filePath that is not already open creates a new panel', async () => {
      const filePath = await saveFleetProxy(undefined, {
        id: generateId(),
        name: 'Existing Proxy',
        url: 'http://proxy.internal:3128',
        certificate_authorities: '',
        certificates: '',
        certificate_key: '',
        is_preconfigured: false,
      });

      ProxyEditorPanel.openExisting(extensionUri, () => undefined, filePath);

      const payload = (await sendReady()) as { isNew: boolean; item: { name: string } };
      expect(payload.isNew).toBe(false);
      expect(payload.item.name).toBe('Existing Proxy');
    });

    it('opening the same filePath twice reveals the existing panel instead of creating a second one', async () => {
      const filePath = await saveFleetProxy(undefined, {
        id: generateId(),
        name: 'Existing Proxy',
        url: 'http://proxy.internal:3128',
        certificate_authorities: '',
        certificates: '',
        certificate_key: '',
        is_preconfigured: false,
      });

      ProxyEditorPanel.openExisting(extensionUri, () => undefined, filePath);
      const firstPanel = lastPanel();

      ProxyEditorPanel.openExisting(extensionUri, () => undefined, filePath);

      expect(firstPanel.revealCount).toBe(1);
      expect(lastPanel()).toBe(firstPanel); // no second panel was created
    });

    it('after the open panel is disposed, opening the same filePath again creates a fresh panel', async () => {
      const filePath = await saveFleetProxy(undefined, {
        id: generateId(),
        name: 'Existing Proxy',
        url: 'http://proxy.internal:3128',
        certificate_authorities: '',
        certificates: '',
        certificate_key: '',
        is_preconfigured: false,
      });

      ProxyEditorPanel.openExisting(extensionUri, () => undefined, filePath);
      const firstPanel = lastPanel();
      await sendCancel();

      ProxyEditorPanel.openExisting(extensionUri, () => undefined, filePath);

      expect(firstPanel.revealCount).toBe(0);
      expect(lastPanel()).not.toBe(firstPanel);
    });
  });
});
