(function () {
  const render = window.IntegrationPolicyRender;
  const payload = window.__liveIntegrationPolicy;
  const policy = payload.policy;
  const template = payload.template;

  const packageDisplay = document.getElementById('package-display');
  const namespaceDisplay = document.getElementById('namespace-display');
  const descriptionDisplay = document.getElementById('description-display');
  const agentPolicyDisplay = document.getElementById('agent-policy-display');
  const fallbackBanner = document.getElementById('fallback-banner');
  const inputsContainer = document.getElementById('inputs-container');
  const jsonFallbackFieldWrapper = document.getElementById('field-json-fallback');
  const jsonFallbackField = document.getElementById('json-fallback');

  const pkg = policy.package || {};
  packageDisplay.value = `${pkg.title || pkg.name || 'Unknown'} (v${pkg.version || 'unknown'})`;
  namespaceDisplay.value = policy.namespace || '';
  descriptionDisplay.value = policy.description || '';
  agentPolicyDisplay.value = payload.agentPolicyName || policy.policy_id || '';

  if (template) {
    render.renderTemplate(inputsContainer, template, true);
    render.populateValues(template, policy);
  } else {
    fallbackBanner.textContent = `No structured editor is implemented for "${pkg.title || pkg.name || 'this integration'}" version ${pkg.version || 'unknown'}. Showing a plain JSON view of its inputs instead.`;
    fallbackBanner.classList.add('show');
    inputsContainer.style.display = 'none';
    jsonFallbackFieldWrapper.style.display = '';
    jsonFallbackField.value = JSON.stringify(policy.inputs || {}, null, 2);
  }
})();
