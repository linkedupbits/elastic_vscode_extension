import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { IlmPolicyEditorPanel } from '../../../src/editors/ilmPolicyEditorPanel';
import { IlmPolicyDefinition } from '../../../src/models';
import { saveIlmPolicy } from '../../../src/repositories';
import { makeTempDir, removeTempDir } from '../../helpers/tempDir';
import { vscodeMock } from '../../helpers/vscodeMock';
import { lastPanel, sendReady, sendSave } from '../../helpers/webviewPanel';

const extensionUri = vscode.Uri.file('/ext');

/** A minimal valid phases payload (only Hot enabled) reused by the mapping-focused tests below. */
const enabledHotOnlyPhases = {
  hot: { enabled: true, min_age: '0ms', actions: {} },
  warm: { enabled: false, min_age: '30d', actions: {} },
  cold: { enabled: false, min_age: '60d', actions: {} },
  frozen: { enabled: false, min_age: '90d', actions: {} },
  delete: { enabled: false, min_age: '90d', actions: {} },
};

describe('IlmPolicyEditorPanel', () => {
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

  it('a new panel starts with the Hot rollover/set_priority + Delete starter preset enabled', async () => {
    IlmPolicyEditorPanel.openNew(extensionUri, () => undefined);
    const payload = (await sendReady()) as {
      isNew: boolean;
      item: { name: string; phases: Record<string, { enabled: boolean; actions: Record<string, { enabled: boolean }> }> };
    };

    expect(payload.isNew).toBe(true);
    expect(payload.item.name).toBe('');
    expect(payload.item.phases.hot.enabled).toBe(true);
    expect(payload.item.phases.hot.actions.rollover.enabled).toBe(true);
    expect(payload.item.phases.hot.actions.set_priority.enabled).toBe(true);
    expect(payload.item.phases.delete.enabled).toBe(true);
    expect(payload.item.phases.delete.actions.delete.enabled).toBe(true);
    expect(payload.item.phases.warm.enabled).toBe(false);
  });

  it('a new panel starts with no integration lifecycle mappings', async () => {
    IlmPolicyEditorPanel.openNew(extensionUri, () => undefined);
    const payload = (await sendReady()) as { item: { mappings: unknown[] } };
    expect(payload.item.mappings).toEqual([]);
  });

  it('an existing panel parses the saved policy.phases and policy._meta from disk', async () => {
    const saved: IlmPolicyDefinition = {
      name: 'logs-default-policy',
      policy: {
        phases: {
          hot: { min_age: '0ms', actions: { set_priority: { priority: 100 } } },
        },
        _meta: { owner: 'platform-team' },
      },
      integration_lifecycle_mappings: [
        { data_stream_type: 'logs', dataset_name: 'map_python', integration_name: 'filestream', namespace: 'cmt' },
      ],
    };
    const filePath = await saveIlmPolicy(undefined, saved);

    IlmPolicyEditorPanel.openExisting(extensionUri, () => undefined, filePath);
    const payload = (await sendReady()) as {
      isNew: boolean;
      item: {
        name: string;
        meta: string;
        phases: Record<string, { enabled: boolean }>;
        mappings: { data_stream_type: string; dataset_name: string; integration_name: string; namespace: string }[];
      };
    };

    expect(payload.isNew).toBe(false);
    expect(payload.item.name).toBe('logs-default-policy');
    expect(payload.item.phases.hot.enabled).toBe(true);
    expect(payload.item.phases.warm.enabled).toBe(false);
    expect(JSON.parse(payload.item.meta)).toEqual({ owner: 'platform-team' });
    expect(payload.item.mappings).toEqual([
      { data_stream_type: 'logs', dataset_name: 'map_python', integration_name: 'filestream', namespace: 'cmt' },
    ]);
  });

  it('an existing panel with no integration_lifecycle_mappings key (legacy file) sends an empty array', async () => {
    const ilmDir = path.join(workspaceRoot, 'Elastic_Source', 'Index_Lifecycle_Policies');
    fs.mkdirSync(ilmDir, { recursive: true });
    const filePath = path.join(ilmDir, 'legacy-policy.json');
    fs.writeFileSync(
      filePath,
      JSON.stringify({ name: 'legacy-policy', policy: { phases: { delete: { actions: { delete: {} } } } } })
    );

    IlmPolicyEditorPanel.openExisting(extensionUri, () => undefined, filePath);
    const payload = (await sendReady()) as { item: { mappings: unknown[] } };

    expect(payload.item.mappings).toEqual([]);
  });

  it('an existing panel with no policy._meta sends an empty meta string', async () => {
    const filePath = await saveIlmPolicy(undefined, {
      name: 'no-meta-policy',
      policy: { phases: { delete: { actions: { delete: {} } } } },
      integration_lifecycle_mappings: [],
    });

    IlmPolicyEditorPanel.openExisting(extensionUri, () => undefined, filePath);
    const payload = (await sendReady()) as { item: { meta: string } };

    expect(payload.item.meta).toBe('');
  });

  it('opening the same filePath twice reveals the existing panel instead of creating a second one', async () => {
    const filePath = await saveIlmPolicy(undefined, {
      name: 'logs-default-policy',
      policy: { phases: { delete: { actions: { delete: {} } } } },
      integration_lifecycle_mappings: [],
    });

    IlmPolicyEditorPanel.openExisting(extensionUri, () => undefined, filePath);
    const firstPanel = lastPanel();

    IlmPolicyEditorPanel.openExisting(extensionUri, () => undefined, filePath);

    expect(firstPanel.revealCount).toBe(1);
    expect(lastPanel()).toBe(firstPanel);
  });

  it('saves only the enabled phases/actions, omitting blank string fields', async () => {
    IlmPolicyEditorPanel.openNew(extensionUri, () => undefined);

    const message = await sendSave({
      name: 'logs-default-policy',
      phases: {
        hot: {
          enabled: true,
          min_age: '0ms',
          actions: {
            rollover: { enabled: true, fields: { max_age: '30d', max_primary_shard_size: '50gb', max_docs: 0 } },
            set_priority: { enabled: false, fields: { priority: 100 } },
            forcemerge: { enabled: false, fields: { max_num_segments: 1 } },
            shrink: { enabled: false, fields: { number_of_shards: 1 } },
            readonly: { enabled: false, fields: {} },
          },
        },
        warm: { enabled: false, min_age: '30d', actions: {} },
        cold: { enabled: false, min_age: '60d', actions: {} },
        frozen: { enabled: false, min_age: '90d', actions: {} },
        delete: { enabled: false, min_age: '90d', actions: {} },
      },
      meta: '',
    });

    expect(message.type).toBe('saved');
    const data = message.payload as IlmPolicyDefinition;
    expect(Object.keys(data.policy.phases)).toEqual(['hot']);
    expect(data.policy.phases.hot).toEqual({
      min_age: '0ms',
      actions: { rollover: { max_age: '30d', max_primary_shard_size: '50gb', max_docs: 0 } },
    });
    expect(data.policy._meta).toBeUndefined();
  });

  it('treats an entirely missing meta field as no metadata (distinct from an empty string)', async () => {
    IlmPolicyEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({
      name: 'logs-default-policy',
      phases: {
        hot: { enabled: true, min_age: '0ms', actions: {} },
        warm: { enabled: false, min_age: '30d', actions: {} },
        cold: { enabled: false, min_age: '60d', actions: {} },
        frozen: { enabled: false, min_age: '90d', actions: {} },
        delete: { enabled: false, min_age: '90d', actions: {} },
      },
      // meta intentionally omitted
    });

    expect(message.type).toBe('saved');
    expect((message.payload as IlmPolicyDefinition).policy._meta).toBeUndefined();
  });

  it('persists a valid policy._meta object', async () => {
    IlmPolicyEditorPanel.openNew(extensionUri, () => undefined);

    const message = await sendSave({
      name: 'logs-default-policy',
      phases: {
        hot: { enabled: true, min_age: '0ms', actions: {} },
        warm: { enabled: false, min_age: '30d', actions: {} },
        cold: { enabled: false, min_age: '60d', actions: {} },
        frozen: { enabled: false, min_age: '90d', actions: {} },
        delete: { enabled: false, min_age: '90d', actions: {} },
      },
      meta: '{"owner": "platform-team"}',
    });

    expect((message.payload as IlmPolicyDefinition).policy._meta).toEqual({ owner: 'platform-team' });
  });

  it('treats an entirely missing name as invalid', async () => {
    IlmPolicyEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({ meta: '' });
    expect(message).toEqual({ type: 'error', message: 'Name is required.' });
  });

  it('treats entirely missing phases/meta as their empty defaults', async () => {
    IlmPolicyEditorPanel.openNew(extensionUri, () => undefined);
    // phases and meta omitted entirely (not just blank/all-disabled), so the
    // `data.phases ?? buildDefaultPhasesFormValue()` and `data.meta ?? ''` fallbacks kick in.
    const message = await sendSave({ name: 'logs-default-policy' });
    expect(message).toEqual({
      type: 'error',
      message: 'Enable at least one phase (hot, warm, cold, frozen, delete).',
    });
  });

  it('rejects a blank name', async () => {
    IlmPolicyEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({
      name: '',
      phases: {
        hot: { enabled: true, min_age: '0ms', actions: {} },
        warm: { enabled: false, min_age: '30d', actions: {} },
        cold: { enabled: false, min_age: '60d', actions: {} },
        frozen: { enabled: false, min_age: '90d', actions: {} },
        delete: { enabled: false, min_age: '90d', actions: {} },
      },
      meta: '',
    });
    expect(message).toEqual({ type: 'error', message: 'Name is required.' });
  });

  it('rejects saving with no phase enabled', async () => {
    IlmPolicyEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({
      name: 'logs-default-policy',
      phases: {
        hot: { enabled: false, min_age: '0ms', actions: {} },
        warm: { enabled: false, min_age: '30d', actions: {} },
        cold: { enabled: false, min_age: '60d', actions: {} },
        frozen: { enabled: false, min_age: '90d', actions: {} },
        delete: { enabled: false, min_age: '90d', actions: {} },
      },
      meta: '',
    });
    expect(message).toEqual({
      type: 'error',
      message: 'Enable at least one phase (hot, warm, cold, frozen, delete).',
    });
  });

  it('rejects malformed JSON in the metadata field', async () => {
    IlmPolicyEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({
      name: 'logs-default-policy',
      phases: {
        hot: { enabled: true, min_age: '0ms', actions: {} },
        warm: { enabled: false, min_age: '30d', actions: {} },
        cold: { enabled: false, min_age: '60d', actions: {} },
        frozen: { enabled: false, min_age: '90d', actions: {} },
        delete: { enabled: false, min_age: '90d', actions: {} },
      },
      meta: '{ not valid json',
    });
    expect(message).toEqual({ type: 'error', message: 'Metadata must be valid JSON.' });
  });

  it('rejects metadata that parses but is not a JSON object', async () => {
    IlmPolicyEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({
      name: 'logs-default-policy',
      phases: {
        hot: { enabled: true, min_age: '0ms', actions: {} },
        warm: { enabled: false, min_age: '30d', actions: {} },
        cold: { enabled: false, min_age: '60d', actions: {} },
        frozen: { enabled: false, min_age: '90d', actions: {} },
        delete: { enabled: false, min_age: '90d', actions: {} },
      },
      meta: '[1, 2, 3]',
    });
    expect(message).toEqual({ type: 'error', message: 'Metadata must be a JSON object.' });
  });

  it('rejects a name colliding with an existing policy', async () => {
    await saveIlmPolicy(undefined, {
      name: 'taken-policy',
      policy: { phases: { delete: { actions: { delete: {} } } } },
      integration_lifecycle_mappings: [],
    });
    IlmPolicyEditorPanel.openNew(extensionUri, () => undefined);

    const message = await sendSave({
      name: 'taken-policy',
      phases: {
        hot: { enabled: true, min_age: '0ms', actions: {} },
        warm: { enabled: false, min_age: '30d', actions: {} },
        cold: { enabled: false, min_age: '60d', actions: {} },
        frozen: { enabled: false, min_age: '90d', actions: {} },
        delete: { enabled: false, min_age: '90d', actions: {} },
      },
      meta: '',
    });
    expect(message).toEqual({
      type: 'error',
      message: 'An Index Lifecycle Policy named "taken-policy" already exists.',
    });
  });

  describe('Integration Lifecycle Mappings', () => {
    it('persists a valid mapping array with trimmed values', async () => {
      IlmPolicyEditorPanel.openNew(extensionUri, () => undefined);
      const message = await sendSave({
        name: 'logs-default-policy',
        phases: enabledHotOnlyPhases,
        meta: '',
        mappings: [
          {
            data_stream_type: 'logs',
            dataset_name: '  map_python  ',
            integration_name: '  filestream  ',
            namespace: '  cmt  ',
          },
        ],
      });

      expect(message.type).toBe('saved');
      const data = message.payload as IlmPolicyDefinition;
      expect(data.integration_lifecycle_mappings).toEqual([
        { data_stream_type: 'logs', dataset_name: 'map_python', integration_name: 'filestream', namespace: 'cmt' },
      ]);
    });

    it('preserves multiple mappings in order', async () => {
      IlmPolicyEditorPanel.openNew(extensionUri, () => undefined);
      const mappings = [
        { data_stream_type: 'logs', dataset_name: 'map_python', integration_name: 'filestream', namespace: 'cmt' },
        { data_stream_type: 'metrics', dataset_name: 'map_system', integration_name: 'system', namespace: 'default' },
      ];

      const message = await sendSave({
        name: 'logs-default-policy',
        phases: enabledHotOnlyPhases,
        meta: '',
        mappings,
      });

      expect((message.payload as IlmPolicyDefinition).integration_lifecycle_mappings).toEqual(mappings);
    });

    it('defaults an entirely missing mappings field to an empty array', async () => {
      IlmPolicyEditorPanel.openNew(extensionUri, () => undefined);
      const message = await sendSave({ name: 'logs-default-policy', phases: enabledHotOnlyPhases, meta: '' });

      expect((message.payload as IlmPolicyDefinition).integration_lifecycle_mappings).toEqual([]);
    });

    it('ignores a non-array mappings value, treating it as no mappings', async () => {
      IlmPolicyEditorPanel.openNew(extensionUri, () => undefined);
      const message = await sendSave({
        name: 'logs-default-policy',
        phases: enabledHotOnlyPhases,
        meta: '',
        mappings: 'not-an-array',
      });

      expect((message.payload as IlmPolicyDefinition).integration_lifecycle_mappings).toEqual([]);
    });

    it('rejects a null mapping entry (falls back to an empty row, which then fails validation)', async () => {
      IlmPolicyEditorPanel.openNew(extensionUri, () => undefined);
      const message = await sendSave({
        name: 'logs-default-policy',
        phases: enabledHotOnlyPhases,
        meta: '',
        mappings: [null],
      });

      expect(message).toEqual({
        type: 'error',
        message: 'Integration Lifecycle Mapping 1: Data Stream Type must be "logs" or "metrics".',
      });
    });

    it('treats entirely missing text fields as blank (distinct from empty strings)', async () => {
      IlmPolicyEditorPanel.openNew(extensionUri, () => undefined);
      const message = await sendSave({
        name: 'logs-default-policy',
        phases: enabledHotOnlyPhases,
        meta: '',
        // dataset_name/integration_name/namespace omitted entirely, not just blank
        mappings: [{ data_stream_type: 'logs' }],
      });

      expect(message).toEqual({
        type: 'error',
        message: 'Integration Lifecycle Mapping 1: Dataset Name, Integration Name and Namespace are all required.',
      });
    });

    it('rejects a mapping with an invalid data_stream_type', async () => {
      IlmPolicyEditorPanel.openNew(extensionUri, () => undefined);
      const message = await sendSave({
        name: 'logs-default-policy',
        phases: enabledHotOnlyPhases,
        meta: '',
        mappings: [{ data_stream_type: 'traces', dataset_name: 'x', integration_name: 'y', namespace: 'z' }],
      });

      expect(message).toEqual({
        type: 'error',
        message: 'Integration Lifecycle Mapping 1: Data Stream Type must be "logs" or "metrics".',
      });
    });

    it('rejects a mapping missing a required text field', async () => {
      IlmPolicyEditorPanel.openNew(extensionUri, () => undefined);
      const message = await sendSave({
        name: 'logs-default-policy',
        phases: enabledHotOnlyPhases,
        meta: '',
        mappings: [{ data_stream_type: 'logs', dataset_name: '', integration_name: 'filestream', namespace: 'cmt' }],
      });

      expect(message).toEqual({
        type: 'error',
        message: 'Integration Lifecycle Mapping 1: Dataset Name, Integration Name and Namespace are all required.',
      });
    });

    it('identifies the correct 1-based row index when a later mapping is invalid', async () => {
      IlmPolicyEditorPanel.openNew(extensionUri, () => undefined);
      const message = await sendSave({
        name: 'logs-default-policy',
        phases: enabledHotOnlyPhases,
        meta: '',
        mappings: [
          { data_stream_type: 'logs', dataset_name: 'map_python', integration_name: 'filestream', namespace: 'cmt' },
          { data_stream_type: 'logs', dataset_name: '', integration_name: 'filestream', namespace: 'cmt' },
        ],
      });

      expect(message).toEqual({
        type: 'error',
        message: 'Integration Lifecycle Mapping 2: Dataset Name, Integration Name and Namespace are all required.',
      });
    });
  });
});
