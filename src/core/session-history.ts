import * as fs from 'fs';
import * as path from 'path';

export interface SessionSummary {
  sessionId: string;
  task: string;
  riskLevel: string;
  createdAt: string;
  status?: string;
  files: string[];
}

export interface ResumeSessionPayload {
  sessionId: string;
  task: string;
  files: string[];
  riskLevel: string;
}

function sessionsDir(cwd: string): string {
  return path.join(cwd, '.jewel', 'sessions');
}

function readSessionStatus(sessionPath: string): string | undefined {
  const reportPath = path.join(sessionPath, 'run-report.json');
  if (!fs.existsSync(reportPath)) return undefined;
  try {
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    return typeof report.status === 'string' ? report.status : undefined;
  } catch {
    return undefined;
  }
}

export function listRecentSessions(cwd: string = process.cwd(), limit = 10): SessionSummary[] {
  const dir = sessionsDir(cwd);
  if (!fs.existsSync(dir)) return [];

  const entries = fs.readdirSync(dir)
    .filter(f => f.startsWith('session-'))
    .sort((a, b) => b.localeCompare(a))
    .slice(0, limit);

  const summaries: SessionSummary[] = [];
  for (const sessionId of entries) {
    const sessionPath = path.join(dir, sessionId);
    const contractPath = path.join(sessionPath, 'task-contract.json');
    if (!fs.existsSync(contractPath)) continue;
    try {
      const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
      summaries.push({
        sessionId,
        task: contract.task || '(unknown task)',
        riskLevel: contract.riskLevel || 'unknown',
        createdAt: contract.createdAt || sessionId,
        status: readSessionStatus(sessionPath),
        files: Array.isArray(contract.filesLikelyNeeded) ? contract.filesLikelyNeeded : []
      });
    } catch {
      summaries.push({
        sessionId,
        task: '(malformed contract)',
        riskLevel: 'unknown',
        createdAt: sessionId,
        files: []
      });
    }
  }
  return summaries;
}

export function resolveSessionId(cwd: string, sessionId?: string): string | null {
  const dir = sessionsDir(cwd);
  if (!fs.existsSync(dir)) return null;

  if (sessionId) {
    const full = path.join(dir, sessionId);
    return fs.existsSync(full) ? sessionId : null;
  }

  const latest = fs.readdirSync(dir)
    .filter(f => f.startsWith('session-'))
    .sort((a, b) => b.localeCompare(a))[0];
  return latest || null;
}

export function getSessionForResume(cwd: string, sessionId?: string): ResumeSessionPayload | null {
  const resolved = resolveSessionId(cwd, sessionId);
  if (!resolved) return null;

  const contractPath = path.join(sessionsDir(cwd), resolved, 'task-contract.json');
  if (!fs.existsSync(contractPath)) return null;

  try {
    const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
    if (!contract.task || typeof contract.task !== 'string') return null;
    return {
      sessionId: resolved,
      task: contract.task,
      files: Array.isArray(contract.filesLikelyNeeded) ? contract.filesLikelyNeeded : [],
      riskLevel: contract.riskLevel || 'low'
    };
  } catch {
    return null;
  }
}

export function formatSessionHistoryTable(sessions: SessionSummary[]): string {
  if (sessions.length === 0) {
    return 'No sessions found. Run a task first with: jewel run "your task" --mock';
  }

  const lines = [
    'Recent Jewel Sessions:',
    ''
  ];
  for (const s of sessions) {
    const status = s.status ? `[${s.status}]` : '[no report]';
    lines.push(`  ${s.sessionId}`);
    lines.push(`    Task: ${s.task}`);
    lines.push(`    Status: ${status}  Risk: ${s.riskLevel}`);
    lines.push(`    Files: ${s.files.length > 0 ? s.files.join(', ') : '(none)'}`);
    lines.push('');
  }
  lines.push('Resume a session: /resume [session-id] [--mock] [--yes]');
  return lines.join('\n');
}
