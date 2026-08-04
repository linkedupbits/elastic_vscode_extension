import * as path from 'path';
import * as vscode from 'vscode';
import { readTextFile } from '../fileSystem';
import { ArtifactPanelBase } from './artifactPanelBase';

interface ArtifactLoadErrorPayload {
  raw: string;
  error: string;
}

/**
 * Read-only view opened when a tree item's backing file failed to load (invalid JSON, or
 * valid JSON that doesn't match the expected artifact shape - see repositories.ts's
 * `assertHasName`). Shows the file's raw text with the load error in the shared error banner,
 * so the user can see what's wrong instead of only getting a transient notification.
 */
export class ArtifactLoadErrorPanel extends ArtifactPanelBase {
  private constructor(
    extensionUri: vscode.Uri,
    filePath: string,
    private readonly loadError: string
  ) {
    super(
      extensionUri,
      'elasticSource.artifactLoadError',
      path.basename(filePath),
      filePath,
      'artifactLoadErrorView.js'
    );
  }

  static open(extensionUri: vscode.Uri, filePath: string, errorMessage: string): void {
    if (ArtifactPanelBase.reveal(filePath)) {
      return;
    }
    new ArtifactLoadErrorPanel(extensionUri, filePath, errorMessage);
  }

  protected getFormBodyHtml(): string {
    return /* html */ `
    <h1>${path.basename(this.filePath as string)}</h1>
    <p class="subtitle">This file failed to load. Its raw contents are shown below.</p>
    <pre id="raw-content" class="raw-json"></pre>
    <div class="actions">
      <button type="button" class="secondary" id="open-in-editor">Open in Editor</button>
      <button type="button" class="secondary" id="cancel">Close</button>
    </div>`;
  }

  protected async loadInitialPayload(): Promise<ArtifactLoadErrorPayload> {
    const raw = await readTextFile(this.filePath as string);
    return { raw, error: this.loadError };
  }

  protected async handleSave(): Promise<{ filePath: string; data: unknown }> {
    throw new Error('This file failed to load and cannot be saved.');
  }

  protected onSaved(): void {
    // no-op: this is a read-only view.
  }
}
