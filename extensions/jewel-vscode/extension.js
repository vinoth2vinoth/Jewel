const vscode = require('vscode');
const { spawn } = require('child_process');

function runJewel(args, cwd) {
  const terminal = vscode.window.createTerminal({ name: 'Jewel', cwd });
  terminal.show();
  terminal.sendText(`jewel ${args}`, true);
}

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand('jewel.runTask', async () => {
      const task = await vscode.window.showInputBox({
        prompt: 'Describe the task for Jewel',
        placeHolder: 'Fix divide-by-zero in math.ts'
      });
      if (!task) return;
      runJewel(`run "${task.replace(/"/g, '\\"')}" --yes`, vscode.workspace.workspaceFolders?.[0]?.uri.fsPath);
    }),
    vscode.commands.registerCommand('jewel.verify', () => {
      runJewel('verify', vscode.workspace.workspaceFolders?.[0]?.uri.fsPath);
    }),
    vscode.commands.registerCommand('jewel.status', () => {
      runJewel('status', vscode.workspace.workspaceFolders?.[0]?.uri.fsPath);
    })
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
