(function () {
  const vscode = acquireVsCodeApi();

  const form = document.getElementById('form');
  const nameField = document.getElementById('name');
  const cloudIdField = document.getElementById('cloudId');
  const apiKeyField = document.getElementById('apiKey');
  const apiKeyHint = document.getElementById('apiKey-hint');
  const errorBanner = document.getElementById('error-banner');
  const cancelButton = document.getElementById('cancel');

  let isNew = true;

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
    nameField.value = item.name;
    cloudIdField.value = item.cloudId;
    apiKeyHint.textContent = isNew
      ? 'Found on the deployment’s API Keys page in Kibana.'
      : 'Leave blank to keep the currently stored API key.';
  }

  window.addEventListener('message', (event) => {
    const message = event.data;
    switch (message.type) {
      case 'init':
        isNew = message.payload.isNew;
        populate(message.payload.item);
        break;
      case 'saved':
        clearError();
        apiKeyField.value = '';
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
    const nameValid = nameValue.length > 0;
    setFieldValid('name', nameValid);

    const cloudIdValue = cloudIdField.value.trim();
    const cloudIdValid = cloudIdValue.length > 0;
    setFieldValid('cloudId', cloudIdValid);

    const apiKeyValue = apiKeyField.value.trim();
    const apiKeyValid = !isNew || apiKeyValue.length > 0;
    setFieldValid('apiKey', apiKeyValid);

    if (!nameValid || !cloudIdValid || !apiKeyValid) {
      return;
    }

    vscode.postMessage({
      type: 'save',
      payload: {
        name: nameValue,
        cloudId: cloudIdValue,
        apiKey: apiKeyValue,
      },
    });
  });

  cancelButton.addEventListener('click', () => {
    vscode.postMessage({ type: 'cancel' });
  });

  vscode.postMessage({ type: 'ready' });
})();
