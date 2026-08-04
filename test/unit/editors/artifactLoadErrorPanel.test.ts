import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { ArtifactLoadErrorPanel } from '../../../src/editors/artifactLoadErrorPanel';
import { makeTempDir, removeTempDir } from '../../helpers/tempDir';
import { vscodeMock } from '../../helpers/vscodeMock';
import { lastPanel, sendCancel, sendOpenInEditor, sendReady } from '../../helpers/webviewPanel';

const extensionUri = vscode.Uri.file('/ext');

describe('ArtifactLoadErrorPanel', () => {
  let workspaceRoot: string;
  let filePath: string;

  beforeEach(() => {
    workspaceRoot = makeTempDir();
    vscodeMock.__setWorkspaceFolders(workspaceRoot);
    vscodeMock.__resetWebviewPanels();

    const rolesDir = path.join(workspaceRoot, 'Elastic_Source', 'Roles');
    fs.mkdirSync(rolesDir, { recursive: true });
    filePath = path.join(rolesDir, 'errorRole.json');
    fs.writeFileSync(filePath, '{ "BadlyFormatted": "Json" }');
  });

  afterEach(() => {
    vscodeMock.__resetWorkspace();
    removeTempDir(workspaceRoot);
  });

  it('titles the panel with the file name and renders a raw-content pane', () => {
    ArtifactLoadErrorPanel.open(extensionUri, filePath, 'is missing a valid "name" field.');

    const panel = lastPanel();
    expect(panel.title).toBe('errorRole.json');
    expect(panel.webview.html).toContain('id="raw-content"');
    expect(panel.webview.html).toContain('id="error-banner"');
  });

  it('responds to "ready" with the raw file contents and the load error message', async () => {
    ArtifactLoadErrorPanel.open(extensionUri, filePath, 'is missing a valid "name" field.');

    const payload = (await sendReady()) as { raw: string; error: string };

    expect(payload.raw).toBe('{ "BadlyFormatted": "Json" }');
    expect(payload.error).toBe('is missing a valid "name" field.');
  });

  it('opening the same filePath twice reveals the existing panel instead of creating a second one', () => {
    ArtifactLoadErrorPanel.open(extensionUri, filePath, 'boom');
    const firstPanel = lastPanel();

    ArtifactLoadErrorPanel.open(extensionUri, filePath, 'boom');

    expect(firstPanel.revealCount).toBe(1);
    expect(lastPanel()).toBe(firstPanel);
  });

  it('"cancel" (Close) disposes the panel', async () => {
    ArtifactLoadErrorPanel.open(extensionUri, filePath, 'boom');
    const panel = lastPanel();
    expect(panel.disposed).toBe(false);

    await sendCancel();

    expect(panel.disposed).toBe(true);
  });

  it('renders an "Open in Editor" button that opens the source file in the default editor', async () => {
    ArtifactLoadErrorPanel.open(extensionUri, filePath, 'boom');

    expect(lastPanel().webview.html).toContain('id="open-in-editor"');

    await sendOpenInEditor();

    expect(vscode.window.showTextDocument).toHaveBeenCalledWith(vscode.Uri.file(filePath));
  });
});
