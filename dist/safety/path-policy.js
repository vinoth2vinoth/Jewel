"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasWindowsDrivePrefix = hasWindowsDrivePrefix;
exports.isWindowsUNCPath = isWindowsUNCPath;
exports.isAnyAbsolutePath = isAnyAbsolutePath;
exports.normalizeRepoPath = normalizeRepoPath;
exports.isPathInsideRoot = isPathInsideRoot;
exports.assertPathInsideRoot = assertPathInsideRoot;
exports.matchesProtectedPattern = matchesProtectedPattern;
exports.isProtectedPath = isProtectedPath;
exports.isDependencyPath = isDependencyPath;
exports.isLockfilePath = isLockfilePath;
exports.isAbsoluteOrEscapingPath = isAbsoluteOrEscapingPath;
exports.isSafeRepoRelativePath = isSafeRepoRelativePath;
const path = __importStar(require("path"));
const minimatch_1 = require("minimatch");
function hasWindowsDrivePrefix(inputPath) {
    return /^[a-zA-Z]:[\\/]/.test(inputPath) || /^[a-zA-Z]:$/.test(inputPath);
}
function isWindowsUNCPath(inputPath) {
    return /^\\\\/.test(inputPath) || /^\/\//.test(inputPath);
}
function isAnyAbsolutePath(inputPath) {
    return path.isAbsolute(inputPath)
        || path.win32.isAbsolute(inputPath)
        || path.posix.isAbsolute(inputPath)
        || hasWindowsDrivePrefix(inputPath)
        || isWindowsUNCPath(inputPath);
}
function normalizeRepoPath(inputPath, root = process.cwd()) {
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
            if (rel.startsWith('/'))
                rel = rel.slice(1);
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
function isPathInsideRoot(root, candidate) {
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
function assertPathInsideRoot(root, candidate) {
    if (!isPathInsideRoot(root, candidate)) {
        throw new Error(`Path escape detected: "${candidate}" is outside the project root "${root}".`);
    }
}
function matchesProtectedPattern(repoPath, patterns) {
    if (repoPath.includes('\0')) {
        return true;
    }
    const normalized = repoPath.replace(/\\/g, '/');
    return patterns.some(pattern => {
        return (0, minimatch_1.minimatch)(normalized, pattern, { dot: true, matchBase: true }) ||
            (0, minimatch_1.minimatch)(normalized, pattern, { dot: true });
    });
}
function isProtectedPath(repoPath, config) {
    const norm = normalizeRepoPath(repoPath);
    return matchesProtectedPattern(norm, config.protectedFiles);
}
function isDependencyPath(repoPath) {
    const base = path.basename(repoPath);
    return base === 'package.json';
}
function isLockfilePath(repoPath) {
    const lockfiles = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lockb'];
    return lockfiles.includes(path.basename(repoPath));
}
function isAbsoluteOrEscapingPath(root, candidate) {
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
function isSafeRepoRelativePath(candidate) {
    if (!candidate)
        return false;
    if (candidate === '.' || candidate === '..')
        return false;
    if (candidate.includes('\0'))
        return false;
    // Normalize backslashes to forward slashes
    const normalized = candidate.replace(/\\/g, '/');
    // Reject UNC paths
    if (normalized.startsWith('//'))
        return false;
    // Reject POSIX absolute paths
    if (normalized.startsWith('/'))
        return false;
    // Reject Windows drive absolute or relative paths
    if (/^[a-zA-Z]:/.test(normalized))
        return false;
    const segments = normalized.split('/');
    // Reject empty path segments
    if (segments.some(segment => segment === ''))
        return false;
    // Reject parent traversal segment ".."
    if (segments.some(segment => segment === '..'))
        return false;
    // Reject current directory segment "."
    if (segments.some(segment => segment === '.'))
        return false;
    return true;
}
