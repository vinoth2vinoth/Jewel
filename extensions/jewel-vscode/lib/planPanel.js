const vscode = require('vscode');

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderPlanHtml(payload) {
  if (!payload || !payload.contract) {
    return '<!DOCTYPE html><html><body><p>No plan available.</p></body></html>';
  }
  const c = payload.contract;
  const files = payload.files || c.filesLikelyNeeded || [];
  let body = `
    <h2>Plan Preview</h2>
    <div class="meta"><strong>Task:</strong> ${escapeHtml(c.task)}</div>
    <div class="meta"><strong>Risk:</strong> ${escapeHtml(c.riskLevel)}</div>
    <div class="meta"><strong>Understanding:</strong> ${escapeHtml(c.understanding || '')}</div>
    <h3>Files in scope</h3><ul>${files.map(f => `<li>${escapeHtml(f)}</li>`).join('')}</ul>
    <h3>Success criteria</h3><ul>${(c.successCriteria || []).map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ul>
    <div class="actions">
      <button id="run-btn">Run task in terminal (--yes)</button>
    </div>
  `;
  return `<!DOCTYPE html><html><head><style>
    body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 12px; font-size: 13px; }
    .meta { margin: 6px 0; }
    .actions { margin-top: 16px; }
  </style></head><body>${body}
  <script>
    const vscode = acquireVsCodeApi();
    document.getElementById('run-btn')?.addEventListener('click', () => {
      vscode.postMessage({ type: 'runTask' });
    });
  </script></body></html>`;
}

/**
 * @param {vscode.ExtensionContext} context
 * @param {unknown} payload
 * @param {() => void} onRunTask
 */
function showPlanPanel(context, payload, onRunTask) {
  const panel = vscode.window.createWebviewPanel(
    'jewelPlan',
    'Jewel Plan Preview',
    vscode.ViewColumn.Beside,
    { enableScripts: true }
  );
  panel.webview.html = renderPlanHtml(payload);
  panel.webview.onDidReceiveMessage(msg => {
    if (msg.type === 'runTask') onRunTask();
  });
  context.subscriptions.push(panel);
  return panel;
}

module.exports = { showPlanPanel, renderPlanHtml };
