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
exports.runDiff = runDiff;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const config_1 = require("../../core/config");
const diff_guard_1 = require("../../safety/diff-guard");
function runDiff(sessionIdInput, cwd = process.cwd()) {
    let sessionId = sessionIdInput;
    const sessionsDir = path.join(cwd, '.jewel', 'sessions');
    if (!sessionId) {
        if (!fs.existsSync(sessionsDir)) {
            console.error('Error: No sessions found. Run a task first.');
            process.exit(1);
        }
        const sessions = fs.readdirSync(sessionsDir).filter(f => f.startsWith('session-'));
        if (sessions.length === 0) {
            console.error('Error: No sessions found. Run a task first.');
            process.exit(1);
        }
        sessions.sort();
        sessionId = sessions[sessions.length - 1];
    }
    const sessionPath = path.join(sessionsDir, sessionId);
    const checkpointPath = path.join(sessionPath, 'checkpoint.json');
    if (!fs.existsSync(checkpointPath)) {
        console.error(`Error: Checkpoint file not found for session "${sessionId}".`);
        process.exit(1);
    }
    const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, 'utf8'));
    let config;
    try {
        config = (0, config_1.loadConfig)(cwd);
    }
    catch {
        const { DEFAULT_CONFIG } = require('../../core/config');
        config = DEFAULT_CONFIG;
    }
    const diffAnalysis = (0, diff_guard_1.runDiffGuard)(checkpoint, config, cwd);
    console.log(`\n=== Jewel Diff (Session: ${sessionId}) ===`);
    console.log(`Changed Files (${diffAnalysis.changedFiles.length}):`);
    for (const file of diffAnalysis.changedFiles) {
        console.log(`  - ${file}`);
    }
    console.log(`Total Added Lines: ${diffAnalysis.addedLinesCount}`);
    console.log(`Total Removed Lines: ${diffAnalysis.removedLinesCount}`);
    if (diffAnalysis.protectedFilesChanged.length > 0) {
        console.warn(`\n[WARNING] Protected files modified:`);
        for (const file of diffAnalysis.protectedFilesChanged) {
            console.warn(`  ! ${file}`);
        }
    }
    console.log('\nGit Diff Preview:');
    if (checkpoint.isGit && checkpoint.gitCheckpointSha) {
        try {
            (0, child_process_1.execSync)(`git diff ${checkpoint.gitCheckpointSha}`, {
                cwd,
                stdio: 'inherit',
                env: { ...process.env, PAGER: 'cat' }
            });
        }
        catch (err) {
            console.log(`(Failed to print git diff: ${err.message})`);
        }
    }
    else {
        console.log('(Git diff preview is not available in non-Git backup mode)');
    }
    console.log('======================================\n');
}
