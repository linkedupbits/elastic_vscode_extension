(function () {
  const vscode = acquireVsCodeApi();

  const form = document.getElementById('form');
  const nameField = document.getElementById('name');
  const namespaceField = document.getElementById('namespace');
  const descriptionField = document.getElementById('description');
  const packageDisplay = document.getElementById('package-display');
  const agentPolicyDisplay = document.getElementById('agent-policy-display');
  const subtitle = document.getElementById('subtitle');
  const inputsContainer = document.getElementById('inputs-container');
  const errorBanner = document.getElementById('error-banner');
  const cancelButton = document.getElementById('cancel');

  let currentTemplate = null;
  let currentOutputId = null;

  function slug(value) {
    return String(value).replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  function inputEnabledId(input) {
    return `inp_enabled__${slug(input.id)}`;
  }
  function inputVarId(input, field) {
    return `inp_var__${slug(input.id)}__${slug(field.key)}`;
  }
  function streamEnabledId(input, stream) {
    return `str_enabled__${slug(input.id)}__${slug(stream.id)}`;
  }
  function streamVarId(input, stream, field) {
    return `str_var__${slug(input.id)}__${slug(stream.id)}__${slug(field.key)}`;
  }

  function fieldControlHtml(field, id) {
    const label = field.required ? `${field.label} *` : field.label;
    const errorSpan = '<span class="error">This field is required.</span>';
    switch (field.type) {
      case 'boolean':
        return `<div class="field" id="field-${id}">
          <div class="checkbox-row"><input type="checkbox" id="${id}" /><label for="${id}" style="margin:0">${label}</label></div>
        </div>`;
      case 'number':
        return `<div class="field" id="field-${id}"><label for="${id}">${label}</label><input type="number" id="${id}" />${errorSpan}</div>`;
      case 'multiline':
        return `<div class="field" id="field-${id}"><label for="${id}">${label}</label><textarea id="${id}"></textarea>${errorSpan}</div>`;
      case 'stringArray':
        return `<div class="field" id="field-${id}"><label for="${id}">${label}</label><textarea id="${id}"></textarea><span class="hint">One value per line.</span>${errorSpan}</div>`;
      case 'string':
      default:
        return `<div class="field" id="field-${id}"><label for="${id}">${label}</label><input type="text" id="${id}" />${errorSpan}</div>`;
    }
  }

  function streamHtml(input, stream) {
    const enabledId = streamEnabledId(input, stream);
    const varsHtml = stream.vars.map((f) => fieldControlHtml(f, streamVarId(input, stream, f))).join('');
    return `<details class="integration-stream" open>
      <summary class="integration-summary"><input type="checkbox" id="${enabledId}" /><span>${stream.label}</span></summary>
      <div class="stream-body">${varsHtml}</div>
    </details>`;
  }

  function inputHtml(input) {
    const enabledId = inputEnabledId(input);
    const varsHtml = (input.vars || []).map((f) => fieldControlHtml(f, inputVarId(input, f))).join('');
    const streamsHtml = input.streams.map((s) => streamHtml(input, s)).join('');
    return `<details class="integration-input" open>
      <summary class="integration-summary"><input type="checkbox" id="${enabledId}" /><strong>${input.label}</strong></summary>
      <div class="input-body">${varsHtml}${streamsHtml}</div>
    </details>`;
  }

  function renderTemplate(template) {
    inputsContainer.innerHTML = template.inputs.map(inputHtml).join('');
    // Prevent a click on a checkbox from also toggling the enclosing <details>.
    inputsContainer.querySelectorAll('input[type="checkbox"]').forEach((el) => {
      el.addEventListener('click', (e) => e.stopPropagation());
    });
  }

  function setControlValue(id, type, value) {
    const el = document.getElementById(id);
    if (!el) return;
    switch (type) {
      case 'boolean':
        el.checked = Boolean(value);
        break;
      case 'stringArray':
        el.value = Array.isArray(value) ? value.join('\n') : '';
        break;
      default:
        el.value = value === undefined || value === null ? '' : String(value);
    }
  }

  function getControlValue(id, type) {
    const el = document.getElementById(id);
    if (!el) return undefined;
    switch (type) {
      case 'boolean':
        return el.checked;
      case 'number': {
        const n = Number(el.value);
        return Number.isFinite(n) ? n : 0;
      }
      case 'stringArray':
        return el.value
          .split('\n')
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
      default:
        return el.value;
    }
  }

  function populateValues(template, item) {
    for (const input of template.inputs) {
      const inputData = item.inputs[input.id];
      document.getElementById(inputEnabledId(input)).checked = Boolean(inputData && inputData.enabled);
      for (const field of input.vars || []) {
        setControlValue(inputVarId(input, field), field.type, inputData && inputData.vars ? inputData.vars[field.key] : field.default);
      }
      for (const stream of input.streams) {
        const streamData = inputData && inputData.streams ? inputData.streams[stream.id] : undefined;
        document.getElementById(streamEnabledId(input, stream)).checked = Boolean(streamData && streamData.enabled);
        for (const field of stream.vars) {
          setControlValue(
            streamVarId(input, stream, field),
            field.type,
            streamData && streamData.vars ? streamData.vars[field.key] : field.default
          );
        }
      }
    }
  }

  function collectInputs(template) {
    const inputs = {};
    for (const input of template.inputs) {
      const vars = {};
      for (const field of input.vars || []) {
        vars[field.key] = getControlValue(inputVarId(input, field), field.type);
      }
      const streams = {};
      for (const stream of input.streams) {
        const streamVars = {};
        for (const field of stream.vars) {
          streamVars[field.key] = getControlValue(streamVarId(input, stream, field), field.type);
        }
        streams[stream.id] = {
          enabled: document.getElementById(streamEnabledId(input, stream)).checked,
          vars: streamVars,
        };
      }
      inputs[input.id] = {
        enabled: document.getElementById(inputEnabledId(input)).checked,
        vars,
        streams,
      };
    }
    return inputs;
  }

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
        const id = inputVarId(input, field);
        const invalid = Boolean(field.required && inputVal.enabled && isEmptyValue(inputVal.vars[field.key]));
        setFieldValid(id, !invalid);
        if (invalid && !firstInvalidId) firstInvalidId = id;
      }
      for (const stream of input.streams) {
        const streamVal = inputVal.streams[stream.id];
        for (const field of stream.vars) {
          const id = streamVarId(input, stream, field);
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
    currentTemplate = payload.template;
    currentOutputId = payload.item.output_id ?? null;

    subtitle.textContent = `Defines the inputs for a ${payload.template.title} integration attached to this agent policy.`;
    packageDisplay.value = `${payload.template.title} (v${payload.template.version})`;
    agentPolicyDisplay.value = payload.agentPolicy.name;
    nameField.value = payload.item.name;
    namespaceField.value = payload.item.namespace || '';
    descriptionField.value = payload.item.description || '';

    renderTemplate(payload.template);
    populateValues(payload.template, payload.item);
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
    if (!nameValid || !currentTemplate) {
      return;
    }

    const inputs = collectInputs(currentTemplate);
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
  });

  cancelButton.addEventListener('click', () => {
    vscode.postMessage({ type: 'cancel' });
  });

  vscode.postMessage({ type: 'ready' });
})();
