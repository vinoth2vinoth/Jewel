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
exports.runStatus = runStatus;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const git_1 = require("../../storage/git");
function runStatus(cwd = process.cwd()) {
    console.log('--- Jewel Status Summary ---');
    // 1. Check initialization
    const configPath = path.join(cwd, 'jewel.config.json');
    if (!fs.existsSync(configPath)) {
        console.log('[-] Status: Jewel is not initialized in this directory.');
        console.log('    Run "jewel init" to get started.');
        return;
    }
    console.log('[+] Initialization: Jewel is initialized in this workspace.');
    // 2. Check Git state
    const isGit = (0, git_1.isGitRepository)(cwd);
    console.log(`[+] Version Control: ${isGit ? 'Git repository' : 'Local folder (no Git)'}`);
    if (isGit) {
        const gitStatus = (0, git_1.getGitStatus)(cwd);
        if (gitStatus) {
            console.log('    Working tree status: Dirty (uncommitted changes exist)');
        }
        else {
            console.log('    Working tree status: Clean');
        }
    }
    // 3. Scan sessions
    const sessionsDir = path.join(cwd, '.jewel', 'sessions');
    if (fs.existsSync(sessionsDir)) {
        const entries = fs.readdirSync(sessionsDir).filter(f => f.startsWith('session-'));
        console.log(`\nSessions tracked: ${entries.length}`);
        if (entries.length > 0) {
            // Sort sessions descending by folder name (timestamp based)
            const sorted = entries.sort((a, b) => b.localeCompare(a)).slice(0, 5);
            console.log('Recent 5 Sessions:');
            for (const entry of sorted) {
                const contractPath = path.join(sessionsDir, entry, 'task-contract.json');
                if (fs.existsSync(contractPath)) {
                    try {
                        const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
                        console.log(`  - ${entry}: "${contract.task}" (Risk: ${contract.riskLevel}, Created: ${contract.createdAt})`);
                    }
                    catch {
                        console.log(`  - ${entry}: Malformed task contract`);
                    }
                }
                else {
                    console.log(`  - ${entry}: Missing task contract`);
                }
            }
        }
    }
    else {
        console.log('\nSessions tracked: 0 (No sessions folder found)');
    }
    // 4. Latest Report summary
    const latestReportPath = path.join(cwd, '.jewel', 'reports', 'latest.json');
    if (fs.existsSync(latestReportPath)) {
        try {
            const latest = JSON.parse(fs.readFileSync(latestReportPath, 'utf8'));
            console.log(`\nLatest Verification Report (${latest.date}):`);
            console.log(`  Overall Status: ${latest.overallStatus}`);
            console.log(`  Passed commands: ${latest.stats.passed}`);
            console.log(`  Failed commands: ${latest.stats.failed}`);
        }
        catch {
            console.log('\nLatest report JSON is malformed.');
        }
    }
}
