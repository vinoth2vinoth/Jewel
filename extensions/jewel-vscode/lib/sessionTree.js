const vscode = require('vscode');

class SessionTreeProvider {
  /**
   * @param {() => Promise<unknown[]>} fetchSessions
   */
  constructor(fetchSessions) {
    this.fetchSessions = fetchSessions;
    /** @type {vscode.EventEmitter<void>} */
    this._onDidChange = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChange.event;
    /** @type {unknown[]} */
    this.sessions = [];
  }

  refresh() {
    this._onDidChange.fire();
  }

  setSessions(sessions) {
    this.sessions = sessions || [];
    this.refresh();
  }

  getTreeItem(element) {
    return element;
  }

  async getChildren(element) {
    if (!element) {
      this.sessions = await this.fetchSessions();
      if (this.sessions.length === 0) {
        const empty = new vscode.TreeItem('No Jewel sessions yet');
        empty.description = 'Run a task to create one';
        empty.contextValue = 'jewelEmpty';
        return [empty];
      }
      return this.sessions.map(s => this.toSessionItem(s));
    }
    return [];
  }

  /** @param {any} session */
  toSessionItem(session) {
    const item = new vscode.TreeItem(session.sessionId, vscode.TreeItemCollapsibleState.None);
    item.description = session.status || 'pending';
    item.tooltip = `${session.task}\nRisk: ${session.riskLevel}\nCreated: ${session.createdAt}`;
    item.contextValue = 'jewelSession';
    item.iconPath = statusIcon(session.status);
    item.command = {
      command: 'jewel.openSessionDiff',
      title: 'Open Diff',
      arguments: [session.sessionId]
    };
    return item;
  }
}

function statusIcon(status) {
  if (status === 'SUCCESS') return new vscode.ThemeIcon('pass', new vscode.ThemeColor('testing.iconPassed'));
  if (status === 'FAIL' || status === 'BLOCKED' || status === 'RETRY_LIMIT_REACHED') {
    return new vscode.ThemeIcon('error', new vscode.ThemeColor('testing.iconFailed'));
  }
  return new vscode.ThemeIcon('history');
}

module.exports = { SessionTreeProvider };
