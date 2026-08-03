import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { IngestPipelineEditorPanel } from '../../../src/editors/ingestPipelineEditorPanel';
import { IngestPipelineDefinition } from '../../../src/models';
import { saveIngestPipeline } from '../../../src/repositories';
import { makeTempDir, removeTempDir } from '../../helpers/tempDir';
import { vscodeMock } from '../../helpers/vscodeMock';
import { lastPanel, sendReady, sendSave } from '../../helpers/webviewPanel';

const extensionUri = vscode.Uri.file('/ext');

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

  it('a new panel defaults to blank fields and an empty processors array', async () => {
    IngestPipelineEditorPanel.openNew(extensionUri, () => undefined);
    const payload = (await sendReady()) as {
      isNew: boolean;
      item: { name: string; description: string; version: string; processors: string; onFailure: string; meta: string; deprecated: boolean };
    };

    expect(payload.isNew).toBe(true);
    expect(payload.item.name).toBe('');
    expect(payload.item.processors).toBe('[]');
    expect(payload.item.deprecated).toBe(false);
  });

  it('an existing panel loads and pretty-prints the saved pipeline from disk', async () => {
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
        processors: string;
        onFailure: string;
        meta: string;
        deprecated: boolean;
      };
    };

    expect(payload.isNew).toBe(false);
    expect(payload.item.name).toBe('logs-emailengine_wildfly@custom');
    expect(payload.item.description).toBe('Adds custom fields.');
    expect(payload.item.version).toBe('3');
    expect(JSON.parse(payload.item.processors)).toEqual(saved.processors);
    expect(JSON.parse(payload.item.onFailure)).toEqual(saved.on_failure);
    expect(JSON.parse(payload.item.meta)).toEqual({ managed_by: 'cmt' });
    expect(payload.item.deprecated).toBe(true);
  });

  it('an existing panel with only the required fields sends empty strings for the rest', async () => {
    const filePath = await saveIngestPipeline(undefined, {
      name: 'minimal-pipeline',
      processors: [{ set: { field: 'a', value: '1' } }],
    });

    IngestPipelineEditorPanel.openExisting(extensionUri, () => undefined, filePath);
    const payload = (await sendReady()) as {
      item: { description: string; version: string; onFailure: string; meta: string; deprecated: boolean };
    };

    expect(payload.item.description).toBe('');
    expect(payload.item.version).toBe('');
    expect(payload.item.onFailure).toBe('');
    expect(payload.item.meta).toBe('');
    expect(payload.item.deprecated).toBe(false);
  });

  it('an existing panel with no processors key at all (legacy/malformed file) sends an empty array', async () => {
    const ingestDir = path.join(workspaceRoot, 'Elastic_Source', 'Ingest_Pipelines');
    fs.mkdirSync(ingestDir, { recursive: true });
    const filePath = path.join(ingestDir, 'legacy-pipeline.json');
    fs.writeFileSync(filePath, JSON.stringify({ name: 'legacy-pipeline' }));

    IngestPipelineEditorPanel.openExisting(extensionUri, () => undefined, filePath);
    const payload = (await sendReady()) as { item: { processors: string } };

    expect(payload.item.processors).toBe('[]');
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
      processors: JSON.stringify([{ set: { field: 'a', value: '1' } }]),
      onFailure: '',
      meta: '',
      deprecated: false,
    });

    expect(message.type).toBe('saved');
    const data = message.payload as IngestPipelineDefinition;
    expect(data).toEqual({
      name: 'logs-emailengine_wildfly@custom',
      processors: [{ set: { field: 'a', value: '1' } }],
    });
  });

  it('saves all optional fields when provided', async () => {
    IngestPipelineEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({
      name: 'logs-emailengine_wildfly@custom',
      description: '  Adds custom fields.  ',
      version: '3',
      processors: JSON.stringify([{ set: { field: 'a', value: '1' } }]),
      onFailure: JSON.stringify([{ set: { field: 'error.message', value: '{{ _ingest.on_failure_message }}' } }]),
      meta: '{"managed_by": "cmt"}',
      deprecated: true,
    });

    expect(message.type).toBe('saved');
    const data = message.payload as IngestPipelineDefinition;
    expect(data.description).toBe('Adds custom fields.');
    expect(data.version).toBe(3);
    expect(data.on_failure).toEqual([{ set: { field: 'error.message', value: '{{ _ingest.on_failure_message }}' } }]);
    expect(data._meta).toEqual({ managed_by: 'cmt' });
    expect(data.deprecated).toBe(true);
  });

  it('rejects a blank name', async () => {
    IngestPipelineEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({
      name: '',
      processors: JSON.stringify([{ set: { field: 'a', value: '1' } }]),
    });
    expect(message).toEqual({ type: 'error', message: 'Name is required.' });
  });

  it('treats an entirely missing name as invalid', async () => {
    IngestPipelineEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({ processors: JSON.stringify([{ set: { field: 'a', value: '1' } }]) });
    expect(message).toEqual({ type: 'error', message: 'Name is required.' });
  });

  it('treats an entirely missing processors field as invalid (not just malformed JSON)', async () => {
    IngestPipelineEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({ name: 'p' });
    expect(message).toEqual({ type: 'error', message: 'Processors must be valid JSON.' });
  });

  it('rejects malformed JSON in processors', async () => {
    IngestPipelineEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({ name: 'p', processors: '{ not valid json' });
    expect(message).toEqual({ type: 'error', message: 'Processors must be valid JSON.' });
  });

  it('rejects processors that parse but are not a JSON array', async () => {
    IngestPipelineEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({ name: 'p', processors: '{"set": {}}' });
    expect(message).toEqual({ type: 'error', message: 'Processors must be a JSON array.' });
  });

  it('rejects a processors array containing a non-object entry', async () => {
    IngestPipelineEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({ name: 'p', processors: '["not-an-object"]' });
    expect(message).toEqual({ type: 'error', message: 'Processors item 1 must be a JSON object.' });
  });

  it('rejects an empty processors array', async () => {
    IngestPipelineEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({ name: 'p', processors: '[]' });
    expect(message).toEqual({ type: 'error', message: 'At least one processor is required.' });
  });

  it('rejects malformed JSON in on_failure', async () => {
    IngestPipelineEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({
      name: 'p',
      processors: JSON.stringify([{ set: { field: 'a', value: '1' } }]),
      onFailure: '{ not valid json',
    });
    expect(message).toEqual({ type: 'error', message: 'On Failure must be valid JSON.' });
  });

  it('rejects malformed JSON in metadata', async () => {
    IngestPipelineEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({
      name: 'p',
      processors: JSON.stringify([{ set: { field: 'a', value: '1' } }]),
      meta: '{ not valid json',
    });
    expect(message).toEqual({ type: 'error', message: 'Metadata must be valid JSON.' });
  });

  it('rejects metadata that parses but is not a JSON object', async () => {
    IngestPipelineEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({
      name: 'p',
      processors: JSON.stringify([{ set: { field: 'a', value: '1' } }]),
      meta: '[1, 2, 3]',
    });
    expect(message).toEqual({ type: 'error', message: 'Metadata must be a JSON object.' });
  });

  it('rejects a non-numeric version', async () => {
    IngestPipelineEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({
      name: 'p',
      processors: JSON.stringify([{ set: { field: 'a', value: '1' } }]),
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
      processors: JSON.stringify([{ set: { field: 'a', value: '1' } }]),
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
      processors: JSON.stringify([{ set: { field: 'a', value: '1' } }]),
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
