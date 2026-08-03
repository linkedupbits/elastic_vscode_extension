(function () {
  const vscode = acquireVsCodeApi();

  const form = document.getElementById('form');
  const idField = document.getElementById('id');
  const nameField = document.getElementById('name');
  const descriptionField = document.getElementById('description');
  const monitoringLogs = document.getElementById('monitoring_logs');
  const monitoringMetrics = document.getElementById('monitoring_metrics');
  const inactivityTimeoutField = document.getElementById('inactivity_timeout');
  const downloadSourceField = document.getElementById('download_source_id');
  const namespaceField = document.getElementById('namespace');
  const schemaVersionField = document.getElementById('schema_version');
  const loggingLevelField = document.getElementById('agent_logging_level');
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

  function populateDownloadSources(sources, selectedId) {
    downloadSourceField.innerHTML = '<option value="">(none)</option>';
    for (const source of sources) {
      const option = document.createElement('option');
      option.value = source.id;
      option.textContent = source.name;
      downloadSourceField.appendChild(option);
    }
    downloadSourceField.value = selectedId || '';
  }

  function populate(payload) {
    const item = payload.item;
    idField.value = item.id;
    nameField.value = item.name;
    descriptionField.value = item.description || '';
    monitoringLogs.checked = item.monitoring_enabled.includes('logs');
    monitoringMetrics.checked = item.monitoring_enabled.includes('metrics');
    inactivityTimeoutField.value = item.inactivity_timeout;
    namespaceField.value = item.namespace || '';
    schemaVersionField.value = item.schema_version || '';
    loggingLevelField.value = (item.advanced_settings && item.advanced_settings.agent_logging_level) || '';
    populateDownloadSources(payload.downloadSources, item.download_source_id);
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

    const name = nameField.value.trim();
    const nameValid = name.length > 0 && !/[\\/:*?"<>|]/.test(name);
    const namespaceValid = namespaceField.value.trim().length > 0;
    const schemaVersionValid = schemaVersionField.value.trim().length > 0;
    const timeout = Number(inactivityTimeoutField.value);
    const timeoutValid = Number.isInteger(timeout) && timeout >= 0;

    setFieldValid('name', nameValid);
    setFieldValid('namespace', namespaceValid);
    setFieldValid('schema_version', schemaVersionValid);
    setFieldValid('inactivity_timeout', timeoutValid);

    if (!nameValid || !namespaceValid || !schemaVersionValid || !timeoutValid) {
      return;
    }

    const monitoring_enabled = [];
    if (monitoringLogs.checked) monitoring_enabled.push('logs');
    if (monitoringMetrics.checked) monitoring_enabled.push('metrics');

    vscode.postMessage({
      type: 'save',
      payload: {
        id: idField.value,
        name,
        description: descriptionField.value,
        monitoring_enabled,
        inactivity_timeout: timeout,
        download_source_id: downloadSourceField.value,
        schema_version: schemaVersionField.value.trim(),
        namespace: namespaceField.value.trim(),
        advanced_settings: {
          agent_logging_level: loggingLevelField.value,
        },
      },
    });
  });

  cancelButton.addEventListener('click', () => {
    vscode.postMessage({ type: 'cancel' });
  });

  vscode.postMessage({ type: 'ready' });
})();
