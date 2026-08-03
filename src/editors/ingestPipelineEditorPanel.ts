import * as vscode from 'vscode';
import { readJsonFile, validateArtifactName } from '../fileSystem';
import { IngestPipelineDefinition } from '../models';
import { saveIngestPipeline } from '../repositories';
import { ArtifactPanelBase } from './artifactPanelBase';

interface IngestPipelinePayload {
  isNew: boolean;
  item: {
    name: string;
    description: string;
    version: string;
    processors: string;
    onFailure: string;
    meta: string;
    deprecated: boolean;
  };
}

function parseJsonArray(raw: string, fieldLabel: string): Record<string, unknown>[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${fieldLabel} must be valid JSON.`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`${fieldLabel} must be a JSON array.`);
  }
  parsed.forEach((entry, index) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw new Error(`${fieldLabel} item ${index + 1} must be a JSON object.`);
    }
  });
  return parsed as Record<string, unknown>[];
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
      <div class="field" id="field-processors">
        <label for="processors">Processors</label>
        <textarea id="processors" rows="16" spellcheck="false"></textarea>
        <span class="hint">JSON array of processor objects, matching the "processors" body of the Put Pipeline API.</span>
        <span class="error">Enter a valid, non-empty JSON array of processor objects.</span>
      </div>
      <div class="field" id="field-on_failure">
        <label for="on_failure">On Failure (optional)</label>
        <textarea id="on_failure" rows="6" spellcheck="false"></textarea>
        <span class="hint">JSON array of processors to run if any processor above throws an error.</span>
        <span class="error">On Failure must be a valid JSON array of processor objects.</span>
      </div>
      <div class="field" id="field-meta">
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
      const item = await readJsonFile<IngestPipelineDefinition>(this.filePath);
      return {
        isNew: false,
        item: {
          name: item.name,
          description: item.description ?? '',
          version: item.version !== undefined ? String(item.version) : '',
          processors: JSON.stringify(item.processors ?? [], null, 2),
          onFailure: item.on_failure ? JSON.stringify(item.on_failure, null, 2) : '',
          meta: item._meta ? JSON.stringify(item._meta, null, 2) : '',
          deprecated: Boolean(item.deprecated),
        },
      };
    }
    return {
      isNew: true,
      item: {
        name: '',
        description: '',
        version: '',
        processors: '[]',
        onFailure: '',
        meta: '',
        deprecated: false,
      },
    };
  }

  protected async handleSave(payload: unknown): Promise<{ filePath: string; data: unknown }> {
    const data = payload as {
      name: string;
      description: string;
      version: string;
      processors: string;
      onFailure: string;
      meta: string;
      deprecated: boolean;
    };
    const name = (data.name ?? '').trim();
    const nameError = validateArtifactName(name);
    if (nameError) {
      throw new Error(nameError);
    }

    const processors = parseJsonArray(data.processors ?? '', 'Processors');
    if (processors.length === 0) {
      throw new Error('At least one processor is required.');
    }

    const onFailureRaw = (data.onFailure ?? '').trim();
    const onFailure = onFailureRaw ? parseJsonArray(onFailureRaw, 'On Failure') : undefined;

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
