import * as vscode from 'vscode';
import { readJsonFile, validateArtifactName } from '../fileSystem';
import { parseOptionalJsonObject, toStringArray } from '../roles/rolePrivilegeTemplates';
import {
  buildRoleTemplatesJson,
  parseRoleTemplatesFromRaw,
  RoleTemplateFormValue,
} from '../roleMappings/roleTemplateRowTemplate';
import { RoleMappingDefinition } from '../models';
import { saveRoleMapping } from '../repositories';
import { ArtifactPanelBase } from './artifactPanelBase';

interface RoleMappingFormItem {
  name: string;
  enabled: boolean;
  roles: string[];
  roleTemplates: RoleTemplateFormValue[];
  rules: string;
  metadata: string;
}

interface RoleMappingPayload {
  isNew: boolean;
  item: RoleMappingFormItem;
}

export class RoleMappingEditorPanel extends ArtifactPanelBase {
  private constructor(
    extensionUri: vscode.Uri,
    filePath: string | undefined,
    private readonly refresh: () => void
  ) {
    super(
      extensionUri,
      'elasticSource.roleMappingEditor',
      filePath ? 'Role Mapping' : 'New Role Mapping',
      filePath,
      'roleMappingForm.js'
    );
  }

  static openNew(extensionUri: vscode.Uri, refresh: () => void): void {
    new RoleMappingEditorPanel(extensionUri, undefined, refresh);
  }

  static openExisting(extensionUri: vscode.Uri, refresh: () => void, filePath: string): void {
    if (ArtifactPanelBase.reveal(filePath)) {
      return;
    }
    new RoleMappingEditorPanel(extensionUri, filePath, refresh);
  }

  protected getFormBodyHtml(): string {
    return /* html */ `
    <h1 id="title">Role Mapping</h1>
    <p class="subtitle">Defines an Elasticsearch role mapping. See the <a href="https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-security-put-role-mapping">Put Role Mapping API</a>.</p>
    <form id="form">
      <div class="field" id="field-name">
        <label for="name">Name</label>
        <input type="text" id="name" />
        <span class="hint">Used as this role mapping's file name and role mapping name.</span>
        <span class="error">Enter a name that is valid as a file name.</span>
      </div>
      <div class="field">
        <div class="checkbox-row">
          <input type="checkbox" id="enabled" />
          <label for="enabled" style="margin:0">Enabled</label>
        </div>
      </div>
      <div class="field">
        <label for="roles">Roles (optional)</label>
        <textarea id="roles" rows="2" placeholder="cmt_read_only" spellcheck="false"></textarea>
        <span class="hint">One existing role name per line to assign to matching users.</span>
      </div>

      <div class="field" style="margin-top:20px">
        <label>Role Templates (optional)</label>
        <span class="hint">Mustache templates evaluated to determine role names dynamically, instead of a fixed Roles list.</span>
      </div>
      <div id="role-templates-container"></div>
      <button type="button" class="secondary" id="add-role-template">Add Role Template</button>

      <div class="field" id="field-rules" style="margin-top:20px">
        <label for="rules">Rules (JSON)</label>
        <textarea id="rules" rows="6" spellcheck="false"></textarea>
        <span class="hint">Required boolean rule tree (field/except/all/any) determining which users this mapping applies to, e.g. {"field": {"username": "*"}}.</span>
        <span class="error">Rules is required and must be a valid JSON object.</span>
      </div>
      <div class="field" id="field-metadata">
        <label for="metadata">Metadata (optional)</label>
        <textarea id="metadata" rows="4" spellcheck="false"></textarea>
        <span class="hint">Optional JSON object saved as "metadata".</span>
        <span class="error">Metadata must be a valid JSON object.</span>
      </div>
      <div class="actions">
        <button type="submit" class="primary">Save</button>
        <button type="button" class="secondary" id="cancel">Cancel</button>
      </div>
    </form>`;
  }

  protected async loadInitialPayload(): Promise<RoleMappingPayload> {
    if (this.filePath) {
      const item = await readJsonFile<RoleMappingDefinition>(this.filePath);
      return {
        isNew: false,
        item: {
          name: item.name,
          enabled: item.enabled !== false,
          roles: item.roles ?? [],
          roleTemplates: parseRoleTemplatesFromRaw(item.role_templates),
          rules: item.rules ? JSON.stringify(item.rules, null, 2) : '',
          metadata: item.metadata ? JSON.stringify(item.metadata, null, 2) : '',
        },
      };
    }
    return {
      isNew: true,
      item: { name: '', enabled: true, roles: [], roleTemplates: [], rules: '', metadata: '' },
    };
  }

  protected async handleSave(payload: unknown): Promise<{ filePath: string; data: unknown }> {
    const data = payload as {
      name: string;
      enabled: boolean;
      roles: unknown;
      roleTemplates: RoleTemplateFormValue[];
      rules: string;
      metadata: string;
    };
    const name = (data.name ?? '').trim();
    const nameError = validateArtifactName(name);
    if (nameError) {
      throw new Error(nameError);
    }

    const roles = toStringArray(data.roles);
    const roleTemplateRows = data.roleTemplates ?? [];
    const roleTemplates = roleTemplateRows.length > 0 ? buildRoleTemplatesJson(roleTemplateRows, 'Role Template') : undefined;

    if (roles.length === 0 && (!roleTemplates || roleTemplates.length === 0)) {
      throw new Error('At least one Role or Role Template is required.');
    }

    const rulesRaw = (data.rules ?? '').trim();
    if (!rulesRaw) {
      throw new Error('Rules is required.');
    }
    let rulesParsed: unknown;
    try {
      rulesParsed = JSON.parse(rulesRaw);
    } catch {
      throw new Error('Rules must be valid JSON.');
    }
    if (typeof rulesParsed !== 'object' || rulesParsed === null || Array.isArray(rulesParsed)) {
      throw new Error('Rules must be a JSON object.');
    }
    const rules = rulesParsed as Record<string, unknown>;

    const metadata = parseOptionalJsonObject(data.metadata, 'Metadata');

    const toSave: RoleMappingDefinition = {
      name,
      ...(data.enabled === false ? { enabled: false } : {}),
      ...(roles.length > 0 ? { roles } : {}),
      ...(roleTemplates ? { role_templates: roleTemplates } : {}),
      rules,
      ...(metadata ? { metadata } : {}),
    };
    const filePath = await saveRoleMapping(this.filePath, toSave);
    this.panel.title = toSave.name;
    return { filePath, data: toSave };
  }

  protected onSaved(): void {
    this.refresh();
  }
}
