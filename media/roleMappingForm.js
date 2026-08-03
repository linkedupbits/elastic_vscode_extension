(function () {
  const vscode = acquireVsCodeApi();

  const form = document.getElementById('form');
  const nameField = document.getElementById('name');
  const enabledField = document.getElementById('enabled');
  const rolesField = document.getElementById('roles');
  const roleTemplatesContainer = document.getElementById('role-templates-container');
  const addRoleTemplateButton = document.getElementById('add-role-template');
  const rulesField = document.getElementById('rules');
  const metadataField = document.getElementById('metadata');
  const errorBanner = document.getElementById('error-banner');
  const cancelButton = document.getElementById('cancel');

  let roleTemplateRowSeq = 0;

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

  // ---------- Role Templates ----------

  function roleTemplateRowHtml(rowId) {
    return `<details class="integration-input roletemplate-row" open data-row-id="${rowId}">
      <summary class="integration-summary">
        <strong>Role Template</strong>
        <button type="button" class="secondary roletemplate-remove">Remove</button>
      </summary>
      <div class="input-body">
        <div class="field" id="field-rt-template-${rowId}">
          <label for="rt-template-${rowId}">Template</label>
          <textarea id="rt-template-${rowId}" rows="2" placeholder="{{#tokenize &quot;username&quot;}}{{.}}{{/tokenize}}" spellcheck="false"></textarea>
          <span class="hint">Mustache template evaluated against the authenticating user to produce role name(s).</span>
          <span class="error">Template is required.</span>
        </div>
        <div class="field">
          <label for="rt-format-${rowId}">Format</label>
          <select id="rt-format-${rowId}">
            <option value="">(default)</option>
            <option value="string">string</option>
            <option value="json">json</option>
          </select>
          <span class="hint">"json" if the evaluated template produces a JSON array of role names.</span>
        </div>
      </div>
    </details>`;
  }

  function populateRoleTemplateRow(rowId, value) {
    document.getElementById(`rt-template-${rowId}`).value = value.template || '';
    document.getElementById(`rt-format-${rowId}`).value = value.format || '';
  }

  function addRoleTemplateRow(value) {
    const rowId = roleTemplateRowSeq++;
    roleTemplatesContainer.insertAdjacentHTML('beforeend', roleTemplateRowHtml(rowId));
    populateRoleTemplateRow(rowId, value);
    const row = roleTemplatesContainer.querySelector(`.roletemplate-row[data-row-id="${rowId}"]`);
    row.querySelector('.roletemplate-remove').addEventListener('click', (e) => {
      e.stopPropagation();
      row.remove();
    });
  }

  function defaultRoleTemplateValue() {
    return { template: '', format: '' };
  }

  function collectRoleTemplateRow(row) {
    const rowId = row.dataset.rowId;
    return {
      rowId,
      template: document.getElementById(`rt-template-${rowId}`).value,
      format: document.getElementById(`rt-format-${rowId}`).value,
    };
  }

  function collectRoleTemplateRows() {
    return Array.from(roleTemplatesContainer.querySelectorAll('.roletemplate-row')).map(collectRoleTemplateRow);
  }

  /** Mirrors the server-side check in buildRoleTemplatesJson. */
  function validateRoleTemplateRows(rows) {
    let firstInvalidId = null;
    for (const row of rows) {
      const templateValid = (row.template || '').trim().length > 0;
      setFieldValid(`rt-template-${row.rowId}`, templateValid);
      if (!templateValid && !firstInvalidId) firstInvalidId = `rt-template-${row.rowId}`;
    }
    return firstInvalidId;
  }

  // ---------- Populate / message handling ----------

  function populate(payload) {
    const item = payload.item;
    nameField.value = item.name;
    enabledField.checked = item.enabled !== false;
    arrayToTextarea(rolesField, item.roles);

    roleTemplatesContainer.innerHTML = '';
    (item.roleTemplates || []).forEach((v) => addRoleTemplateRow(v));

    rulesField.value = item.rules || '';
    metadataField.value = item.metadata || '';
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

  addRoleTemplateButton.addEventListener('click', () => addRoleTemplateRow(defaultRoleTemplateValue()));

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    clearError();

    const nameValue = nameField.value.trim();
    const nameValid = nameValue.length > 0 && !/[\\/:*?"<>|]/.test(nameValue);
    setFieldValid('name', nameValid);

    const rulesValue = rulesField.value.trim();
    const rulesValid = rulesValue !== '' && Boolean(parseJsonObject(rulesValue));
    setFieldValid('rules', rulesValid);

    const metadataValue = metadataField.value.trim();
    const metadataValid = metadataValue === '' || Boolean(parseJsonObject(metadataValue));
    setFieldValid('metadata', metadataValid);

    if (!nameValid || !rulesValid || !metadataValid) {
      return;
    }

    const roleTemplateRows = collectRoleTemplateRows();
    const roles = arrayFromTextarea(rolesField);

    if (roles.length === 0 && roleTemplateRows.length === 0) {
      showError('At least one Role or Role Template is required.');
      return;
    }

    const firstInvalidId = validateRoleTemplateRows(roleTemplateRows);
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
        enabled: enabledField.checked,
        roles,
        roleTemplates: roleTemplateRows.map(stripRowId),
        rules: rulesField.value,
        metadata: metadataField.value,
      },
    });
  });

  cancelButton.addEventListener('click', () => {
    vscode.postMessage({ type: 'cancel' });
  });

  vscode.postMessage({ type: 'ready' });
})();
