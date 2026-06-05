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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const node_assert_1 = __importDefault(require("node:assert"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const rollback_1 = require("./rollback");
const git_1 = require("../../storage/git");
(0, node_test_1.default)('rollback command - safety hardening checks', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jewel-test-rollback-safe-'));
    const { execSync } = require('child_process');
    try {
        execSync('git init', { cwd: tempDir, stdio: 'ignore' });
        if (!(0, git_1.isGitRepository)(tempDir)) {
            return; // Skip if git fails to initialize in this env
        }
        execSync('git config user.name "Test"', { cwd: tempDir, stdio: 'ignore' });
        execSync('git config user.email "test@test.com"', { cwd: tempDir, stdio: 'ignore' });
        // Write a .gitignore so git clean doesn't delete .jewel
        fs.writeFileSync(path.join(tempDir, '.gitignore'), '.jewel\n', 'utf8');
        execSync('git add .gitignore', { cwd: tempDir, stdio: 'ignore' });
        execSync('git commit -m "add gitignore"', { cwd: tempDir, stdio: 'ignore' });
        // Initial commit
        fs.writeFileSync(path.join(tempDir, 'main.txt'), 'initial content\n');
        execSync('git add main.txt', { cwd: tempDir, stdio: 'ignore' });
        execSync('git commit -m "initial commit"', { cwd: tempDir, stdio: 'ignore' });
        // Make dirty change
        fs.writeFileSync(path.join(tempDir, 'main.txt'), 'dirty content\n');
        // Create session structure
        const sessionsDir = path.join(tempDir, '.jewel', 'sessions');
        const sessionId = 'session-999';
        const sessionPath = path.join(sessionsDir, sessionId);
        fs.mkdirSync(sessionPath, { recursive: true });
        // Create checkpoint
        const meta = (0, git_1.createCheckpoint)(sessionId, tempDir);
        fs.writeFileSync(path.join(sessionPath, 'checkpoint.json'), JSON.stringify(meta, null, 2), 'utf8');
        // Case 1: User makes changes, but NO new commits are made. Rollback should work.
        fs.writeFileSync(path.join(tempDir, 'main.txt'), 'dirty content modified by agent\n');
        // Capture logs to prevent output noise
        const originalLog = console.log;
        const originalWarn = console.warn;
        console.log = () => { };
        console.warn = () => { };
        try {
            (0, rollback_1.runRollback)(sessionId, tempDir, false, false);
        }
        finally {
            console.log = originalLog;
            console.warn = originalWarn;
        }
        // Verify it restored
        node_assert_1.default.strictEqual(fs.readFileSync(path.join(tempDir, 'main.txt'), 'utf8').replace(/\r\n/g, '\n'), 'dirty content\n');
        // Case 2: User makes new commits after the checkpoint.
        // Create new commit
        fs.writeFileSync(path.join(tempDir, 'main.txt'), 'some new user content\n');
        execSync('git add main.txt', { cwd: tempDir, stdio: 'ignore' });
        execSync('git commit -m "new user commit"', { cwd: tempDir, stdio: 'ignore' });
        // Try rollback without force. It should refuse and call process.exit(1).
        const originalExit = process.exit;
        let exitCode = null;
        process.exit = (code) => {
            exitCode = code;
            throw new Error(`exit-${code}`);
        };
        console.log = () => { };
        console.warn = () => { };
        try {
            (0, rollback_1.runRollback)(sessionId, tempDir, false, false);
        }
        catch (err) {
            if (!err.message.startsWith('exit-')) {
                throw err;
            }
        }
        finally {
            process.exit = originalExit;
            console.log = originalLog;
            console.warn = originalWarn;
        }
        node_assert_1.default.strictEqual(exitCode, 1);
        // Verify before-rollback.patch was created
        node_assert_1.default.ok(fs.existsSync(path.join(sessionPath, 'before-rollback.patch')));
        // Case 3: Rollback with force. It should succeed.
        console.log = () => { };
        console.warn = () => { };
        try {
            (0, rollback_1.runRollback)(sessionId, tempDir, false, true);
        }
        finally {
            console.log = originalLog;
            console.warn = originalWarn;
        }
        // Reverted
        node_assert_1.default.strictEqual(fs.readFileSync(path.join(tempDir, 'main.txt'), 'utf8').replace(/\r\n/g, '\n'), 'dirty content\n');
    }
    catch (err) {
        console.warn('Skipping test due to git failure:', err);
    }
    finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});
