(function () {
  const vscode = acquireVsCodeApi();

  const form = document.getElementById('form');
  const idField = document.getElementById('id');
  const nameField = document.getElementById('name');
  const hostField = document.getElementById('host');
  const proxyField = document.getElementById('proxy_id');
  const defaultField = document.getElementById('is_default');
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

  function populateProxies(proxies, selectedId) {
    proxyField.innerHTML = '<option value="">(none)</option>';
    for (const proxy of proxies) {
      const option = document.createElement('option');
      option.value = proxy.id;
      option.textContent = proxy.name;
      proxyField.appendChild(option);
    }
    proxyField.value = selectedId || '';
  }

  function populate(payload) {
    const item = payload.item;
    idField.value = item.id;
    nameField.value = item.name;
    hostField.value = item.host;
    defaultField.checked = Boolean(item.is_default);
    populateProxies(payload.proxies, item.proxy_id);
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

    const nameValid = nameField.value.trim().length > 0;
    const hostValid = isValidUrl(hostField.value.trim());
    setFieldValid('name', nameValid);
    setFieldValid('host', hostValid);
    if (!nameValid || !hostValid) {
      return;
    }

    vscode.postMessage({
      type: 'save',
      payload: {
        id: idField.value,
        name: nameField.value.trim(),
        host: hostField.value.trim(),
        is_default: defaultField.checked,
        proxy_id: proxyField.value,
      },
    });
  });

  cancelButton.addEventListener('click', () => {
    vscode.postMessage({ type: 'cancel' });
  });

  vscode.postMessage({ type: 'ready' });
})();
