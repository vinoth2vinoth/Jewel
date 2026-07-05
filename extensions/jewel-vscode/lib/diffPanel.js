const vscode = require('vscode');
const path = require('path');

/** @type {vscode.WebviewPanel | null} */
let panel = null;

/** @type {unknown | null} */
let currentPayload = null;

/** @type {Map<string, string>} */
const diffContentCache = new Map();

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderDiffHtml(payload) {
  if (!payload) {
    return '<!DOCTYPE html><html><body><p>No session diff available.</p></body></html>';
  }

  const files = payload.changedFiles || [];
  const findings = payload.diffAnalysis?.findings || [];

  let body = `
    <h2>${escapeHtml(payload.sessionId)}</h2>
    <div class="meta">
      <div><strong>Task:</strong> ${escapeHtml(payload.task)}</div>
      <div><strong>Status:</strong> <span class="badge">${escapeHtml(payload.status || 'unknown')}</span>
        &nbsp; <strong>Diff guard:</strong> ${escapeHtml(payload.diffAnalysis?.status || 'N/A')}</div>
      <div>+${payload.diffAnalysis?.addedLinesCount || 0} / -${payload.diffAnalysis?.removedLinesCount || 0} lines across ${files.length} file(s)</div>
    </div>
  `;

  if (findings.length > 0) {
    body += '<div class="finding"><strong>Findings:</strong><ul>';
    for (const f of findings) body += `<li>${escapeHtml(f)}</li>`;
    body += '</ul></div>';
  }

  for (const file of files) {
    body += `
      <div class="file">
        <label><input type="checkbox" class="file-check" data-file="${escapeHtml(file.path)}" checked />
        <strong>${escapeHtml(file.path)}</strong> (+${file.added} / -${file.removed})</label>
        <button data-file="${escapeHtml(file.path)}">Open in Diff Editor</button>
      </div>`;
  }

  if (files.length > 0) {
    body += `
      <div class="actions">
        <button id="approve-btn">Approve selected files</button>
        <button id="reject-btn">Reject all</button>
      </div>`;
  }

  if (payload.gitDiff) {
    const colored = payload.gitDiff.split('\n').map(line => {
      if (line.startsWith('+') && !line.startsWith('+++')) return `<span class="add">${escapeHtml(line)}</span>`;
      if (line.startsWith('-') && !line.startsWith('---')) return `<span class="del">${escapeHtml(line)}</span>`;
      return escapeHtml(line);
    }).join('\n');
    body += `<h2>Git diff</h2><div class="diff">${colored}</div>`;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 12px; }
    h2 { margin: 16px 0 8px; font-size: 14px; }
    .meta { opacity: 0.85; font-size: 12px; margin-bottom: 12px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
    .file { margin: 8px 0; padding: 8px; border: 1px solid var(--vscode-panel-border); border-radius: 4px; }
    .file button { margin-top: 6px; cursor: pointer; }
    .diff { font-family: var(--vscode-editor-font-family); font-size: 12px; white-space: pre-wrap; background: var(--vscode-editor-background); padding: 8px; border-radius: 4px; max-height: 400px; overflow: auto; }
    .add { color: var(--vscode-gitDecoration-addedResourceForeground, #73c991); }
    .del { color: var(--vscode-gitDecoration-deletedResourceForeground, #f14c4c); }
    .finding { color: var(--vscode-inputValidation-warningForeground); font-size: 12px; }
    .actions { margin-top: 16px; display: flex; gap: 8px; }
    .actions button { cursor: pointer; }
  </style>
</head>
<body>
  ${body}
  <script>
    const vscode = acquireVsCodeApi();
    document.querySelectorAll('button[data-file]').forEach(btn => {
      btn.addEventListener('click', () => {
        vscode.postMessage({ type: 'openFileDiff', path: btn.getAttribute('data-file') });
      });
    });
    const approveBtn = document.getElementById('approve-btn');
    if (approveBtn) {
      approveBtn.addEventListener('click', () => {
        const selected = Array.from(document.querySelectorAll('.file-check:checked')).map(el => el.getAttribute('data-file'));
        vscode.postMessage({ type: 'submitReview', action: 'approve', approvedFiles: selected });
      });
    }
    const rejectBtn = document.getElementById('reject-btn');
    if (rejectBtn) {
      rejectBtn.addEventListener('click', () => {
        vscode.postMessage({ type: 'submitReview', action: 'reject', approvedFiles: [] });
      });
    }
  </script>
</body>
</html>`;
}

/**
 * @param {vscode.ExtensionContext} context
 */
function registerDiffContentProvider(context) {
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider('jewel-diff', {
      provideTextDocumentContent(uri) {
        return diffContentCache.get(uri.toString()) || '';
      }
    })
  );
}

/**
 * @param {vscode.ExtensionContext} context
 * @param {unknown} payload
 * @param {(msg: {type: string, action?: string, approvedFiles?: string[]}) => Promise<void>} [onReview]
 */
function showDiffPanel(context, payload, onReview) {
  currentPayload = payload;
  const column = vscode.window.activeTextEditor?.viewColumn || vscode.ViewColumn.One;

  if (panel) {
    panel.reveal(column);
    panel.title = payload ? `Jewel: ${payload.sessionId}` : 'Jewel Diff';
    panel.webview.html = renderDiffHtml(payload);
    return panel;
  }

  panel = vscode.window.createWebviewPanel(
    'jewelDiff',
    payload ? `Jewel: ${payload.sessionId}` : 'Jewel Diff',
    column,
    { enableScripts: true, retainContextWhenHidden: true }
  );

  panel.webview.html = renderDiffHtml(payload);

  panel.webview.onDidReceiveMessage(async msg => {
    if (msg.type === 'openFileDiff' && msg.path) {
      await openFileInDiffEditor(msg.path, currentPayload);
    } else if (msg.type === 'submitReview' && onReview) {
      await onReview(msg);
    }
  });

  panel.onDidDispose(() => { panel = null; currentPayload = null; });
  context.subscriptions.push(panel);
  return panel;
}

/**
 * @param {string} relativePath
 * @param {any} payload
 */
async function openFileInDiffEditor(relativePath, payload) {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root || !payload) {
    vscode.window.showWarningMessage('Open a workspace folder to view diffs.');
    return;
  }

  const fileEntry = (payload.changedFiles || []).find(f => f.path === relativePath);
  const absPath = path.join(root, relativePath);
  const rightUri = vscode.Uri.file(absPath);

  const leftContent = fileEntry?.oldContent ?? '';
  const leftUri = vscode.Uri.parse(`jewel-diff:${relativePath}?session=${encodeURIComponent(payload.sessionId)}`);
  diffContentCache.set(leftUri.toString(), leftContent);

  const title = `${relativePath} (checkpoint ↔ working)`;
  await vscode.commands.executeCommand('vscode.diff', leftUri, rightUri, title);
}

module.exports = {
  showDiffPanel,
  openFileInDiffEditor,
  registerDiffContentProvider
};
