import * as vscode from 'vscode';
import { validateArtifactName } from '../fileSystem';
import {
  buildProcessorsJson,
  INGEST_PROCESSORS,
  IngestProcessorDef,
  IngestProcessorFormValue,
  parseProcessorsFromRaw,
} from '../ingest/ingestProcessorTemplate';
import { IngestPipelineDefinition } from '../models';
import { loadIngestPipeline, saveIngestPipeline } from '../repositories';
import { ArtifactPanelBase } from './artifactPanelBase';

interface IngestPipelinePayload {
  isNew: boolean;
  item: {
    name: string;
    description: string;
    version: string;
    processors: IngestProcessorFormValue[];
    onFailure: IngestProcessorFormValue[];
    meta: string;
    deprecated: boolean;
  };
  template: IngestProcessorDef[];
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

export class IngestPipelineEditorPanel extends ArtifactPanelBase {
  private constructor(
    extensionUri: vscode.Uri,
    filePath: string | undefined,
    private readonly refresh: () => void
  ) {
    super(
      extensionUri,
      'elasticSource.ingestPipelineEditor',
      filePath ? 'Ingest Pipeline' : 'New Ingest Pipeline',
      filePath,
      'ingestPipelineForm.js'
    );
  }

  static openNew(extensionUri: vscode.Uri, refresh: () => void): void {
    new IngestPipelineEditorPanel(extensionUri, undefined, refresh);
  }

  static openExisting(extensionUri: vscode.Uri, refresh: () => void, filePath: string): void {
    if (ArtifactPanelBase.reveal(filePath)) {
      return;
    }
    new IngestPipelineEditorPanel(extensionUri, filePath, refresh);
  }

  protected getFormBodyHtml(): string {
    return /* html */ `
    <h1 id="title">Ingest Pipeline</h1>
    <p class="subtitle">Defines an Elasticsearch ingest pipeline. See the <a href="https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-ingest-put-pipeline">Put Pipeline API</a> for the processors schema.</p>
    <form id="form">
      <div class="field" id="field-name">
        <label for="name">Name</label>
        <input type="text" id="name" />
        <span class="hint">Used as this pipeline's file name and pipeline ID, e.g. logs-emailengine_wildfly@custom.</span>
        <span class="error">Enter a name that is valid as a file name.</span>
      </div>
      <div class="field">
        <label for="description">Description (optional)</label>
        <textarea id="description" rows="2"></textarea>
      </div>
      <div class="field" id="field-version">
        <label for="version">Version (optional)</label>
        <input type="number" id="version" />
        <span class="hint">Used to track/manage pipeline changes externally; not enforced by Elasticsearch.</span>
        <span class="error">Version must be a number.</span>
      </div>
      <div class="field">
        <label>Processors</label>
        <span class="hint">Runs in order against every document ingested through this pipeline.</span>
      </div>
      <div id="processors-container"></div>
      <button type="button" class="secondary" id="add-processor">Add Processor</button>
      <div class="field" style="margin-top:20px">
        <label>On Failure (optional)</label>
        <span class="hint">Runs instead, in order, if any processor above throws an error.</span>
      </div>
      <div id="on-failure-container"></div>
      <button type="button" class="secondary" id="add-on-failure-processor">Add On-Failure Processor</button>
      <div class="field" id="field-meta" style="margin-top:20px">
        <label for="meta">Metadata (optional)</label>
        <textarea id="meta" rows="4" spellcheck="false"></textarea>
        <span class="hint">Optional JSON object saved as "_meta".</span>
        <span class="error">Metadata must be a valid JSON object.</span>
      </div>
      <div class="field">
        <div class="checkbox-row">
          <input type="checkbox" id="deprecated" />
          <label for="deprecated" style="margin:0">Deprecated</label>
        </div>
      </div>
      <div class="actions">
        <button type="submit" class="primary">Save</button>
        <button type="button" class="secondary" id="cancel">Cancel</button>
      </div>
    </form>`;
  }

  protected async loadInitialPayload(): Promise<IngestPipelinePayload> {
    if (this.filePath) {
      const item = await loadIngestPipeline(this.filePath);
      return {
        isNew: false,
        item: {
          name: item.name,
          description: item.description ?? '',
          version: item.version !== undefined ? String(item.version) : '',
          processors: parseProcessorsFromRaw(item.processors),
          onFailure: parseProcessorsFromRaw(item.on_failure),
          meta: item._meta ? JSON.stringify(item._meta, null, 2) : '',
          deprecated: Boolean(item.deprecated),
        },
        template: INGEST_PROCESSORS,
      };
    }
    return {
      isNew: true,
      item: {
        name: '',
        description: '',
        version: '',
        processors: [],
        onFailure: [],
        meta: '',
        deprecated: false,
      },
      template: INGEST_PROCESSORS,
    };
  }

  protected async handleSave(payload: unknown): Promise<{ filePath: string; data: unknown }> {
    const data = payload as {
      name: string;
      description: string;
      version: string;
      processors: IngestProcessorFormValue[];
      onFailure: IngestProcessorFormValue[];
      meta: string;
      deprecated: boolean;
    };
    const name = (data.name ?? '').trim();
    const nameError = validateArtifactName(name);
    if (nameError) {
      throw new Error(nameError);
    }

    const processors = buildProcessorsJson(data.processors ?? [], 'Processor');
    if (processors.length === 0) {
      throw new Error('At least one processor is required.');
    }

    const onFailureRows = data.onFailure ?? [];
    const onFailure = onFailureRows.length > 0 ? buildProcessorsJson(onFailureRows, 'On-Failure Processor') : undefined;

    const metaRaw = (data.meta ?? '').trim();
    const meta = metaRaw ? parseJsonObject(metaRaw, 'Metadata') : undefined;

    const versionRaw = (data.version ?? '').trim();
    let version: number | undefined;
    if (versionRaw) {
      version = Number(versionRaw);
      if (!Number.isFinite(version)) {
        throw new Error('Version must be a number.');
      }
    }

    const description = (data.description ?? '').trim();

    const toSave: IngestPipelineDefinition = {
      name,
      processors,
      ...(description ? { description } : {}),
      ...(onFailure ? { on_failure: onFailure } : {}),
      ...(version !== undefined ? { version } : {}),
      ...(meta ? { _meta: meta } : {}),
      ...(data.deprecated ? { deprecated: true } : {}),
    };
    const filePath = await saveIngestPipeline(this.filePath, toSave);
    this.panel.title = toSave.name;
    return { filePath, data: toSave };
  }

  protected onSaved(): void {
    this.refresh();
  }
}
