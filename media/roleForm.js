(function () {
  const vscode = acquireVsCodeApi();

  const form = document.getElementById('form');
  const nameField = document.getElementById('name');
  const descriptionField = document.getElementById('description');
  const clusterField = document.getElementById('cluster');
  const runAsField = document.getElementById('runAs');
  const indicesContainer = document.getElementById('indices-container');
  const addIndexButton = document.getElementById('add-index-privilege');
  const remoteIndicesContainer = document.getElementById('remote-indices-container');
  const addRemoteIndexButton = document.getElementById('add-remote-index-privilege');
  const applicationsContainer = document.getElementById('applications-container');
  const addApplicationButton = document.getElementById('add-application-privilege');
  const remoteClusterContainer = document.getElementById('remote-cluster-container');
  const addRemoteClusterButton = document.getElementById('add-remote-cluster-privilege');
  const metadataField = document.getElementById('metadata');
  const globalField = document.getElementById('global');
  const errorBanner = document.getElementById('error-banner');
  const cancelButton = document.getElementById('cancel');

  let indexRowSeq = 0;
  let remoteIndexRowSeq = 0;
  let applicationRowSeq = 0;
  let remoteClusterRowSeq = 0;

  function arrayFromTextarea(el) {
    return el.value
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  function arrayToTextarea(el, values) {
    el.value = Array.isArray(values) ? values.join('\n') : '';
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

  // ---------- Index Privileges / Remote Index Privileges ----------
  // Remote Index Privileges are the same shape plus a required "clusters" field, so both are
  // rendered/collected/validated by the same parameterized functions below (prefix namespaces
  // element ids so both kinds of rows can coexist on the same page).

  function indexPrivilegeBodyHtml(prefix, rowId, includeClusters) {
    const clustersHtml = includeClusters
      ? `<div class="field" id="field-${prefix}-clusters-${rowId}">
          <label for="${prefix}-clusters-${rowId}">Clusters</label>
          <textarea id="${prefix}-clusters-${rowId}" rows="2" spellcheck="false"></textarea>
          <span class="hint">One remote cluster name/pattern per line.</span>
          <span class="error">At least one cluster is required.</span>
        </div>`
      : '';
    return `${clustersHtml}
      <div class="field" id="field-${prefix}-names-${rowId}">
        <label for="${prefix}-names-${rowId}">Index Names/Patterns</label>
        <textarea id="${prefix}-names-${rowId}" rows="2" placeholder="logs-myapp-*" spellcheck="false"></textarea>
        <span class="hint">One index name/pattern per line.</span>
        <span class="error">At least one index name/pattern is required.</span>
      </div>
      <div class="field" id="field-${prefix}-privileges-${rowId}">
        <label for="${prefix}-privileges-${rowId}">Privileges</label>
        <textarea id="${prefix}-privileges-${rowId}" rows="2" placeholder="read" spellcheck="false"></textarea>
        <span class="hint">One privilege name per line, e.g. read, write, all.</span>
        <span class="error">At least one privilege is required.</span>
      </div>
      <div class="field">
        <div class="checkbox-row">
          <input type="checkbox" id="${prefix}-allowrestricted-${rowId}" />
          <label for="${prefix}-allowrestricted-${rowId}" style="margin:0">Allow Restricted Indices</label>
        </div>
      </div>
      <div class="field">
        <label for="${prefix}-fsgrant-${rowId}">Field Security: Grant (optional)</label>
        <textarea id="${prefix}-fsgrant-${rowId}" rows="2" spellcheck="false"></textarea>
        <span class="hint">One field name/pattern per line. Leave blank to grant all fields.</span>
      </div>
      <div class="field">
        <label for="${prefix}-fsexcept-${rowId}">Field Security: Except (optional)</label>
        <textarea id="${prefix}-fsexcept-${rowId}" rows="2" spellcheck="false"></textarea>
        <span class="hint">One field name/pattern per line to exclude from the fields granted above.</span>
      </div>
      <div class="field" id="field-${prefix}-query-${rowId}">
        <label for="${prefix}-query-${rowId}">Query (optional, JSON)</label>
        <textarea id="${prefix}-query-${rowId}" rows="3" spellcheck="false"></textarea>
        <span class="hint">Optional Query DSL object restricting which documents this privilege grants access to.</span>
        <span class="error">Query must be valid JSON.</span>
      </div>`;
  }

  function indexPrivilegeRowHtml(prefix, rowId, includeClusters) {
    return `<details class="integration-input ${prefix}-row" open data-row-id="${rowId}">
      <summary class="integration-summary">
        <strong>${includeClusters ? 'Remote Index Privilege' : 'Index Privilege'}</strong>
        <button type="button" class="secondary ${prefix}-remove">Remove</button>
      </summary>
      <div class="input-body">${indexPrivilegeBodyHtml(prefix, rowId, includeClusters)}</div>
    </details>`;
  }

  function populateIndexPrivilegeRow(prefix, rowId, value, includeClusters) {
    if (includeClusters) {
      arrayToTextarea(document.getElementById(`${prefix}-clusters-${rowId}`), value.clusters);
    }
    arrayToTextarea(document.getElementById(`${prefix}-names-${rowId}`), value.names);
    arrayToTextarea(document.getElementById(`${prefix}-privileges-${rowId}`), value.privileges);
    document.getElementById(`${prefix}-allowrestricted-${rowId}`).checked = Boolean(value.allowRestrictedIndices);
    arrayToTextarea(document.getElementById(`${prefix}-fsgrant-${rowId}`), value.fieldSecurityGrant);
    arrayToTextarea(document.getElementById(`${prefix}-fsexcept-${rowId}`), value.fieldSecurityExcept);
    document.getElementById(`${prefix}-query-${rowId}`).value = value.query || '';
  }

  function addIndexPrivilegeRow(container, prefix, nextRowId, value, includeClusters) {
    const rowId = nextRowId();
    container.insertAdjacentHTML('beforeend', indexPrivilegeRowHtml(prefix, rowId, includeClusters));
    populateIndexPrivilegeRow(prefix, rowId, value, includeClusters);
    const row = container.querySelector(`.${prefix}-row[data-row-id="${rowId}"]`);
    row.querySelector(`.${prefix}-remove`).addEventListener('click', (e) => {
      e.stopPropagation();
      row.remove();
    });
  }

  function defaultIndexPrivilegeValue(includeClusters) {
    return {
      clusters: includeClusters ? [] : undefined,
      names: [],
      privileges: [],
      allowRestrictedIndices: false,
      fieldSecurityGrant: [],
      fieldSecurityExcept: [],
      query: '',
    };
  }

  function collectIndexPrivilegeRow(prefix, row, includeClusters) {
    const rowId = row.dataset.rowId;
    return {
      rowId,
      clusters: includeClusters ? arrayFromTextarea(document.getElementById(`${prefix}-clusters-${rowId}`)) : undefined,
      names: arrayFromTextarea(document.getElementById(`${prefix}-names-${rowId}`)),
      privileges: arrayFromTextarea(document.getElementById(`${prefix}-privileges-${rowId}`)),
      allowRestrictedIndices: document.getElementById(`${prefix}-allowrestricted-${rowId}`).checked,
      fieldSecurityGrant: arrayFromTextarea(document.getElementById(`${prefix}-fsgrant-${rowId}`)),
      fieldSecurityExcept: arrayFromTextarea(document.getElementById(`${prefix}-fsexcept-${rowId}`)),
      query: document.getElementById(`${prefix}-query-${rowId}`).value,
    };
  }

  function collectIndexPrivilegeRows(container, prefix, includeClusters) {
    return Array.from(container.querySelectorAll(`.${prefix}-row`)).map((row) =>
      collectIndexPrivilegeRow(prefix, row, includeClusters)
    );
  }

  /** Mirrors the server-side checks in buildIndexPrivilegesJson/buildRemoteIndexPrivilegesJson. */
  function validateIndexPrivilegeRows(rows, prefix, includeClusters) {
    let firstInvalidId = null;
    for (const row of rows) {
      if (includeClusters) {
        const clustersValid = row.clusters.length > 0;
        setFieldValid(`${prefix}-clusters-${row.rowId}`, clustersValid);
        if (!clustersValid && !firstInvalidId) firstInvalidId = `${prefix}-clusters-${row.rowId}`;
      }
      const namesValid = row.names.length > 0;
      setFieldValid(`${prefix}-names-${row.rowId}`, namesValid);
      if (!namesValid && !firstInvalidId) firstInvalidId = `${prefix}-names-${row.rowId}`;

      const privilegesValid = row.privileges.length > 0;
      setFieldValid(`${prefix}-privileges-${row.rowId}`, privilegesValid);
      if (!privilegesValid && !firstInvalidId) firstInvalidId = `${prefix}-privileges-${row.rowId}`;

      const queryValue = (row.query || '').trim();
      const queryValid = queryValue === '' || Boolean(parseJsonObject(queryValue));
      setFieldValid(`${prefix}-query-${row.rowId}`, queryValid);
      if (!queryValid && !firstInvalidId) firstInvalidId = `${prefix}-query-${row.rowId}`;
    }
    return firstInvalidId;
  }

  // ---------- Application Privileges ----------

  function applicationRowHtml(rowId) {
    return `<details class="integration-input application-row" open data-row-id="${rowId}">
      <summary class="integration-summary">
        <input type="text" id="app-application-${rowId}" placeholder="Application" />
        <button type="button" class="secondary application-remove">Remove</button>
      </summary>
      <div class="input-body">
        <div class="field" id="field-app-privileges-${rowId}">
          <label for="app-privileges-${rowId}">Privileges</label>
          <textarea id="app-privileges-${rowId}" rows="2" spellcheck="false"></textarea>
          <span class="hint">One privilege name per line.</span>
          <span class="error">At least one privilege is required.</span>
        </div>
        <div class="field" id="field-app-resources-${rowId}">
          <label for="app-resources-${rowId}">Resources</label>
          <textarea id="app-resources-${rowId}" rows="2" spellcheck="false"></textarea>
          <span class="hint">One resource name/pattern per line, e.g. "*" for all resources.</span>
          <span class="error">At least one resource is required.</span>
        </div>
      </div>
    </details>`;
  }

  function populateApplicationRow(rowId, value) {
    document.getElementById(`app-application-${rowId}`).value = value.application || '';
    arrayToTextarea(document.getElementById(`app-privileges-${rowId}`), value.privileges);
    arrayToTextarea(document.getElementById(`app-resources-${rowId}`), value.resources);
  }

  function addApplicationRow(value) {
    const rowId = applicationRowSeq++;
    applicationsContainer.insertAdjacentHTML('beforeend', applicationRowHtml(rowId));
    populateApplicationRow(rowId, value);
    const row = applicationsContainer.querySelector(`.application-row[data-row-id="${rowId}"]`);
    const applicationField = document.getElementById(`app-application-${rowId}`);
    applicationField.addEventListener('click', (e) => e.stopPropagation());
    row.querySelector('.application-remove').addEventListener('click', (e) => {
      e.stopPropagation();
      row.remove();
    });
  }

  function defaultApplicationValue() {
    return { application: '', privileges: [], resources: [] };
  }

  function collectApplicationRow(row) {
    const rowId = row.dataset.rowId;
    return {
      rowId,
      application: document.getElementById(`app-application-${rowId}`).value,
      privileges: arrayFromTextarea(document.getElementById(`app-privileges-${rowId}`)),
      resources: arrayFromTextarea(document.getElementById(`app-resources-${rowId}`)),
    };
  }

  function collectApplicationRows() {
    return Array.from(applicationsContainer.querySelectorAll('.application-row')).map(collectApplicationRow);
  }

  /** Mirrors the server-side checks in buildApplicationPrivilegesJson. */
  function validateApplicationRows(rows) {
    let firstInvalidId = null;
    for (const row of rows) {
      const applicationField = document.getElementById(`app-application-${row.rowId}`);
      const applicationValid = (row.application || '').trim().length > 0;
      applicationField.classList.toggle('invalid-input', !applicationValid);
      if (!applicationValid && !firstInvalidId) firstInvalidId = `app-application-${row.rowId}`;

      const privilegesValid = row.privileges.length > 0;
      setFieldValid(`app-privileges-${row.rowId}`, privilegesValid);
      if (!privilegesValid && !firstInvalidId) firstInvalidId = `app-privileges-${row.rowId}`;

      const resourcesValid = row.resources.length > 0;
      setFieldValid(`app-resources-${row.rowId}`, resourcesValid);
      if (!resourcesValid && !firstInvalidId) firstInvalidId = `app-resources-${row.rowId}`;
    }
    return firstInvalidId;
  }

  // ---------- Remote Cluster Privileges ----------

  function remoteClusterRowHtml(rowId) {
    return `<details class="integration-input remotecluster-row" open data-row-id="${rowId}">
      <summary class="integration-summary">
        <strong>Remote Cluster Privilege</strong>
        <button type="button" class="secondary remotecluster-remove">Remove</button>
      </summary>
      <div class="input-body">
        <div class="field" id="field-rc-clusters-${rowId}">
          <label for="rc-clusters-${rowId}">Clusters</label>
          <textarea id="rc-clusters-${rowId}" rows="2" spellcheck="false"></textarea>
          <span class="hint">One remote cluster name/pattern per line.</span>
          <span class="error">At least one cluster is required.</span>
        </div>
        <div class="field" id="field-rc-privileges-${rowId}">
          <label for="rc-privileges-${rowId}">Privileges</label>
          <textarea id="rc-privileges-${rowId}" rows="2" placeholder="monitor_enrich" spellcheck="false"></textarea>
          <span class="hint">One cluster privilege name per line, e.g. monitor_enrich.</span>
          <span class="error">At least one privilege is required.</span>
        </div>
      </div>
    </details>`;
  }

  function populateRemoteClusterRow(rowId, value) {
    arrayToTextarea(document.getElementById(`rc-clusters-${rowId}`), value.clusters);
    arrayToTextarea(document.getElementById(`rc-privileges-${rowId}`), value.privileges);
  }

  function addRemoteClusterRow(value) {
    const rowId = remoteClusterRowSeq++;
    remoteClusterContainer.insertAdjacentHTML('beforeend', remoteClusterRowHtml(rowId));
    populateRemoteClusterRow(rowId, value);
    const row = remoteClusterContainer.querySelector(`.remotecluster-row[data-row-id="${rowId}"]`);
    row.querySelector('.remotecluster-remove').addEventListener('click', (e) => {
      e.stopPropagation();
      row.remove();
    });
  }

  function defaultRemoteClusterValue() {
    return { clusters: [], privileges: [] };
  }

  function collectRemoteClusterRow(row) {
    const rowId = row.dataset.rowId;
    return {
      rowId,
      clusters: arrayFromTextarea(document.getElementById(`rc-clusters-${rowId}`)),
      privileges: arrayFromTextarea(document.getElementById(`rc-privileges-${rowId}`)),
    };
  }

  function collectRemoteClusterRows() {
    return Array.from(remoteClusterContainer.querySelectorAll('.remotecluster-row')).map(collectRemoteClusterRow);
  }

  /** Mirrors the server-side checks in buildRemoteClusterPrivilegesJson. */
  function validateRemoteClusterRows(rows) {
    let firstInvalidId = null;
    for (const row of rows) {
      const clustersValid = row.clusters.length > 0;
      setFieldValid(`rc-clusters-${row.rowId}`, clustersValid);
      if (!clustersValid && !firstInvalidId) firstInvalidId = `rc-clusters-${row.rowId}`;

      const privilegesValid = row.privileges.length > 0;
      setFieldValid(`rc-privileges-${row.rowId}`, privilegesValid);
      if (!privilegesValid && !firstInvalidId) firstInvalidId = `rc-privileges-${row.rowId}`;
    }
    return firstInvalidId;
  }

  // ---------- Populate / message handling ----------

  function populate(payload) {
    const item = payload.item;
    nameField.value = item.name;
    descriptionField.value = item.description || '';
    arrayToTextarea(clusterField, item.cluster);
    arrayToTextarea(runAsField, item.runAs);

    indicesContainer.innerHTML = '';
    (item.indices || []).forEach((v) => addIndexPrivilegeRow(indicesContainer, 'idx', () => indexRowSeq++, v, false));

    remoteIndicesContainer.innerHTML = '';
    (item.remoteIndices || []).forEach((v) =>
      addIndexPrivilegeRow(remoteIndicesContainer, 'ridx', () => remoteIndexRowSeq++, v, true)
    );

    applicationsContainer.innerHTML = '';
    (item.applications || []).forEach((v) => addApplicationRow(v));

    remoteClusterContainer.innerHTML = '';
    (item.remoteCluster || []).forEach((v) => addRemoteClusterRow(v));

    metadataField.value = item.metadata || '';
    globalField.value = item.global || '';
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

  addIndexButton.addEventListener('click', () =>
    addIndexPrivilegeRow(indicesContainer, 'idx', () => indexRowSeq++, defaultIndexPrivilegeValue(false), false)
  );
  addRemoteIndexButton.addEventListener('click', () =>
    addIndexPrivilegeRow(remoteIndicesContainer, 'ridx', () => remoteIndexRowSeq++, defaultIndexPrivilegeValue(true), true)
  );
  addApplicationButton.addEventListener('click', () => addApplicationRow(defaultApplicationValue()));
  addRemoteClusterButton.addEventListener('click', () => addRemoteClusterRow(defaultRemoteClusterValue()));

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    clearError();

    const nameValue = nameField.value.trim();
    const nameValid = nameValue.length > 0 && !/[\\/:*?"<>|]/.test(nameValue);
    setFieldValid('name', nameValid);

    const metadataValue = metadataField.value.trim();
    const metadataValid = metadataValue === '' || Boolean(parseJsonObject(metadataValue));
    setFieldValid('metadata', metadataValid);

    const globalValue = globalField.value.trim();
    const globalValid = globalValue === '' || Boolean(parseJsonObject(globalValue));
    setFieldValid('global', globalValid);

    if (!nameValid || !metadataValid || !globalValid) {
      return;
    }

    const indexRows = collectIndexPrivilegeRows(indicesContainer, 'idx', false);
    const remoteIndexRows = collectIndexPrivilegeRows(remoteIndicesContainer, 'ridx', true);
    const applicationRows = collectApplicationRows();
    const remoteClusterRows = collectRemoteClusterRows();

    const firstInvalidId =
      validateIndexPrivilegeRows(indexRows, 'idx', false) ||
      validateIndexPrivilegeRows(remoteIndexRows, 'ridx', true) ||
      validateApplicationRows(applicationRows) ||
      validateRemoteClusterRows(remoteClusterRows);
    if (firstInvalidId) {
      showError('Fill in the required fields highlighted below.');
      document.getElementById(firstInvalidId).scrollIntoView({ block: 'center' });
      return;
    }

    const stripRowId = ({ rowId, ...rest }) => rest;

    vscode.postMessage({
      type: 'save',
      payload: {
        name: nameValue,
        description: descriptionField.value,
        cluster: arrayFromTextarea(clusterField),
        runAs: arrayFromTextarea(runAsField),
        indices: indexRows.map(stripRowId),
        remoteIndices: remoteIndexRows.map(stripRowId),
        applications: applicationRows.map(stripRowId),
        remoteCluster: remoteClusterRows.map(stripRowId),
        metadata: metadataField.value,
        global: globalField.value,
      },
    });
  });

  cancelButton.addEventListener('click', () => {
    vscode.postMessage({ type: 'cancel' });
  });

  vscode.postMessage({ type: 'ready' });
})();
