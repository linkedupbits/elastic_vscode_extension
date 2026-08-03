(function () {
  const vscode = acquireVsCodeApi();

  const CUSTOM_ID = '__custom__';

  const form = document.getElementById('form');
  const nameField = document.getElementById('name');
  const descriptionField = document.getElementById('description');
  const versionField = document.getElementById('version');
  const metaField = document.getElementById('meta');
  const deprecatedField = document.getElementById('deprecated');
  const processorsContainer = document.getElementById('processors-container');
  const onFailureContainer = document.getElementById('on-failure-container');
  const addProcessorButton = document.getElementById('add-processor');
  const addOnFailureButton = document.getElementById('add-on-failure-processor');
  const errorBanner = document.getElementById('error-banner');
  const cancelButton = document.getElementById('cancel');

  let currentTemplate = [];
  let rowSeq = 0;

  function findProcessorDef(typeId) {
    return currentTemplate.find((p) => p.id === typeId);
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

  function parseJsonObject(raw) {
    let parsed;
    try {
      parsed = JSON.parse(raw || '{}');
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
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'string') return value.trim().length === 0;
    return false;
  }

  function setControlValue(id, type, value) {
    const el = document.getElementById(id);
    if (!el) return;
    if (type === 'boolean') {
      el.checked = Boolean(value);
    } else if (type === 'stringArray') {
      el.value = Array.isArray(value) ? value.join('\n') : '';
    } else {
      el.value = value === undefined || value === null ? '' : String(value);
    }
  }

  function getControlValue(id, type) {
    const el = document.getElementById(id);
    if (!el) return undefined;
    if (type === 'boolean') return el.checked;
    if (type === 'stringArray') {
      return el.value
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }
    return el.value;
  }

  function fieldControlHtml(field, id) {
    const label = field.required ? `${field.label} *` : field.label;
    const hintSpan = field.hint ? `<span class="hint">${field.hint}</span>` : '';
    const errorSpan = '<span class="error">This field is required.</span>';
    switch (field.type) {
      case 'boolean':
        return `<div class="field" id="field-${id}">
          <div class="checkbox-row"><input type="checkbox" id="${id}" /><label for="${id}" style="margin:0">${label}</label></div>
        </div>`;
      case 'multiline':
        return `<div class="field" id="field-${id}"><label for="${id}">${label}</label><textarea id="${id}"></textarea>${hintSpan}${errorSpan}</div>`;
      case 'stringArray':
        return `<div class="field" id="field-${id}"><label for="${id}">${label}</label><textarea id="${id}"></textarea>${hintSpan}${errorSpan}</div>`;
      case 'select': {
        const options = (field.options || []).map((o) => `<option value="${o.value}">${o.label}</option>`).join('');
        return `<div class="field" id="field-${id}"><label for="${id}">${label}</label><select id="${id}">${options}</select>${hintSpan}${errorSpan}</div>`;
      }
      case 'string':
      default:
        return `<div class="field" id="field-${id}"><label for="${id}">${label}</label><input type="text" id="${id}" />${hintSpan}${errorSpan}</div>`;
    }
  }

  function processorTypeOptionsHtml(selectedType) {
    const known = currentTemplate
      .map((p) => `<option value="${p.id}"${p.id === selectedType ? ' selected' : ''}>${p.label}</option>`)
      .join('');
    const customSelected = selectedType === CUSTOM_ID ? ' selected' : '';
    return known + `<option value="${CUSTOM_ID}"${customSelected}>Custom / Other...</option>`;
  }

  function fieldsAreaHtml(rowId, def) {
    if (!def) {
      return `
        <div class="field" id="field-proc-customtype-${rowId}">
          <label for="proc-customtype-${rowId}">Processor Type</label>
          <input type="text" id="proc-customtype-${rowId}" placeholder="e.g. enrich" />
          <span class="error">Processor Type is required.</span>
        </div>
        <div class="field" id="field-proc-customconfig-${rowId}">
          <label for="proc-customconfig-${rowId}">Configuration (JSON)</label>
          <textarea id="proc-customconfig-${rowId}" rows="6" spellcheck="false"></textarea>
          <span class="hint">JSON object of this processor's parameters (excluding Tag/Condition/Ignore Failure below).</span>
          <span class="error">Configuration must be a valid JSON object.</span>
        </div>`;
    }
    if (def.fields.length === 0) {
      return '<p class="hint">This processor takes no additional parameters.</p>';
    }
    return def.fields.map((f) => fieldControlHtml(f, `proc-field-${rowId}-${f.key}`)).join('');
  }

  function processorRowHtml(rowId, value) {
    const def = value.isCustom ? undefined : findProcessorDef(value.type);
    const typeSelectValue = def ? def.id : CUSTOM_ID;
    return `<details class="integration-input processor-row" open data-row-id="${rowId}">
      <summary class="integration-summary">
        <select id="proc-type-${rowId}">${processorTypeOptionsHtml(typeSelectValue)}</select>
        <button type="button" class="secondary processor-remove">Remove</button>
      </summary>
      <div class="input-body">
        <div class="proc-fields" id="proc-fields-${rowId}">${fieldsAreaHtml(rowId, def)}</div>
        <div class="field" id="field-proc-tag-${rowId}">
          <label for="proc-tag-${rowId}">Tag (optional)</label>
          <input type="text" id="proc-tag-${rowId}" />
        </div>
        <div class="field" id="field-proc-if-${rowId}">
          <label for="proc-if-${rowId}">Condition (optional, Painless)</label>
          <textarea id="proc-if-${rowId}" rows="2"></textarea>
        </div>
        <div class="field">
          <div class="checkbox-row">
            <input type="checkbox" id="proc-ignorefailure-${rowId}" />
            <label for="proc-ignorefailure-${rowId}" style="margin:0">Ignore Failure</label>
          </div>
        </div>
      </div>
    </details>`;
  }

  function populateProcessorRow(rowId, value) {
    const def = value.isCustom ? undefined : findProcessorDef(value.type);
    if (!def) {
      document.getElementById(`proc-customtype-${rowId}`).value = value.customType || '';
      document.getElementById(`proc-customconfig-${rowId}`).value = value.customConfig || '{}';
    } else {
      for (const field of def.fields) {
        setControlValue(
          `proc-field-${rowId}-${field.key}`,
          field.type,
          value.fields ? value.fields[field.key] : field.default
        );
      }
    }
    document.getElementById(`proc-tag-${rowId}`).value = value.tag || '';
    document.getElementById(`proc-if-${rowId}`).value = value.condition || '';
    document.getElementById(`proc-ignorefailure-${rowId}`).checked = Boolean(value.ignoreFailure);
  }

  function wireProcessorRow(rowId) {
    const row = document.querySelector(`.processor-row[data-row-id="${rowId}"]`);
    const typeSelect = document.getElementById(`proc-type-${rowId}`);
    // Prevent interacting with controls in the <summary> from also toggling the enclosing <details>.
    typeSelect.addEventListener('click', (e) => e.stopPropagation());
    typeSelect.addEventListener('change', () => {
      const def = findProcessorDef(typeSelect.value);
      document.getElementById(`proc-fields-${rowId}`).innerHTML = fieldsAreaHtml(rowId, def);
    });
    const removeButton = row.querySelector('.processor-remove');
    removeButton.addEventListener('click', (e) => {
      e.stopPropagation();
      row.remove();
    });
  }

  function addProcessorRow(container, value) {
    const rowId = rowSeq++;
    container.insertAdjacentHTML('beforeend', processorRowHtml(rowId, value));
    populateProcessorRow(rowId, value);
    wireProcessorRow(rowId);
  }

  function defaultNewProcessorValue() {
    const firstType = currentTemplate[0];
    const fields = {};
    for (const field of firstType.fields) {
      fields[field.key] = field.default;
    }
    return {
      type: firstType.id,
      isCustom: false,
      customType: '',
      customConfig: '{}',
      fields,
      tag: '',
      condition: '',
      ignoreFailure: false,
    };
  }

  function collectProcessorRow(row) {
    const rowId = row.dataset.rowId;
    const typeSelect = document.getElementById(`proc-type-${rowId}`);
    const def = findProcessorDef(typeSelect.value);
    const tag = document.getElementById(`proc-tag-${rowId}`).value;
    const condition = document.getElementById(`proc-if-${rowId}`).value;
    const ignoreFailure = document.getElementById(`proc-ignorefailure-${rowId}`).checked;

    if (!def) {
      return {
        rowId,
        type: CUSTOM_ID,
        isCustom: true,
        customType: document.getElementById(`proc-customtype-${rowId}`).value.trim(),
        customConfig: document.getElementById(`proc-customconfig-${rowId}`).value,
        fields: {},
        tag,
        condition,
        ignoreFailure,
      };
    }

    const fields = {};
    for (const field of def.fields) {
      fields[field.key] = getControlValue(`proc-field-${rowId}-${field.key}`, field.type);
    }
    return { rowId, type: def.id, isCustom: false, customType: '', customConfig: '{}', fields, tag, condition, ignoreFailure };
  }

  function collectProcessors(container) {
    return Array.from(container.querySelectorAll('.processor-row')).map(collectProcessorRow);
  }

  /** Mirrors the server-side checks in buildProcessorJson; returns the first invalid element's id, if any. */
  function validateProcessorRows(rows) {
    let firstInvalidId = null;
    for (const row of rows) {
      if (row.isCustom) {
        const typeValid = !isBlank(row.customType);
        setFieldValid(`proc-customtype-${row.rowId}`, typeValid);
        if (!typeValid && !firstInvalidId) firstInvalidId = `proc-customtype-${row.rowId}`;

        const configValid = Boolean(parseJsonObject(row.customConfig));
        setFieldValid(`proc-customconfig-${row.rowId}`, configValid);
        if (!configValid && !firstInvalidId) firstInvalidId = `proc-customconfig-${row.rowId}`;
        continue;
      }
      const def = findProcessorDef(row.type);
      for (const field of def.fields) {
        const id = `proc-field-${row.rowId}-${field.key}`;
        const invalid = Boolean(field.required && isBlank(row.fields[field.key]));
        setFieldValid(id, !invalid);
        if (invalid && !firstInvalidId) firstInvalidId = id;
      }
    }
    return firstInvalidId;
  }

  function populateProcessorList(container, values) {
    container.innerHTML = '';
    values.forEach((value) => addProcessorRow(container, value));
  }

  function populate(payload) {
    currentTemplate = payload.template;
    nameField.value = payload.item.name;
    descriptionField.value = payload.item.description || '';
    versionField.value = payload.item.version || '';
    metaField.value = payload.item.meta || '';
    deprecatedField.checked = Boolean(payload.item.deprecated);

    populateProcessorList(processorsContainer, payload.item.processors);
    populateProcessorList(onFailureContainer, payload.item.onFailure);
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

  addProcessorButton.addEventListener('click', () => addProcessorRow(processorsContainer, defaultNewProcessorValue()));
  addOnFailureButton.addEventListener('click', () => addProcessorRow(onFailureContainer, defaultNewProcessorValue()));

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    clearError();

    const nameValue = nameField.value.trim();
    const nameValid = nameValue.length > 0 && !/[\\/:*?"<>|]/.test(nameValue);
    setFieldValid('name', nameValid);

    const versionValue = versionField.value.trim();
    const versionValid = versionValue === '' || Number.isFinite(Number(versionValue));
    setFieldValid('version', versionValid);

    const metaValue = metaField.value.trim();
    const metaValid = metaValue === '' || Boolean(parseJsonObject(metaValue));
    setFieldValid('meta', metaValid);

    if (!nameValid || !versionValid || !metaValid) {
      return;
    }

    const processorRows = collectProcessors(processorsContainer);
    const onFailureRows = collectProcessors(onFailureContainer);

    if (processorRows.length === 0) {
      showError('At least one processor is required.');
      return;
    }

    const firstInvalidId = validateProcessorRows(processorRows) || validateProcessorRows(onFailureRows);
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
        description: descriptionField.value,
        version: versionField.value,
        processors: processorRows.map(stripRowId),
        onFailure: onFailureRows.map(stripRowId),
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
