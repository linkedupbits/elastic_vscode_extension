import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { IngestPipelineEditorPanel } from '../../../src/editors/ingestPipelineEditorPanel';
import { CUSTOM_PROCESSOR_ID, IngestFieldValue, IngestProcessorFormValue } from '../../../src/ingest/ingestProcessorTemplate';
import { IngestPipelineDefinition } from '../../../src/models';
import { saveIngestPipeline } from '../../../src/repositories';
import { makeTempDir, removeTempDir } from '../../helpers/tempDir';
import { vscodeMock } from '../../helpers/vscodeMock';
import { lastPanel, sendReady, sendSave } from '../../helpers/webviewPanel';

const extensionUri = vscode.Uri.file('/ext');

function processorRow(
  type: string,
  fields: Record<string, IngestFieldValue> = {},
  overrides: Partial<IngestProcessorFormValue> = {}
): IngestProcessorFormValue {
  return {
    type,
    isCustom: false,
    customType: '',
    customConfig: '{}',
    fields,
    tag: '',
    condition: '',
    ignoreFailure: false,
    ...overrides,
  };
}

function customProcessorRow(
  customType: string,
  customConfig = '{}',
  overrides: Partial<IngestProcessorFormValue> = {}
): IngestProcessorFormValue {
  return {
    type: CUSTOM_PROCESSOR_ID,
    isCustom: true,
    customType,
    customConfig,
    fields: {},
    tag: '',
    condition: '',
    ignoreFailure: false,
    ...overrides,
  };
}

describe('IngestPipelineEditorPanel', () => {
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

  it('a new panel defaults to blank fields and no processors', async () => {
    IngestPipelineEditorPanel.openNew(extensionUri, () => undefined);
    const payload = (await sendReady()) as {
      isNew: boolean;
      item: {
        name: string;
        description: string;
        version: string;
        processors: unknown[];
        onFailure: unknown[];
        meta: string;
        deprecated: boolean;
      };
      template: { id: string }[];
    };

    expect(payload.isNew).toBe(true);
    expect(payload.item.name).toBe('');
    expect(payload.item.processors).toEqual([]);
    expect(payload.item.onFailure).toEqual([]);
    expect(payload.item.deprecated).toBe(false);
    expect(payload.template.some((p) => p.id === 'set')).toBe(true);
  });

  it('an existing panel parses known processor types from disk', async () => {
    const saved: IngestPipelineDefinition = {
      name: 'logs-emailengine_wildfly@custom',
      description: 'Adds custom fields.',
      processors: [{ set: { field: 'event.dataset', value: 'emailengine.wildfly' } }],
      on_failure: [{ set: { field: 'error.message', value: '{{ _ingest.on_failure_message }}' } }],
      version: 3,
      _meta: { managed_by: 'cmt' },
      deprecated: true,
    };
    const filePath = await saveIngestPipeline(undefined, saved);

    IngestPipelineEditorPanel.openExisting(extensionUri, () => undefined, filePath);
    const payload = (await sendReady()) as {
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
    };

    expect(payload.isNew).toBe(false);
    expect(payload.item.name).toBe('logs-emailengine_wildfly@custom');
    expect(payload.item.description).toBe('Adds custom fields.');
    expect(payload.item.version).toBe('3');
    expect(payload.item.processors).toHaveLength(1);
    expect(payload.item.processors[0].type).toBe('set');
    expect(payload.item.processors[0].fields.field).toBe('event.dataset');
    expect(payload.item.onFailure).toHaveLength(1);
    expect(payload.item.onFailure[0].type).toBe('set');
    expect(JSON.parse(payload.item.meta)).toEqual({ managed_by: 'cmt' });
    expect(payload.item.deprecated).toBe(true);
  });

  it('an existing panel falls back to a custom row for an uncurated processor type', async () => {
    const filePath = await saveIngestPipeline(undefined, {
      name: 'enrich-pipeline',
      processors: [{ enrich: { policy_name: 'my-policy', field: 'ip', target_field: 'geo' } }],
    });

    IngestPipelineEditorPanel.openExisting(extensionUri, () => undefined, filePath);
    const payload = (await sendReady()) as { item: { processors: IngestProcessorFormValue[] } };

    expect(payload.item.processors).toHaveLength(1);
    expect(payload.item.processors[0].isCustom).toBe(true);
    expect(payload.item.processors[0].customType).toBe('enrich');
    expect(JSON.parse(payload.item.processors[0].customConfig)).toEqual({
      policy_name: 'my-policy',
      field: 'ip',
      target_field: 'geo',
    });
  });

  it('an existing panel with only the required fields sends empty strings/arrays for the rest', async () => {
    const filePath = await saveIngestPipeline(undefined, {
      name: 'minimal-pipeline',
      processors: [{ set: { field: 'a', value: '1' } }],
    });

    IngestPipelineEditorPanel.openExisting(extensionUri, () => undefined, filePath);
    const payload = (await sendReady()) as {
      item: { description: string; version: string; onFailure: unknown[]; meta: string; deprecated: boolean };
    };

    expect(payload.item.description).toBe('');
    expect(payload.item.version).toBe('');
    expect(payload.item.onFailure).toEqual([]);
    expect(payload.item.meta).toBe('');
    expect(payload.item.deprecated).toBe(false);
  });

  it('opening the same filePath twice reveals the existing panel instead of creating a second one', async () => {
    const filePath = await saveIngestPipeline(undefined, {
      name: 'minimal-pipeline',
      processors: [{ set: { field: 'a', value: '1' } }],
    });

    IngestPipelineEditorPanel.openExisting(extensionUri, () => undefined, filePath);
    const firstPanel = lastPanel();

    IngestPipelineEditorPanel.openExisting(extensionUri, () => undefined, filePath);

    expect(firstPanel.revealCount).toBe(1);
    expect(lastPanel()).toBe(firstPanel);
  });

  it('saves a minimal pipeline, omitting unset optional fields entirely', async () => {
    IngestPipelineEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({
      name: 'logs-emailengine_wildfly@custom',
      description: '',
      version: '',
      processors: [processorRow('set', { field: 'a', value: '1', override: true, ignore_empty_value: false })],
      onFailure: [],
      meta: '',
      deprecated: false,
    });

    expect(message.type).toBe('saved');
    const data = message.payload as IngestPipelineDefinition;
    expect(data).toEqual({
      name: 'logs-emailengine_wildfly@custom',
      processors: [{ set: { field: 'a', value: '1', override: true, ignore_empty_value: false } }],
    });
  });

  it('saves all optional fields, on_failure, and a custom processor type when provided', async () => {
    IngestPipelineEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({
      name: 'logs-emailengine_wildfly@custom',
      description: '  Adds custom fields.  ',
      version: '3',
      processors: [
        processorRow('set', { field: 'a', value: '1', override: true, ignore_empty_value: false }),
        customProcessorRow('enrich', '{"policy_name": "my-policy"}'),
      ],
      onFailure: [processorRow('set', { field: 'error.message', value: '{{ _ingest.on_failure_message }}', override: true, ignore_empty_value: false })],
      meta: '{"managed_by": "cmt"}',
      deprecated: true,
    });

    expect(message.type).toBe('saved');
    const data = message.payload as IngestPipelineDefinition;
    expect(data.description).toBe('Adds custom fields.');
    expect(data.version).toBe(3);
    expect(data.processors).toEqual([
      { set: { field: 'a', value: '1', override: true, ignore_empty_value: false } },
      { enrich: { policy_name: 'my-policy' } },
    ]);
    expect(data.on_failure).toEqual([
      { set: { field: 'error.message', value: '{{ _ingest.on_failure_message }}', override: true, ignore_empty_value: false } },
    ]);
    expect(data._meta).toEqual({ managed_by: 'cmt' });
    expect(data.deprecated).toBe(true);
  });

  it('rejects a blank name', async () => {
    IngestPipelineEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({
      name: '',
      processors: [processorRow('set', { field: 'a', value: '1' })],
    });
    expect(message).toEqual({ type: 'error', message: 'Name is required.' });
  });

  it('treats an entirely missing name as invalid', async () => {
    IngestPipelineEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({ processors: [processorRow('set', { field: 'a', value: '1' })] });
    expect(message).toEqual({ type: 'error', message: 'Name is required.' });
  });

  it('rejects an entirely missing processors field', async () => {
    IngestPipelineEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({ name: 'p' });
    expect(message).toEqual({ type: 'error', message: 'At least one processor is required.' });
  });

  it('rejects an empty processors array', async () => {
    IngestPipelineEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({ name: 'p', processors: [] });
    expect(message).toEqual({ type: 'error', message: 'At least one processor is required.' });
  });

  it('rejects a processor row missing a required field', async () => {
    IngestPipelineEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({ name: 'p', processors: [processorRow('set', { field: '', value: '' })] });
    expect(message).toEqual({ type: 'error', message: 'Processor 1 (Set): "Field" is required.' });
  });

  it('rejects a custom processor row with a blank type name', async () => {
    IngestPipelineEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({ name: 'p', processors: [customProcessorRow('')] });
    expect(message).toEqual({ type: 'error', message: 'Processor 1: Processor Type is required.' });
  });

  it('rejects a custom processor row with invalid JSON configuration', async () => {
    IngestPipelineEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({ name: 'p', processors: [customProcessorRow('enrich', '{ not valid json')] });
    expect(message).toEqual({ type: 'error', message: 'Processor 1 ("enrich"): Configuration must be valid JSON.' });
  });

  it('labels an invalid on_failure row distinctly from the main processors list', async () => {
    IngestPipelineEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({
      name: 'p',
      processors: [processorRow('set', { field: 'a', value: '1' })],
      onFailure: [processorRow('set', { field: '', value: '' })],
    });
    expect(message).toEqual({
      type: 'error',
      message: 'On-Failure Processor 1 (Set): "Field" is required.',
    });
  });

  it('rejects malformed JSON in metadata', async () => {
    IngestPipelineEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({
      name: 'p',
      processors: [processorRow('set', { field: 'a', value: '1' })],
      meta: '{ not valid json',
    });
    expect(message).toEqual({ type: 'error', message: 'Metadata must be valid JSON.' });
  });

  it('rejects metadata that parses but is not a JSON object', async () => {
    IngestPipelineEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({
      name: 'p',
      processors: [processorRow('set', { field: 'a', value: '1' })],
      meta: '[1, 2, 3]',
    });
    expect(message).toEqual({ type: 'error', message: 'Metadata must be a JSON object.' });
  });

  it('rejects a non-numeric version', async () => {
    IngestPipelineEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({
      name: 'p',
      processors: [processorRow('set', { field: 'a', value: '1' })],
      version: 'not-a-number',
    });
    expect(message).toEqual({ type: 'error', message: 'Version must be a number.' });
  });

  it('rejects a name colliding with an existing pipeline', async () => {
    await saveIngestPipeline(undefined, {
      name: 'taken-pipeline',
      processors: [{ set: { field: 'a', value: '1' } }],
    });
    IngestPipelineEditorPanel.openNew(extensionUri, () => undefined);

    const message = await sendSave({
      name: 'taken-pipeline',
      processors: [processorRow('set', { field: 'a', value: '1' })],
    });
    expect(message).toEqual({
      type: 'error',
      message: 'An Ingest Pipeline named "taken-pipeline" already exists.',
    });
  });

  it('supports "@" in the pipeline name (a common Elastic naming convention)', async () => {
    IngestPipelineEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({
      name: 'logs-emailengine_wildfly@custom',
      processors: [processorRow('set', { field: 'a', value: '1' })],
    });

    expect(message.type).toBe('saved');
    const filePath = path.join(
      workspaceRoot,
      'Elastic_Source',
      'Ingest_Pipelines',
      'logs-emailengine_wildfly@custom.json'
    );
    expect(fs.existsSync(filePath)).toBe(true);
  });
});
