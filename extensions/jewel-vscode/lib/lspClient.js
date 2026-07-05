const vscode = require('vscode');
const path = require('path');
const {
  LanguageClient,
  TransportKind,
  State
} = require('vscode-languageclient/node');

/** @type {LanguageClient | null} */
let client = null;

function getServerOptions() {
  const config = vscode.workspace.getConfiguration('jewel');
  const cliPath = config.get('cliPath', 'jewel');
  const extraArgs = config.get('cliArgs', []);
  const useSub = config.get('useLspSubcommand', true);

  const runArgs = useSub ? [...extraArgs, 'lsp'] : ['lsp', ...extraArgs];
  const debugArgs = useSub ? [...extraArgs, 'lsp'] : ['lsp', ...extraArgs];

  return {
    run: {
      command: cliPath,
      args: runArgs,
      transport: TransportKind.stdio,
      options: { cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath }
    },
    debug: {
      command: cliPath,
      args: debugArgs,
      transport: TransportKind.stdio,
      options: { cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath }
    }
  };
}

/**
 * @param {vscode.ExtensionContext} context
 * @param {{ onSessionsChanged?: (sessions: unknown[]) => void, onSessionDiff?: (payload: unknown) => void, onVerificationStatus?: (status: unknown) => void }} hooks
 */
function startLanguageClient(context, hooks = {}) {
  if (client) return client;

  client = new LanguageClient(
    'jewel',
    'Jewel Language Server',
    getServerOptions(),
    {
      documentSelector: [{ scheme: 'file' }],
      synchronize: {
        fileEvents: [
          vscode.workspace.createFileSystemWatcher('**/.jewel/reports/**'),
          vscode.workspace.createFileSystemWatcher('**/.jewel/sessions/**')
        ]
      },
      middleware: {}
    }
  );

  client.onDidChangeState(e => {
    if (e.newState === State.Running) {
      refreshSessions();
    }
  });

  client.onNotification('jewel/sessionsChanged', sessions => {
    if (hooks.onSessionsChanged) hooks.onSessionsChanged(sessions);
  });

  client.onNotification('jewel/sessionDiff', payload => {
    if (hooks.onSessionDiff) hooks.onSessionDiff(payload);
  });

  client.onNotification('jewel/verificationStatus', status => {
    if (hooks.onVerificationStatus) hooks.onVerificationStatus(status);
  });

  client.start();
  context.subscriptions.push({ dispose: () => client?.stop() });
  return client;
}

async function refreshSessions() {
  if (!client) return [];
  try {
    return await client.sendRequest('jewel/listSessions', { limit: 30 });
  } catch {
    return [];
  }
}

async function getSessionDiff(sessionId) {
  if (!client) return null;
  return client.sendRequest('jewel/getSessionDiff', { sessionId });
}

async function runVerifyLsp() {
  if (!client) return null;
  return client.sendRequest('jewel/runVerify', {});
}

async function executeJewelCommand(command) {
  if (!client) return null;
  return client.sendRequest('workspace/executeCommand', { command, arguments: [] });
}

async function previewPlan(task, files = []) {
  if (!client) return null;
  return client.sendRequest('jewel/previewPlan', { task, files });
}

async function submitReview(sessionId, action, approvedFiles = []) {
  if (!client) return null;
  return client.sendRequest('jewel/submitReview', { sessionId, action, approvedFiles });
}

function getClient() {
  return client;
}

module.exports = {
  startLanguageClient,
  refreshSessions,
  getSessionDiff,
  runVerifyLsp,
  executeJewelCommand,
  previewPlan,
  submitReview,
  getClient
};
