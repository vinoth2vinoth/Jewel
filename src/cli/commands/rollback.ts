import * as fs from 'fs';
import * as path from 'path';
import { rollbackCheckpoint, CheckpointMetadata } from '../../storage/git';

export function runRollback(targetSessionId?: string, cwd: string = process.cwd()): void {
  console.log('Initiating Jewel Rollback...');

  const sessionsDir = path.join(cwd, '.jewel', 'sessions');
  if (!fs.existsSync(sessionsDir)) {
    console.error('Error: No sessions folder found. Cannot rollback.');
    process.exit(1);
  }

  let sessionId = targetSessionId;

  if (!sessionId) {
    // Find the latest session folder (lexicographically largest name because of timestamp ordering)
    const sessions = fs.readdirSync(sessionsDir)
      .filter(f => f.startsWith('session-'))
      .sort((a, b) => b.localeCompare(a));

    if (sessions.length === 0) {
      console.error('Error: No Jewel sessions found to roll back.');
      process.exit(1);
    }
    sessionId = sessions[0];
  }

  const sessionPath = path.join(sessionsDir, sessionId);
  const checkpointPath = path.join(sessionPath, 'checkpoint.json');

  if (!fs.existsSync(checkpointPath)) {
    console.error(`Error: Checkpoint metadata not found for session ${sessionId}.`);
    process.exit(1);
  }

  try {
    const metadata: CheckpointMetadata = JSON.parse(fs.readFileSync(checkpointPath, 'utf8'));
    console.log(`[+] Found checkpoint metadata for session: ${sessionId}`);
    console.log(`    Strategy: ${metadata.isGit ? 'Git branch reset' : 'Directory copy'}`);
    if (metadata.isGit) {
      console.log(`    Original commit: ${metadata.gitCommitSha}`);
      console.log(`    Checkpoint commit: ${metadata.gitCheckpointSha}`);
      console.log(`    Working dir was dirty: ${metadata.gitWasDirty}`);
    } else {
      console.log(`    Backup folder: ${metadata.backupPath}`);
    }

    // Run rollback
    rollbackCheckpoint(metadata, cwd);

    // Save rollback report
    const reportsDir = path.join(cwd, '.jewel', 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const rollbackReport = {
      sessionId,
      timestamp: new Date().toISOString(),
      metadata,
      status: 'SUCCESS'
    };

    fs.writeFileSync(
      path.join(reportsDir, 'latest-rollback.json'),
      JSON.stringify(rollbackReport, null, 2),
      'utf8'
    );

    // Markdown rollback report
    let mdReport = `# Jewel Rollback Report\n\n`;
    mdReport += `**Rollback Date:** ${rollbackReport.timestamp}\n`;
    mdReport += `**Session Rolled Back:** ${sessionId}\n`;
    mdReport += `**Version Control:** ${metadata.isGit ? 'Git' : 'Directory Backup'}\n`;
    mdReport += `**Status:** SUCCESS\n\n`;
    mdReport += `## Details\n\n`;
    if (metadata.isGit) {
      mdReport += `- Rolled back working files to checkpoint commit: \`${metadata.gitCheckpointSha}\`\n`;
      if (metadata.gitWasDirty) {
        mdReport += `- Restored original uncommitted modifications to working tree.\n`;
      }
    } else {
      mdReport += `- Restored original files from backup directory: \`${metadata.backupPath}\`\n`;
    }

    fs.writeFileSync(path.join(reportsDir, 'latest-rollback.md'), mdReport, 'utf8');

    console.log(`\n[+] Rollback completed successfully. Project returned to pre-run state.`);
  } catch (err: any) {
    console.error(`\n[-] Rollback failed: ${err.message}`);
    process.exit(1);
  }
}
