(function () {
  const vscode = acquireVsCodeApi();

  const form = document.getElementById('form');
  const nameField = document.getElementById('name');
  const metaField = document.getElementById('meta');
  const phasesContainer = document.getElementById('phases-container');
  const errorBanner = document.getElementById('error-banner');
  const cancelButton = document.getElementById('cancel');

  let currentTemplate = null;

  function slug(value) {
    return String(value).replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  function phaseEnabledId(phase) {
    return `phase_enabled__${slug(phase.id)}`;
  }
  function phaseMinAgeId(phase) {
    return `phase_minage__${slug(phase.id)}`;
  }
  function actionEnabledId(phase, action) {
    return `action_enabled__${slug(phase.id)}__${slug(action.id)}`;
  }
  function actionFieldId(phase, action, field) {
    return `action_field__${slug(phase.id)}__${slug(action.id)}__${slug(field.key)}`;
  }

  function fieldControlHtml(field, id) {
    const hintSpan = field.hint ? `<span class="hint">${field.hint}</span>` : '';
    switch (field.type) {
      case 'boolean':
        return `<div class="field" id="field-${id}">
          <div class="checkbox-row"><input type="checkbox" id="${id}" /><label for="${id}" style="margin:0">${field.label}</label></div>
        </div>`;
      case 'number':
        return `<div class="field" id="field-${id}"><label for="${id}">${field.label}</label><input type="number" id="${id}" />${hintSpan}</div>`;
      case 'string':
      default:
        return `<div class="field" id="field-${id}"><label for="${id}">${field.label}</label><input type="text" id="${id}" />${hintSpan}</div>`;
    }
  }

  function actionHtml(phase, action) {
    const enabledId = actionEnabledId(phase, action);
    const fieldsHtml = action.fields.map((f) => fieldControlHtml(f, actionFieldId(phase, action, f))).join('');
    return `<details class="integration-stream" open>
      <summary class="integration-summary"><input type="checkbox" id="${enabledId}" /><span>${action.label}</span></summary>
      <div class="stream-body">${fieldsHtml || '<p class="hint">No additional settings.</p>'}</div>
    </details>`;
  }

  function phaseHtml(phase) {
    const enabledId = phaseEnabledId(phase);
    const minAgeId = phaseMinAgeId(phase);
    const actionsHtml = phase.actions.map((a) => actionHtml(phase, a)).join('');
    return `<details class="integration-input" open>
      <summary class="integration-summary"><input type="checkbox" id="${enabledId}" /><strong>${phase.label}</strong></summary>
      <div class="input-body">
        <div class="field" id="field-${minAgeId}">
          <label for="${minAgeId}">Minimum Age</label>
          <input type="text" id="${minAgeId}" />
          <span class="hint">How long after rollover before this phase starts, e.g. ${phase.defaultMinAge}.</span>
        </div>
        ${actionsHtml}
      </div>
    </details>`;
  }

  function renderTemplate(template) {
    phasesContainer.innerHTML = template.map(phaseHtml).join('');
    // Prevent a click on a checkbox from also toggling the enclosing <details>.
    phasesContainer.querySelectorAll('input[type="checkbox"]').forEach((el) => {
      el.addEventListener('click', (e) => e.stopPropagation());
    });
  }

  function setControlValue(id, type, value) {
    const el = document.getElementById(id);
    if (!el) return;
    if (type === 'boolean') {
      el.checked = Boolean(value);
    } else {
      el.value = value === undefined || value === null ? '' : String(value);
    }
  }

  function getControlValue(id, type) {
    const el = document.getElementById(id);
    if (!el) return undefined;
    if (type === 'boolean') return el.checked;
    if (type === 'number') {
      const n = Number(el.value);
      return Number.isFinite(n) ? n : 0;
    }
    return el.value;
  }

  function populatePhases(template, phasesForm) {
    for (const phase of template) {
      const phaseValue = phasesForm[phase.id];
      document.getElementById(phaseEnabledId(phase)).checked = Boolean(phaseValue && phaseValue.enabled);
      document.getElementById(phaseMinAgeId(phase)).value = (phaseValue && phaseValue.min_age) || phase.defaultMinAge;
      for (const action of phase.actions) {
        const actionValue = phaseValue && phaseValue.actions ? phaseValue.actions[action.id] : undefined;
        document.getElementById(actionEnabledId(phase, action)).checked = Boolean(actionValue && actionValue.enabled);
        for (const field of action.fields) {
          setControlValue(
            actionFieldId(phase, action, field),
            field.type,
            actionValue && actionValue.fields ? actionValue.fields[field.key] : field.default
          );
        }
      }
    }
  }

  function collectPhases(template) {
    const result = {};
    for (const phase of template) {
      const actions = {};
      for (const action of phase.actions) {
        const fields = {};
        for (const field of action.fields) {
          fields[field.key] = getControlValue(actionFieldId(phase, action, field), field.type);
        }
        actions[action.id] = {
          enabled: document.getElementById(actionEnabledId(phase, action)).checked,
          fields,
        };
      }
      result[phase.id] = {
        enabled: document.getElementById(phaseEnabledId(phase)).checked,
        min_age: document.getElementById(phaseMinAgeId(phase)).value.trim(),
        actions,
      };
    }
    return result;
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
    nameField.value = payload.item.name;
    metaField.value = payload.item.meta || '';
    renderTemplate(payload.template);
    populatePhases(payload.template, payload.item.phases);
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

    const nameValue = nameField.value.trim();
    const nameValid = nameValue.length > 0 && !/[\\/:*?"<>|]/.test(nameValue);
    setFieldValid('name', nameValid);

    const metaValue = metaField.value.trim();
    const metaValid = metaValue.length === 0 || Boolean(parseJsonObject(metaValue));
    setFieldValid('meta', metaValid);

    if (!nameValid || !metaValid || !currentTemplate) {
      return;
    }

    const phases = collectPhases(currentTemplate);
    const anyPhaseEnabled = currentTemplate.some((p) => phases[p.id].enabled);
    if (!anyPhaseEnabled) {
      showError('Enable at least one phase (hot, warm, cold, frozen, delete).');
      return;
    }

    vscode.postMessage({
      type: 'save',
      payload: {
        name: nameValue,
        phases,
        meta: metaField.value,
      },
    });
  });

  cancelButton.addEventListener('click', () => {
    vscode.postMessage({ type: 'cancel' });
  });

  vscode.postMessage({ type: 'ready' });
})();
