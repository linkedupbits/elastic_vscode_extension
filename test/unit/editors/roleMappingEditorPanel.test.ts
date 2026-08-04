import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { RoleMappingEditorPanel } from '../../../src/editors/roleMappingEditorPanel';
import { RoleMappingDefinition } from '../../../src/models';
import { buildDefaultRoleTemplateValue, RoleTemplateFormValue } from '../../../src/roleMappings/roleTemplateRowTemplate';
import { saveRoleMapping } from '../../../src/repositories';
import { makeTempDir, removeTempDir } from '../../helpers/tempDir';
import { vscodeMock } from '../../helpers/vscodeMock';
import { lastPanel, sendReady, sendSave } from '../../helpers/webviewPanel';

const extensionUri = vscode.Uri.file('/ext');

function roleTemplate(overrides: Partial<RoleTemplateFormValue> = {}): RoleTemplateFormValue {
  return { ...buildDefaultRoleTemplateValue(), ...overrides };
}

describe('RoleMappingEditorPanel', () => {
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

  it('a new panel starts with empty/default values, enabled by default', async () => {
    RoleMappingEditorPanel.openNew(extensionUri, () => undefined);
    const payload = (await sendReady()) as {
      isNew: boolean;
      item: {
        name: string;
        enabled: boolean;
        roles: string[];
        roleTemplates: unknown[];
        rules: string;
        metadata: string;
      };
    };

    expect(payload.isNew).toBe(true);
    expect(payload.item).toEqual({
      name: '',
      enabled: true,
      roles: [],
      roleTemplates: [],
      rules: '',
      metadata: '',
    });
  });

  it('an existing panel parses a minimal saved role mapping from disk', async () => {
    const saved: RoleMappingDefinition = {
      name: 'cmt_ldap_admins',
      roles: ['cmt_read_only'],
      rules: { field: { username: '*' } },
    };
    const filePath = await saveRoleMapping(undefined, saved);

    RoleMappingEditorPanel.openExisting(extensionUri, () => undefined, filePath);
    const payload = (await sendReady()) as {
      isNew: boolean;
      item: { name: string; enabled: boolean; roles: string[]; roleTemplates: unknown[]; rules: string; metadata: string };
    };

    expect(payload.isNew).toBe(false);
    expect(payload.item.name).toBe('cmt_ldap_admins');
    expect(payload.item.enabled).toBe(true);
    expect(payload.item.roles).toEqual(['cmt_read_only']);
    expect(payload.item.roleTemplates).toEqual([]);
    expect(JSON.parse(payload.item.rules)).toEqual({ field: { username: '*' } });
    expect(payload.item.metadata).toBe('');
  });

  it('an existing panel parses a fully populated saved role mapping from disk', async () => {
    const saved: RoleMappingDefinition = {
      name: 'cmt_ldap_admins',
      enabled: false,
      roles: ['cmt_read_only'],
      role_templates: [{ template: { source: '{{username}}' }, format: 'json' }],
      rules: { all: [{ field: { 'realm.name': 'ldap1' } }] },
      metadata: { managed_by: 'cmt' },
    };
    const filePath = await saveRoleMapping(undefined, saved);

    RoleMappingEditorPanel.openExisting(extensionUri, () => undefined, filePath);
    const payload = (await sendReady()) as {
      item: { enabled: boolean; roleTemplates: RoleTemplateFormValue[]; rules: string; metadata: string };
    };

    expect(payload.item.enabled).toBe(false);
    expect(payload.item.roleTemplates).toEqual([{ template: '{{username}}', format: 'json' }]);
    expect(JSON.parse(payload.item.rules)).toEqual(saved.rules);
    expect(JSON.parse(payload.item.metadata)).toEqual({ managed_by: 'cmt' });
  });

  it('an existing panel with no roles key (role_templates-only mapping) sends an empty roles array', async () => {
    const filePath = await saveRoleMapping(undefined, {
      name: 'cmt_templated',
      role_templates: [{ template: { source: '{{username}}' } }],
      rules: { field: { username: '*' } },
    });

    RoleMappingEditorPanel.openExisting(extensionUri, () => undefined, filePath);
    const payload = (await sendReady()) as { item: { roles: string[] } };

    expect(payload.item.roles).toEqual([]);
  });

  it('an existing panel with no rules key (legacy/malformed file) sends an empty rules string', async () => {
    const roleMappingsDir = path.join(workspaceRoot, 'Elastic_Source', 'Role_Mappings');
    fs.mkdirSync(roleMappingsDir, { recursive: true });
    const filePath = path.join(roleMappingsDir, 'legacy-mapping.json');
    fs.writeFileSync(filePath, JSON.stringify({ 'legacy-mapping': { roles: ['cmt_read_only'] } }));

    RoleMappingEditorPanel.openExisting(extensionUri, () => undefined, filePath);
    const payload = (await sendReady()) as { item: { rules: string } };

    expect(payload.item.rules).toBe('');
  });

  it('opening the same filePath twice reveals the existing panel instead of creating a second one', async () => {
    const filePath = await saveRoleMapping(undefined, {
      name: 'cmt_ldap_admins',
      roles: ['cmt_read_only'],
      rules: { field: { username: '*' } },
    });

    RoleMappingEditorPanel.openExisting(extensionUri, () => undefined, filePath);
    const firstPanel = lastPanel();

    RoleMappingEditorPanel.openExisting(extensionUri, () => undefined, filePath);

    expect(firstPanel.revealCount).toBe(1);
    expect(lastPanel()).toBe(firstPanel);
  });

  it('saves a minimal role mapping, omitting enabled (defaults true) and unset optional fields', async () => {
    RoleMappingEditorPanel.openNew(extensionUri, () => undefined);

    const message = await sendSave({
      name: 'cmt_ldap_admins',
      enabled: true,
      roles: ['cmt_read_only'],
      roleTemplates: [],
      rules: '{"field": {"username": "*"}}',
      metadata: '',
    });

    expect(message.type).toBe('saved');
    const data = message.payload as RoleMappingDefinition;
    expect(data).toEqual({ name: 'cmt_ldap_admins', roles: ['cmt_read_only'], rules: { field: { username: '*' } } });
  });

  it('saves a fully populated role mapping', async () => {
    RoleMappingEditorPanel.openNew(extensionUri, () => undefined);

    const message = await sendSave({
      name: 'cmt_ldap_admins',
      enabled: false,
      roles: ['cmt_read_only'],
      roleTemplates: [roleTemplate({ template: '{{username}}', format: 'json' })],
      rules: '{"field": {"username": "*"}}',
      metadata: '{"managed_by": "cmt"}',
    });

    expect(message.type).toBe('saved');
    const data = message.payload as RoleMappingDefinition;
    expect(data).toEqual({
      name: 'cmt_ldap_admins',
      enabled: false,
      roles: ['cmt_read_only'],
      role_templates: [{ template: { source: '{{username}}' }, format: 'json' }],
      rules: { field: { username: '*' } },
      metadata: { managed_by: 'cmt' },
    });
  });

  it('saves with only role_templates set and no roles', async () => {
    RoleMappingEditorPanel.openNew(extensionUri, () => undefined);

    const message = await sendSave({
      name: 'cmt_templated',
      roleTemplates: [roleTemplate({ template: '{{username}}' })],
      rules: '{"field": {"username": "*"}}',
    });

    expect(message.type).toBe('saved');
    const data = message.payload as RoleMappingDefinition;
    expect(data.roles).toBeUndefined();
    expect(data.role_templates).toEqual([{ template: { source: '{{username}}' } }]);
  });

  it('treats an entirely missing name as invalid', async () => {
    RoleMappingEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({ rules: '{"field": {"username": "*"}}' });
    expect(message).toEqual({ type: 'error', message: 'Name is required.' });
  });

  it('rejects a blank name', async () => {
    RoleMappingEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({ name: '', rules: '{"field": {"username": "*"}}' });
    expect(message).toEqual({ type: 'error', message: 'Name is required.' });
  });

  it('rejects a name colliding with an existing role mapping', async () => {
    await saveRoleMapping(undefined, {
      name: 'taken-mapping',
      roles: ['cmt_read_only'],
      rules: { field: { username: '*' } },
    });
    RoleMappingEditorPanel.openNew(extensionUri, () => undefined);

    const message = await sendSave({
      name: 'taken-mapping',
      roles: ['cmt_read_only'],
      rules: '{"field": {"username": "*"}}',
    });
    expect(message).toEqual({ type: 'error', message: 'A Role Mapping named "taken-mapping" already exists.' });
  });

  it('rejects when both roles and role_templates are empty', async () => {
    RoleMappingEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({ name: 'cmt_ldap_admins', rules: '{"field": {"username": "*"}}' });
    expect(message).toEqual({ type: 'error', message: 'At least one Role or Role Template is required.' });
  });

  it('treats an entirely missing rules field as invalid', async () => {
    RoleMappingEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({ name: 'cmt_ldap_admins', roles: ['cmt_read_only'] });
    expect(message).toEqual({ type: 'error', message: 'Rules is required.' });
  });

  it('rejects a blank rules value', async () => {
    RoleMappingEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({ name: 'cmt_ldap_admins', roles: ['cmt_read_only'], rules: '   ' });
    expect(message).toEqual({ type: 'error', message: 'Rules is required.' });
  });

  it('rejects malformed JSON in the rules field', async () => {
    RoleMappingEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({ name: 'cmt_ldap_admins', roles: ['cmt_read_only'], rules: '{ not valid json' });
    expect(message).toEqual({ type: 'error', message: 'Rules must be valid JSON.' });
  });

  it('rejects rules that parse but are not a JSON object', async () => {
    RoleMappingEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({ name: 'cmt_ldap_admins', roles: ['cmt_read_only'], rules: '[1, 2, 3]' });
    expect(message).toEqual({ type: 'error', message: 'Rules must be a JSON object.' });
  });

  it('rejects malformed JSON in the metadata field', async () => {
    RoleMappingEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({
      name: 'cmt_ldap_admins',
      roles: ['cmt_read_only'],
      rules: '{"field": {"username": "*"}}',
      metadata: '{ not valid json',
    });
    expect(message).toEqual({ type: 'error', message: 'Metadata must be valid JSON.' });
  });

  it('rejects metadata that parses but is not a JSON object', async () => {
    RoleMappingEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({
      name: 'cmt_ldap_admins',
      roles: ['cmt_read_only'],
      rules: '{"field": {"username": "*"}}',
      metadata: '[1, 2, 3]',
    });
    expect(message).toEqual({ type: 'error', message: 'Metadata must be a JSON object.' });
  });

  it('rejects a role template row with a blank template', async () => {
    RoleMappingEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({
      name: 'cmt_ldap_admins',
      roleTemplates: [roleTemplate()],
      rules: '{"field": {"username": "*"}}',
    });
    expect(message).toEqual({ type: 'error', message: 'Role Template 1: Template is required.' });
  });

  it('supports the @ character in file names', async () => {
    RoleMappingEditorPanel.openNew(extensionUri, () => undefined);
    const message = await sendSave({
      name: 'cmt_ldap_admins@custom',
      roles: ['cmt_read_only'],
      rules: '{"field": {"username": "*"}}',
    });

    expect(message.type).toBe('saved');
    const roleMappingsDir = path.join(workspaceRoot, 'Elastic_Source', 'Role_Mappings');
    expect(fs.existsSync(path.join(roleMappingsDir, 'cmt_ldap_admins@custom.json'))).toBe(true);
  });
});
