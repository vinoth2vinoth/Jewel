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
exports.isGitRepository = isGitRepository;
exports.getGitStatus = getGitStatus;
exports.getGitHead = getGitHead;
exports.createCheckpoint = createCheckpoint;
exports.rollbackCheckpoint = rollbackCheckpoint;
exports.revertFileToCheckpoint = revertFileToCheckpoint;
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
function isGitRepository(cwd = process.cwd()) {
    try {
        (0, child_process_1.execSync)('git rev-parse --is-inside-work-tree', { cwd, stdio: 'ignore' });
        return true;
    }
    catch {
        return false;
    }
}
function getGitStatus(cwd = process.cwd()) {
    try {
        return (0, child_process_1.execSync)('git status --porcelain', { cwd, encoding: 'utf8' }).trim();
    }
    catch {
        return '';
    }
}
function getGitHead(cwd = process.cwd()) {
    try {
        return (0, child_process_1.execSync)('git rev-parse HEAD', { cwd, encoding: 'utf8' }).trim();
    }
    catch {
        return '';
    }
}
function createCheckpoint(sessionId, cwd = process.cwd()) {
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
            (0, child_process_1.execSync)('git config user.name', { cwd, stdio: 'ignore' });
        }
        catch {
            hasGitConfig = false;
        }
        const configEnv = { ...process.env };
        if (!hasGitConfig) {
            configEnv.GIT_AUTHOR_NAME = 'Jewel Harness';
            configEnv.GIT_AUTHOR_EMAIL = 'jewel@harness.local';
            configEnv.GIT_COMMITTER_NAME = 'Jewel Harness';
            configEnv.GIT_COMMITTER_EMAIL = 'jewel@harness.local';
        }
        (0, child_process_1.execSync)('git add -A', { cwd, stdio: 'ignore' });
        (0, child_process_1.execSync)(`git commit -m "jewel-checkpoint-${sessionId}" --no-verify`, {
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
    }
    catch (err) {
        throw new Error(`Failed to create git checkpoint: ${err.message}`);
    }
}
function rollbackCheckpoint(metadata, cwd = process.cwd()) {
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
        (0, child_process_1.execSync)(`git reset --hard ${checkpointSha}`, { cwd, stdio: 'ignore' });
        (0, child_process_1.execSync)('git clean -fd', { cwd, stdio: 'ignore' });
        // If it was originally dirty, we committed those changes to gitCheckpointSha.
        // We soft-reset by 1 commit to bring those changes back as uncommitted working changes.
        if (metadata.gitWasDirty && metadata.gitCommitSha) {
            (0, child_process_1.execSync)('git reset HEAD~1', { cwd, stdio: 'ignore' });
        }
    }
    catch (err) {
        throw new Error(`Failed to rollback git checkpoint: ${err.message}`);
    }
}
function revertFileToCheckpoint(file, checkpoint, cwd = process.cwd()) {
    const absolutePath = path.resolve(cwd, file);
    if (checkpoint.isGit && checkpoint.gitCheckpointSha) {
        try {
            // Check if file existed in checkpoint commit
            let fileExisted = false;
            try {
                (0, child_process_1.execSync)(`git show ${checkpoint.gitCheckpointSha}:"${file}"`, { cwd, stdio: 'ignore' });
                fileExisted = true;
            }
            catch { }
            if (fileExisted) {
                (0, child_process_1.execSync)(`git checkout ${checkpoint.gitCheckpointSha} -- "${file}"`, { cwd, stdio: 'ignore' });
            }
            else {
                // Did not exist - delete from disk
                if (fs.existsSync(absolutePath)) {
                    fs.unlinkSync(absolutePath);
                }
                // Remove from git index
                try {
                    (0, child_process_1.execSync)(`git rm --cached -f "${file}"`, { cwd, stdio: 'ignore' });
                }
                catch { }
            }
        }
        catch (err) {
            console.warn(`[Warning] Failed to revert file ${file} via Git: ${err.message}`);
        }
    }
    else if (checkpoint.backupPath) {
        const backupFilePath = path.join(checkpoint.backupPath, file);
        if (fs.existsSync(backupFilePath)) {
            try {
                // Ensure parent directory exists for deeply nested files
                fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
                fs.copyFileSync(backupFilePath, absolutePath);
            }
            catch (err) {
                console.warn(`[Warning] Failed to restore backup for ${file}: ${err.message}`);
            }
        }
        else {
            try {
                if (fs.existsSync(absolutePath)) {
                    fs.unlinkSync(absolutePath);
                }
            }
            catch (err) {
                console.warn(`[Warning] Failed to delete temporary file ${file}: ${err.message}`);
            }
        }
    }
}
