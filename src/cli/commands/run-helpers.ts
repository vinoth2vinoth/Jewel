import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { UIServer } from '../ui-server';
import { buildRepoSummary } from '../../exploration/context-builder';

export async function waitForExitAcknowledgment(uiServer: UIServer): Promise<void> {
  let rl: readline.Interface | null = null;
  const cliPrompt = new Promise<void>((resolve) => {
    rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.on('line', () => {
      resolve();
    });
  });
  await Promise.race([
    uiServer.waitForExitConfirmation(),
    cliPrompt
  ]);
  if (rl) {
    (rl as readline.Interface).close();
  }
}

export function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
}

export function broadcastState(uiServer: UIServer | undefined, stateUpdate: Record<string, unknown>, config: { maxSessionCost?: number }, adapter: { usage?: { totalTokens?: number; inputTokens?: number; outputTokens?: number; estimatedCostUsd?: number } } | null) {
  if (!uiServer) return;
  const costUpdate = adapter && adapter.usage ? {
    cost: {
      totalTokens: adapter.usage.totalTokens || 0,
      promptTokens: adapter.usage.inputTokens || 0,
      completionTokens: adapter.usage.outputTokens || 0,
      totalUSD: adapter.usage.estimatedCostUsd || 0,
      maxCost: config.maxSessionCost
    }
  } : {};
  uiServer.updateState({
    ...stateUpdate,
    ...costUpdate
  });
}

/** @deprecated Use buildRepoSummary from context-builder instead. Kept for backward compatibility. */
export function generateRepoSummary(cwd: string): string {
  return buildRepoSummary(cwd);
}

export function buildRepoContext(cwd: string, filePaths: string[]): string {
  let repoContext = '';
  for (const filePath of filePaths) {
    const fullPath = path.resolve(cwd, filePath);
    if (fs.existsSync(fullPath)) {
      const stat = fs.statSync(fullPath);
      if (!stat.isFile()) {
        repoContext += `=== File: ${filePath} ===\n(Not a regular file)\n\n`;
        continue;
      }
      const content = fs.readFileSync(fullPath, 'utf8');
      repoContext += `=== File: ${filePath} ===\n${content}\n\n`;
    } else {
      repoContext += `=== File: ${filePath} ===\n(File does not exist yet)\n\n`;
    }
  }
  return repoContext;
}
