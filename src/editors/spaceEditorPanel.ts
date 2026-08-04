import * as vscode from 'vscode';
import { readJsonFile } from '../fileSystem';
import { toStringArray } from '../roles/rolePrivilegeTemplates';
import { SpaceDefinition } from '../models';
import { saveSpace } from '../repositories';
import { ArtifactPanelBase } from './artifactPanelBase';

interface SpaceFormItem {
  id: string;
  name: string;
  description: string;
  color: string;
  initials: string;
  imageUrl: string;
  disabledFeatures: string[];
}

interface SpacePayload {
  isNew: boolean;
  item: SpaceFormItem;
}

/** Kibana space ids are URL-safe: lowercase letters, digits, underscores and hyphens only. */
const VALID_SPACE_ID = /^[a-z0-9_-]+$/;
const VALID_HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export class SpaceEditorPanel extends ArtifactPanelBase {
  private constructor(
    extensionUri: vscode.Uri,
    filePath: string | undefined,
    private readonly refresh: () => void
  ) {
    super(extensionUri, 'elasticSource.spaceEditor', filePath ? 'Space' : 'New Space', filePath, 'spaceForm.js');
  }

  static openNew(extensionUri: vscode.Uri, refresh: () => void): void {
    new SpaceEditorPanel(extensionUri, undefined, refresh);
  }

  static openExisting(extensionUri: vscode.Uri, refresh: () => void, filePath: string): void {
    if (ArtifactPanelBase.reveal(filePath)) {
      return;
    }
    new SpaceEditorPanel(extensionUri, filePath, refresh);
  }

  protected getFormBodyHtml(): string {
    return /* html */ `
    <h1 id="title">Space</h1>
    <p class="subtitle">Defines a Kibana space. See the <a href="https://www.elastic.co/docs/api/doc/kibana/operation/operation-post-spaces-space">Create Space API</a>.</p>
    <form id="form">
      <div class="field" id="field-id">
        <label for="id">ID</label>
        <input type="text" id="id" placeholder="marketing" />
        <span class="hint">Lowercase letters, digits, underscores and hyphens only. Used in Kibana URLs and as this space's file name.</span>
        <span class="error">Enter an id using only lowercase letters, digits, underscores and hyphens.</span>
      </div>
      <div class="field" id="field-name">
        <label for="name">Name</label>
        <input type="text" id="name" />
        <span class="hint">This space's display name in Kibana.</span>
        <span class="error">Name is required.</span>
      </div>
      <div class="field">
        <label for="description">Description (optional)</label>
        <textarea id="description" rows="2"></textarea>
      </div>
      <div class="field" id="field-color">
        <label for="color">Color (optional)</label>
        <input type="text" id="color" placeholder="#aabbcc" />
        <span class="hint">Hex color used for the space avatar background.</span>
        <span class="error">Enter a valid hex color, e.g. #aabbcc.</span>
      </div>
      <div class="field" id="field-initials">
        <label for="initials">Initials (optional)</label>
        <input type="text" id="initials" maxlength="2" placeholder="MK" />
        <span class="hint">Up to 2 characters shown on the space avatar when no image is set.</span>
        <span class="error">Initials can be at most 2 characters.</span>
      </div>
      <div class="field">
        <label for="imageUrl">Avatar Image URL (optional)</label>
        <textarea id="imageUrl" rows="2" spellcheck="false"></textarea>
        <span class="hint">A URL or base64 data URL for a custom avatar image, overrides Color/Initials.</span>
      </div>
      <div class="field">
        <label for="disabledFeatures">Disabled Features (optional)</label>
        <textarea id="disabledFeatures" rows="2" placeholder="discover" spellcheck="false"></textarea>
        <span class="hint">One Kibana feature id per line to hide within this space.</span>
      </div>
      <div class="actions">
        <button type="submit" class="primary">Save</button>
        <button type="button" class="secondary" id="cancel">Cancel</button>
      </div>
    </form>`;
  }

  protected async loadInitialPayload(): Promise<SpacePayload> {
    if (this.filePath) {
      const item = await readJsonFile<SpaceDefinition>(this.filePath);
      return {
        isNew: false,
        item: {
          id: item.id,
          name: item.name,
          description: item.description ?? '',
          color: item.color ?? '',
          initials: item.initials ?? '',
          imageUrl: item.imageUrl ?? '',
          disabledFeatures: item.disabledFeatures ?? [],
        },
      };
    }
    return {
      isNew: true,
      item: { id: '', name: '', description: '', color: '', initials: '', imageUrl: '', disabledFeatures: [] },
    };
  }

  protected async handleSave(payload: unknown): Promise<{ filePath: string; data: unknown }> {
    const data = payload as {
      id: string;
      name: string;
      description: string;
      color: string;
      initials: string;
      imageUrl: string;
      disabledFeatures: unknown;
    };
    const name = (data.name ?? '').trim();
    if (!name) {
      throw new Error('Name is required.');
    }

    const id = (data.id ?? '').trim();
    if (!VALID_SPACE_ID.test(id)) {
      throw new Error('ID must contain only lowercase letters, digits, underscores and hyphens.');
    }

    const color = (data.color ?? '').trim();
    if (color && !VALID_HEX_COLOR.test(color)) {
      throw new Error('Color must be a valid hex color, e.g. #aabbcc.');
    }

    const initials = (data.initials ?? '').trim();
    if (initials.length > 2) {
      throw new Error('Initials can be at most 2 characters.');
    }

    const description = (data.description ?? '').trim();
    const imageUrl = (data.imageUrl ?? '').trim();
    const disabledFeatures = toStringArray(data.disabledFeatures);

    const toSave: SpaceDefinition = {
      id,
      name,
      ...(description ? { description } : {}),
      ...(color ? { color } : {}),
      ...(initials ? { initials } : {}),
      ...(imageUrl ? { imageUrl } : {}),
      ...(disabledFeatures.length > 0 ? { disabledFeatures } : {}),
    };
    const filePath = await saveSpace(this.filePath, toSave);
    this.panel.title = toSave.name;
    return { filePath, data: toSave };
  }

  protected onSaved(): void {
    this.refresh();
  }
}
