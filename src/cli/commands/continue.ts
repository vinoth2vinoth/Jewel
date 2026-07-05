import * as fs from 'fs';
import * as path from 'path';
import { runTask } from './run';
import {
  loadContinuationContext,
  buildContinuationTask
} from '../../core/session-continue';
import { resolveSessionId } from '../../core/session-history';

export async function runContinueCommand(
  feedback: string,
  sessionIdInput: string | undefined,
  useMock: boolean,
  cwd: string,
  yesFlag: boolean,
  noReview: boolean,
  keepFailed: boolean,
  cliOverrides?: {
    provider?: string;
    model?: string;
    temperature?: number;
    maxOutputTokens?: number;
  },
  dryRun = false,
  uiFlag = false
): Promise<void> {
  if (!feedback || feedback.trim() === '') {
    console.error('Error: Feedback is required. Example: jewel continue "Also handle edge case when b is zero"');
    process.exit(1);
  }

  const ctx = loadContinuationContext(cwd, feedback, sessionIdInput);
  if (!ctx) {
    console.error('Error: No session found to continue. Run jewel status or specify a session ID.');
    process.exit(1);
  }

  const continuationTask = buildContinuationTask(ctx);
  const sessionId = resolveSessionId(cwd, ctx.parentSessionId) || ctx.parentSessionId;
  const contractPath = path.join(cwd, '.jewel', 'sessions', sessionId, 'task-contract.json');

  let files: string[] = [];
  if (fs.existsSync(contractPath)) {
    try {
      const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
      files = Array.isArray(contract.filesLikelyNeeded) ? contract.filesLikelyNeeded : [];
    } catch {}
  }

  console.log(`[+] Continuing from session ${ctx.parentSessionId}`);
  console.log(`[+] Prior status: ${ctx.priorStatus || 'unknown'}`);
  console.log(`[+] Follow-up: "${ctx.feedback}"`);

  await runTask(
    continuationTask,
    files,
    useMock,
    cwd,
    yesFlag,
    noReview,
    keepFailed,
    cliOverrides,
    dryRun,
    uiFlag,
    {
      parentSessionId: ctx.parentSessionId,
      continuationFeedback: ctx.feedback
    }
  );
}
