import * as vscode from 'vscode';
import { readJsonFile, validateArtifactName } from '../fileSystem';
import {
  buildDefaultPhasesFormValue,
  buildPhasesJson,
  hasEnabledPhase,
  ILM_PHASES,
  IlmPhaseDef,
  IlmPhasesFormValue,
  parsePhasesFromRaw,
} from '../ilm/ilmPhaseTemplate';
import { IlmDataStreamType, IlmPolicyDefinition, IntegrationLifecycleMapping } from '../models';
import { saveIlmPolicy } from '../repositories';
import { ArtifactPanelBase } from './artifactPanelBase';

interface IlmPolicyPayload {
  isNew: boolean;
  item: {
    name: string;
    phases: IlmPhasesFormValue;
    meta: string;
    mappings: IntegrationLifecycleMapping[];
  };
  template: IlmPhaseDef[];
}

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

const VALID_DATA_STREAM_TYPES: IlmDataStreamType[] = ['logs', 'metrics'];

function parseMappings(raw: unknown): IntegrationLifecycleMapping[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map((entry, index) => {
    const row = (entry ?? {}) as Record<string, unknown>;
    const dataStreamType = row.data_stream_type;
    if (!VALID_DATA_STREAM_TYPES.includes(dataStreamType as IlmDataStreamType)) {
      throw new Error(
        `Integration Lifecycle Mapping ${index + 1}: Data Stream Type must be "logs" or "metrics".`
      );
    }
    const datasetName = String(row.dataset_name ?? '').trim();
    const integrationName = String(row.integration_name ?? '').trim();
    const namespace = String(row.namespace ?? '').trim();
    if (!datasetName || !integrationName || !namespace) {
      throw new Error(
        `Integration Lifecycle Mapping ${index + 1}: Dataset Name, Integration Name and Namespace are all required.`
      );
    }
    return { data_stream_type: dataStreamType as IlmDataStreamType, dataset_name: datasetName, integration_name: integrationName, namespace };
  });
}

function starterPhasesFormValue(): IlmPhasesFormValue {
  const phases = buildDefaultPhasesFormValue();
  phases.hot.enabled = true;
  phases.hot.actions.rollover.enabled = true;
  phases.hot.actions.set_priority.enabled = true;
  phases.delete.enabled = true;
  phases.delete.actions.delete.enabled = true;
  return phases;
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
    <p class="subtitle">Defines an Elasticsearch Index Lifecycle Management policy. Enable each phase you need and configure its actions.</p>
    <form id="form">
      <div class="field" id="field-name">
        <label for="name">Name</label>
        <input type="text" id="name" />
        <span class="hint">Used as this policy's file name and ILM policy name.</span>
        <span class="error">Enter a name that is valid as a file name.</span>
      </div>
      <div id="phases-container"></div>
      <div class="field">
        <label>Integration Lifecycle Mappings (optional)</label>
        <span class="hint">Maps this policy to the specific integration data streams it should apply to.</span>
        <div id="mappings-container"></div>
        <button type="button" class="secondary" id="add-mapping">Add Mapping</button>
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
      return {
        isNew: false,
        item: {
          name: item.name,
          phases: parsePhasesFromRaw(item.policy?.phases),
          meta: item.policy?._meta ? JSON.stringify(item.policy._meta, null, 2) : '',
          mappings: item.integration_lifecycle_mappings ?? [],
        },
        template: ILM_PHASES,
      };
    }
    return {
      isNew: true,
      item: { name: '', phases: starterPhasesFormValue(), meta: '', mappings: [] },
      template: ILM_PHASES,
    };
  }

  protected async handleSave(payload: unknown): Promise<{ filePath: string; data: unknown }> {
    const data = payload as { name: string; phases: IlmPhasesFormValue; meta: string; mappings: unknown };
    const name = (data.name ?? '').trim();
    const nameError = validateArtifactName(name);
    if (nameError) {
      throw new Error(nameError);
    }

    const phasesForm = data.phases ?? buildDefaultPhasesFormValue();
    if (!hasEnabledPhase(phasesForm)) {
      throw new Error('Enable at least one phase (hot, warm, cold, frozen, delete).');
    }
    const phases = buildPhasesJson(phasesForm);

    const metaRaw = (data.meta ?? '').trim();
    const meta = metaRaw ? parseJsonObject(metaRaw, 'Metadata') : undefined;

    const mappings = parseMappings(data.mappings);

    const toSave: IlmPolicyDefinition = {
      name,
      policy: meta ? { phases, _meta: meta } : { phases },
      integration_lifecycle_mappings: mappings,
    };
    const filePath = await saveIlmPolicy(this.filePath, toSave);
    this.panel.title = toSave.name;
    return { filePath, data: toSave };
  }

  protected onSaved(): void {
    this.refresh();
  }
}
