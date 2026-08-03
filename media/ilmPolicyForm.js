(function () {
  const vscode = acquireVsCodeApi();

  const form = document.getElementById('form');
  const nameField = document.getElementById('name');
  const phasesField = document.getElementById('phases');
  const metaField = document.getElementById('meta');
  const errorBanner = document.getElementById('error-banner');
  const cancelButton = document.getElementById('cancel');

  const VALID_PHASES = ['hot', 'warm', 'cold', 'frozen', 'delete'];

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
    phasesField.value = JSON.stringify(item.policy.phases, null, 2);
    metaField.value = item.policy._meta ? JSON.stringify(item.policy._meta, null, 2) : '';
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

    const phases = parseJsonObject(phasesField.value);
    const phaseKeys = phases ? Object.keys(phases) : [];
    const phasesValid =
      Boolean(phases) && phaseKeys.length > 0 && phaseKeys.every((key) => VALID_PHASES.includes(key));

    const metaValue = metaField.value.trim();
    const metaValid = metaValue.length === 0 || Boolean(parseJsonObject(metaValue));

    setFieldValid('name', nameValid);
    setFieldValid('phases', phasesValid);
    setFieldValid('meta', metaValid);
    if (!nameValid || !phasesValid || !metaValid) {
      return;
    }

    vscode.postMessage({
      type: 'save',
      payload: {
        name: nameValue,
        phases: phasesField.value,
        meta: metaField.value,
      },
    });
  });

  cancelButton.addEventListener('click', () => {
    vscode.postMessage({ type: 'cancel' });
  });

  vscode.postMessage({ type: 'ready' });
})();
