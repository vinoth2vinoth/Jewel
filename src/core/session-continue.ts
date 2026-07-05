import * as fs from 'fs';
import * as path from 'path';
import { resolveSessionId } from './session-history';
import { ContinuationContext } from './run-task-options';
import { TaskContract } from './session';

export function loadContinuationContext(
  cwd: string,
  feedback: string,
  sessionIdInput?: string
): ContinuationContext | null {
  const sessionId = resolveSessionId(cwd, sessionIdInput);
  if (!sessionId) return null;

  const sessionPath = path.join(cwd, '.jewel', 'sessions', sessionId);
  const contractPath = path.join(sessionPath, 'task-contract.json');
  if (!fs.existsSync(contractPath)) return null;

  let contract: TaskContract;
  try {
    contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  } catch {
    return null;
  }

  if (!contract.task) return null;

  const priorFindings: string[] = [];
  let priorStatus: string | undefined;

  const reportPath = path.join(sessionPath, 'run-report.json');
  if (fs.existsSync(reportPath)) {
    try {
      const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
      priorStatus = typeof report.status === 'string' ? report.status : undefined;
      if (Array.isArray(report.criticFindings)) {
        priorFindings.push(...report.criticFindings.filter((f: unknown) => typeof f === 'string'));
      }
      if (report.verificationSummary && typeof report.verificationSummary === 'string') {
        priorFindings.push(report.verificationSummary);
      }
    } catch {}
  }

  return {
    parentSessionId: sessionId,
    originalTask: contract.task,
    priorStatus,
    priorFindings,
    feedback: feedback.trim()
  };
}

export function buildContinuationTask(ctx: ContinuationContext): string {
  return `${ctx.originalTask}\n\n--- Follow-up ---\n${ctx.feedback}`;
}

export function buildContinuationRepoAppendix(ctx: ContinuationContext): string {
  const lines = [
    '',
    '--- Continuation from prior Jewel session ---',
    `Parent session: ${ctx.parentSessionId}`,
    `Prior status: ${ctx.priorStatus || 'unknown'}`,
    `Follow-up feedback: ${ctx.feedback}`
  ];
  if (ctx.priorFindings.length > 0) {
    lines.push('Prior findings:');
    for (const f of ctx.priorFindings.slice(0, 15)) {
      lines.push(`  - ${f}`);
    }
  }
  return lines.join('\n');
}

export function writeSessionLinkMetadata(
  sessionPath: string,
  parentSessionId: string,
  feedback: string
): void {
  fs.writeFileSync(
    path.join(sessionPath, 'continuation.json'),
    JSON.stringify({
      parentSessionId,
      feedback,
      createdAt: new Date().toISOString()
    }, null, 2),
    'utf8'
  );
}
