(function () {
  const vscode = acquireVsCodeApi();

  const form = document.getElementById('form');
  const policyIdField = document.getElementById('policyId');
  const scheduleField = document.getElementById('schedule');
  const nameField = document.getElementById('name');
  const repositoryField = document.getElementById('repository');
  const configField = document.getElementById('config');
  const retentionField = document.getElementById('retention');
  const errorBanner = document.getElementById('error-banner');
  const cancelButton = document.getElementById('cancel');

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

  function populate(item) {
    policyIdField.value = item.policyId;
    scheduleField.value = item.schedule;
    nameField.value = item.name;
    repositoryField.value = item.repository;
    configField.value = item.config || '';
    retentionField.value = item.retention || '';
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

    const policyIdValue = policyIdField.value.trim();
    const policyIdValid = policyIdValue.length > 0 && !/[\\/:*?"<>|]/.test(policyIdValue);
    setFieldValid('policyId', policyIdValid);

    const scheduleValue = scheduleField.value.trim();
    const scheduleValid = scheduleValue.length > 0;
    setFieldValid('schedule', scheduleValid);

    const nameValue = nameField.value.trim();
    const nameValid = nameValue.length > 0;
    setFieldValid('name', nameValid);

    const repositoryValue = repositoryField.value.trim();
    const repositoryValid = repositoryValue.length > 0;
    setFieldValid('repository', repositoryValid);

    const configValue = configField.value.trim();
    const configValid = configValue === '' || Boolean(parseJsonObject(configValue));
    setFieldValid('config', configValid);

    const retentionValue = retentionField.value.trim();
    const retentionValid = retentionValue === '' || Boolean(parseJsonObject(retentionValue));
    setFieldValid('retention', retentionValid);

    if (!policyIdValid || !scheduleValid || !nameValid || !repositoryValid || !configValid || !retentionValid) {
      return;
    }

    vscode.postMessage({
      type: 'save',
      payload: {
        policyId: policyIdValue,
        schedule: scheduleValue,
        name: nameValue,
        repository: repositoryValue,
        config: configField.value,
        retention: retentionField.value,
      },
    });
  });

  cancelButton.addEventListener('click', () => {
    vscode.postMessage({ type: 'cancel' });
  });

  vscode.postMessage({ type: 'ready' });
})();
