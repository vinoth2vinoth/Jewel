const vscode = require('vscode');
const {
  startLanguageClient,
  refreshSessions,
  getSessionDiff,
  runVerifyLsp,
  executeJewelCommand,
  previewPlan,
  submitReview
} = require('./lib/lspClient');
const { SessionTreeProvider } = require('./lib/sessionTree');
const { showDiffPanel, registerDiffContentProvider } = require('./lib/diffPanel');
const { showPlanPanel } = require('./lib/planPanel');

/** @type {SessionTreeProvider | null} */
let sessionTree = null;

/** @type {vscode.StatusBarItem | null} */
let statusBar = null;

function getWorkspaceRoot() {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function runJewelTerminal(args) {
  const cwd = getWorkspaceRoot();
  const terminal = vscode.window.createTerminal({ name: 'Jewel', cwd });
  terminal.show();
  terminal.sendText(`jewel ${args}`, true);
}

/**
 * @param {vscode.ExtensionContext} context
 * @param {string | undefined} sessionId
 */
async function openSessionDiff(context, sessionId) {
  const payload = await getSessionDiff(sessionId);
  if (!payload) {
    vscode.window.showWarningMessage('No diff found for that session.');
    return;
  }
  showDiffPanel(context, payload, async msg => {
    const result = await submitReview(payload.sessionId, msg.action, msg.approvedFiles || []);
    if (result?.saved) {
      vscode.window.showInformationMessage(`Jewel review saved (${msg.action}) for ${payload.sessionId}`);
    }
  });
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  registerDiffContentProvider(context);

  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBar.command = 'jewel.verify';
  statusBar.text = '$(shield) Jewel';
  statusBar.tooltip = 'Click to run Jewel verify';
  statusBar.show();
  context.subscriptions.push(statusBar);

  sessionTree = new SessionTreeProvider(() => refreshSessions());
  vscode.window.registerTreeDataProvider('jewelSessions', sessionTree);

  startLanguageClient(context, {
    onSessionsChanged: sessions => sessionTree?.setSessions(sessions),
    onSessionDiff: payload => showDiffPanel(context, payload, async msg => {
      if (!payload?.sessionId) return;
      await submitReview(payload.sessionId, msg.action, msg.approvedFiles || []);
    }),
    onVerificationStatus: status => {
      if (!statusBar || !status) return;
      const icon = status.overallStatus === 'PASS' ? '$(check)' : '$(warning)';
      statusBar.text = `${icon} Jewel: ${status.overallStatus || 'ready'}`;
    }
  });

  context.subscriptions.push(
    vscode.commands.registerCommand('jewel.runTask', async () => {
      const task = await vscode.window.showInputBox({
        prompt: 'Describe the task for Jewel',
        placeHolder: 'Fix divide-by-zero in math.ts'
      });
      if (!task) return;
      runJewelTerminal(`run "${task.replace(/"/g, '\\"')}" --yes`);
      setTimeout(() => refreshSessions().then(s => sessionTree?.setSessions(s)), 3000);
    }),

    vscode.commands.registerCommand('jewel.verify', async () => {
      try {
        const report = await runVerifyLsp();
        if (report) {
          vscode.window.showInformationMessage(`Jewel verify: ${report.overallStatus}`);
        } else {
          runJewelTerminal('verify');
        }
      } catch {
        runJewelTerminal('verify');
      }
    }),

    vscode.commands.registerCommand('jewel.status', () => {
      runJewelTerminal('status');
    }),

    vscode.commands.registerCommand('jewel.refreshSessions', async () => {
      const sessions = await refreshSessions();
      sessionTree?.setSessions(sessions);
      vscode.window.showInformationMessage(`Jewel: ${sessions.length} session(s) loaded`);
    }),

    vscode.commands.registerCommand('jewel.openSessionDiff', async sessionId => {
      if (!sessionId) {
        const sessions = await refreshSessions();
        if (sessions.length === 0) {
          vscode.window.showWarningMessage('No Jewel sessions found.');
          return;
        }
        const pick = await vscode.window.showQuickPick(
          sessions.map(s => ({ label: s.sessionId, description: s.status, detail: s.task, sessionId: s.sessionId })),
          { placeHolder: 'Select a session to preview diff' }
        );
        if (!pick) return;
        sessionId = pick.sessionId;
      }
      await openSessionDiff(context, sessionId);
    }),

    vscode.commands.registerCommand('jewel.openLatestDiff', async () => {
      await executeJewelCommand('jewel.openLatestDiff');
    }),

    vscode.commands.registerCommand('jewel.openFileDiff', async (relativePath, sessionId) => {
      const payload = await getSessionDiff(sessionId);
      if (!payload) return;
      const { openFileInDiffEditor } = require('./lib/diffPanel');
      await openFileInDiffEditor(relativePath, payload);
    }),

    vscode.commands.registerCommand('jewel.previewPlan', async () => {
      const task = await vscode.window.showInputBox({
        prompt: 'Task for plan preview',
        placeHolder: 'Fix divide-by-zero in math.ts'
      });
      if (!task) return;
      const plan = await previewPlan(task, []);
      if (!plan) {
        vscode.window.showWarningMessage('Could not generate plan preview. Is jewel lsp running?');
        return;
      }
      showPlanPanel(context, plan, () => {
        runJewelTerminal(`run "${task.replace(/"/g, '\\"')}" --yes`);
      });
    })
  );

  const watcher = vscode.workspace.createFileSystemWatcher('**/.jewel/sessions/**');
  watcher.onDidCreate(() => refreshSessions().then(s => sessionTree?.setSessions(s)));
  watcher.onDidChange(() => refreshSessions().then(s => sessionTree?.setSessions(s)));
  context.subscriptions.push(watcher);
}

function deactivate() {
  statusBar?.dispose();
}

module.exports = { activate, deactivate };
