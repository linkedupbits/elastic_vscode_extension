import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { IndexTemplateEditorPanel } from '../../../src/editors/indexTemplateEditorPanel';
import { CUSTOM_MAPPING_TYPE_ID, MappingFieldFormValue } from '../../../src/indexTemplates/mappingsTemplate';
import { IndexTemplateDefinition } from '../../../src/models';
import { saveIndexTemplate } from '../../../src/repositories';
import { makeTempDir, removeTempDir } from '../../helpers/tempDir';
import { vscodeMock } from '../../helpers/vscodeMock';
import { lastPanel, sendReady, sendSave } from '../../helpers/webviewPanel';

const extensionUri = vscode.Uri.file('/ext');

function blankSettings() {
  return { fields: {}, advanced: '' };
}

function blankMappings() {
  return { dynamic: '', disableSource: false, fields: [] as MappingFieldFormValue[] };
}

function mappingField(overrides: Partial<MappingFieldFormValue> = {}): MappingFieldFormValue {
  return { name: '', type: 'text', isCustom: false, customType: '', customConfig: '{}', options: {}, ...overrides };
}

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
        settingsEnabled: boolean;
        settings: { fields: Record<string, string>; advanced: string };
        mappingsEnabled: boolean;
        mappings: { dynamic: string; disableSource: boolean; fields: unknown[] };
        aliasesEnabled: boolean;
        aliases: unknown[];
        meta: string;
        deprecated: boolean;
      };
      settingsFields: { key: string }[];
      mappingFieldTypes: { id: string }[];
    };

    expect(payload.isNew).toBe(true);
    expect(payload.item.name).toBe('');
    expect(payload.item.indexPatterns).toEqual([]);
    expect(payload.item.composedOf).toEqual([]);
    expect(payload.item.priority).toBe('');
    expect(payload.item.version).toBe('');
    expect(payload.item.allowAutoCreate).toBe('');
    expect(payload.item.ignoreMissingComponentTemplates).toEqual([]);
    expect(payload.item.dataStreamEnabled).toBe(false);
    expect(payload.item.dataStreamHidden).toBe(false);
    expect(payload.item.dataStreamAllowCustomRouting).toBe(false);
    expect(payload.item.settingsEnabled).toBe(false);
    expect(payload.item.settings.advanced).toBe('');
    expect(Object.values(payload.item.settings.fields).every((v) => v === '')).toBe(true);
    expect(payload.item.mappingsEnabled).toBe(false);
    expect(payload.item.mappings).toEqual({ dynamic: '', disableSource: false, fields: [] });
    expect(payload.item.aliasesEnabled).toBe(false);
    expect(payload.item.aliases).toEqual([]);
    expect(payload.item.meta).toBe('');
    expect(payload.item.deprecated).toBe(false);
    expect(payload.settingsFields.length).toBeGreaterThan(0);
    expect(payload.mappingFieldTypes.length).toBeGreaterThan(0);
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
        settingsEnabled: boolean;
        settings: { fields: Record<string, string>; advanced: string };
        mappingsEnabled: boolean;
        mappings: { dynamic: string; disableSource: boolean; fields: unknown[] };
        aliasesEnabled: boolean;
        aliases: unknown[];
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
    expect(payload.item.settingsEnabled).toBe(false);
    expect(payload.item.settings.advanced).toBe('');
    expect(payload.item.mappingsEnabled).toBe(false);
    expect(payload.item.mappings).toEqual({ dynamic: '', disableSource: false, fields: [] });
    expect(payload.item.aliasesEnabled).toBe(false);
    expect(payload.item.aliases).toEqual([]);
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
        settings: { number_of_shards: 1, 'sort.field': 'timestamp' },
        mappings: { dynamic: 'strict', properties: { message: { type: 'text' } } },
        aliases: { 'logs-myapp-alias': { is_write_index: true } },
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
        settingsEnabled: boolean;
        settings: { fields: Record<string, string>; advanced: string };
        mappingsEnabled: boolean;
        mappings: { dynamic: string; disableSource: boolean; fields: { name: string; type: string }[] };
        aliasesEnabled: boolean;
        aliases: { name: string; isWriteIndex: boolean }[];
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
    expect(payload.item.settingsEnabled).toBe(true);
    expect(payload.item.settings.fields.number_of_shards).toBe('1');
    expect(JSON.parse(payload.item.settings.advanced)).toEqual({ 'sort.field': 'timestamp' });
    expect(payload.item.mappingsEnabled).toBe(true);
    expect(payload.item.mappings.dynamic).toBe('strict');
    expect(payload.item.mappings.fields).toEqual([{ name: 'message', type: 'text', isCustom: false, customType: '', customConfig: '{}', options: { analyzer: '', add_keyword_subfield: false } }]);
    expect(payload.item.aliasesEnabled).toBe(true);
    expect(payload.item.aliases).toEqual([{ name: 'logs-myapp-alias', isWriteIndex: true, isHidden: false, routing: '', filter: '' }]);
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
      settings: blankSettings(),
      mappings: blankMappings(),
      aliases: [],
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
      settingsEnabled: true,
      settings: { fields: { number_of_shards: '1' }, advanced: '' },
      mappingsEnabled: true,
      mappings: {
        dynamic: 'strict',
        disableSource: true,
        fields: [mappingField({ name: 'message', type: 'text' })],
      },
      aliasesEnabled: true,
      aliases: [{ name: 'logs-myapp-alias', isWriteIndex: true, isHidden: false, routing: '', filter: '' }],
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
        mappings: { dynamic: 'strict', _source: { enabled: false }, properties: { message: { type: 'text' } } },
        aliases: { 'logs-myapp-alias': { is_write_index: true } },
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
      mappingsEnabled: true,
      mappings: { dynamic: '', disableSource: false, fields: [mappingField({ name: 'message', type: 'text' })] },
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
      settingsEnabled: true,
      settings: { fields: { number_of_shards: '1' }, advanced: '' },
      aliasesEnabled: true,
      aliases: [{ name: 'logs-myapp-alias', isWriteIndex: false, isHidden: false, routing: '', filter: '' }],
    });

    expect(message.type).toBe('saved');
    expect((message.payload as IndexTemplateDefinition).template).toEqual({
      settings: { number_of_shards: 1 },
      aliases: { 'logs-myapp-alias': {} },
    });
  });

  it('treats an entirely missing settings/mappings/aliases as unset', async () => {
    IndexTemplateEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({ name: 'logs-myapp', indexPatterns: ['logs-myapp-*'] });

    expect(message.type).toBe('saved');
    expect((message.payload as IndexTemplateDefinition).template).toBeUndefined();
  });

  describe('Include Settings/Mappings/Aliases toggles', () => {
    it('excludes settings from the saved template when settingsEnabled is false, even if fields are populated', async () => {
      IndexTemplateEditorPanel.openNew(extensionUri, () => undefined);
      const message = await sendSave({
        name: 'logs-myapp',
        indexPatterns: ['logs-myapp-*'],
        settingsEnabled: false,
        settings: { fields: { number_of_shards: '3' }, advanced: '' },
      });

      expect(message.type).toBe('saved');
      expect((message.payload as IndexTemplateDefinition).template).toBeUndefined();
    });

    it('excludes settings without validating them when settingsEnabled is false, even if malformed', async () => {
      IndexTemplateEditorPanel.openNew(extensionUri, () => undefined);
      const message = await sendSave({
        name: 'logs-myapp',
        indexPatterns: ['logs-myapp-*'],
        settingsEnabled: false,
        settings: { fields: { number_of_shards: 'not-a-number' }, advanced: '{ not valid json' },
      });

      expect(message.type).toBe('saved');
    });

    it('excludes mappings from the saved template when mappingsEnabled is false, even if fields are populated', async () => {
      IndexTemplateEditorPanel.openNew(extensionUri, () => undefined);
      const message = await sendSave({
        name: 'logs-myapp',
        indexPatterns: ['logs-myapp-*'],
        mappingsEnabled: false,
        mappings: { dynamic: 'strict', disableSource: true, fields: [mappingField({ name: 'message', type: 'text' })] },
      });

      expect(message.type).toBe('saved');
      expect((message.payload as IndexTemplateDefinition).template).toBeUndefined();
    });

    it('excludes mappings without validating them when mappingsEnabled is false, even if invalid', async () => {
      IndexTemplateEditorPanel.openNew(extensionUri, () => undefined);
      const message = await sendSave({
        name: 'logs-myapp',
        indexPatterns: ['logs-myapp-*'],
        mappingsEnabled: false,
        mappings: { dynamic: '', disableSource: false, fields: [mappingField({ name: '' })] },
      });

      expect(message.type).toBe('saved');
    });

    it('excludes aliases from the saved template when aliasesEnabled is false, even if rows are populated', async () => {
      IndexTemplateEditorPanel.openNew(extensionUri, () => undefined);
      const message = await sendSave({
        name: 'logs-myapp',
        indexPatterns: ['logs-myapp-*'],
        aliasesEnabled: false,
        aliases: [{ name: 'logs-myapp-alias', isWriteIndex: true, isHidden: false, routing: '', filter: '' }],
      });

      expect(message.type).toBe('saved');
      expect((message.payload as IndexTemplateDefinition).template).toBeUndefined();
    });

    it('excludes aliases without validating them when aliasesEnabled is false, even if invalid', async () => {
      IndexTemplateEditorPanel.openNew(extensionUri, () => undefined);
      const message = await sendSave({
        name: 'logs-myapp',
        indexPatterns: ['logs-myapp-*'],
        aliasesEnabled: false,
        aliases: [{ name: '', isWriteIndex: false, isHidden: false, routing: '', filter: '' }],
      });

      expect(message.type).toBe('saved');
    });

    it('treats settingsEnabled: true with an entirely missing settings key as blank settings', async () => {
      IndexTemplateEditorPanel.openNew(extensionUri, () => undefined);
      const message = await sendSave({ name: 'logs-myapp', indexPatterns: ['logs-myapp-*'], settingsEnabled: true });

      expect(message.type).toBe('saved');
      expect((message.payload as IndexTemplateDefinition).template).toBeUndefined();
    });

    it('treats mappingsEnabled: true with an entirely missing mappings key as blank mappings', async () => {
      IndexTemplateEditorPanel.openNew(extensionUri, () => undefined);
      const message = await sendSave({ name: 'logs-myapp', indexPatterns: ['logs-myapp-*'], mappingsEnabled: true });

      expect(message.type).toBe('saved');
      expect((message.payload as IndexTemplateDefinition).template).toBeUndefined();
    });

    it('treats aliasesEnabled: true with an entirely missing aliases key as no aliases', async () => {
      IndexTemplateEditorPanel.openNew(extensionUri, () => undefined);
      const message = await sendSave({ name: 'logs-myapp', indexPatterns: ['logs-myapp-*'], aliasesEnabled: true });

      expect(message.type).toBe('saved');
      expect((message.payload as IndexTemplateDefinition).template).toBeUndefined();
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

  describe('Settings', () => {
    it('rejects a non-numeric curated numeric field', async () => {
      IndexTemplateEditorPanel.openNew(extensionUri, () => undefined);
      const message = await sendSave({
        name: 'logs-myapp',
        indexPatterns: ['logs-myapp-*'],
        settingsEnabled: true,
        settings: { fields: { number_of_shards: 'not-a-number' }, advanced: '' },
      });
      expect(message).toEqual({ type: 'error', message: '"Number of Shards" must be a number.' });
    });

    it('rejects malformed JSON in Advanced Settings', async () => {
      IndexTemplateEditorPanel.openNew(extensionUri, () => undefined);
      const message = await sendSave({
        name: 'logs-myapp',
        indexPatterns: ['logs-myapp-*'],
        settingsEnabled: true,
        settings: { fields: {}, advanced: '{ not valid json' },
      });
      expect(message).toEqual({ type: 'error', message: 'Advanced Settings must be valid JSON.' });
    });

    it('rejects Advanced Settings that parse but are not a JSON object', async () => {
      IndexTemplateEditorPanel.openNew(extensionUri, () => undefined);
      const message = await sendSave({
        name: 'logs-myapp',
        indexPatterns: ['logs-myapp-*'],
        settingsEnabled: true,
        settings: { fields: {}, advanced: '[1, 2, 3]' },
      });
      expect(message).toEqual({ type: 'error', message: 'Advanced Settings must be a JSON object.' });
    });
  });

  describe('Mappings', () => {
    it('saves a curated field with its structured options', async () => {
      IndexTemplateEditorPanel.openNew(extensionUri, () => undefined);
      const message = await sendSave({
        name: 'logs-myapp',
        indexPatterns: ['logs-myapp-*'],
        mappingsEnabled: true,
        mappings: {
          dynamic: '',
          disableSource: false,
          fields: [mappingField({ name: 'status', type: 'keyword', options: { ignore_above: 256 } })],
        },
      });
      expect((message.payload as IndexTemplateDefinition).template?.mappings).toEqual({
        properties: { status: { type: 'keyword', ignore_above: 256 } },
      });
    });

    it('saves a custom/uncurated field type verbatim', async () => {
      IndexTemplateEditorPanel.openNew(extensionUri, () => undefined);
      const message = await sendSave({
        name: 'logs-myapp',
        indexPatterns: ['logs-myapp-*'],
        mappingsEnabled: true,
        mappings: {
          dynamic: '',
          disableSource: false,
          fields: [
            mappingField({
              name: 'embedding',
              type: CUSTOM_MAPPING_TYPE_ID,
              isCustom: true,
              customType: 'dense_vector',
              customConfig: '{"dims": 384}',
            }),
          ],
        },
      });
      expect((message.payload as IndexTemplateDefinition).template?.mappings).toEqual({
        properties: { embedding: { type: 'dense_vector', dims: 384 } },
      });
    });

    it('rejects a field with a blank name', async () => {
      IndexTemplateEditorPanel.openNew(extensionUri, () => undefined);
      const message = await sendSave({
        name: 'logs-myapp',
        indexPatterns: ['logs-myapp-*'],
        mappingsEnabled: true,
        mappings: { dynamic: '', disableSource: false, fields: [mappingField({ name: '' })] },
      });
      expect(message).toEqual({ type: 'error', message: 'Field 1: Field Name is required.' });
    });

    it('rejects two fields sharing the same name', async () => {
      IndexTemplateEditorPanel.openNew(extensionUri, () => undefined);
      const message = await sendSave({
        name: 'logs-myapp',
        indexPatterns: ['logs-myapp-*'],
        mappingsEnabled: true,
        mappings: {
          dynamic: '',
          disableSource: false,
          fields: [mappingField({ name: 'status' }), mappingField({ name: 'status' })],
        },
      });
      expect(message).toEqual({ type: 'error', message: 'Field 2: A field named "status" is already defined.' });
    });

    it('rejects a custom field with a blank type', async () => {
      IndexTemplateEditorPanel.openNew(extensionUri, () => undefined);
      const message = await sendSave({
        name: 'logs-myapp',
        indexPatterns: ['logs-myapp-*'],
        mappingsEnabled: true,
        mappings: {
          dynamic: '',
          disableSource: false,
          fields: [mappingField({ name: 'embedding', type: CUSTOM_MAPPING_TYPE_ID, isCustom: true, customType: '' })],
        },
      });
      expect(message).toEqual({ type: 'error', message: 'Field 1 ("embedding"): Field Type is required.' });
    });

    it('rejects a custom field with invalid configuration JSON', async () => {
      IndexTemplateEditorPanel.openNew(extensionUri, () => undefined);
      const message = await sendSave({
        name: 'logs-myapp',
        indexPatterns: ['logs-myapp-*'],
        mappingsEnabled: true,
        mappings: {
          dynamic: '',
          disableSource: false,
          fields: [
            mappingField({
              name: 'embedding',
              type: CUSTOM_MAPPING_TYPE_ID,
              isCustom: true,
              customType: 'dense_vector',
              customConfig: '{ not valid json',
            }),
          ],
        },
      });
      expect(message).toEqual({ type: 'error', message: 'Field 1 ("embedding"): Configuration must be valid JSON.' });
    });
  });

  describe('Aliases', () => {
    it('saves an alias with structured fields plus a filter', async () => {
      IndexTemplateEditorPanel.openNew(extensionUri, () => undefined);
      const message = await sendSave({
        name: 'logs-myapp',
        indexPatterns: ['logs-myapp-*'],
        aliasesEnabled: true,
        aliases: [
          {
            name: 'logs-myapp-alias',
            isWriteIndex: true,
            isHidden: true,
            routing: 'shard1',
            filter: '{"term": {"tenant": "acme"}}',
          },
        ],
      });
      expect((message.payload as IndexTemplateDefinition).template?.aliases).toEqual({
        'logs-myapp-alias': { is_write_index: true, is_hidden: true, routing: 'shard1', filter: { term: { tenant: 'acme' } } },
      });
    });

    it('rejects an alias with a blank name', async () => {
      IndexTemplateEditorPanel.openNew(extensionUri, () => undefined);
      const message = await sendSave({
        name: 'logs-myapp',
        indexPatterns: ['logs-myapp-*'],
        aliasesEnabled: true,
        aliases: [{ name: '', isWriteIndex: false, isHidden: false, routing: '', filter: '' }],
      });
      expect(message).toEqual({ type: 'error', message: 'Alias 1: Alias Name is required.' });
    });

    it('rejects two aliases sharing the same name', async () => {
      IndexTemplateEditorPanel.openNew(extensionUri, () => undefined);
      const message = await sendSave({
        name: 'logs-myapp',
        indexPatterns: ['logs-myapp-*'],
        aliasesEnabled: true,
        aliases: [
          { name: 'logs-myapp-alias', isWriteIndex: false, isHidden: false, routing: '', filter: '' },
          { name: 'logs-myapp-alias', isWriteIndex: false, isHidden: false, routing: '', filter: '' },
        ],
      });
      expect(message).toEqual({ type: 'error', message: 'Alias 2: An alias named "logs-myapp-alias" is already defined.' });
    });

    it('rejects an alias with an invalid filter', async () => {
      IndexTemplateEditorPanel.openNew(extensionUri, () => undefined);
      const message = await sendSave({
        name: 'logs-myapp',
        indexPatterns: ['logs-myapp-*'],
        aliasesEnabled: true,
        aliases: [{ name: 'logs-myapp-alias', isWriteIndex: false, isHidden: false, routing: '', filter: '{ not valid json' }],
      });
      expect(message).toEqual({ type: 'error', message: 'Alias 1 ("logs-myapp-alias"): Filter must be valid JSON.' });
    });
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
