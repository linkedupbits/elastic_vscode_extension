(function () {
  const vscode = acquireVsCodeApi();

  const rawContent = document.getElementById('raw-content');
  const errorBanner = document.getElementById('error-banner');
  const closeButton = document.getElementById('cancel');
  const openInEditorButton = document.getElementById('open-in-editor');

  function showError(message) {
    errorBanner.textContent = message;
    errorBanner.classList.add('show');
  }

  window.addEventListener('message', (event) => {
    const message = event.data;
    if (message.type === 'init') {
      rawContent.textContent = message.payload.raw;
      showError(message.payload.error);
    }
  });

  closeButton.addEventListener('click', () => {
    vscode.postMessage({ type: 'cancel' });
  });

  openInEditorButton.addEventListener('click', () => {
    vscode.postMessage({ type: 'openInEditor' });
  });

  vscode.postMessage({ type: 'ready' });
})();
