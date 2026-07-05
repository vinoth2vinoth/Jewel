import * as fs from 'fs';
import * as path from 'path';
import { startStdioRpc, writeStdioRpc } from '../rpc/stdio-transport';
import { loadConfig } from '../core/config';
import { generateLocalContract } from '../core/session';
import { resolveFilesForTask } from '../exploration/context-builder';
import { runVerification, VerificationReport } from '../verification/runner';
import { diagnosticsFromVerificationReport, LspDiagnosticMap } from './diagnostics';
import { getSessionDiffPayload, listSessionsForLsp } from './session-data';

type PublishDiagnostics = (map: LspDiagnosticMap) => void;

let workspaceRoot = process.cwd();
let publishDiagnostics: PublishDiagnostics = () => {};
let reportWatcher: fs.FSWatcher | null = null;

function publishVerificationDiagnostics(cwd: string): void {
  const reportPath = path.join(cwd, '.jewel', 'reports', 'latest.json');
  if (!fs.existsSync(reportPath)) {
    publishDiagnostics({});
    return;
  }
  try {
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as VerificationReport;
    publishDiagnostics(diagnosticsFromVerificationReport(report, cwd));
  } catch {
    publishDiagnostics({});
  }
}

function startReportWatcher(cwd: string): void {
  const reportsDir = path.join(cwd, '.jewel', 'reports');
  if (!fs.existsSync(reportsDir)) {
    try { fs.mkdirSync(reportsDir, { recursive: true }); } catch {}
  }
  if (reportWatcher) {
    try { reportWatcher.close(); } catch {}
  }
  try {
    reportWatcher = fs.watch(reportsDir, () => {
      publishVerificationDiagnostics(cwd);
    });
  } catch {}
  publishVerificationDiagnostics(cwd);
}

function notifySessionsChanged(): void {
  writeStdioRpc({
    jsonrpc: '2.0',
    method: 'jewel/sessionsChanged',
    params: { sessions: listSessionsForLsp(workspaceRoot) }
  });
}

export function runLspServerLoop(cwd: string = process.cwd()): void {
  workspaceRoot = cwd;

  publishDiagnostics = (map: LspDiagnosticMap) => {
    for (const [uri, diagnostics] of Object.entries(map)) {
      writeStdioRpc({
        jsonrpc: '2.0',
        method: 'textDocument/publishDiagnostics',
        params: { uri, diagnostics }
      });
    }
    if (Object.keys(map).length === 0) {
      writeStdioRpc({
        jsonrpc: '2.0',
        method: 'jewel/verificationStatus',
        params: { overallStatus: 'UNKNOWN', failed: 0, passed: 0 }
      });
    }
  };

  startStdioRpc((msg) => {
    const id = msg.id;
    const method = msg.method as string;
    const params = (msg.params || {}) as Record<string, unknown>;

    if (method === 'initialize') {
      const rootUri = (params.rootUri as string) || '';
      if (rootUri.startsWith('file://')) {
        workspaceRoot = decodeURIComponent(rootUri.replace(/^file:\/\//, '').replace(/^\/([A-Za-z]:)/, '$1'));
      }
      startReportWatcher(workspaceRoot);

      writeStdioRpc({
        jsonrpc: '2.0',
        id,
        result: {
          capabilities: {
            workspace: { workspaceFolders: true },
            executeCommandProvider: {
              commands: ['jewel.verify', 'jewel.refreshSessions', 'jewel.openLatestDiff']
            }
          },
          serverInfo: { name: 'jewel-lsp', version: '0.10.0' }
        }
      });
      return;
    }

    if (method === 'initialized') {
      notifySessionsChanged();
      return;
    }

    if (method === 'shutdown') {
      if (reportWatcher) try { reportWatcher.close(); } catch {}
      writeStdioRpc({ jsonrpc: '2.0', id, result: null });
      return;
    }

    if (method === 'exit') {
      process.exit(0);
    }

    if (method === 'workspace/didChangeWorkspaceFolders') {
      startReportWatcher(workspaceRoot);
      notifySessionsChanged();
      return;
    }

    if (method === 'workspace/executeCommand') {
      const command = params.command as string;
      if (command === 'jewel.verify') {
        const config = loadConfig(workspaceRoot);
        runVerification(config, workspaceRoot)
          .then(report => {
            const map = diagnosticsFromVerificationReport(report, workspaceRoot);
            publishDiagnostics(map);
            writeStdioRpc({
              jsonrpc: '2.0',
              method: 'jewel/verificationStatus',
              params: {
                overallStatus: report.overallStatus,
                failed: report.stats.failed,
                passed: report.stats.passed
              }
            });
            if (id !== undefined) {
              writeStdioRpc({ jsonrpc: '2.0', id, result: { overallStatus: report.overallStatus } });
            }
          })
          .catch((err: unknown) => {
            const message = err instanceof Error ? err.message : String(err);
            if (id !== undefined) {
              writeStdioRpc({ jsonrpc: '2.0', id, error: { code: -32603, message } });
            }
          });
        return;
      }
      if (command === 'jewel.refreshSessions') {
        notifySessionsChanged();
        if (id !== undefined) writeStdioRpc({ jsonrpc: '2.0', id, result: true });
        return;
      }
      if (command === 'jewel.openLatestDiff') {
        const payload = getSessionDiffPayload(workspaceRoot);
        writeStdioRpc({
          jsonrpc: '2.0',
          method: 'jewel/sessionDiff',
          params: payload
        });
        if (id !== undefined) writeStdioRpc({ jsonrpc: '2.0', id, result: payload?.sessionId || null });
        return;
      }
    }

    // Custom Jewel requests
    if (method === 'jewel/listSessions') {
      const limit = typeof params.limit === 'number' ? params.limit : 20;
      writeStdioRpc({ jsonrpc: '2.0', id, result: listSessionsForLsp(workspaceRoot, limit) });
      return;
    }

    if (method === 'jewel/getSessionDiff') {
      const sessionId = typeof params.sessionId === 'string' ? params.sessionId : undefined;
      writeStdioRpc({ jsonrpc: '2.0', id, result: getSessionDiffPayload(workspaceRoot, sessionId) });
      return;
    }

    if (method === 'jewel/previewPlan') {
      try {
        const task = String(params.task || '');
        const config = loadConfig(workspaceRoot);
        const userFiles = Array.isArray(params.files) ? params.files.map(String) : [];
        const resolved = resolveFilesForTask(workspaceRoot, task, userFiles, config);
        const contract = generateLocalContract(task, config, resolved);
        writeStdioRpc({
          jsonrpc: '2.0',
          id,
          result: { contract, files: resolved, task }
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        writeStdioRpc({ jsonrpc: '2.0', id, error: { code: -32603, message } });
      }
      return;
    }

    if (method === 'jewel/submitReview') {
      const sessionId = String(params.sessionId || '');
      const action = params.action === 'reject' ? 'reject' : 'approve';
      const approvedFiles = Array.isArray(params.approvedFiles) ? params.approvedFiles.map(String) : [];
      const reviewPath = path.join(workspaceRoot, '.jewel', 'sessions', sessionId, 'human-review.json');
      fs.mkdirSync(path.dirname(reviewPath), { recursive: true });
      fs.writeFileSync(reviewPath, JSON.stringify({
        action,
        approvedFiles,
        submittedAt: new Date().toISOString()
      }, null, 2), 'utf8');
      writeStdioRpc({ jsonrpc: '2.0', id, result: { saved: true, path: reviewPath } });
      return;
    }

    if (method === 'jewel/runVerify') {
      runVerification(loadConfig(workspaceRoot), workspaceRoot)
        .then(report => {
          publishDiagnostics(diagnosticsFromVerificationReport(report, workspaceRoot));
          writeStdioRpc({ jsonrpc: '2.0', id, result: report });
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          writeStdioRpc({ jsonrpc: '2.0', id, error: { code: -32603, message } });
        });
      return;
    }

    if (id !== undefined) {
      writeStdioRpc({
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Method not found: ${method}` }
      });
    }
  });
}
