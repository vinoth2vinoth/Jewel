import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { JewelConfig } from '../core/config';
import { CheckpointMetadata } from '../storage/git';

export interface DiffAnalysis {
  status: 'PASS' | 'WARN' | 'BLOCK';
  changedFilesCount: number;
  addedLinesCount: number;
  removedLinesCount: number;
  changedFiles: string[];
  protectedFilesChanged: string[];
  dependenciesChanged: boolean;
  lockfilesChanged: string[];
  findings: string[];
}

export function runDiffGuard(
  checkpoint: CheckpointMetadata,
  config: JewelConfig,
  cwd: string = process.cwd()
): DiffAnalysis {
  const findings: string[] = [];
  let status: DiffAnalysis['status'] = 'PASS';

  let changedFiles: { file: string; added: number; removed: number }[] = [];

  if (checkpoint.isGit && checkpoint.gitCheckpointSha) {
    // Git diff implementation
    try {
      const diffStat = execSync(`git diff --numstat ${checkpoint.gitCheckpointSha}`, {
        cwd,
        encoding: 'utf8'
      }).trim();

      if (diffStat) {
        changedFiles = diffStat.split('\n').map(line => {
          const [addedStr, removedStr, file] = line.split(/\s+/);
          const added = addedStr === '-' ? 0 : Number(addedStr || 0);
          const removed = removedStr === '-' ? 0 : Number(removedStr || 0);
          return { file, added, removed };
        });
      }
    } catch (err: any) {
      findings.push(`Failed to perform git diff: ${err.message}`);
      status = 'BLOCK';
    }
  } else if (checkpoint.backupPath && fs.existsSync(checkpoint.backupPath)) {
    // Non-Git diff implementation (Backup comparison)
    const { backupPath } = checkpoint;
    
    // Find all files in current directory and backup directory
    const getFilesRecursive = (dir: string, baseDir: string = dir): string[] => {
      let results: string[] = [];
      const ignore = ['.git', 'node_modules', '.jewel'];
      if (!fs.existsSync(dir)) return [];
      const list = fs.readdirSync(dir);
      for (const file of list) {
        if (ignore.includes(file)) continue;
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          results = results.concat(getFilesRecursive(filePath, baseDir));
        } else {
          results.push(path.relative(baseDir, filePath).replace(/\\/g, '/'));
        }
      }
      return results;
    };

    const currentFiles = getFilesRecursive(cwd);
    const backupFiles = getFilesRecursive(backupPath);
    const allFiles = Array.from(new Set([...currentFiles, ...backupFiles]));

    for (const file of allFiles) {
      const currentFilePath = path.join(cwd, file);
      const backupFilePath = path.join(backupPath, file);

      const existsNow = fs.existsSync(currentFilePath);
      const existedBefore = fs.existsSync(backupFilePath);

      if (!existedBefore && existsNow) {
        // File added
        const content = fs.readFileSync(currentFilePath, 'utf8');
        const lines = content.split('\n').length;
        changedFiles.push({ file, added: lines, removed: 0 });
      } else if (existedBefore && !existsNow) {
        // File deleted
        const content = fs.readFileSync(backupFilePath, 'utf8');
        const lines = content.split('\n').length;
        changedFiles.push({ file, added: 0, removed: lines });
      } else {
        // Modified - check line diff
        const currentContent = fs.readFileSync(currentFilePath, 'utf8');
        const backupContent = fs.readFileSync(backupFilePath, 'utf8');
        if (currentContent !== backupContent) {
          // Simple rough line-by-line diff or length diff
          const currentLines = currentContent.split('\n');
          const backupLines = backupContent.split('\n');
          // For simplicity, let's treat it as max changes
          const added = Math.max(0, currentLines.length - backupLines.length);
          const removed = Math.max(0, backupLines.length - currentLines.length);
          // ensure at least 1 change line is recorded if they are different
          changedFiles.push({ file, added: added || 1, removed: removed || 1 });
        }
      }
    }
  }

  // Count totals
  let totalAdded = 0;
  let totalRemoved = 0;
  const changedFileNames: string[] = [];

  for (const item of changedFiles) {
    totalAdded += item.added;
    totalRemoved += item.removed;
    changedFileNames.push(item.file);
  }

  const totalChangedLines = totalAdded + totalRemoved;

  // 1. Check maxFilesChanged
  if (changedFiles.length > config.maxFilesChanged) {
    findings.push(`Too many files changed: ${changedFiles.length} (limit: ${config.maxFilesChanged})`);
    status = 'BLOCK';
  }

  // 2. Check maxLinesChanged
  if (totalChangedLines > config.maxLinesChanged) {
    findings.push(`Too many lines changed: ${totalChangedLines} (limit: ${config.maxLinesChanged})`);
    status = 'BLOCK';
  }

  // 3. Detect protected files changed
  const protectedFilesChanged: string[] = [];
  const highRiskFilePrefixes = ['src/auth', 'src/payments', 'src/billing', 'src/security'];
  
  for (const file of changedFileNames) {
    const normFile = file.replace(/\\/g, '/');
    
    // Check general prefixes
    const matchesPrefix = highRiskFilePrefixes.some(p => normFile.startsWith(p));
    let matchesPattern = false;

    for (const pattern of config.protectedFiles) {
      const regexPattern = pattern
        .replace(/\./g, '\\.')
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*');
      const regex = new RegExp(`^${regexPattern}$`);
      if (regex.test(normFile)) {
        matchesPattern = true;
        break;
      }
    }

    if (matchesPrefix || matchesPattern) {
      protectedFilesChanged.push(file);
    }
  }

  if (protectedFilesChanged.length > 0) {
    findings.push(`Protected files modified: ${protectedFilesChanged.join(', ')}`);
    if (!config.allowProtectedFileChanges) {
      status = 'BLOCK';
    } else {
      status = 'WARN';
    }
  }

  // 4. Detect dependency changes in package.json
  let dependenciesChanged = false;
  if (changedFileNames.includes('package.json')) {
    try {
      let oldPkg: any = {};
      const currentPkgPath = path.join(cwd, 'package.json');
      const currentPkg = fs.existsSync(currentPkgPath) ? JSON.parse(fs.readFileSync(currentPkgPath, 'utf8')) : {};

      if (checkpoint.isGit && checkpoint.gitCheckpointSha) {
        try {
          const oldContent = execSync(`git show ${checkpoint.gitCheckpointSha}:package.json`, { cwd, encoding: 'utf8' });
          oldPkg = JSON.parse(oldContent);
        } catch {
          // Fallback if git show fails
        }
      } else if (checkpoint.backupPath) {
        const oldPkgPath = path.join(checkpoint.backupPath, 'package.json');
        if (fs.existsSync(oldPkgPath)) {
          oldPkg = JSON.parse(fs.readFileSync(oldPkgPath, 'utf8'));
        }
      }

      const checkDepsEqual = (d1: any = {}, d2: any = {}) => {
        const keys1 = Object.keys(d1);
        const keys2 = Object.keys(d2);
        if (keys1.length !== keys2.length) return false;
        for (const k of keys1) {
          if (d1[k] !== d2[k]) return false;
        }
        return true;
      };

      if (!checkDepsEqual(oldPkg.dependencies, currentPkg.dependencies) ||
          !checkDepsEqual(oldPkg.devDependencies, currentPkg.devDependencies) ||
          !checkDepsEqual(oldPkg.peerDependencies, currentPkg.peerDependencies)) {
        dependenciesChanged = true;
      }
    } catch {
      // If parsing fails, flag it conservatively
      dependenciesChanged = true;
    }
  }

  if (dependenciesChanged) {
    findings.push(`Dependencies in package.json modified.`);
    if (!config.allowNewDependencies) {
      status = 'BLOCK';
    } else if (status !== 'BLOCK') {
      status = 'WARN';
    }
  }

  // 5. Lockfiles changed
  const lockfiles = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lockb'];
  const lockfilesChanged = changedFileNames.filter(f => lockfiles.includes(path.basename(f)));
  
  if (lockfilesChanged.length > 0) {
    findings.push(`Lockfile(s) modified: ${lockfilesChanged.join(', ')}`);
    if (!config.allowNewDependencies && !config.allowProtectedFileChanges) {
      status = 'BLOCK';
    } else if (status !== 'BLOCK') {
      status = 'WARN';
    }
  }

  // 6. Deletion of folders / critical paths
  // If files count deleted is very high, warning or blocking
  const deletedFilesCount = changedFiles.filter(item => item.added === 0 && item.removed > 0).length;
  if (deletedFilesCount > 5) {
    findings.push(`Multiple files deleted (${deletedFilesCount} files). Potential dangerous directory deletion.`);
    status = 'BLOCK';
  }

  return {
    status,
    changedFilesCount: changedFiles.length,
    addedLinesCount: totalAdded,
    removedLinesCount: totalRemoved,
    changedFiles: changedFileNames,
    protectedFilesChanged,
    dependenciesChanged,
    lockfilesChanged,
    findings
  };
}
