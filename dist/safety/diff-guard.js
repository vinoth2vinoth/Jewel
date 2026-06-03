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
exports.runDiffGuard = runDiffGuard;
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const path_policy_1 = require("./path-policy");
function runDiffGuard(checkpoint, config, cwd = process.cwd()) {
    const findings = [];
    let status = 'PASS';
    let changedFiles = [];
    if (checkpoint.isGit && checkpoint.gitCheckpointSha) {
        // Git diff implementation
        try {
            const diffStat = (0, child_process_1.execSync)(`git diff --numstat ${checkpoint.gitCheckpointSha}`, {
                cwd,
                encoding: 'utf8'
            }).trim();
            let gitRoot = cwd;
            try {
                gitRoot = (0, child_process_1.execSync)('git rev-parse --show-toplevel', { cwd, encoding: 'utf8' }).trim();
            }
            catch { }
            if (diffStat) {
                changedFiles = diffStat.split('\n').map(line => {
                    const [addedStr, removedStr, file] = line.split(/\s+/);
                    const added = addedStr === '-' ? 0 : Number(addedStr || 0);
                    const removed = removedStr === '-' ? 0 : Number(removedStr || 0);
                    // Convert git-root relative path to cwd-relative path
                    const absolutePath = path.resolve(gitRoot, file);
                    const relativeToCwd = path.relative(cwd, absolutePath).replace(/\\/g, '/');
                    return { file: relativeToCwd, added, removed };
                });
            }
        }
        catch (err) {
            findings.push(`Failed to perform git diff: ${err.message}`);
            status = 'BLOCK';
        }
    }
    else if (checkpoint.backupPath && fs.existsSync(checkpoint.backupPath)) {
        // Non-Git diff implementation (Backup comparison)
        const { backupPath } = checkpoint;
        // Find all files in current directory and backup directory
        const getFilesRecursive = (dir, baseDir = dir) => {
            let results = [];
            const ignore = ['.git', 'node_modules', '.jewel'];
            if (!fs.existsSync(dir))
                return [];
            const list = fs.readdirSync(dir);
            for (const file of list) {
                if (ignore.includes(file))
                    continue;
                const filePath = path.join(dir, file);
                const stat = fs.statSync(filePath);
                if (stat.isDirectory()) {
                    results = results.concat(getFilesRecursive(filePath, baseDir));
                }
                else {
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
            }
            else if (existedBefore && !existsNow) {
                // File deleted
                const content = fs.readFileSync(backupFilePath, 'utf8');
                const lines = content.split('\n').length;
                changedFiles.push({ file, added: 0, removed: lines });
            }
            else {
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
    const changedFileNames = [];
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
    const protectedFilesChanged = [];
    for (const file of changedFileNames) {
        if ((0, path_policy_1.isProtectedPath)(file, config)) {
            protectedFilesChanged.push(file);
        }
    }
    if (protectedFilesChanged.length > 0) {
        findings.push(`Protected files modified: ${protectedFilesChanged.join(', ')}`);
        if (!config.allowProtectedFileChanges) {
            status = 'BLOCK';
        }
        else {
            status = 'WARN';
        }
    }
    // 4. Detect dependency changes in package.json
    let dependenciesChanged = false;
    if (changedFileNames.some(f => (0, path_policy_1.isDependencyPath)(f))) {
        try {
            let oldPkg = {};
            const currentPkgPath = path.join(cwd, 'package.json');
            const currentPkg = fs.existsSync(currentPkgPath) ? JSON.parse(fs.readFileSync(currentPkgPath, 'utf8')) : {};
            if (checkpoint.isGit && checkpoint.gitCheckpointSha) {
                try {
                    const oldContent = (0, child_process_1.execSync)(`git show ${checkpoint.gitCheckpointSha}:package.json`, { cwd, encoding: 'utf8' });
                    oldPkg = JSON.parse(oldContent);
                }
                catch {
                    // Fallback if git show fails
                }
            }
            else if (checkpoint.backupPath) {
                const oldPkgPath = path.join(checkpoint.backupPath, 'package.json');
                if (fs.existsSync(oldPkgPath)) {
                    oldPkg = JSON.parse(fs.readFileSync(oldPkgPath, 'utf8'));
                }
            }
            const checkDepsEqual = (d1 = {}, d2 = {}) => {
                const keys1 = Object.keys(d1);
                const keys2 = Object.keys(d2);
                if (keys1.length !== keys2.length)
                    return false;
                for (const k of keys1) {
                    if (d1[k] !== d2[k])
                        return false;
                }
                return true;
            };
            if (!checkDepsEqual(oldPkg.dependencies, currentPkg.dependencies) ||
                !checkDepsEqual(oldPkg.devDependencies, currentPkg.devDependencies) ||
                !checkDepsEqual(oldPkg.peerDependencies, currentPkg.peerDependencies)) {
                dependenciesChanged = true;
            }
        }
        catch {
            // If parsing fails, flag it conservatively
            dependenciesChanged = true;
        }
    }
    if (dependenciesChanged) {
        findings.push(`Dependencies in package.json modified.`);
        if (!config.allowNewDependencies) {
            status = 'BLOCK';
        }
        else if (status !== 'BLOCK') {
            status = 'WARN';
        }
    }
    // 5. Lockfiles changed
    const lockfilesChanged = changedFileNames.filter(f => (0, path_policy_1.isLockfilePath)(f));
    if (lockfilesChanged.length > 0) {
        findings.push(`Lockfile(s) modified: ${lockfilesChanged.join(', ')}`);
        if (!config.allowNewDependencies && !config.allowProtectedFileChanges) {
            status = 'BLOCK';
        }
        else if (status !== 'BLOCK') {
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
