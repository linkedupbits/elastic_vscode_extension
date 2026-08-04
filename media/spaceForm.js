(function () {
  const vscode = acquireVsCodeApi();

  const form = document.getElementById('form');
  const idField = document.getElementById('id');
  const nameField = document.getElementById('name');
  const descriptionField = document.getElementById('description');
  const colorField = document.getElementById('color');
  const initialsField = document.getElementById('initials');
  const imageUrlField = document.getElementById('imageUrl');
  const disabledFeaturesField = document.getElementById('disabledFeatures');
  const errorBanner = document.getElementById('error-banner');
  const cancelButton = document.getElementById('cancel');

  const VALID_SPACE_ID = /^[a-z0-9_-]+$/;
  const VALID_HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

  function arrayFromTextarea(el) {
    return el.value
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  function arrayToTextarea(el, values) {
    el.value = Array.isArray(values) ? values.join('\n') : '';
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
    idField.value = item.id;
    nameField.value = item.name;
    descriptionField.value = item.description || '';
    colorField.value = item.color || '';
    initialsField.value = item.initials || '';
    imageUrlField.value = item.imageUrl || '';
    arrayToTextarea(disabledFeaturesField, item.disabledFeatures);
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

    const idValue = idField.value.trim();
    const idValid = VALID_SPACE_ID.test(idValue);
    setFieldValid('id', idValid);

    const nameValue = nameField.value.trim();
    const nameValid = nameValue.length > 0;
    setFieldValid('name', nameValid);

    const colorValue = colorField.value.trim();
    const colorValid = colorValue === '' || VALID_HEX_COLOR.test(colorValue);
    setFieldValid('color', colorValid);

    const initialsValue = initialsField.value.trim();
    const initialsValid = initialsValue.length <= 2;
    setFieldValid('initials', initialsValid);

    if (!idValid || !nameValid || !colorValid || !initialsValid) {
      return;
    }

    vscode.postMessage({
      type: 'save',
      payload: {
        id: idValue,
        name: nameValue,
        description: descriptionField.value,
        color: colorValue,
        initials: initialsValue,
        imageUrl: imageUrlField.value,
        disabledFeatures: arrayFromTextarea(disabledFeaturesField),
      },
    });
  });

  cancelButton.addEventListener('click', () => {
    vscode.postMessage({ type: 'cancel' });
  });

  vscode.postMessage({ type: 'ready' });
})();
