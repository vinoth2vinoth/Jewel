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
exports.applyPatchProposalSafely = applyPatchProposalSafely;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const path_policy_1 = require("./path-policy");
function validateProposedFile(filePath, content, taskContract, config, cwd) {
    // Strict repo-relative path check
    if (!(0, path_policy_1.isSafeRepoRelativePath)(filePath)) {
        return 'Unsafe patch path. Patch paths must be clean repo-relative paths with no absolute path, drive prefix, UNC path, null byte, or parent traversal.';
    }
    // 0. Reject null bytes in path.
    if (filePath.includes('\0')) {
        return `Path contains null bytes: "${filePath}"`;
    }
    // 2. Reject absolute paths.
    if ((0, path_policy_1.isAnyAbsolutePath)(filePath)) {
        return `Path is absolute: "${filePath}"`;
    }
    // 3. Reject paths containing ../ that escape the project root.
    // 4. Resolve every target path and confirm it stays inside cwd.
    if ((0, path_policy_1.isAbsoluteOrEscapingPath)(cwd, filePath)) {
        return `Path escapes the project root: "${filePath}"`;
    }
    // 5. Reject symlink target escapes.
    try {
        let current = cwd;
        const parts = filePath.split(/[/\\]/);
        for (const part of parts) {
            if (!part || part === '.')
                continue;
            if (part === '..') {
                current = path.dirname(current);
                if (!(0, path_policy_1.isPathInsideRoot)(cwd, current)) {
                    return `Path escapes the project root via parent segment: "${filePath}"`;
                }
                continue;
            }
            current = path.join(current, part);
            if (fs.existsSync(current)) {
                const real = fs.realpathSync(current);
                if (!(0, path_policy_1.isPathInsideRoot)(cwd, real)) {
                    return `Path escapes the project root via symlink: "${filePath}" (resolves to "${real}")`;
                }
            }
        }
    }
    catch (err) {
        return `Failed to resolve path safety: ${err.message}`;
    }
    const normPath = (0, path_policy_1.normalizeRepoPath)(filePath, cwd);
    // 7. Reject package.json dependency changes unless allowNewDependencies is true.
    if ((0, path_policy_1.isDependencyPath)(normPath)) {
        const pkgJsonPath = path.join(cwd, normPath);
        const existingContent = fs.existsSync(pkgJsonPath) ? fs.readFileSync(pkgJsonPath, 'utf8') : '';
        try {
            const current = existingContent ? JSON.parse(existingContent) : {};
            const proposed = JSON.parse(content);
            const checkDepsEqual = (d1 = {}, d2 = {}) => {
                const keys1 = Object.keys(d1 || {});
                const keys2 = Object.keys(d2 || {});
                if (keys1.length !== keys2.length)
                    return false;
                for (const k of keys1) {
                    if (d1[k] !== d2[k])
                        return false;
                }
                return true;
            };
            const hasDepChanges = !checkDepsEqual(current.dependencies, proposed.dependencies) ||
                !checkDepsEqual(current.devDependencies, proposed.devDependencies) ||
                !checkDepsEqual(current.peerDependencies, proposed.peerDependencies);
            if (hasDepChanges && !config.allowNewDependencies) {
                return `Modifying package.json dependencies is not allowed by configuration.`;
            }
        }
        catch (err) {
            return `Proposed package.json is invalid JSON: ${err.message}`;
        }
    }
    // 8. Reject lockfile writes unless dependency changes are approved.
    if ((0, path_policy_1.isLockfilePath)(normPath) && !config.allowNewDependencies) {
        return `Writing to lockfile "${normPath}" is not allowed unless dependency changes are approved.`;
    }
    // 6. Reject protected file writes unless allowProtectedFileChanges is true.
    if ((0, path_policy_1.isProtectedPath)(normPath, config) && !config.allowProtectedFileChanges) {
        return `Writing to protected file "${normPath}" is not allowed by configuration.`;
    }
    // 9. Reject writes outside taskContract.filesLikelyNeeded when mode is strict.
    if (taskContract.mode === 'strict') {
        const allowedNormalized = (taskContract.filesLikelyNeeded || []).map(f => (0, path_policy_1.normalizeRepoPath)(f, cwd));
        if (!allowedNormalized.includes(normPath)) {
            return `Writing to undeclared file "${normPath}" is blocked in strict mode.`;
        }
    }
    return null;
}
function applyPatchProposalSafely(patchProposal, taskContract, config, cwd = process.cwd(), sessionPath) {
    const blockedFiles = [];
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
    // 1. Take snapshots of original contents and existence state of target files
    const snapshots = [];
    for (const file of patchProposal.files) {
        const targetPath = path.resolve(cwd, file.filePath);
        const exists = fs.existsSync(targetPath);
        if (exists) {
            try {
                const content = fs.readFileSync(targetPath, 'utf8');
                snapshots.push({ filePath: targetPath, exists, content });
            }
            catch (err) {
                // Fallback if file exists but is not readable (e.g., directory)
                snapshots.push({ filePath: targetPath, exists });
            }
        }
        else {
            snapshots.push({ filePath: targetPath, exists });
        }
    }
    // 2. Write files in a transaction-like loop
    const appliedFiles = [];
    const newlyCreatedFiles = [];
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
            fs.writeFileSync(targetPath, file.content, 'utf8');
            appliedFiles.push((0, path_policy_1.normalizeRepoPath)(file.filePath, cwd));
        }
    }
    catch (err) {
        // Write failure: Rollback all changes
        for (const snapshot of snapshots) {
            if (snapshot.exists && snapshot.content !== undefined) {
                try {
                    fs.writeFileSync(snapshot.filePath, snapshot.content, 'utf8');
                }
                catch { }
            }
        }
        for (const newFilePath of newlyCreatedFiles) {
            try {
                if (fs.existsSync(newFilePath)) {
                    // If it was created as a directory, remove directory, otherwise unlink file
                    const stats = fs.statSync(newFilePath);
                    if (stats.isDirectory()) {
                        fs.rmSync(newFilePath, { recursive: true, force: true });
                    }
                    else {
                        fs.unlinkSync(newFilePath);
                    }
                }
            }
            catch { }
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
                fs.writeFileSync(path.join(recoveryDir, 'write-failure-recovery.json'), JSON.stringify(recoveryData, null, 2), 'utf8');
            }
            catch { }
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
