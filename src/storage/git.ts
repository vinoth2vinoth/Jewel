import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export interface CheckpointMetadata {
  timestamp: string;
  isGit: boolean;
  gitCommitSha?: string;
  gitWasDirty?: boolean;
  gitCheckpointSha?: string; // If a temporary commit was created
  backupPath?: string; // If non-git backup
}

export function isGitRepository(cwd: string = process.cwd()): boolean {
  try {
    execSync('git rev-parse --is-inside-work-tree', { cwd, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function getGitStatus(cwd: string = process.cwd()): string {
  try {
    return execSync('git status --porcelain', { cwd, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

export function getGitHead(cwd: string = process.cwd()): string {
  try {
    return execSync('git rev-parse HEAD', { cwd, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

export function createCheckpoint(sessionId: string, cwd: string = process.cwd()): CheckpointMetadata {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const isRepo = isGitRepository(cwd);

  if (!isRepo) {
    // Non-git backup
    const backupDirName = `backup-${timestamp}`;
    const backupPath = path.join(cwd, '.jewel', 'backups', backupDirName);
    const { backupDirectory } = require('./backup');
    backupDirectory(cwd, backupPath);
    return {
      timestamp,
      isGit: false,
      backupPath
    };
  }

  // Git repository
  const originalHead = getGitHead(cwd);
  const status = getGitStatus(cwd);
  const wasDirty = status.length > 0;

  if (!wasDirty) {
    return {
      timestamp,
      isGit: true,
      gitCommitSha: originalHead,
      gitWasDirty: false,
      gitCheckpointSha: originalHead
    };
  }

  // Dirty - create temporary checkpoint commit
  try {
    // Check if user has configured git email/name
    let hasGitConfig = true;
    try {
      execSync('git config user.name', { cwd, stdio: 'ignore' });
    } catch {
      hasGitConfig = false;
    }
    
    const configEnv = { ...process.env };
    if (!hasGitConfig) {
      configEnv.GIT_AUTHOR_NAME = 'Jewel Harness';
      configEnv.GIT_AUTHOR_EMAIL = 'jewel@harness.local';
      configEnv.GIT_COMMITTER_NAME = 'Jewel Harness';
      configEnv.GIT_COMMITTER_EMAIL = 'jewel@harness.local';
    }

    execSync('git add -A', { cwd, stdio: 'ignore' });
    execSync(`git commit -m "jewel-checkpoint-${sessionId}" --no-verify`, {
      cwd,
      stdio: 'ignore',
      env: configEnv
    });
    const checkpointSha = getGitHead(cwd);

    return {
      timestamp,
      isGit: true,
      gitCommitSha: originalHead,
      gitWasDirty: true,
      gitCheckpointSha: checkpointSha
    };
  } catch (err: any) {
    throw new Error(`Failed to create git checkpoint: ${err.message}`);
  }
}

export function rollbackCheckpoint(metadata: CheckpointMetadata, cwd: string = process.cwd()): void {
  if (!metadata.isGit) {
    if (!metadata.backupPath || !fs.existsSync(metadata.backupPath)) {
      throw new Error('Backup path does not exist for rollback.');
    }
    const { restoreDirectory } = require('./backup');
    restoreDirectory(metadata.backupPath, cwd);
    return;
  }

  // Git Rollback
  const checkpointSha = metadata.gitCheckpointSha;
  if (!checkpointSha) {
    throw new Error('No commit SHA found in checkpoint metadata.');
  }

  try {
    // Reset hard to the checkpoint state
    execSync(`git reset --hard ${checkpointSha}`, { cwd, stdio: 'ignore' });
    execSync('git clean -fd', { cwd, stdio: 'ignore' });

    // If it was originally dirty, we committed those changes to gitCheckpointSha.
    // We soft-reset by 1 commit to bring those changes back as uncommitted working changes.
    if (metadata.gitWasDirty && metadata.gitCommitSha) {
      execSync('git reset HEAD~1', { cwd, stdio: 'ignore' });
    }
  } catch (err: any) {
    throw new Error(`Failed to rollback git checkpoint: ${err.message}`);
  }
}
