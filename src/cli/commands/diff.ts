import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { loadConfig } from '../../core/config';
import { runDiffGuard } from '../../safety/diff-guard';

export function runDiff(sessionIdInput?: string, cwd: string = process.cwd()): void {
  let sessionId = sessionIdInput;
  const sessionsDir = path.join(cwd, '.jewel', 'sessions');
  
  if (!sessionId) {
    if (!fs.existsSync(sessionsDir)) {
      console.error('Error: No sessions found. Run a task first.');
      process.exit(1);
    }
    const sessions = fs.readdirSync(sessionsDir).filter(f => f.startsWith('session-'));
    if (sessions.length === 0) {
      console.error('Error: No sessions found. Run a task first.');
      process.exit(1);
    }
    sessions.sort();
    sessionId = sessions[sessions.length - 1];
  }
  
  const sessionPath = path.join(sessionsDir, sessionId);
  const checkpointPath = path.join(sessionPath, 'checkpoint.json');
  
  if (!fs.existsSync(checkpointPath)) {
    console.error(`Error: Checkpoint file not found for session "${sessionId}".`);
    process.exit(1);
  }
  
  const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, 'utf8'));
  let config;
  try {
    config = loadConfig(cwd);
  } catch {
    const { DEFAULT_CONFIG } = require('../../core/config');
    config = DEFAULT_CONFIG;
  }
  
  const diffAnalysis = runDiffGuard(checkpoint, config, cwd);
  
  console.log(`\n=== Jewel Diff (Session: ${sessionId}) ===`);
  console.log(`Changed Files (${diffAnalysis.changedFiles.length}):`);
  for (const file of diffAnalysis.changedFiles) {
    console.log(`  - ${file}`);
  }
  console.log(`Total Added Lines: ${diffAnalysis.addedLinesCount}`);
  console.log(`Total Removed Lines: ${diffAnalysis.removedLinesCount}`);
  
  if (diffAnalysis.protectedFilesChanged.length > 0) {
    console.warn(`\n[WARNING] Protected files modified:`);
    for (const file of diffAnalysis.protectedFilesChanged) {
      console.warn(`  ! ${file}`);
    }
  }
  
  console.log('\nGit Diff Preview:');
  if (checkpoint.isGit && checkpoint.gitCheckpointSha) {
    try {
      execSync(`git diff ${checkpoint.gitCheckpointSha}`, {
        cwd,
        stdio: 'inherit',
        env: { ...process.env, PAGER: 'cat' }
      });
    } catch (err: any) {
      console.log(`(Failed to print git diff: ${err.message})`);
    }
  } else {
    console.log('(Git diff preview is not available in non-Git backup mode)');
  }
  console.log('======================================\n');
}
