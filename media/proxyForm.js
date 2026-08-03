(function () {
  const vscode = acquireVsCodeApi();

  const form = document.getElementById('form');
  const idField = document.getElementById('id');
  const nameField = document.getElementById('name');
  const urlField = document.getElementById('url');
  const caField = document.getElementById('certificate_authorities');
  const certField = document.getElementById('certificates');
  const keyField = document.getElementById('certificate_key');
  const preconfiguredField = document.getElementById('is_preconfigured');
  const errorBanner = document.getElementById('error-banner');
  const cancelButton = document.getElementById('cancel');

  function isValidUrl(value) {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }

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

  function populate(item) {
    idField.value = item.id;
    nameField.value = item.name;
    urlField.value = item.url;
    caField.value = item.certificate_authorities;
    certField.value = item.certificates;
    keyField.value = item.certificate_key;
    preconfiguredField.checked = Boolean(item.is_preconfigured);
  }

  window.addEventListener('message', (event) => {
    const message = event.data;
    switch (message.type) {
      case 'init':
        populate(message.payload.item);
        break;
      case 'saved':
        clearError();
        vscode.setState({ item: message.payload });
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
    const urlValid = isValidUrl(urlField.value.trim());
    setFieldValid('name', nameValid);
    setFieldValid('url', urlValid);
    if (!nameValid || !urlValid) {
      return;
    }

    vscode.postMessage({
      type: 'save',
      payload: {
        id: idField.value,
        name: nameField.value.trim(),
        url: urlField.value.trim(),
        certificate_authorities: caField.value,
        certificates: certField.value,
        certificate_key: keyField.value,
        is_preconfigured: preconfiguredField.checked,
      },
    });
  });

  cancelButton.addEventListener('click', () => {
    vscode.postMessage({ type: 'cancel' });
  });

  vscode.postMessage({ type: 'ready' });
})();
