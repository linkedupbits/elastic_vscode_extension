(function () {
  const vscode = acquireVsCodeApi();

  const CUSTOM_MAPPING_TYPE_ID = '__custom__';

  const form = document.getElementById('form');
  const nameField = document.getElementById('name');
  const indexPatternsField = document.getElementById('indexPatterns');
  const composedOfField = document.getElementById('composedOf');
  const priorityField = document.getElementById('priority');
  const versionField = document.getElementById('version');
  const allowAutoCreateField = document.getElementById('allowAutoCreate');
  const ignoreMissingField = document.getElementById('ignoreMissingComponentTemplates');
  const dataStreamEnabledField = document.getElementById('dataStreamEnabled');
  const dataStreamHiddenField = document.getElementById('dataStreamHidden');
  const dataStreamAllowCustomRoutingField = document.getElementById('dataStreamAllowCustomRouting');
  const settingsSection = document.getElementById('settings-section');
  const settingsEnabledField = document.getElementById('settingsEnabled');
  const settingsBody = document.getElementById('settings-body');
  const settingsFieldsContainer = document.getElementById('settings-fields-container');
  const settingsAdvancedField = document.getElementById('settingsAdvanced');
  const mappingsSection = document.getElementById('mappings-section');
  const mappingsEnabledField = document.getElementById('mappingsEnabled');
  const mappingsBody = document.getElementById('mappings-body');
  const mappingsDynamicField = document.getElementById('mappingsDynamic');
  const mappingsDisableSourceField = document.getElementById('mappingsDisableSource');
  const mappingFieldsContainer = document.getElementById('mapping-fields-container');
  const addMappingFieldButton = document.getElementById('add-mapping-field');
  const aliasesSection = document.getElementById('aliases-section');
  const aliasesEnabledField = document.getElementById('aliasesEnabled');
  const aliasesBody = document.getElementById('aliases-body');
  const aliasesContainer = document.getElementById('aliases-container');
  const addAliasButton = document.getElementById('add-alias');
  const metaField = document.getElementById('meta');
  const deprecatedField = document.getElementById('deprecated');
  const errorBanner = document.getElementById('error-banner');
  const cancelButton = document.getElementById('cancel');

  let settingsFieldsTemplate = [];
  let mappingFieldTypesTemplate = [];
  let mappingRowSeq = 0;
  let aliasRowSeq = 0;

  // Prevent a click on the data-stream checkbox from also toggling the enclosing <details>.
  dataStreamEnabledField.addEventListener('click', (e) => e.stopPropagation());

  /** Wires an "Include <section>" checkbox living in a <details> <summary> to show/hide (and open/close) that section's body. */
  function wireIncludeToggle(section, enabledField, body) {
    enabledField.addEventListener('click', (e) => e.stopPropagation());
    enabledField.addEventListener('change', () => {
      const enabled = enabledField.checked;
      body.classList.toggle('section-disabled', !enabled);
      section.open = enabled;
    });
  }

  function setIncludeToggle(section, enabledField, body, enabled) {
    enabledField.checked = enabled;
    body.classList.toggle('section-disabled', !enabled);
    section.open = enabled;
  }

  wireIncludeToggle(settingsSection, settingsEnabledField, settingsBody);
  wireIncludeToggle(mappingsSection, mappingsEnabledField, mappingsBody);
  wireIncludeToggle(aliasesSection, aliasesEnabledField, aliasesBody);

  function slug(value) {
    return String(value).replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  function arrayFromTextarea(el) {
    return el.value
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  function arrayToTextarea(el, values) {
    el.value = Array.isArray(values) ? values.join('\n') : '';
  }

  function parseJsonObject(raw) {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return undefined;
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return undefined;
    }
    return parsed;
  }

  function isBlank(value) {
    if (value === undefined || value === null) return true;
    if (typeof value === 'string') return value.trim().length === 0;
    return false;
  }

  function setFieldValid(fieldId, valid) {
    const el = document.getElementById('field-' + fieldId);
    if (el) el.classList.toggle('invalid', !valid);
  }

  function showError(message) {
    errorBanner.textContent = message;
    errorBanner.classList.add('show');
  }

  function clearError() {
    errorBanner.classList.remove('show');
    errorBanner.textContent = '';
  }

  // ---------- Settings ----------

  function settingsFieldId(field) {
    return 'settings-field-' + slug(field.key);
  }

  function settingsFieldControlHtml(field) {
    const id = settingsFieldId(field);
    const hintSpan = field.hint ? `<span class="hint">${field.hint}</span>` : '';
    if (field.type === 'select') {
      const options = (field.options || []).map((o) => `<option value="${o.value}">${o.label}</option>`).join('');
      return `<div class="field"><label for="${id}">${field.label}</label><select id="${id}">${options}</select>${hintSpan}</div>`;
    }
    const inputType = field.type === 'number' ? 'number' : 'text';
    return `<div class="field"><label for="${id}">${field.label}</label><input type="${inputType}" id="${id}" />${hintSpan}</div>`;
  }

  function renderSettingsFields(template) {
    settingsFieldsContainer.innerHTML = template.map(settingsFieldControlHtml).join('');
  }

  function populateSettings(template, value) {
    for (const field of template) {
      document.getElementById(settingsFieldId(field)).value = (value.fields && value.fields[field.key]) || '';
    }
    settingsAdvancedField.value = value.advanced || '';
  }

  function collectSettings(template) {
    const fields = {};
    for (const field of template) {
      fields[field.key] = document.getElementById(settingsFieldId(field)).value;
    }
    return { fields, advanced: settingsAdvancedField.value };
  }

  // ---------- Mapping Fields ----------

  function findMappingFieldType(typeId) {
    return mappingFieldTypesTemplate.find((t) => t.id === typeId);
  }

  function setOptionControlValue(id, type, value) {
    const el = document.getElementById(id);
    if (!el) return;
    if (type === 'boolean') {
      el.checked = Boolean(value);
    } else {
      el.value = value === undefined || value === null ? '' : String(value);
    }
  }

  function getOptionControlValue(id, type) {
    const el = document.getElementById(id);
    if (!el) return undefined;
    if (type === 'boolean') return el.checked;
    return el.value;
  }

  function mappingOptionControlHtml(opt, id) {
    const hintSpan = opt.hint ? `<span class="hint">${opt.hint}</span>` : '';
    if (opt.type === 'boolean') {
      return `<div class="field"><div class="checkbox-row"><input type="checkbox" id="${id}" /><label for="${id}" style="margin:0">${opt.label}</label></div>${hintSpan}</div>`;
    }
    const inputType = opt.type === 'number' ? 'number' : 'text';
    return `<div class="field"><label for="${id}">${opt.label}</label><input type="${inputType}" id="${id}" />${hintSpan}</div>`;
  }

  function mappingTypeOptionsHtml(selectedType) {
    const known = mappingFieldTypesTemplate
      .map((t) => `<option value="${t.id}"${t.id === selectedType ? ' selected' : ''}>${t.label}</option>`)
      .join('');
    const customSelected = selectedType === CUSTOM_MAPPING_TYPE_ID ? ' selected' : '';
    return known + `<option value="${CUSTOM_MAPPING_TYPE_ID}"${customSelected}>Custom / Other...</option>`;
  }

  function mappingOptionsAreaHtml(rowId, def) {
    if (!def) {
      return `
        <div class="field" id="field-mapping-customtype-${rowId}">
          <label for="mapping-customtype-${rowId}">Field Type</label>
          <input type="text" id="mapping-customtype-${rowId}" placeholder="e.g. dense_vector" />
          <span class="error">Field Type is required.</span>
        </div>
        <div class="field" id="field-mapping-customconfig-${rowId}">
          <label for="mapping-customconfig-${rowId}">Configuration (JSON)</label>
          <textarea id="mapping-customconfig-${rowId}" rows="6" spellcheck="false"></textarea>
          <span class="hint">JSON object of this field's parameters, e.g. nested "properties" (excluding "type").</span>
          <span class="error">Configuration must be a valid JSON object.</span>
        </div>`;
    }
    if (def.options.length === 0) {
      return '<p class="hint">This field type takes no additional parameters.</p>';
    }
    return def.options.map((o) => mappingOptionControlHtml(o, `mapping-opt-${rowId}-${o.key}`)).join('');
  }

  function mappingFieldRowHtml(rowId, value) {
    const def = value.isCustom ? undefined : findMappingFieldType(value.type);
    const typeSelectValue = def ? def.id : CUSTOM_MAPPING_TYPE_ID;
    return `<details class="integration-input mapping-field-row" open data-row-id="${rowId}">
      <summary class="integration-summary">
        <input type="text" id="mapping-name-${rowId}" placeholder="Field Name" />
        <select id="mapping-type-${rowId}">${mappingTypeOptionsHtml(typeSelectValue)}</select>
        <button type="button" class="secondary mapping-field-remove">Remove</button>
      </summary>
      <div class="input-body">
        <div class="mapping-options" id="mapping-opts-${rowId}">${mappingOptionsAreaHtml(rowId, def)}</div>
      </div>
    </details>`;
  }

  function populateMappingFieldRow(rowId, value) {
    document.getElementById(`mapping-name-${rowId}`).value = value.name || '';
    const def = value.isCustom ? undefined : findMappingFieldType(value.type);
    if (!def) {
      document.getElementById(`mapping-customtype-${rowId}`).value = value.customType || '';
      document.getElementById(`mapping-customconfig-${rowId}`).value = value.customConfig || '{}';
    } else {
      for (const opt of def.options) {
        setOptionControlValue(
          `mapping-opt-${rowId}-${opt.key}`,
          opt.type,
          value.options ? value.options[opt.key] : opt.default
        );
      }
    }
  }

  function wireMappingFieldRow(rowId) {
    const row = document.querySelector(`.mapping-field-row[data-row-id="${rowId}"]`);
    const nameField = document.getElementById(`mapping-name-${rowId}`);
    const typeSelect = document.getElementById(`mapping-type-${rowId}`);
    // Prevent interacting with controls in the <summary> from also toggling the enclosing <details>.
    nameField.addEventListener('click', (e) => e.stopPropagation());
    typeSelect.addEventListener('click', (e) => e.stopPropagation());
    typeSelect.addEventListener('change', () => {
      const def = findMappingFieldType(typeSelect.value);
      document.getElementById(`mapping-opts-${rowId}`).innerHTML = mappingOptionsAreaHtml(rowId, def);
    });
    row.querySelector('.mapping-field-remove').addEventListener('click', (e) => {
      e.stopPropagation();
      row.remove();
    });
  }

  function addMappingFieldRow(value) {
    const rowId = mappingRowSeq++;
    mappingFieldsContainer.insertAdjacentHTML('beforeend', mappingFieldRowHtml(rowId, value));
    populateMappingFieldRow(rowId, value);
    wireMappingFieldRow(rowId);
  }

  function defaultMappingFieldValue() {
    const firstType = mappingFieldTypesTemplate[0];
    const options = {};
    for (const opt of firstType.options) {
      options[opt.key] = opt.default;
    }
    return { name: '', type: firstType.id, isCustom: false, customType: '', customConfig: '{}', options };
  }

  function collectMappingFieldRow(row) {
    const rowId = row.dataset.rowId;
    const typeSelect = document.getElementById(`mapping-type-${rowId}`);
    const def = findMappingFieldType(typeSelect.value);
    const name = document.getElementById(`mapping-name-${rowId}`).value;

    if (!def) {
      return {
        rowId,
        name,
        type: CUSTOM_MAPPING_TYPE_ID,
        isCustom: true,
        customType: document.getElementById(`mapping-customtype-${rowId}`).value.trim(),
        customConfig: document.getElementById(`mapping-customconfig-${rowId}`).value,
        options: {},
      };
    }

    const options = {};
    for (const opt of def.options) {
      options[opt.key] = getOptionControlValue(`mapping-opt-${rowId}-${opt.key}`, opt.type);
    }
    return { rowId, name, type: def.id, isCustom: false, customType: '', customConfig: '{}', options };
  }

  function collectMappingFields() {
    return Array.from(mappingFieldsContainer.querySelectorAll('.mapping-field-row')).map(collectMappingFieldRow);
  }

  /** Mirrors the server-side checks in buildMappingFieldJson/buildMappingPropertiesJson; returns the first invalid element's id, if any. */
  function validateMappingFieldRows(rows) {
    let firstInvalidId = null;
    const seenNames = new Set();
    for (const row of rows) {
      const nameInput = document.getElementById(`mapping-name-${row.rowId}`);
      const trimmedName = (row.name || '').trim();
      const nameValid = trimmedName.length > 0 && !seenNames.has(trimmedName);
      if (trimmedName) seenNames.add(trimmedName);
      nameInput.classList.toggle('invalid-input', !nameValid);
      if (!nameValid && !firstInvalidId) firstInvalidId = `mapping-name-${row.rowId}`;

      if (row.isCustom) {
        const typeValid = !isBlank(row.customType);
        setFieldValid(`mapping-customtype-${row.rowId}`, typeValid);
        if (!typeValid && !firstInvalidId) firstInvalidId = `mapping-customtype-${row.rowId}`;

        const configValid = Boolean(parseJsonObject(row.customConfig || '{}'));
        setFieldValid(`mapping-customconfig-${row.rowId}`, configValid);
        if (!configValid && !firstInvalidId) firstInvalidId = `mapping-customconfig-${row.rowId}`;
      }
    }
    return firstInvalidId;
  }

  // ---------- Aliases ----------

  function aliasRowHtml(rowId) {
    return `<details class="integration-input alias-row" open data-row-id="${rowId}">
      <summary class="integration-summary">
        <input type="text" id="alias-name-${rowId}" placeholder="Alias Name" />
        <button type="button" class="secondary alias-remove">Remove</button>
      </summary>
      <div class="input-body">
        <div class="field">
          <div class="checkbox-row">
            <input type="checkbox" id="alias-writeindex-${rowId}" />
            <label for="alias-writeindex-${rowId}" style="margin:0">Is Write Index</label>
          </div>
        </div>
        <div class="field">
          <div class="checkbox-row">
            <input type="checkbox" id="alias-hidden-${rowId}" />
            <label for="alias-hidden-${rowId}" style="margin:0">Is Hidden</label>
          </div>
        </div>
        <div class="field">
          <label for="alias-routing-${rowId}">Routing (optional)</label>
          <input type="text" id="alias-routing-${rowId}" />
        </div>
        <div class="field" id="field-alias-filter-${rowId}">
          <label for="alias-filter-${rowId}">Filter (optional, JSON)</label>
          <textarea id="alias-filter-${rowId}" rows="4" spellcheck="false"></textarea>
          <span class="hint">Optional Query DSL object restricting which documents this alias exposes.</span>
          <span class="error">Filter must be a valid JSON object.</span>
        </div>
      </div>
    </details>`;
  }

  function populateAliasRow(rowId, value) {
    document.getElementById(`alias-name-${rowId}`).value = value.name || '';
    document.getElementById(`alias-writeindex-${rowId}`).checked = Boolean(value.isWriteIndex);
    document.getElementById(`alias-hidden-${rowId}`).checked = Boolean(value.isHidden);
    document.getElementById(`alias-routing-${rowId}`).value = value.routing || '';
    document.getElementById(`alias-filter-${rowId}`).value = value.filter || '';
  }

  function wireAliasRow(rowId) {
    const row = document.querySelector(`.alias-row[data-row-id="${rowId}"]`);
    const nameField = document.getElementById(`alias-name-${rowId}`);
    // Prevent interacting with the name field in the <summary> from also toggling the enclosing <details>.
    nameField.addEventListener('click', (e) => e.stopPropagation());
    row.querySelector('.alias-remove').addEventListener('click', (e) => {
      e.stopPropagation();
      row.remove();
    });
  }

  function addAliasRow(value) {
    const rowId = aliasRowSeq++;
    aliasesContainer.insertAdjacentHTML('beforeend', aliasRowHtml(rowId));
    populateAliasRow(rowId, value);
    wireAliasRow(rowId);
  }

  function defaultAliasValue() {
    return { name: '', isWriteIndex: false, isHidden: false, routing: '', filter: '' };
  }

  function collectAliasRow(row) {
    const rowId = row.dataset.rowId;
    return {
      rowId,
      name: document.getElementById(`alias-name-${rowId}`).value,
      isWriteIndex: document.getElementById(`alias-writeindex-${rowId}`).checked,
      isHidden: document.getElementById(`alias-hidden-${rowId}`).checked,
      routing: document.getElementById(`alias-routing-${rowId}`).value,
      filter: document.getElementById(`alias-filter-${rowId}`).value,
    };
  }

  function collectAliases() {
    return Array.from(aliasesContainer.querySelectorAll('.alias-row')).map(collectAliasRow);
  }

  /** Mirrors the server-side checks in buildAliasJson/buildAliasesJson; returns the first invalid element's id, if any. */
  function validateAliasRows(rows) {
    let firstInvalidId = null;
    const seenNames = new Set();
    for (const row of rows) {
      const nameInput = document.getElementById(`alias-name-${row.rowId}`);
      const trimmedName = (row.name || '').trim();
      const nameValid = trimmedName.length > 0 && !seenNames.has(trimmedName);
      if (trimmedName) seenNames.add(trimmedName);
      nameInput.classList.toggle('invalid-input', !nameValid);
      if (!nameValid && !firstInvalidId) firstInvalidId = `alias-name-${row.rowId}`;

      const filterValue = (row.filter || '').trim();
      const filterValid = filterValue === '' || Boolean(parseJsonObject(filterValue));
      setFieldValid(`alias-filter-${row.rowId}`, filterValid);
      if (!filterValid && !firstInvalidId) firstInvalidId = `alias-filter-${row.rowId}`;
    }
    return firstInvalidId;
  }

  // ---------- Populate / message handling ----------

  function populate(payload) {
    settingsFieldsTemplate = payload.settingsFields;
    mappingFieldTypesTemplate = payload.mappingFieldTypes;

    const item = payload.item;
    nameField.value = item.name;
    arrayToTextarea(indexPatternsField, item.indexPatterns);
    arrayToTextarea(composedOfField, item.composedOf);
    priorityField.value = item.priority || '';
    versionField.value = item.version || '';
    allowAutoCreateField.value = item.allowAutoCreate || '';
    arrayToTextarea(ignoreMissingField, item.ignoreMissingComponentTemplates);
    dataStreamEnabledField.checked = Boolean(item.dataStreamEnabled);
    dataStreamHiddenField.checked = Boolean(item.dataStreamHidden);
    dataStreamAllowCustomRoutingField.checked = Boolean(item.dataStreamAllowCustomRouting);

    renderSettingsFields(settingsFieldsTemplate);
    populateSettings(settingsFieldsTemplate, item.settings);
    setIncludeToggle(settingsSection, settingsEnabledField, settingsBody, Boolean(item.settingsEnabled));

    mappingsDynamicField.value = item.mappings.dynamic || '';
    mappingsDisableSourceField.checked = Boolean(item.mappings.disableSource);
    mappingFieldsContainer.innerHTML = '';
    (item.mappings.fields || []).forEach((f) => addMappingFieldRow(f));
    setIncludeToggle(mappingsSection, mappingsEnabledField, mappingsBody, Boolean(item.mappingsEnabled));

    aliasesContainer.innerHTML = '';
    (item.aliases || []).forEach((a) => addAliasRow(a));
    setIncludeToggle(aliasesSection, aliasesEnabledField, aliasesBody, Boolean(item.aliasesEnabled));

    metaField.value = item.meta || '';
    deprecatedField.checked = Boolean(item.deprecated);
  }

  window.addEventListener('message', (event) => {
    const message = event.data;
    switch (message.type) {
      case 'init':
        populate(message.payload);
        break;
      case 'saved':
        clearError();
        break;
      case 'error':
        showError(message.message);
        break;
    }
  });

  addMappingFieldButton.addEventListener('click', () => addMappingFieldRow(defaultMappingFieldValue()));
  addAliasButton.addEventListener('click', () => addAliasRow(defaultAliasValue()));

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    clearError();

    const nameValue = nameField.value.trim();
    const nameValid = nameValue.length > 0 && !/[\\/:*?"<>|]/.test(nameValue);
    setFieldValid('name', nameValid);

    const indexPatterns = arrayFromTextarea(indexPatternsField);
    const indexPatternsValid = indexPatterns.length > 0;
    setFieldValid('indexPatterns', indexPatternsValid);

    const priorityValue = priorityField.value.trim();
    const priorityValid = priorityValue === '' || Number.isFinite(Number(priorityValue));
    setFieldValid('priority', priorityValid);

    const versionValue = versionField.value.trim();
    const versionValid = versionValue === '' || Number.isFinite(Number(versionValue));
    setFieldValid('version', versionValid);

    const settingsAdvancedValue = settingsAdvancedField.value.trim();
    const settingsAdvancedValid =
      !settingsEnabledField.checked || settingsAdvancedValue === '' || Boolean(parseJsonObject(settingsAdvancedValue));
    setFieldValid('settingsAdvanced', settingsAdvancedValid);

    const metaValue = metaField.value.trim();
    const metaValid = metaValue === '' || Boolean(parseJsonObject(metaValue));
    setFieldValid('meta', metaValid);

    if (!nameValid || !indexPatternsValid || !priorityValid || !versionValid || !settingsAdvancedValid || !metaValid) {
      return;
    }

    const mappingRows = collectMappingFields();
    const aliasRows = collectAliases();

    // Rows in a section that isn't included don't block saving - they're excluded outright.
    const firstInvalidId =
      (mappingsEnabledField.checked ? validateMappingFieldRows(mappingRows) : null) ||
      (aliasesEnabledField.checked ? validateAliasRows(aliasRows) : null);
    if (firstInvalidId) {
      showError('Fill in the required fields highlighted below.');
      document.getElementById(firstInvalidId).scrollIntoView({ block: 'center' });
      return;
    }

    const stripRowId = ({ rowId, ...rest }) => rest;

    vscode.postMessage({
      type: 'save',
      payload: {
        name: nameValue,
        indexPatterns,
        composedOf: arrayFromTextarea(composedOfField),
        priority: priorityField.value,
        version: versionField.value,
        allowAutoCreate: allowAutoCreateField.value,
        ignoreMissingComponentTemplates: arrayFromTextarea(ignoreMissingField),
        dataStreamEnabled: dataStreamEnabledField.checked,
        dataStreamHidden: dataStreamHiddenField.checked,
        dataStreamAllowCustomRouting: dataStreamAllowCustomRoutingField.checked,
        settingsEnabled: settingsEnabledField.checked,
        settings: collectSettings(settingsFieldsTemplate),
        mappingsEnabled: mappingsEnabledField.checked,
        mappings: {
          dynamic: mappingsDynamicField.value,
          disableSource: mappingsDisableSourceField.checked,
          fields: mappingRows.map(stripRowId),
        },
        aliasesEnabled: aliasesEnabledField.checked,
        aliases: aliasRows.map(stripRowId),
        meta: metaField.value,
        deprecated: deprecatedField.checked,
      },
    });
  });

  cancelButton.addEventListener('click', () => {
    vscode.postMessage({ type: 'cancel' });
  });

  vscode.postMessage({ type: 'ready' });
})();
