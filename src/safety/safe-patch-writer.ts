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
  isAnyAbsolutePath
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

export function applyPatchProposalSafely(
  patchProposal: any,
  taskContract: TaskContract,
  config: JewelConfig,
  cwd: string = process.cwd()
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
  for (const file of patchProposal.files) {
    const error = validateProposedFile(file.filePath, file.content, taskContract, config, cwd);
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

  // Create parent folders only after all proposed files are validated.
  // Write files only after full validation succeeds.
  const appliedFiles: string[] = [];
  try {
    for (const file of patchProposal.files) {
      const targetPath = path.resolve(cwd, file.filePath);
      const parentDir = path.dirname(targetPath);
      
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      
      fs.writeFileSync(targetPath, file.content, 'utf8');
      appliedFiles.push(normalizeRepoPath(file.filePath, cwd));
    }
  } catch (err: any) {
    return {
      success: false,
      appliedFiles,
      blockedFiles: [{ filePath: 'write_failure', reason: `Failed writing files: ${err.message}` }]
    };
  }

  return {
    success: true,
    appliedFiles,
    blockedFiles: []
  };
}
