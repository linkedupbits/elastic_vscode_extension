import * as vscode from 'vscode';
import { IntegrationPolicyEditorPanel } from '../../../src/editors/integrationPolicyEditorPanel';
import { generateId } from '../../../src/fileSystem';
import { PackageTemplate } from '../../../src/integrations/packageTemplate';
import { IntegrationPolicy } from '../../../src/models';
import { saveFleetAgentPolicy, saveIntegrationPolicy } from '../../../src/repositories';
import { makeTempDir, removeTempDir } from '../../helpers/tempDir';
import { vscodeMock } from '../../helpers/vscodeMock';
import { lastPanel, sendReady, sendSave } from '../../helpers/webviewPanel';

const extensionUri = vscode.Uri.file('/ext');

/** Small template exercising a required input var, a required + a requiresRoot stream var. */
const fixtureTemplate: PackageTemplate = {
  name: 'fixture',
  title: 'Fixture',
  version: '1.0.0',
  inputs: [
    {
      id: 'fixture-input',
      label: 'Fixture Input',
      defaultEnabled: true,
      vars: [{ key: 'mode', label: 'Mode', type: 'string', default: '', required: true }],
      streams: [
        {
          id: 'fixture.stream',
          label: 'Fixture Stream',
          defaultEnabled: true,
          requiresRoot: true,
          vars: [{ key: 'path', label: 'Path', type: 'string', default: '', required: true }],
        },
      ],
    },
  ],
};

function enabledInputsPayload(overrides: Partial<{ mode: string; path: string; streamEnabled: boolean }> = {}) {
  return {
    'fixture-input': {
      enabled: true,
      vars: { mode: overrides.mode ?? 'active' },
      streams: {
        'fixture.stream': {
          enabled: overrides.streamEnabled ?? true,
          vars: { path: overrides.path ?? '/var/log/app.log' },
        },
      },
    },
  };
}

describe('IntegrationPolicyEditorPanel', () => {
  let workspaceRoot: string;
  let agentPolicyId: string;
  let agentPolicyFilePath: string;

  beforeEach(async () => {
    workspaceRoot = makeTempDir();
    vscodeMock.__setWorkspaceFolders(workspaceRoot);
    vscodeMock.__resetWebviewPanels();
    agentPolicyId = generateId();
    agentPolicyFilePath = await saveFleetAgentPolicy(undefined, {
      id: agentPolicyId,
      name: 'CMT Default',
      description: '',
      monitoring_enabled: [],
      inactivity_timeout: 0,
      download_source_id: '',
      schema_version: '1.0.0',
      namespace: 'default',
      advanced_settings: {},
    });
  });

  afterEach(() => {
    vscodeMock.__resetWorkspace();
    removeTempDir(workspaceRoot);
  });

  it('a new panel defaults from the template and links to the owning agent policy', async () => {
    IntegrationPolicyEditorPanel.openNew(extensionUri, () => undefined, agentPolicyFilePath, fixtureTemplate);
    const payload = (await sendReady()) as {
      isNew: boolean;
      item: IntegrationPolicy;
      agentPolicy: { id: string; name: string };
    };

    expect(payload.isNew).toBe(true);
    expect(payload.item.policy_id).toBe(agentPolicyId);
    expect(payload.item.policy_ids).toEqual([agentPolicyId]);
    expect(payload.agentPolicy).toEqual({ id: agentPolicyId, name: 'CMT Default' });
  });

  it('an existing panel merges the saved inputs against the current template', async () => {
    const integrationPath = await saveIntegrationPolicy(undefined, agentPolicyFilePath, {
      name: 'fixture-instance',
      namespace: '',
      description: '',
      package: { name: 'fixture', title: 'Fixture', version: '1.0.0', requires_root: false },
      policy_id: agentPolicyId,
      policy_ids: [agentPolicyId],
      inputs: {}, // deliberately sparse/legacy shape
      output_id: null,
      vars: {},
    });

    IntegrationPolicyEditorPanel.openExisting(extensionUri, () => undefined, integrationPath, fixtureTemplate);
    const payload = (await sendReady()) as { isNew: boolean; item: IntegrationPolicy };

    expect(payload.isNew).toBe(false);
    // mergeInputsWithTemplate backfilled the missing input from template defaults.
    expect(payload.item.inputs['fixture-input'].enabled).toBe(true);
    expect(payload.item.inputs['fixture-input'].streams['fixture.stream'].vars.path).toBe('');
  });

  it('opening the same filePath twice reveals the existing panel instead of creating a second one', async () => {
    const integrationPath = await saveIntegrationPolicy(undefined, agentPolicyFilePath, {
      name: 'fixture-instance',
      namespace: '',
      description: '',
      package: { name: 'fixture', title: 'Fixture', version: '1.0.0', requires_root: false },
      policy_id: agentPolicyId,
      policy_ids: [agentPolicyId],
      inputs: {},
      output_id: null,
      vars: {},
    });

    IntegrationPolicyEditorPanel.openExisting(extensionUri, () => undefined, integrationPath, fixtureTemplate);
    const firstPanel = lastPanel();

    IntegrationPolicyEditorPanel.openExisting(extensionUri, () => undefined, integrationPath, fixtureTemplate);

    expect(firstPanel.revealCount).toBe(1);
    expect(lastPanel()).toBe(firstPanel);
  });

  it('saves with policy_id/policy_ids/package re-derived server-side, ignoring whatever the payload sent', async () => {
    IntegrationPolicyEditorPanel.openNew(extensionUri, () => undefined, agentPolicyFilePath, fixtureTemplate);

    const message = await sendSave({
      name: 'fixture-instance',
      namespace: 'ns',
      description: 'desc',
      inputs: enabledInputsPayload(),
      policy_id: 'bogus-id-from-webview',
      policy_ids: ['bogus-id-from-webview'],
      package: { name: 'spoofed', title: 'Spoofed', version: '9.9.9', requires_root: false },
      output_id: null,
      vars: {},
    });

    expect(message.type).toBe('saved');
    const data = message.payload as IntegrationPolicy;
    expect(data.policy_id).toBe(agentPolicyId);
    expect(data.policy_ids).toEqual([agentPolicyId]);
    expect(data.package).toEqual({ name: 'fixture', title: 'Fixture', version: '1.0.0', requires_root: true });
  });

  it('computes requires_root as false when the root-requiring stream is disabled', async () => {
    IntegrationPolicyEditorPanel.openNew(extensionUri, () => undefined, agentPolicyFilePath, fixtureTemplate);

    const message = await sendSave({
      name: 'fixture-instance',
      namespace: '',
      description: '',
      inputs: enabledInputsPayload({ streamEnabled: false }),
      output_id: null,
      vars: {},
    });

    expect((message.payload as IntegrationPolicy).package.requires_root).toBe(false);
  });

  it('treats entirely missing name/namespace/description/vars as their empty defaults', async () => {
    IntegrationPolicyEditorPanel.openNew(extensionUri, () => undefined, agentPolicyFilePath, fixtureTemplate);
    const message = await sendSave({
      // name, namespace, description, vars intentionally omitted entirely
      inputs: enabledInputsPayload(),
      output_id: null,
    });

    expect(message).toEqual({ type: 'error', message: 'Name is required.' });
  });

  it('defaults missing optional namespace/description/vars to empty values on a successful save', async () => {
    IntegrationPolicyEditorPanel.openNew(extensionUri, () => undefined, agentPolicyFilePath, fixtureTemplate);
    const message = await sendSave({
      name: 'fixture-instance',
      // namespace, description, vars intentionally omitted entirely
      inputs: enabledInputsPayload(),
      output_id: null,
    });

    expect(message.type).toBe('saved');
    const data = message.payload as IntegrationPolicy;
    expect(data.namespace).toBe('');
    expect(data.description).toBe('');
    expect(data.vars).toEqual({});
  });

  it('rejects a blank name', async () => {
    IntegrationPolicyEditorPanel.openNew(extensionUri, () => undefined, agentPolicyFilePath, fixtureTemplate);
    const message = await sendSave({
      name: '',
      namespace: '',
      description: '',
      inputs: enabledInputsPayload(),
      output_id: null,
      vars: {},
    });
    expect(message).toEqual({ type: 'error', message: 'Name is required.' });
  });

  it('rejects missing required vars on an enabled input/stream', async () => {
    IntegrationPolicyEditorPanel.openNew(extensionUri, () => undefined, agentPolicyFilePath, fixtureTemplate);
    const message = await sendSave({
      name: 'fixture-instance',
      namespace: '',
      description: '',
      inputs: enabledInputsPayload({ mode: '', path: '' }),
      output_id: null,
      vars: {},
    });
    expect(message).toEqual({
      type: 'error',
      message: 'Fixture Input: "Mode" is required. Fixture Input / Fixture Stream: "Path" is required.',
    });
  });

  it('rejects a duplicate integration name within the same agent policy', async () => {
    await saveIntegrationPolicy(undefined, agentPolicyFilePath, {
      name: 'taken',
      namespace: '',
      description: '',
      package: { name: 'fixture', title: 'Fixture', version: '1.0.0', requires_root: false },
      policy_id: agentPolicyId,
      policy_ids: [agentPolicyId],
      inputs: {},
      output_id: null,
      vars: {},
    });
    IntegrationPolicyEditorPanel.openNew(extensionUri, () => undefined, agentPolicyFilePath, fixtureTemplate);

    const message = await sendSave({
      name: 'taken',
      namespace: '',
      description: '',
      inputs: enabledInputsPayload(),
      output_id: null,
      vars: {},
    });
    expect(message).toEqual({
      type: 'error',
      message: 'An integration policy named "taken" already exists in this agent policy.',
    });
  });
});
