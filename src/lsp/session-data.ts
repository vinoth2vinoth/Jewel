import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { loadConfig } from '../core/config';
import { listRecentSessions, resolveSessionId } from '../core/session-history';
import { runDiffGuard } from '../safety/diff-guard';
import { CheckpointMetadata } from '../storage/git';

export interface SessionFileDiff {
  path: string;
  added: number;
  removed: number;
  oldContent: string | null;
  newContent: string | null;
}

export interface SessionDiffPayload {
  sessionId: string;
  task: string;
  status?: string;
  riskLevel?: string;
  changedFiles: SessionFileDiff[];
  gitDiff: string;
  diffAnalysis: {
    status: string;
    changedFilesCount: number;
    addedLinesCount: number;
    removedLinesCount: number;
    findings: string[];
  };
  report?: Record<string, unknown>;
}

function readGitFileAtRef(cwd: string, ref: string, filePath: string): string | null {
  try {
    return execSync(`git show ${ref}:${filePath.replace(/\\/g, '/')}`, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    });
  } catch {
    return null;
  }
}

function readBackupFile(backupPath: string, cwd: string, relativePath: string): string | null {
  const full = path.join(backupPath, relativePath);
  if (!fs.existsSync(full)) return null;
  try {
    return fs.readFileSync(full, 'utf8');
  } catch {
    return null;
  }
}

export function getSessionDiffPayload(cwd: string, sessionIdInput?: string): SessionDiffPayload | null {
  const sessionId = resolveSessionId(cwd, sessionIdInput);
  if (!sessionId) return null;

  const sessionPath = path.join(cwd, '.jewel', 'sessions', sessionId);
  const checkpointPath = path.join(sessionPath, 'checkpoint.json');
  const contractPath = path.join(sessionPath, 'task-contract.json');
  if (!fs.existsSync(checkpointPath)) return null;

  const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, 'utf8')) as CheckpointMetadata;
  let config;
  try {
    config = loadConfig(cwd);
  } catch {
    const { DEFAULT_CONFIG } = require('../core/config');
    config = DEFAULT_CONFIG;
  }

  const diffAnalysis = runDiffGuard(checkpoint, config, cwd);
  let task = '(unknown)';
  let riskLevel = 'unknown';
  if (fs.existsSync(contractPath)) {
    try {
      const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
      task = contract.task || task;
      riskLevel = contract.riskLevel || riskLevel;
    } catch {}
  }

  let status: string | undefined;
  const reportPath = path.join(sessionPath, 'run-report.json');
  let report: Record<string, unknown> | undefined;
  if (fs.existsSync(reportPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as Record<string, unknown>;
      report = parsed;
      status = typeof parsed.status === 'string' ? parsed.status : undefined;
    } catch {}
  }

  let gitDiff = '';
  if (checkpoint.isGit && checkpoint.gitCheckpointSha) {
    try {
      gitDiff = execSync(`git diff ${checkpoint.gitCheckpointSha}`, {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      });
    } catch {}
  }

  const changedFiles: SessionFileDiff[] = [];
  for (const file of diffAnalysis.changedFiles) {
    const fullPath = path.resolve(cwd, file);
    let newContent: string | null = null;
    let oldContent: string | null = null;

    if (fs.existsSync(fullPath)) {
      try { newContent = fs.readFileSync(fullPath, 'utf8'); } catch {}
    }

    if (checkpoint.isGit && checkpoint.gitCheckpointSha) {
      oldContent = readGitFileAtRef(cwd, checkpoint.gitCheckpointSha, file);
    } else if (checkpoint.backupPath) {
      oldContent = readBackupFile(checkpoint.backupPath, cwd, file);
    }

    const stat = diffAnalysis.changedFilesCount > 0
      ? { added: 0, removed: 0 }
      : { added: 0, removed: 0 };

    changedFiles.push({
      path: file,
      added: stat.added,
      removed: stat.removed,
      oldContent,
      newContent
    });
  }

  // Enrich added/removed from diff analysis internal stats if available
  for (const cf of changedFiles) {
    const match = gitDiff.match(new RegExp(`diff --git a/${cf.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
    if (match) {
      const section = gitDiff.slice(gitDiff.indexOf(match[0]));
      const nextDiff = section.indexOf('\ndiff --git ', 10);
      const chunk = nextDiff === -1 ? section : section.slice(0, nextDiff);
      cf.added = (chunk.match(/^\+(?!\+)/gm) || []).length;
      cf.removed = (chunk.match(/^-(?!-)/gm) || []).length;
    }
  }

  return {
    sessionId,
    task,
    status,
    riskLevel,
    changedFiles,
    gitDiff,
    diffAnalysis: {
      status: diffAnalysis.status,
      changedFilesCount: diffAnalysis.changedFilesCount,
      addedLinesCount: diffAnalysis.addedLinesCount,
      removedLinesCount: diffAnalysis.removedLinesCount,
      findings: diffAnalysis.findings
    },
    report
  };
}

export function listSessionsForLsp(cwd: string, limit = 20) {
  return listRecentSessions(cwd, limit);
}
