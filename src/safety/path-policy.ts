import * as path from 'path';
import { minimatch } from 'minimatch';
import { JewelConfig } from '../core/config';

export function hasWindowsDrivePrefix(inputPath: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(inputPath) || /^[a-zA-Z]:$/.test(inputPath);
}

export function isWindowsUNCPath(inputPath: string): boolean {
  return /^\\\\/.test(inputPath) || /^\/\//.test(inputPath);
}

export function isAnyAbsolutePath(inputPath: string): boolean {
  return path.isAbsolute(inputPath)
    || path.win32.isAbsolute(inputPath)
    || path.posix.isAbsolute(inputPath)
    || hasWindowsDrivePrefix(inputPath)
    || isWindowsUNCPath(inputPath);
}

export function normalizeRepoPath(inputPath: string, root: string = process.cwd()): string {
  if (inputPath.includes('\0')) {
    throw new Error('Path contains null bytes');
  }

  // Convert backslashes to forward slashes for repo relative paths
  let normalizedInput = inputPath.replace(/\\/g, '/');

  // If it's absolute, resolve it relative to root if it starts with root
  const resolvedRoot = path.resolve(root).replace(/\\/g, '/');

  if (isAnyAbsolutePath(normalizedInput)) {
    if (normalizedInput.toLowerCase().startsWith(resolvedRoot.toLowerCase())) {
      let rel = normalizedInput.slice(resolvedRoot.length);
      if (rel.startsWith('/')) rel = rel.slice(1);
      return rel;
    }
    
    // Otherwise fallback
    const strippedInput = normalizedInput.replace(/^[a-zA-Z]:/, '');
    const resolvedInput = path.resolve(root, strippedInput);
    const rel = path.relative(path.resolve(root), resolvedInput);
    return rel.replace(/\\/g, '/');
  }

  const resolvedInput = path.resolve(root, normalizedInput);
  const rel = path.relative(path.resolve(root), resolvedInput);
  return rel.replace(/\\/g, '/');
}

export function isPathInsideRoot(root: string, candidate: string): boolean {
  if (candidate.includes('\0') || root.includes('\0')) {
    return false;
  }

  // Reject raw drive letters alone (e.g., "C:" or "D:")
  if (/^[a-zA-Z]:$/.test(candidate)) {
    return false;
  }

  const normRoot = path.resolve(root).replace(/\\/g, '/');
  const normCandidate = candidate.replace(/\\/g, '/');

  if (isAnyAbsolutePath(normCandidate)) {
    const hasDrive = hasWindowsDrivePrefix(normCandidate) || hasWindowsDrivePrefix(normRoot);
    if (hasDrive) {
      return normCandidate.toLowerCase().startsWith(normRoot.toLowerCase());
    }
    return normCandidate.startsWith(normRoot);
  }

  // Resolve it relative to root
  const resolvedRoot = path.resolve(root);
  const resolvedCandidate = path.resolve(resolvedRoot, normCandidate);
  const relative = path.relative(resolvedRoot, resolvedCandidate);

  // If relative path starts with '..' or is absolute, it escapes root
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return false;
  }

  // Also guard against Windows drive mismatch where relative returns absolute drive letter path
  if (path.isAbsolute(relative.replace(/^\w:/, ''))) {
    return false;
  }

  return true;
}

export function assertPathInsideRoot(root: string, candidate: string): void {
  if (!isPathInsideRoot(root, candidate)) {
    throw new Error(`Path escape detected: "${candidate}" is outside the project root "${root}".`);
  }
}

export function matchesProtectedPattern(repoPath: string, patterns: string[]): boolean {
  if (repoPath.includes('\0')) {
    return true;
  }
  const normalized = repoPath.replace(/\\/g, '/');
  return patterns.some(pattern => {
    return minimatch(normalized, pattern, { dot: true, matchBase: true }) || 
           minimatch(normalized, pattern, { dot: true });
  });
}

export function isProtectedPath(repoPath: string, config: JewelConfig): boolean {
  const norm = normalizeRepoPath(repoPath);
  return matchesProtectedPattern(norm, config.protectedFiles);
}

export function isDependencyPath(repoPath: string): boolean {
  const base = path.basename(repoPath);
  return base === 'package.json';
}

export function isLockfilePath(repoPath: string): boolean {
  const lockfiles = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lockb'];
  return lockfiles.includes(path.basename(repoPath));
}

export function isAbsoluteOrEscapingPath(root: string, candidate: string): boolean {
  if (candidate.includes('\0')) {
    return true;
  }
  if (isAnyAbsolutePath(candidate)) {
    return true;
  }
  const normalized = candidate.replace(/\\/g, '/');
  const segments = normalized.split('/');
  if (segments.some(segment => segment === '..')) {
    return true;
  }
  return !isPathInsideRoot(root, candidate);
}

export function isSafeRepoRelativePath(candidate: string): boolean {
  if (!candidate) return false;
  if (candidate === '.' || candidate === '..') return false;
  if (candidate.includes('\0')) return false;

  // Normalize backslashes to forward slashes
  const normalized = candidate.replace(/\\/g, '/');

  // Reject UNC paths
  if (normalized.startsWith('//')) return false;

  // Reject POSIX absolute paths
  if (normalized.startsWith('/')) return false;

  // Reject Windows drive absolute or relative paths
  if (/^[a-zA-Z]:/.test(normalized)) return false;

  const segments = normalized.split('/');

  // Reject empty path segments
  if (segments.some(segment => segment === '')) return false;

  // Reject parent traversal segment ".."
  if (segments.some(segment => segment === '..')) return false;

  // Reject current directory segment "."
  if (segments.some(segment => segment === '.')) return false;

  return true;
}
