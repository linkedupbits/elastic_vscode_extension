import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { IndexTemplateEditorPanel } from '../../../src/editors/indexTemplateEditorPanel';
import { IndexTemplateDefinition } from '../../../src/models';
import { saveIndexTemplate } from '../../../src/repositories';
import { makeTempDir, removeTempDir } from '../../helpers/tempDir';
import { vscodeMock } from '../../helpers/vscodeMock';
import { lastPanel, sendReady, sendSave } from '../../helpers/webviewPanel';

const extensionUri = vscode.Uri.file('/ext');

describe('IndexTemplateEditorPanel', () => {
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

  it('a new panel starts with empty/default values', async () => {
    IndexTemplateEditorPanel.openNew(extensionUri, () => undefined);
    const payload = (await sendReady()) as {
      isNew: boolean;
      item: {
        name: string;
        indexPatterns: string[];
        composedOf: string[];
        priority: string;
        version: string;
        allowAutoCreate: string;
        ignoreMissingComponentTemplates: string[];
        dataStreamEnabled: boolean;
        dataStreamHidden: boolean;
        dataStreamAllowCustomRouting: boolean;
        settings: string;
        mappings: string;
        aliases: string;
        meta: string;
        deprecated: boolean;
      };
    };

    expect(payload.isNew).toBe(true);
    expect(payload.item).toEqual({
      name: '',
      indexPatterns: [],
      composedOf: [],
      priority: '',
      version: '',
      allowAutoCreate: '',
      ignoreMissingComponentTemplates: [],
      dataStreamEnabled: false,
      dataStreamHidden: false,
      dataStreamAllowCustomRouting: false,
      settings: '',
      mappings: '',
      aliases: '',
      meta: '',
      deprecated: false,
    });
  });

  it('an existing panel parses a minimal saved template from disk', async () => {
    const saved: IndexTemplateDefinition = {
      name: 'logs-myapp',
      index_patterns: ['logs-myapp-*'],
    };
    const filePath = await saveIndexTemplate(undefined, saved);

    IndexTemplateEditorPanel.openExisting(extensionUri, () => undefined, filePath);
    const payload = (await sendReady()) as {
      isNew: boolean;
      item: {
        name: string;
        indexPatterns: string[];
        composedOf: string[];
        priority: string;
        version: string;
        allowAutoCreate: string;
        ignoreMissingComponentTemplates: string[];
        dataStreamEnabled: boolean;
        settings: string;
        mappings: string;
        aliases: string;
        meta: string;
      };
    };

    expect(payload.isNew).toBe(false);
    expect(payload.item.name).toBe('logs-myapp');
    expect(payload.item.indexPatterns).toEqual(['logs-myapp-*']);
    expect(payload.item.composedOf).toEqual([]);
    expect(payload.item.priority).toBe('');
    expect(payload.item.version).toBe('');
    expect(payload.item.allowAutoCreate).toBe('');
    expect(payload.item.ignoreMissingComponentTemplates).toEqual([]);
    expect(payload.item.dataStreamEnabled).toBe(false);
    expect(payload.item.settings).toBe('');
    expect(payload.item.mappings).toBe('');
    expect(payload.item.aliases).toBe('');
    expect(payload.item.meta).toBe('');
  });

  it('an existing panel parses a fully populated saved template from disk', async () => {
    const saved: IndexTemplateDefinition = {
      name: 'logs-myapp',
      index_patterns: ['logs-myapp-*'],
      composed_of: ['logs-mappings', 'logs-settings'],
      priority: 200,
      version: 3,
      allow_auto_create: false,
      ignore_missing_component_templates: ['maybe-missing'],
      data_stream: { hidden: true, allow_custom_routing: true },
      template: {
        settings: { number_of_shards: 1 },
        mappings: { properties: { message: { type: 'text' } } },
        aliases: { 'logs-myapp-alias': {} },
      },
      _meta: { managed_by: 'cmt' },
      deprecated: true,
    };
    const filePath = await saveIndexTemplate(undefined, saved);

    IndexTemplateEditorPanel.openExisting(extensionUri, () => undefined, filePath);
    const payload = (await sendReady()) as {
      item: {
        composedOf: string[];
        priority: string;
        version: string;
        allowAutoCreate: string;
        ignoreMissingComponentTemplates: string[];
        dataStreamEnabled: boolean;
        dataStreamHidden: boolean;
        dataStreamAllowCustomRouting: boolean;
        settings: string;
        mappings: string;
        aliases: string;
        meta: string;
        deprecated: boolean;
      };
    };

    expect(payload.item.composedOf).toEqual(['logs-mappings', 'logs-settings']);
    expect(payload.item.priority).toBe('200');
    expect(payload.item.version).toBe('3');
    expect(payload.item.allowAutoCreate).toBe('false');
    expect(payload.item.ignoreMissingComponentTemplates).toEqual(['maybe-missing']);
    expect(payload.item.dataStreamEnabled).toBe(true);
    expect(payload.item.dataStreamHidden).toBe(true);
    expect(payload.item.dataStreamAllowCustomRouting).toBe(true);
    expect(JSON.parse(payload.item.settings)).toEqual({ number_of_shards: 1 });
    expect(JSON.parse(payload.item.mappings)).toEqual({ properties: { message: { type: 'text' } } });
    expect(JSON.parse(payload.item.aliases)).toEqual({ 'logs-myapp-alias': {} });
    expect(JSON.parse(payload.item.meta)).toEqual({ managed_by: 'cmt' });
    expect(payload.item.deprecated).toBe(true);
  });

  it('an existing panel with no index_patterns key (legacy/malformed file) sends an empty array', async () => {
    const indexTemplatesDir = path.join(workspaceRoot, 'Elastic_Source', 'Index_Templates');
    fs.mkdirSync(indexTemplatesDir, { recursive: true });
    const filePath = path.join(indexTemplatesDir, 'legacy-template.json');
    fs.writeFileSync(filePath, JSON.stringify({ name: 'legacy-template' }));

    IndexTemplateEditorPanel.openExisting(extensionUri, () => undefined, filePath);
    const payload = (await sendReady()) as { item: { indexPatterns: string[] } };

    expect(payload.item.indexPatterns).toEqual([]);
  });

  it('an existing panel with allow_auto_create explicitly true reports "true"', async () => {
    const filePath = await saveIndexTemplate(undefined, {
      name: 'logs-myapp',
      index_patterns: ['logs-myapp-*'],
      allow_auto_create: true,
    });

    IndexTemplateEditorPanel.openExisting(extensionUri, () => undefined, filePath);
    const payload = (await sendReady()) as { item: { allowAutoCreate: string } };

    expect(payload.item.allowAutoCreate).toBe('true');
  });

  it('opening the same filePath twice reveals the existing panel instead of creating a second one', async () => {
    const filePath = await saveIndexTemplate(undefined, {
      name: 'logs-myapp',
      index_patterns: ['logs-myapp-*'],
    });

    IndexTemplateEditorPanel.openExisting(extensionUri, () => undefined, filePath);
    const firstPanel = lastPanel();

    IndexTemplateEditorPanel.openExisting(extensionUri, () => undefined, filePath);

    expect(firstPanel.revealCount).toBe(1);
    expect(lastPanel()).toBe(firstPanel);
  });

  it('saves a minimal template, omitting every unset optional field', async () => {
    IndexTemplateEditorPanel.openNew(extensionUri, () => undefined);

    const message = await sendSave({
      name: 'logs-myapp',
      indexPatterns: ['logs-myapp-*'],
      composedOf: [],
      priority: '',
      version: '',
      allowAutoCreate: '',
      ignoreMissingComponentTemplates: [],
      dataStreamEnabled: false,
      dataStreamHidden: false,
      dataStreamAllowCustomRouting: false,
      settings: '',
      mappings: '',
      aliases: '',
      meta: '',
      deprecated: false,
    });

    expect(message.type).toBe('saved');
    const data = message.payload as IndexTemplateDefinition;
    expect(data).toEqual({ name: 'logs-myapp', index_patterns: ['logs-myapp-*'] });
  });

  it('saves a fully populated template', async () => {
    IndexTemplateEditorPanel.openNew(extensionUri, () => undefined);

    const message = await sendSave({
      name: 'logs-myapp',
      indexPatterns: ['logs-myapp-*', 'logs-myapp-legacy-*'],
      composedOf: ['logs-mappings', 'logs-settings'],
      priority: '200',
      version: '3',
      allowAutoCreate: 'true',
      ignoreMissingComponentTemplates: ['maybe-missing'],
      dataStreamEnabled: true,
      dataStreamHidden: true,
      dataStreamAllowCustomRouting: true,
      settings: '{"number_of_shards": 1}',
      mappings: '{"properties": {"message": {"type": "text"}}}',
      aliases: '{"logs-myapp-alias": {}}',
      meta: '{"managed_by": "cmt"}',
      deprecated: true,
    });

    expect(message.type).toBe('saved');
    const data = message.payload as IndexTemplateDefinition;
    expect(data).toEqual({
      name: 'logs-myapp',
      index_patterns: ['logs-myapp-*', 'logs-myapp-legacy-*'],
      composed_of: ['logs-mappings', 'logs-settings'],
      priority: 200,
      version: 3,
      allow_auto_create: true,
      ignore_missing_component_templates: ['maybe-missing'],
      data_stream: { hidden: true, allow_custom_routing: true },
      template: {
        settings: { number_of_shards: 1 },
        mappings: { properties: { message: { type: 'text' } } },
        aliases: { 'logs-myapp-alias': {} },
      },
      _meta: { managed_by: 'cmt' },
      deprecated: true,
    });
  });

  it('saves only the template sub-key that was actually set, omitting the other two', async () => {
    IndexTemplateEditorPanel.openNew(extensionUri, () => undefined);

    const message = await sendSave({
      name: 'logs-myapp',
      indexPatterns: ['logs-myapp-*'],
      mappings: '{"properties": {"message": {"type": "text"}}}',
    });

    expect(message.type).toBe('saved');
    expect((message.payload as IndexTemplateDefinition).template).toEqual({
      mappings: { properties: { message: { type: 'text' } } },
    });
  });

  it('saves settings and aliases without mappings when only those two are set', async () => {
    IndexTemplateEditorPanel.openNew(extensionUri, () => undefined);

    const message = await sendSave({
      name: 'logs-myapp',
      indexPatterns: ['logs-myapp-*'],
      settings: '{"number_of_shards": 1}',
      aliases: '{"logs-myapp-alias": {}}',
    });

    expect(message.type).toBe('saved');
    expect((message.payload as IndexTemplateDefinition).template).toEqual({
      settings: { number_of_shards: 1 },
      aliases: { 'logs-myapp-alias': {} },
    });
  });

  it('saves allow_auto_create as false when explicitly selected', async () => {
    IndexTemplateEditorPanel.openNew(extensionUri, () => undefined);

    const message = await sendSave({
      name: 'logs-myapp',
      indexPatterns: ['logs-myapp-*'],
      allowAutoCreate: 'false',
    });

    expect((message.payload as IndexTemplateDefinition).allow_auto_create).toBe(false);
  });

  it('enabling the data stream template without hidden/allow_custom_routing saves an empty data_stream object', async () => {
    IndexTemplateEditorPanel.openNew(extensionUri, () => undefined);

    const message = await sendSave({
      name: 'logs-myapp',
      indexPatterns: ['logs-myapp-*'],
      dataStreamEnabled: true,
      dataStreamHidden: false,
      dataStreamAllowCustomRouting: false,
    });

    expect((message.payload as IndexTemplateDefinition).data_stream).toEqual({});
  });

  it('treats an entirely missing name as invalid', async () => {
    IndexTemplateEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({ indexPatterns: ['logs-myapp-*'] });
    expect(message).toEqual({ type: 'error', message: 'Name is required.' });
  });

  it('rejects a blank name', async () => {
    IndexTemplateEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({ name: '', indexPatterns: ['logs-myapp-*'] });
    expect(message).toEqual({ type: 'error', message: 'Name is required.' });
  });

  it('treats an entirely missing indexPatterns field as invalid', async () => {
    IndexTemplateEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({ name: 'logs-myapp' });
    expect(message).toEqual({ type: 'error', message: 'At least one index pattern is required.' });
  });

  it('rejects an empty indexPatterns array', async () => {
    IndexTemplateEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({ name: 'logs-myapp', indexPatterns: [] });
    expect(message).toEqual({ type: 'error', message: 'At least one index pattern is required.' });
  });

  it('rejects a non-numeric priority', async () => {
    IndexTemplateEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({
      name: 'logs-myapp',
      indexPatterns: ['logs-myapp-*'],
      priority: 'not-a-number',
    });
    expect(message).toEqual({ type: 'error', message: 'Priority must be a number.' });
  });

  it('rejects a non-numeric version', async () => {
    IndexTemplateEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({
      name: 'logs-myapp',
      indexPatterns: ['logs-myapp-*'],
      version: 'not-a-number',
    });
    expect(message).toEqual({ type: 'error', message: 'Version must be a number.' });
  });

  it('rejects malformed JSON in the settings field', async () => {
    IndexTemplateEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({
      name: 'logs-myapp',
      indexPatterns: ['logs-myapp-*'],
      settings: '{ not valid json',
    });
    expect(message).toEqual({ type: 'error', message: 'Settings must be valid JSON.' });
  });

  it('rejects settings that parse but are not a JSON object', async () => {
    IndexTemplateEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({
      name: 'logs-myapp',
      indexPatterns: ['logs-myapp-*'],
      settings: '[1, 2, 3]',
    });
    expect(message).toEqual({ type: 'error', message: 'Settings must be a JSON object.' });
  });

  it('rejects malformed JSON in the mappings field', async () => {
    IndexTemplateEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({
      name: 'logs-myapp',
      indexPatterns: ['logs-myapp-*'],
      mappings: '{ not valid json',
    });
    expect(message).toEqual({ type: 'error', message: 'Mappings must be valid JSON.' });
  });

  it('rejects mappings that parse but are not a JSON object', async () => {
    IndexTemplateEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({
      name: 'logs-myapp',
      indexPatterns: ['logs-myapp-*'],
      mappings: 'null',
    });
    expect(message).toEqual({ type: 'error', message: 'Mappings must be a JSON object.' });
  });

  it('rejects malformed JSON in the aliases field', async () => {
    IndexTemplateEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({
      name: 'logs-myapp',
      indexPatterns: ['logs-myapp-*'],
      aliases: '{ not valid json',
    });
    expect(message).toEqual({ type: 'error', message: 'Aliases must be valid JSON.' });
  });

  it('rejects aliases that parse but are not a JSON object', async () => {
    IndexTemplateEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({
      name: 'logs-myapp',
      indexPatterns: ['logs-myapp-*'],
      aliases: '"a string"',
    });
    expect(message).toEqual({ type: 'error', message: 'Aliases must be a JSON object.' });
  });

  it('rejects malformed JSON in the metadata field', async () => {
    IndexTemplateEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({
      name: 'logs-myapp',
      indexPatterns: ['logs-myapp-*'],
      meta: '{ not valid json',
    });
    expect(message).toEqual({ type: 'error', message: 'Metadata must be valid JSON.' });
  });

  it('rejects metadata that parses but is not a JSON object', async () => {
    IndexTemplateEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({
      name: 'logs-myapp',
      indexPatterns: ['logs-myapp-*'],
      meta: '[1, 2, 3]',
    });
    expect(message).toEqual({ type: 'error', message: 'Metadata must be a JSON object.' });
  });

  it('rejects a name colliding with an existing template', async () => {
    await saveIndexTemplate(undefined, { name: 'taken-template', index_patterns: ['logs-*'] });
    IndexTemplateEditorPanel.openNew(extensionUri, () => undefined);

    const message = await sendSave({ name: 'taken-template', indexPatterns: ['logs-myapp-*'] });
    expect(message).toEqual({
      type: 'error',
      message: 'An Index Template named "taken-template" already exists.',
    });
  });

  it('supports the @ character in file names', async () => {
    IndexTemplateEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({ name: 'logs-myapp@custom', indexPatterns: ['logs-myapp-*'] });

    expect(message.type).toBe('saved');
    const ilmDir = path.join(workspaceRoot, 'Elastic_Source', 'Index_Templates');
    expect(fs.existsSync(path.join(ilmDir, 'logs-myapp@custom.json'))).toBe(true);
  });
});
