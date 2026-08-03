(function () {
  const vscode = acquireVsCodeApi();

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
  const settingsField = document.getElementById('settings');
  const mappingsField = document.getElementById('mappings');
  const aliasesField = document.getElementById('aliases');
  const metaField = document.getElementById('meta');
  const deprecatedField = document.getElementById('deprecated');
  const errorBanner = document.getElementById('error-banner');
  const cancelButton = document.getElementById('cancel');

  // Prevent a click on the data-stream checkbox from also toggling the enclosing <details>.
  dataStreamEnabledField.addEventListener('click', (e) => e.stopPropagation());

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

  function populate(payload) {
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
    settingsField.value = item.settings || '';
    mappingsField.value = item.mappings || '';
    aliasesField.value = item.aliases || '';
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

    const settingsValue = settingsField.value.trim();
    const settingsValid = settingsValue === '' || Boolean(parseJsonObject(settingsValue));
    setFieldValid('settings', settingsValid);

    const mappingsValue = mappingsField.value.trim();
    const mappingsValid = mappingsValue === '' || Boolean(parseJsonObject(mappingsValue));
    setFieldValid('mappings', mappingsValid);

    const aliasesValue = aliasesField.value.trim();
    const aliasesValid = aliasesValue === '' || Boolean(parseJsonObject(aliasesValue));
    setFieldValid('aliases', aliasesValid);

    const metaValue = metaField.value.trim();
    const metaValid = metaValue === '' || Boolean(parseJsonObject(metaValue));
    setFieldValid('meta', metaValid);

    if (
      !nameValid ||
      !indexPatternsValid ||
      !priorityValid ||
      !versionValid ||
      !settingsValid ||
      !mappingsValid ||
      !aliasesValid ||
      !metaValid
    ) {
      return;
    }

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
        settings: settingsField.value,
        mappings: mappingsField.value,
        aliases: aliasesField.value,
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
