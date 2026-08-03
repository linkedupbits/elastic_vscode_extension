import * as vscode from 'vscode';
import { readJsonFile, validateArtifactName } from '../fileSystem';
import {
  buildAliasesJson,
  IndexTemplateAliasFormValue,
  parseAliasesFromRaw,
} from '../indexTemplates/aliasesTemplate';
import {
  buildMappingsJson,
  IndexTemplateMappingsFormValue,
  MAPPING_FIELD_TYPES,
  MappingFieldTypeDef,
  parseMappingsFromRaw,
} from '../indexTemplates/mappingsTemplate';
import {
  buildSettingsJson,
  INDEX_TEMPLATE_SETTINGS_FIELDS,
  IndexTemplateSettingsFormValue,
  parseSettingsFromRaw,
  SettingsFieldDef,
} from '../indexTemplates/settingsTemplate';
import { IndexTemplateDefinition } from '../models';
import { saveIndexTemplate } from '../repositories';
import { ArtifactPanelBase } from './artifactPanelBase';

interface IndexTemplateFormItem {
  name: string;
  indexPatterns: string[];
  composedOf: string[];
  priority: string;
  version: string;
  allowAutoCreate: '' | 'true' | 'false';
  ignoreMissingComponentTemplates: string[];
  dataStreamEnabled: boolean;
  dataStreamHidden: boolean;
  dataStreamAllowCustomRouting: boolean;
  settingsEnabled: boolean;
  settings: IndexTemplateSettingsFormValue;
  mappingsEnabled: boolean;
  mappings: IndexTemplateMappingsFormValue;
  aliasesEnabled: boolean;
  aliases: IndexTemplateAliasFormValue[];
  meta: string;
  deprecated: boolean;
}

interface IndexTemplatePayload {
  isNew: boolean;
  item: IndexTemplateFormItem;
  settingsFields: SettingsFieldDef[];
  mappingFieldTypes: MappingFieldTypeDef[];
}

function parseOptionalJsonObject(raw: string, fieldLabel: string): Record<string, unknown> | undefined {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) {
    return undefined;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error(`${fieldLabel} must be valid JSON.`);
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${fieldLabel} must be a JSON object.`);
  }
  return parsed as Record<string, unknown>;
}

function toStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map((v) => String(v).trim()).filter((v) => v.length > 0);
}

export class IndexTemplateEditorPanel extends ArtifactPanelBase {
  private constructor(
    extensionUri: vscode.Uri,
    filePath: string | undefined,
    private readonly refresh: () => void
  ) {
    super(
      extensionUri,
      'elasticSource.indexTemplateEditor',
      filePath ? 'Index Template' : 'New Index Template',
      filePath,
      'indexTemplateForm.js'
    );
  }

  static openNew(extensionUri: vscode.Uri, refresh: () => void): void {
    new IndexTemplateEditorPanel(extensionUri, undefined, refresh);
  }

  static openExisting(extensionUri: vscode.Uri, refresh: () => void, filePath: string): void {
    if (ArtifactPanelBase.reveal(filePath)) {
      return;
    }
    new IndexTemplateEditorPanel(extensionUri, filePath, refresh);
  }

  protected getFormBodyHtml(): string {
    return /* html */ `
    <h1 id="title">Index Template</h1>
    <p class="subtitle">Defines an Elasticsearch index template. See the <a href="https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-indices-put-index-template">Put Index Template API</a>.</p>
    <form id="form">
      <div class="field" id="field-name">
        <label for="name">Name</label>
        <input type="text" id="name" />
        <span class="hint">Used as this template's file name and index template name.</span>
        <span class="error">Enter a name that is valid as a file name.</span>
      </div>
      <div class="field" id="field-indexPatterns">
        <label for="indexPatterns">Index Patterns</label>
        <textarea id="indexPatterns" rows="3" placeholder="logs-myapp-*" spellcheck="false"></textarea>
        <span class="hint">One pattern per line. At least one is required, e.g. logs-myapp-*.</span>
        <span class="error">At least one index pattern is required.</span>
      </div>
      <div class="field">
        <label for="composedOf">Composed Of (optional)</label>
        <textarea id="composedOf" rows="3" placeholder="component-template-name" spellcheck="false"></textarea>
        <span class="hint">One component template name per line, applied in order.</span>
      </div>
      <div class="field" id="field-priority">
        <label for="priority">Priority (optional)</label>
        <input type="number" id="priority" />
        <span class="hint">Higher priority templates win when more than one matches an index.</span>
        <span class="error">Priority must be a number.</span>
      </div>
      <div class="field" id="field-version">
        <label for="version">Version (optional)</label>
        <input type="number" id="version" />
        <span class="hint">Used to track/manage template changes externally; not enforced by Elasticsearch.</span>
        <span class="error">Version must be a number.</span>
      </div>
      <div class="field">
        <label for="allowAutoCreate">Allow Auto Create (optional)</label>
        <select id="allowAutoCreate">
          <option value="">(default)</option>
          <option value="true">True</option>
          <option value="false">False</option>
        </select>
        <span class="hint">Overrides the cluster's action.auto_create_index setting for matching indices.</span>
      </div>
      <div class="field">
        <label for="ignoreMissingComponentTemplates">Ignore Missing Component Templates (optional)</label>
        <textarea id="ignoreMissingComponentTemplates" rows="2" spellcheck="false"></textarea>
        <span class="hint">One component template name per line that is allowed to be missing from Composed Of.</span>
      </div>
      <details class="integration-input" open>
        <summary class="integration-summary">
          <input type="checkbox" id="dataStreamEnabled" />
          <strong>Data Stream Template</strong>
        </summary>
        <div class="input-body">
          <div class="field">
            <div class="checkbox-row">
              <input type="checkbox" id="dataStreamHidden" />
              <label for="dataStreamHidden" style="margin:0">Hidden</label>
            </div>
          </div>
          <div class="field">
            <div class="checkbox-row">
              <input type="checkbox" id="dataStreamAllowCustomRouting" />
              <label for="dataStreamAllowCustomRouting" style="margin:0">Allow Custom Routing</label>
            </div>
          </div>
        </div>
      </details>

      <details class="integration-input" id="settings-section" style="margin-top:20px">
        <summary class="integration-summary">
          <input type="checkbox" id="settingsEnabled" />
          <strong>Settings</strong>
        </summary>
        <div class="input-body" id="settings-body">
          <span class="hint">Common index settings. Anything not listed below can be added as Advanced Settings JSON.</span>
          <div id="settings-fields-container"></div>
          <div class="field" id="field-settingsAdvanced">
            <label for="settingsAdvanced">Advanced Settings (optional, JSON)</label>
            <textarea id="settingsAdvanced" rows="4" spellcheck="false"></textarea>
            <span class="hint">Any additional settings not covered above, merged into "template.settings".</span>
            <span class="error">Advanced Settings must be a valid JSON object.</span>
          </div>
        </div>
      </details>

      <details class="integration-input" id="mappings-section" style="margin-top:12px">
        <summary class="integration-summary">
          <input type="checkbox" id="mappingsEnabled" />
          <strong>Mappings</strong>
        </summary>
        <div class="input-body" id="mappings-body">
          <span class="hint">Defines the fields for indices created from this template.</span>
          <div class="field">
            <label for="mappingsDynamic">Dynamic</label>
            <select id="mappingsDynamic">
              <option value="">(default)</option>
              <option value="true">true</option>
              <option value="false">false</option>
              <option value="strict">strict</option>
            </select>
          </div>
          <div class="field">
            <div class="checkbox-row">
              <input type="checkbox" id="mappingsDisableSource" />
              <label for="mappingsDisableSource" style="margin:0">Disable _source</label>
            </div>
          </div>
          <div id="mapping-fields-container"></div>
          <button type="button" class="secondary" id="add-mapping-field">Add Field</button>
        </div>
      </details>

      <details class="integration-input" id="aliases-section" style="margin-top:12px">
        <summary class="integration-summary">
          <input type="checkbox" id="aliasesEnabled" />
          <strong>Aliases</strong>
        </summary>
        <div class="input-body" id="aliases-body">
          <span class="hint">Aliases automatically applied to indices created from this template.</span>
          <div id="aliases-container"></div>
          <button type="button" class="secondary" id="add-alias">Add Alias</button>
        </div>
      </details>

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

  protected async loadInitialPayload(): Promise<IndexTemplatePayload> {
    if (this.filePath) {
      const item = await readJsonFile<IndexTemplateDefinition>(this.filePath);
      return {
        isNew: false,
        item: {
          name: item.name,
          indexPatterns: item.index_patterns ?? [],
          composedOf: item.composed_of ?? [],
          priority: item.priority !== undefined ? String(item.priority) : '',
          version: item.version !== undefined ? String(item.version) : '',
          allowAutoCreate: item.allow_auto_create === undefined ? '' : item.allow_auto_create ? 'true' : 'false',
          ignoreMissingComponentTemplates: item.ignore_missing_component_templates ?? [],
          dataStreamEnabled: item.data_stream !== undefined,
          dataStreamHidden: Boolean(item.data_stream?.hidden),
          dataStreamAllowCustomRouting: Boolean(item.data_stream?.allow_custom_routing),
          settingsEnabled: item.template?.settings !== undefined,
          settings: parseSettingsFromRaw(item.template?.settings),
          mappingsEnabled: item.template?.mappings !== undefined,
          mappings: parseMappingsFromRaw(item.template?.mappings),
          aliasesEnabled: item.template?.aliases !== undefined,
          aliases: parseAliasesFromRaw(item.template?.aliases),
          meta: item._meta ? JSON.stringify(item._meta, null, 2) : '',
          deprecated: Boolean(item.deprecated),
        },
        settingsFields: INDEX_TEMPLATE_SETTINGS_FIELDS,
        mappingFieldTypes: MAPPING_FIELD_TYPES,
      };
    }
    return {
      isNew: true,
      item: {
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
        settingsEnabled: false,
        settings: parseSettingsFromRaw(undefined),
        mappingsEnabled: false,
        mappings: parseMappingsFromRaw(undefined),
        aliasesEnabled: false,
        aliases: [],
        meta: '',
        deprecated: false,
      },
      settingsFields: INDEX_TEMPLATE_SETTINGS_FIELDS,
      mappingFieldTypes: MAPPING_FIELD_TYPES,
    };
  }

  protected async handleSave(payload: unknown): Promise<{ filePath: string; data: unknown }> {
    const data = payload as {
      name: string;
      indexPatterns: unknown;
      composedOf: unknown;
      priority: string;
      version: string;
      allowAutoCreate: string;
      ignoreMissingComponentTemplates: unknown;
      dataStreamEnabled: boolean;
      dataStreamHidden: boolean;
      dataStreamAllowCustomRouting: boolean;
      settingsEnabled: boolean;
      settings: IndexTemplateSettingsFormValue;
      mappingsEnabled: boolean;
      mappings: IndexTemplateMappingsFormValue;
      aliasesEnabled: boolean;
      aliases: IndexTemplateAliasFormValue[];
      meta: string;
      deprecated: boolean;
    };
    const name = (data.name ?? '').trim();
    const nameError = validateArtifactName(name);
    if (nameError) {
      throw new Error(nameError);
    }

    const indexPatterns = toStringArray(data.indexPatterns);
    if (indexPatterns.length === 0) {
      throw new Error('At least one index pattern is required.');
    }

    const composedOf = toStringArray(data.composedOf);
    const ignoreMissingComponentTemplates = toStringArray(data.ignoreMissingComponentTemplates);

    const priorityRaw = (data.priority ?? '').trim();
    let priority: number | undefined;
    if (priorityRaw) {
      priority = Number(priorityRaw);
      if (!Number.isFinite(priority)) {
        throw new Error('Priority must be a number.');
      }
    }

    const versionRaw = (data.version ?? '').trim();
    let version: number | undefined;
    if (versionRaw) {
      version = Number(versionRaw);
      if (!Number.isFinite(version)) {
        throw new Error('Version must be a number.');
      }
    }

    let allowAutoCreate: boolean | undefined;
    if (data.allowAutoCreate === 'true') {
      allowAutoCreate = true;
    } else if (data.allowAutoCreate === 'false') {
      allowAutoCreate = false;
    }

    const settings = data.settingsEnabled
      ? buildSettingsJson(data.settings ?? { fields: {}, advanced: '' })
      : undefined;
    const mappings = data.mappingsEnabled
      ? buildMappingsJson(data.mappings ?? { dynamic: '', disableSource: false, fields: [] })
      : undefined;
    const aliasRows = data.aliasesEnabled ? data.aliases ?? [] : [];
    const aliases = aliasRows.length > 0 ? buildAliasesJson(aliasRows) : undefined;

    const meta = parseOptionalJsonObject(data.meta, 'Metadata');

    const template =
      settings || mappings || aliases
        ? {
            ...(settings ? { settings } : {}),
            ...(mappings ? { mappings } : {}),
            ...(aliases ? { aliases } : {}),
          }
        : undefined;

    const dataStream = data.dataStreamEnabled
      ? {
          ...(data.dataStreamHidden ? { hidden: true } : {}),
          ...(data.dataStreamAllowCustomRouting ? { allow_custom_routing: true } : {}),
        }
      : undefined;

    const toSave: IndexTemplateDefinition = {
      name,
      index_patterns: indexPatterns,
      ...(composedOf.length > 0 ? { composed_of: composedOf } : {}),
      ...(priority !== undefined ? { priority } : {}),
      ...(version !== undefined ? { version } : {}),
      ...(meta ? { _meta: meta } : {}),
      ...(template ? { template } : {}),
      ...(dataStream ? { data_stream: dataStream } : {}),
      ...(allowAutoCreate !== undefined ? { allow_auto_create: allowAutoCreate } : {}),
      ...(ignoreMissingComponentTemplates.length > 0
        ? { ignore_missing_component_templates: ignoreMissingComponentTemplates }
        : {}),
      ...(data.deprecated ? { deprecated: true } : {}),
    };
    const filePath = await saveIndexTemplate(this.filePath, toSave);
    this.panel.title = toSave.name;
    return { filePath, data: toSave };
  }

  protected onSaved(): void {
    this.refresh();
  }
}
