(function () {
  const vscode = acquireVsCodeApi();
  const render = window.IntegrationPolicyRender;

  const form = document.getElementById('form');
  const nameField = document.getElementById('name');
  const namespaceField = document.getElementById('namespace');
  const descriptionField = document.getElementById('description');
  const packageDisplay = document.getElementById('package-display');
  const agentPolicyDisplay = document.getElementById('agent-policy-display');
  const subtitle = document.getElementById('subtitle');
  const inputsContainer = document.getElementById('inputs-container');
  const errorBanner = document.getElementById('error-banner');
  const fallbackBanner = document.getElementById('fallback-banner');
  const jsonFallbackFieldWrapper = document.getElementById('field-json-fallback');
  const jsonFallbackField = document.getElementById('json-fallback');
  const cancelButton = document.getElementById('cancel');

  let currentTemplate = null;
  let currentOutputId = null;
  let currentVars = {};

  function isEmptyValue(value) {
    if (value === undefined || value === null) return true;
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'string') return value.trim().length === 0;
    return false;
  }

  /** Mirrors the server-side check: only enabled inputs/streams enforce their required vars. */
  function validateRequired(template, inputs) {
    let firstInvalidId = null;
    for (const input of template.inputs) {
      const inputVal = inputs[input.id];
      for (const field of input.vars || []) {
        const id = render.inputVarId(input, field);
        const invalid = Boolean(field.required && inputVal.enabled && isEmptyValue(inputVal.vars[field.key]));
        setFieldValid(id, !invalid);
        if (invalid && !firstInvalidId) firstInvalidId = id;
      }
      for (const stream of input.streams) {
        const streamVal = inputVal.streams[stream.id];
        for (const field of stream.vars) {
          const id = render.streamVarId(input, stream, field);
          const invalid = Boolean(
            field.required && inputVal.enabled && streamVal.enabled && isEmptyValue(streamVal.vars[field.key])
          );
          setFieldValid(id, !invalid);
          if (invalid && !firstInvalidId) firstInvalidId = id;
        }
      }
    }
    return firstInvalidId;
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

  function populate(payload) {
    currentTemplate = payload.template || null;
    currentOutputId = payload.item.output_id ?? null;
    currentVars = payload.item.vars ?? {};

    agentPolicyDisplay.value = payload.agentPolicy.name;
    nameField.value = payload.item.name;
    namespaceField.value = payload.item.namespace || '';
    descriptionField.value = payload.item.description || '';

    if (currentTemplate) {
      fallbackBanner.classList.remove('show');
      fallbackBanner.textContent = '';
      jsonFallbackFieldWrapper.style.display = 'none';
      inputsContainer.style.display = '';

      subtitle.textContent = `Defines the inputs for a ${payload.template.title} integration attached to this agent policy.`;
      packageDisplay.value = `${payload.template.title} (v${payload.template.version})`;

      render.renderTemplate(inputsContainer, payload.template, false);
      render.populateValues(payload.template, payload.item);
    } else {
      const pkg = payload.item.package || {};
      subtitle.textContent = 'Structured editing is not available for this integration; edit the inputs as raw JSON below.';
      packageDisplay.value = `${pkg.title || pkg.name || 'Unknown'} (v${pkg.version || 'unknown'})`;
      fallbackBanner.textContent = `No structured editor is implemented for "${pkg.title || pkg.name || 'this integration'}" version ${pkg.version || 'unknown'}. Showing a plain JSON editor for its inputs instead.`;
      fallbackBanner.classList.add('show');
      inputsContainer.style.display = 'none';
      inputsContainer.innerHTML = '';
      jsonFallbackFieldWrapper.style.display = '';
      jsonFallbackField.value = JSON.stringify(payload.item.inputs ?? {}, null, 2);
    }
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
    setFieldValid('name', nameValid);
    if (!nameValid) {
      return;
    }

    if (currentTemplate) {
      const inputs = render.collectInputs(currentTemplate);
      const firstInvalidId = validateRequired(currentTemplate, inputs);
      if (firstInvalidId) {
        showError('Fill in the required fields highlighted below.');
        document.getElementById(firstInvalidId).scrollIntoView({ block: 'center' });
        return;
      }

      vscode.postMessage({
        type: 'save',
        payload: {
          name,
          namespace: namespaceField.value.trim(),
          description: descriptionField.value,
          inputs,
          output_id: currentOutputId,
          vars: {},
        },
      });
      return;
    }

    let inputs;
    try {
      inputs = jsonFallbackField.value.trim() ? JSON.parse(jsonFallbackField.value) : {};
    } catch (e) {
      showError('Inputs JSON is not valid: ' + e.message);
      jsonFallbackField.focus();
      return;
    }

    vscode.postMessage({
      type: 'save',
      payload: {
        name,
        namespace: namespaceField.value.trim(),
        description: descriptionField.value,
        inputs,
        output_id: currentOutputId,
        vars: currentVars,
      },
    });
  });

  cancelButton.addEventListener('click', () => {
    vscode.postMessage({ type: 'cancel' });
  });

  vscode.postMessage({ type: 'ready' });
})();
