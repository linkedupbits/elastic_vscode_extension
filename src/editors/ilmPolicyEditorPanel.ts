import * as vscode from 'vscode';
import { readJsonFile, validateArtifactName } from '../fileSystem';
import { IlmPolicyDefinition } from '../models';
import { saveIlmPolicy } from '../repositories';
import { ArtifactPanelBase } from './artifactPanelBase';

interface IlmPolicyPayload {
  isNew: boolean;
  item: IlmPolicyDefinition;
}

const VALID_PHASES = ['hot', 'warm', 'cold', 'frozen', 'delete'];

function parseJsonObject(raw: string, fieldLabel: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${fieldLabel} must be valid JSON.`);
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${fieldLabel} must be a JSON object.`);
  }
  return parsed as Record<string, unknown>;
}

export class IlmPolicyEditorPanel extends ArtifactPanelBase {
  private constructor(
    extensionUri: vscode.Uri,
    filePath: string | undefined,
    private readonly refresh: () => void
  ) {
    super(
      extensionUri,
      'elasticSource.ilmPolicyEditor',
      filePath ? 'Index Lifecycle Policy' : 'New Index Lifecycle Policy',
      filePath,
      'ilmPolicyForm.js'
    );
  }

  static openNew(extensionUri: vscode.Uri, refresh: () => void): void {
    new IlmPolicyEditorPanel(extensionUri, undefined, refresh);
  }

  static openExisting(extensionUri: vscode.Uri, refresh: () => void, filePath: string): void {
    if (ArtifactPanelBase.reveal(filePath)) {
      return;
    }
    new IlmPolicyEditorPanel(extensionUri, filePath, refresh);
  }

  protected getFormBodyHtml(): string {
    return /* html */ `
    <h1 id="title">Index Lifecycle Policy</h1>
    <p class="subtitle">Defines an Elasticsearch Index Lifecycle Management policy. Phases/actions follow the <a href="https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-ilm-put-lifecycle">ILM Put Lifecycle API</a> body.</p>
    <form id="form">
      <div class="field" id="field-name">
        <label for="name">Name</label>
        <input type="text" id="name" />
        <span class="hint">Used as this policy's file name and ILM policy name.</span>
        <span class="error">Enter a name that is valid as a file name.</span>
      </div>
      <div class="field" id="field-phases">
        <label for="phases">Phases</label>
        <textarea id="phases" rows="18" spellcheck="false"></textarea>
        <span class="hint">JSON object keyed by phase (hot, warm, cold, frozen, delete), matching the "policy.phases" body of the ILM Put Lifecycle API.</span>
        <span class="error">Enter a valid JSON object with at least one phase (hot, warm, cold, frozen, delete).</span>
      </div>
      <div class="field" id="field-meta">
        <label for="meta">Metadata (optional)</label>
        <textarea id="meta" rows="6" spellcheck="false"></textarea>
        <span class="hint">Optional JSON object saved as "policy._meta".</span>
        <span class="error">Metadata must be a valid JSON object.</span>
      </div>
      <div class="actions">
        <button type="submit" class="primary">Save</button>
        <button type="button" class="secondary" id="cancel">Cancel</button>
      </div>
    </form>`;
  }

  protected async loadInitialPayload(): Promise<IlmPolicyPayload> {
    if (this.filePath) {
      const item = await readJsonFile<IlmPolicyDefinition>(this.filePath);
      return { isNew: false, item };
    }
    return {
      isNew: true,
      item: {
        name: '',
        policy: {
          phases: {
            hot: {
              min_age: '0ms',
              actions: { rollover: { max_primary_shard_size: '50gb', max_age: '30d' } },
            },
            delete: { min_age: '90d', actions: { delete: {} } },
          },
        },
      },
    };
  }

  protected async handleSave(payload: unknown): Promise<{ filePath: string; data: unknown }> {
    const data = payload as { name: string; phases: string; meta: string };
    const name = (data.name ?? '').trim();
    const nameError = validateArtifactName(name);
    if (nameError) {
      throw new Error(nameError);
    }

    const phases = parseJsonObject(data.phases ?? '', 'Phases');
    const phaseKeys = Object.keys(phases);
    if (phaseKeys.length === 0 || !phaseKeys.every((key) => VALID_PHASES.includes(key))) {
      throw new Error(`Phases must only contain: ${VALID_PHASES.join(', ')}.`);
    }

    const metaRaw = (data.meta ?? '').trim();
    const meta = metaRaw ? parseJsonObject(metaRaw, 'Metadata') : undefined;

    const toSave: IlmPolicyDefinition = {
      name,
      policy: meta ? { phases, _meta: meta } : { phases },
    };
    const filePath = await saveIlmPolicy(this.filePath, toSave);
    this.panel.title = toSave.name;
    return { filePath, data: toSave };
  }

  protected onSaved(): void {
    this.refresh();
  }
}
