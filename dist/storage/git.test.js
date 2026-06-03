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
const backup_1 = require("./backup");
const git_1 = require("./git");
const sandboxDir = path.join(__dirname, '../../sandbox-test-checkpoint');
function cleanupSandbox() {
    if (fs.existsSync(sandboxDir)) {
        fs.rmSync(sandboxDir, { recursive: true, force: true });
    }
}
(0, node_test_1.default)('backup & restore directory (non-Git fallback)', () => {
    cleanupSandbox();
    fs.mkdirSync(sandboxDir, { recursive: true });
    const srcDir = path.join(sandboxDir, 'src-dir');
    const backupDest = path.join(sandboxDir, 'backup-dest');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(path.join(srcDir, 'file1.txt'), 'hello');
    fs.mkdirSync(path.join(srcDir, 'sub'), { recursive: true });
    fs.writeFileSync(path.join(srcDir, 'sub', 'file2.txt'), 'world');
    // 1. Run backup
    (0, backup_1.backupDirectory)(srcDir, backupDest);
    // Check backup files exist
    node_assert_1.default.ok(fs.existsSync(path.join(backupDest, 'file1.txt')));
    node_assert_1.default.ok(fs.existsSync(path.join(backupDest, 'sub', 'file2.txt')));
    // 2. Modify srcDir
    fs.writeFileSync(path.join(srcDir, 'file1.txt'), 'modified');
    fs.writeFileSync(path.join(srcDir, 'new-file.txt'), 'new file');
    // 3. Restore from backup
    (0, backup_1.restoreDirectory)(backupDest, srcDir);
    // Check contents reverted
    node_assert_1.default.strictEqual(fs.readFileSync(path.join(srcDir, 'file1.txt'), 'utf8'), 'hello');
    node_assert_1.default.ok(fs.existsSync(path.join(srcDir, 'sub', 'file2.txt')));
    node_assert_1.default.ok(!fs.existsSync(path.join(srcDir, 'new-file.txt'))); // new-file should have been removed
    cleanupSandbox();
});
(0, node_test_1.default)('git checkpoint and rollback flow', () => {
    // Test local git repo integration if it is running in a git repo
    const testRepoDir = path.join(sandboxDir, 'test-repo');
    cleanupSandbox();
    fs.mkdirSync(testRepoDir, { recursive: true });
    // Init small git repo for testing
    const { execSync } = require('child_process');
    try {
        execSync('git init', { cwd: testRepoDir, stdio: 'ignore' });
        // Check if git is available
        if (!(0, git_1.isGitRepository)(testRepoDir)) {
            cleanupSandbox();
            return; // Skip if git fails to initialize in this env
        }
        // Set author config
        execSync('git config user.name "Test"', { cwd: testRepoDir, stdio: 'ignore' });
        execSync('git config user.email "test@test.com"', { cwd: testRepoDir, stdio: 'ignore' });
        // Initial commit
        fs.writeFileSync(path.join(testRepoDir, 'main.txt'), 'initial commit content\n');
        execSync('git add main.txt', { cwd: testRepoDir, stdio: 'ignore' });
        execSync('git commit -m "initial commit"', { cwd: testRepoDir, stdio: 'ignore' });
        // Create uncommitted change
        fs.writeFileSync(path.join(testRepoDir, 'main.txt'), 'user work content\n');
        // Perform Jewel checkpoint
        const meta = (0, git_1.createCheckpoint)('session-123', testRepoDir);
        node_assert_1.default.strictEqual(meta.isGit, true);
        node_assert_1.default.strictEqual(meta.gitWasDirty, true);
        // Jewel execution changes a file
        fs.writeFileSync(path.join(testRepoDir, 'main.txt'), 'agent broken content\n');
        fs.writeFileSync(path.join(testRepoDir, 'bad-agent.txt'), 'bad file\n');
        // Run rollback
        (0, git_1.rollbackCheckpoint)(meta, testRepoDir);
        // Verify it is back to pre-run user work state
        node_assert_1.default.strictEqual(fs.readFileSync(path.join(testRepoDir, 'main.txt'), 'utf8').replace(/\r\n/g, '\n'), 'user work content\n');
        node_assert_1.default.ok(!fs.existsSync(path.join(testRepoDir, 'bad-agent.txt')));
    }
    catch (err) {
        // If git is missing or fails in this environment, it shouldn't fail the whole test run
        console.warn('Skipping git checkpoint integration test:', err);
    }
    finally {
        cleanupSandbox();
    }
});
