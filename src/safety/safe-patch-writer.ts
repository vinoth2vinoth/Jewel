import * as fs from 'fs';
import * as path from 'path';
import { JewelConfig } from '../core/config';
import { TaskContract } from '../core/session';
import { 
  normalizeRepoPath, 
  isPathInsideRoot, 
  isProtectedPath, 
  isDependencyPath, 
  isLockfilePath, 
  isAbsoluteOrEscapingPath,
  isAnyAbsolutePath,
  isSafeRepoRelativePath
} from './path-policy';

export interface BlockedFile {
  filePath: string;
  reason: string;
}

export interface SafePatchResult {
  success: boolean;
  appliedFiles: string[];
  blockedFiles: BlockedFile[];
}

function validateProposedFile(
  filePath: string,
  content: string,
  taskContract: TaskContract,
  config: JewelConfig,
  cwd: string
): string | null {
  // Strict repo-relative path check
  if (!isSafeRepoRelativePath(filePath)) {
    return 'Unsafe patch path. Patch paths must be clean repo-relative paths with no absolute path, drive prefix, UNC path, null byte, or parent traversal.';
  }

  // 0. Reject null bytes in path.
  if (filePath.includes('\0')) {
    return `Path contains null bytes: "${filePath}"`;
  }

  // 2. Reject absolute paths.
  if (isAnyAbsolutePath(filePath)) {
    return `Path is absolute: "${filePath}"`;
  }

  // 3. Reject paths containing ../ that escape the project root.
  // 4. Resolve every target path and confirm it stays inside cwd.
  if (isAbsoluteOrEscapingPath(cwd, filePath)) {
    return `Path escapes the project root: "${filePath}"`;
  }

  // 5. Reject symlink target escapes.
  try {
    let current = cwd;
    const parts = filePath.split(/[/\\]/);
    for (const part of parts) {
      if (!part || part === '.') continue;
      if (part === '..') {
        current = path.dirname(current);
        if (!isPathInsideRoot(cwd, current)) {
          return `Path escapes the project root via parent segment: "${filePath}"`;
        }
        continue;
      }
      current = path.join(current, part);
      if (fs.existsSync(current)) {
        const real = fs.realpathSync(current);
        if (!isPathInsideRoot(cwd, real)) {
          return `Path escapes the project root via symlink: "${filePath}" (resolves to "${real}")`;
        }
      }
    }
  } catch (err: any) {
    return `Failed to resolve path safety: ${err.message}`;
  }

  const normPath = normalizeRepoPath(filePath, cwd);

  // 7. Reject package.json dependency changes unless allowNewDependencies is true.
  if (isDependencyPath(normPath)) {
    const pkgJsonPath = path.join(cwd, normPath);
    const existingContent = fs.existsSync(pkgJsonPath) ? fs.readFileSync(pkgJsonPath, 'utf8') : '';
    try {
      const current = existingContent ? JSON.parse(existingContent) : {};
      const proposed = JSON.parse(content);
      
      const checkDepsEqual = (d1: any = {}, d2: any = {}) => {
        const keys1 = Object.keys(d1 || {});
        const keys2 = Object.keys(d2 || {});
        if (keys1.length !== keys2.length) return false;
        for (const k of keys1) {
          if (d1[k] !== d2[k]) return false;
        }
        return true;
      };

      const hasDepChanges = 
        !checkDepsEqual(current.dependencies, proposed.dependencies) ||
        !checkDepsEqual(current.devDependencies, proposed.devDependencies) ||
        !checkDepsEqual(current.peerDependencies, proposed.peerDependencies);

      if (hasDepChanges && !config.allowNewDependencies) {
        return `Modifying package.json dependencies is not allowed by configuration.`;
      }
    } catch (err: any) {
      return `Proposed package.json is invalid JSON: ${err.message}`;
    }
  }

  // 8. Reject lockfile writes unless dependency changes are approved.
  if (isLockfilePath(normPath) && !config.allowNewDependencies) {
    return `Writing to lockfile "${normPath}" is not allowed unless dependency changes are approved.`;
  }

  // 6. Reject protected file writes unless allowProtectedFileChanges is true.
  if (isProtectedPath(normPath, config) && !config.allowProtectedFileChanges) {
    return `Writing to protected file "${normPath}" is not allowed by configuration.`;
  }

  // 9. Reject writes outside taskContract.filesLikelyNeeded when mode is strict.
  if (taskContract.mode === 'strict') {
    const allowedNormalized = (taskContract.filesLikelyNeeded || []).map(f => normalizeRepoPath(f, cwd));
    if (!allowedNormalized.includes(normPath)) {
      return `Writing to undeclared file "${normPath}" is blocked in strict mode.`;
    }
  }

  return null;
}

export function applySearchReplaceEdits(
  originalContent: string,
  edits: Array<{ search: string; replace: string }>
): { content: string; error?: string } {
  let content = originalContent;
  for (let i = 0; i < edits.length; i++) {
    const edit = edits[i];
    if (!content.includes(edit.search)) {
      return {
        content: originalContent,
        error: `Edit ${i + 1} search string not found in file.`
      };
    }
    content = content.replace(edit.search, edit.replace);
  }
  return { content };
}

function resolveFileContent(
  file: { filePath: string; content?: string; edits?: Array<{ search: string; replace: string }> },
  cwd: string
): { content: string; error?: string } {
  if (typeof file.content === 'string' && (!file.edits || file.edits.length === 0)) {
    return { content: file.content };
  }

  const targetPath = path.resolve(cwd, file.filePath);
  if (!fs.existsSync(targetPath)) {
    if (file.edits && file.edits.length > 0) {
      return { content: '', error: `Cannot apply edits to non-existent file "${file.filePath}".` };
    }
    return { content: file.content || '' };
  }

  const original = fs.readFileSync(targetPath, 'utf8');
  if (file.edits && file.edits.length > 0) {
    return applySearchReplaceEdits(original, file.edits);
  }
  return { content: file.content || '' };
}

export function applyPatchProposalSafely(
  patchProposal: any,
  taskContract: TaskContract,
  config: JewelConfig,
  cwd: string = process.cwd(),
  sessionPath?: string
): SafePatchResult {
  const blockedFiles: BlockedFile[] = [];

  if (!patchProposal || !Array.isArray(patchProposal.files)) {
    return {
      success: false,
      appliedFiles: [],
      blockedFiles: [{ filePath: 'proposal', reason: 'Patch proposal files must be an array.' }]
    };
  }

  // Validate all proposed files before writing anything.
  const resolvedContents: Map<string, string> = new Map();
  for (const file of patchProposal.files) {
    const resolved = resolveFileContent(file, cwd);
    if (resolved.error) {
      blockedFiles.push({
        filePath: file.filePath,
        reason: resolved.error
      });
      continue;
    }
    resolvedContents.set(file.filePath, resolved.content);
    const error = validateProposedFile(file.filePath, resolved.content, taskContract, config, cwd);
    if (error) {
      blockedFiles.push({
        filePath: file.filePath,
        reason: error
      });
    }
  }

  // If one proposed file is blocked, write nothing. Never write partial patches.
  if (blockedFiles.length > 0) {
    return {
      success: false,
      appliedFiles: [],
      blockedFiles
    };
  }

  // 1. Take snapshots of original contents and existence state of target files
  const snapshots: { filePath: string; exists: boolean; content?: string }[] = [];
  for (const file of patchProposal.files) {
    const targetPath = path.resolve(cwd, file.filePath);
    const exists = fs.existsSync(targetPath);
    if (exists) {
      try {
        const content = fs.readFileSync(targetPath, 'utf8');
        snapshots.push({ filePath: targetPath, exists, content });
      } catch (err) {
        // Fallback if file exists but is not readable (e.g., directory)
        snapshots.push({ filePath: targetPath, exists });
      }
    } else {
      snapshots.push({ filePath: targetPath, exists });
    }
  }

  // 2. Write files in a transaction-like loop
  const appliedFiles: string[] = [];
  const newlyCreatedFiles: string[] = [];
  try {
    for (const file of patchProposal.files) {
      const targetPath = path.resolve(cwd, file.filePath);
      const parentDir = path.dirname(targetPath);
      const existedBefore = fs.existsSync(targetPath);

      if (!existedBefore) {
        newlyCreatedFiles.push(targetPath);
      }

      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      
      fs.writeFileSync(targetPath, resolvedContents.get(file.filePath) ?? file.content ?? '', 'utf8');
      appliedFiles.push(normalizeRepoPath(file.filePath, cwd));
    }
  } catch (err: any) {
    // Write failure: Rollback all changes
    for (const snapshot of snapshots) {
      if (snapshot.exists && snapshot.content !== undefined) {
        try {
          fs.writeFileSync(snapshot.filePath, snapshot.content, 'utf8');
        } catch {}
      }
    }
    for (const newFilePath of newlyCreatedFiles) {
      try {
        if (fs.existsSync(newFilePath)) {
          // If it was created as a directory, remove directory, otherwise unlink file
          const stats = fs.statSync(newFilePath);
          if (stats.isDirectory()) {
            fs.rmSync(newFilePath, { recursive: true, force: true });
          } else {
            fs.unlinkSync(newFilePath);
          }
        }
      } catch {}
    }

    // Save recovery details inside the session directory if provided
    if (sessionPath) {
      try {
        const recoveryData = {
          timestamp: new Date().toISOString(),
          error: err.message,
          snapshots: snapshots.map(s => ({
            filePath: s.filePath,
            existed: s.exists,
            contentLength: s.content?.length
          })),
          newlyCreatedDeleted: newlyCreatedFiles
        };
        const recoveryDir = path.join(sessionPath, 'recovery');
        if (!fs.existsSync(recoveryDir)) {
          fs.mkdirSync(recoveryDir, { recursive: true });
        }
        fs.writeFileSync(
          path.join(recoveryDir, 'write-failure-recovery.json'),
          JSON.stringify(recoveryData, null, 2),
          'utf8'
        );
      } catch {}
    }

    return {
      success: false,
      appliedFiles: [],
      blockedFiles: [{ filePath: 'write_failure', reason: `Failed writing files: ${err.message}. Rollback successful.` }]
    };
  }

  return {
    success: true,
    appliedFiles,
    blockedFiles: []
  };
}
