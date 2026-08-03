(function () {
  const vscode = acquireVsCodeApi();

  const form = document.getElementById('form');
  const nameField = document.getElementById('name');
  const descriptionField = document.getElementById('description');
  const versionField = document.getElementById('version');
  const processorsField = document.getElementById('processors');
  const onFailureField = document.getElementById('on_failure');
  const metaField = document.getElementById('meta');
  const deprecatedField = document.getElementById('deprecated');
  const errorBanner = document.getElementById('error-banner');
  const cancelButton = document.getElementById('cancel');

  function setFieldValid(fieldId, valid) {
    document.getElementById('field-' + fieldId).classList.toggle('invalid', !valid);
  }

  function showError(message) {
    errorBanner.textContent = message;
    errorBanner.classList.add('show');
  }

  function clearError() {
    errorBanner.classList.remove('show');
    errorBanner.textContent = '';
  }

  function parseJsonArray(raw) {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return undefined;
    }
    return Array.isArray(parsed) ? parsed : undefined;
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

  function populate(item) {
    nameField.value = item.name;
    descriptionField.value = item.description || '';
    versionField.value = item.version || '';
    processorsField.value = item.processors;
    onFailureField.value = item.onFailure || '';
    metaField.value = item.meta || '';
    deprecatedField.checked = Boolean(item.deprecated);
  }

  window.addEventListener('message', (event) => {
    const message = event.data;
    switch (message.type) {
      case 'init':
        populate(message.payload.item);
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

    const versionValue = versionField.value.trim();
    const versionValid = versionValue === '' || Number.isFinite(Number(versionValue));
    setFieldValid('version', versionValid);

    const processors = parseJsonArray(processorsField.value);
    const processorsValid = Boolean(processors) && processors.length > 0;
    setFieldValid('processors', processorsValid);

    const onFailureValue = onFailureField.value.trim();
    const onFailureValid = onFailureValue === '' || Boolean(parseJsonArray(onFailureValue));
    setFieldValid('on_failure', onFailureValid);

    const metaValue = metaField.value.trim();
    const metaValid = metaValue === '' || Boolean(parseJsonObject(metaValue));
    setFieldValid('meta', metaValid);

    if (!nameValid || !versionValid || !processorsValid || !onFailureValid || !metaValid) {
      return;
    }

    vscode.postMessage({
      type: 'save',
      payload: {
        name: nameValue,
        description: descriptionField.value,
        version: versionField.value,
        processors: processorsField.value,
        onFailure: onFailureField.value,
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
