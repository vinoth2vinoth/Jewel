import * as fs from 'fs';
import * as path from 'path';
import { isGitRepository, getGitStatus } from '../../storage/git';

export function runStatus(cwd: string = process.cwd()): void {
  console.log('--- Jewel Status Summary ---');

  // 1. Check initialization
  const configPath = path.join(cwd, 'jewel.config.json');
  if (!fs.existsSync(configPath)) {
    console.log('[-] Status: Jewel is not initialized in this directory.');
    console.log('    Run "jewel init" to get started.');
    return;
  }
  console.log('[+] Initialization: Jewel is initialized in this workspace.');

  // 2. Check Git state
  const isGit = isGitRepository(cwd);
  console.log(`[+] Version Control: ${isGit ? 'Git repository' : 'Local folder (no Git)'}`);
  if (isGit) {
    const gitStatus = getGitStatus(cwd);
    if (gitStatus) {
      console.log('    Working tree status: Dirty (uncommitted changes exist)');
    } else {
      console.log('    Working tree status: Clean');
    }
  }

  // 3. Scan sessions
  const sessionsDir = path.join(cwd, '.jewel', 'sessions');
  if (fs.existsSync(sessionsDir)) {
    const entries = fs.readdirSync(sessionsDir).filter(f => f.startsWith('session-'));
    console.log(`\nSessions tracked: ${entries.length}`);

    if (entries.length > 0) {
      // Sort sessions descending by folder name (timestamp based)
      const sorted = entries.sort((a, b) => b.localeCompare(a)).slice(0, 5);
      console.log('Recent 5 Sessions:');
      for (const entry of sorted) {
        const contractPath = path.join(sessionsDir, entry, 'task-contract.json');
        if (fs.existsSync(contractPath)) {
          try {
            const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
            console.log(`  - ${entry}: "${contract.task}" (Risk: ${contract.riskLevel}, Created: ${contract.createdAt})`);
          } catch {
            console.log(`  - ${entry}: Malformed task contract`);
          }
        } else {
          console.log(`  - ${entry}: Missing task contract`);
        }
      }
    }
  } else {
    console.log('\nSessions tracked: 0 (No sessions folder found)');
  }

  // 4. Latest Report summary
  const latestReportPath = path.join(cwd, '.jewel', 'reports', 'latest.json');
  if (fs.existsSync(latestReportPath)) {
    try {
      const latest = JSON.parse(fs.readFileSync(latestReportPath, 'utf8'));
      console.log(`\nLatest Verification Report (${latest.date}):`);
      console.log(`  Overall Status: ${latest.overallStatus}`);
      console.log(`  Passed commands: ${latest.stats.passed}`);
      console.log(`  Failed commands: ${latest.stats.failed}`);
    } catch {
      console.log('\nLatest report JSON is malformed.');
    }
  }
}
