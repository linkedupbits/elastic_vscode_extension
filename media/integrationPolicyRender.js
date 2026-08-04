/**
 * Structured input/stream/var rendering shared by the editable Integration Policy form
 * (integrationPolicyForm.js) and the read-only live Integration Policy view
 * (liveIntegrationPolicyView.js), so both present the exact same structured layout - only
 * whether the controls accept input differs (via each render call's `readonly` flag).
 */
window.IntegrationPolicyRender = (function () {
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

  function fieldControlHtml(field, id, readonly) {
    const label = field.required ? `${field.label} *` : field.label;
    const errorSpan = readonly ? '' : '<span class="error">This field is required.</span>';
    const ro = readonly ? ' readonly' : '';
    const disabled = readonly ? ' disabled' : '';
    switch (field.type) {
      case 'boolean':
        return `<div class="field" id="field-${id}">
          <div class="checkbox-row"><input type="checkbox" id="${id}"${disabled} /><label for="${id}" style="margin:0">${label}</label></div>
        </div>`;
      case 'number':
        return `<div class="field" id="field-${id}"><label for="${id}">${label}</label><input type="number" id="${id}"${ro} />${errorSpan}</div>`;
      case 'multiline':
        return `<div class="field" id="field-${id}"><label for="${id}">${label}</label><textarea id="${id}"${ro}></textarea>${errorSpan}</div>`;
      case 'stringArray':
        return `<div class="field" id="field-${id}"><label for="${id}">${label}</label><textarea id="${id}"${ro}></textarea><span class="hint">One value per line.</span>${errorSpan}</div>`;
      case 'select': {
        const options = (field.options || [])
          .map((o) => `<option value="${o.value}">${o.label}</option>`)
          .join('');
        return `<div class="field" id="field-${id}"><label for="${id}">${label}</label><select id="${id}"${disabled}>${options}</select>${errorSpan}</div>`;
      }
      case 'string':
      default:
        return `<div class="field" id="field-${id}"><label for="${id}">${label}</label><input type="text" id="${id}"${ro} />${errorSpan}</div>`;
    }
  }

  function streamHtml(input, stream, readonly) {
    const enabledId = streamEnabledId(input, stream);
    const disabled = readonly ? ' disabled' : '';
    const varsHtml = stream.vars.map((f) => fieldControlHtml(f, streamVarId(input, stream, f), readonly)).join('');
    return `<details class="integration-stream" open>
      <summary class="integration-summary"><input type="checkbox" id="${enabledId}"${disabled} /><span>${stream.label}</span></summary>
      <div class="stream-body">${varsHtml}</div>
    </details>`;
  }

  function inputHtml(input, readonly) {
    const enabledId = inputEnabledId(input);
    const disabled = readonly ? ' disabled' : '';
    const varsHtml = (input.vars || []).map((f) => fieldControlHtml(f, inputVarId(input, f), readonly)).join('');
    const streamsHtml = input.streams.map((s) => streamHtml(input, s, readonly)).join('');
    return `<details class="integration-input" open>
      <summary class="integration-summary"><input type="checkbox" id="${enabledId}"${disabled} /><strong>${input.label}</strong></summary>
      <div class="input-body">${varsHtml}${streamsHtml}</div>
    </details>`;
  }

  /** Renders `template.inputs` into `container`; pass `readonly: true` to disable every control (the live/view mode). */
  function renderTemplate(container, template, readonly) {
    container.innerHTML = template.inputs.map((input) => inputHtml(input, readonly)).join('');
    // Prevent a click on a checkbox from also toggling the enclosing <details>.
    container.querySelectorAll('input[type="checkbox"]').forEach((el) => {
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

  /** Sets every rendered control's value/checked state from `item.inputs` (falling back to each field's template default). */
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

  /** Reads every rendered control back into an `inputs` object shaped like `IntegrationPolicy.inputs`. */
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

  return {
    inputVarId,
    streamVarId,
    renderTemplate,
    populateValues,
    collectInputs,
  };
})();
