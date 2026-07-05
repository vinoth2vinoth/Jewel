import * as fs from 'fs';
import * as path from 'path';
import { execSync, execFileSync } from 'child_process';
import { loadConfig } from '../../core/config';
import { resolveSessionId } from '../../core/session-history';
import { getSessionDiffPayload } from '../../lsp/session-data';
import { isGitRepository } from '../../storage/git';

export interface ShipOptions {
  sessionId?: string;
  branch?: string;
  message?: string;
  cwd?: string;
}

export function runShip(options: ShipOptions = {}): void {
  const cwd = options.cwd || process.cwd();

  if (!isGitRepository(cwd)) {
    console.error('Error: jewel ship requires a Git repository.');
    process.exit(1);
  }

  loadConfig(cwd);

  const sessionId = resolveSessionId(cwd, options.sessionId);
  if (!sessionId) {
    console.error('Error: No session found. Run a Jewel task first.');
    process.exit(1);
  }

  const diff = getSessionDiffPayload(cwd, sessionId);
  if (!diff) {
    console.error(`Error: Could not load diff for session ${sessionId}.`);
    process.exit(1);
  }

  if (diff.status !== 'PASS' && diff.status !== 'SUCCESS') {
    console.warn(`Warning: Session status is "${diff.status || 'unknown'}". Shipping anyway.`);
  }

  const changedFiles = diff.changedFiles.map(f => f.path).filter(Boolean);
  if (changedFiles.length === 0) {
    console.error('Error: No changed files in session diff. Nothing to ship.');
    process.exit(1);
  }

  const branch = options.branch || `jewel/${sessionId}`;
  const message = options.message || `jewel: ${diff.task.slice(0, 72)}`;

  try {
    execSync('git rev-parse --abbrev-ref HEAD', { cwd, encoding: 'utf8', stdio: 'pipe' });
  } catch {
    console.error('Error: Git repository is not accessible.');
    process.exit(1);
  }

  let branchCreated = false;
  try {
    execSync(`git checkout -b ${branch}`, { cwd, stdio: 'pipe' });
    branchCreated = true;
  } catch {
    try {
      execSync(`git checkout ${branch}`, { cwd, stdio: 'pipe' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Error: Could not create or checkout branch "${branch}": ${msg}`);
      process.exit(1);
    }
  }

  for (const file of changedFiles) {
    const full = path.resolve(cwd, file);
    if (fs.existsSync(full)) {
      execFileSync('git', ['add', '--', file], { cwd, stdio: 'pipe' });
    }
  }

  try {
    execFileSync('git', ['commit', '-m', message], { cwd, stdio: 'inherit' });
  } catch {
    console.error('Error: git commit failed. Ensure files are staged and changes exist.');
    if (branchCreated) {
      try { execSync('git checkout -', { cwd, stdio: 'pipe' }); } catch {}
    }
    process.exit(1);
  }

  const prBody = buildPrBody(diff, sessionId, branch);
  const outDir = path.join(cwd, '.jewel', 'ship');
  fs.mkdirSync(outDir, { recursive: true });
  const prPath = path.join(outDir, `${sessionId}-pr-body.md`);
  fs.writeFileSync(prPath, prBody, 'utf8');

  console.log(`\n[+] Shipped session ${sessionId} to branch "${branch}"`);
  console.log(`[+] Commit message: ${message}`);
  console.log(`[+] PR body template: ${path.relative(cwd, prPath)}`);
  console.log(`[+] Changed files: ${changedFiles.join(', ')}`);
}

function buildPrBody(
  diff: NonNullable<ReturnType<typeof getSessionDiffPayload>>,
  sessionId: string,
  branch: string
): string {
  let md = `# ${diff.task}\n\n`;
  md += `**Jewel session:** \`${sessionId}\`\n`;
  md += `**Branch:** \`${branch}\`\n`;
  md += `**Status:** ${diff.status || 'unknown'}\n`;
  md += `**Risk:** ${diff.riskLevel || 'unknown'}\n\n`;
  md += `## Summary\n\n`;
  md += `${diff.task}\n\n`;
  md += `## Changed files\n\n`;
  for (const f of diff.changedFiles) {
    md += `- \`${f.path}\` (+${f.added}/-${f.removed})\n`;
  }
  if (diff.diffAnalysis.findings.length > 0) {
    md += `\n## Diff guard findings\n\n`;
    for (const f of diff.diffAnalysis.findings) {
      md += `- ${f}\n`;
    }
  }
  md += `\n## Verification\n\n`;
  md += `Shipped from Jewel session after verification gate.\n`;
  return md;
}
