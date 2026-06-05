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
const child_process_1 = require("child_process");
const release_check_1 = require("./release-check");
function createMockReleaseWorkspace(version = '0.9.0', withDocs = true, withFiles = true) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jewel-release-check-test-'));
    // Git init
    (0, child_process_1.execSync)('git init', { cwd: tempDir, stdio: 'ignore' });
    (0, child_process_1.execSync)('git config user.name "Test"', { cwd: tempDir, stdio: 'ignore' });
    (0, child_process_1.execSync)('git config user.email "test@test.com"', { cwd: tempDir, stdio: 'ignore' });
    // package.json
    const filesList = withFiles ? ['bin', 'dist', 'docs'] : ['bin'];
    fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({
        name: 'jewel-cli-mock',
        version,
        files: filesList
    }, null, 2), 'utf8');
    // bin/jewel.js
    fs.mkdirSync(path.join(tempDir, 'bin'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'bin', 'jewel.js'), '// mock binary', 'utf8');
    // dist/cli/index.js
    fs.mkdirSync(path.join(tempDir, 'dist', 'cli'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'dist', 'cli', 'index.js'), `
    const args = process.argv.slice(2);
    if (args[0] === 'version') {
      console.log('Jewel version: ${version}');
    } else if (args[0] === '--help') {
      console.log('AI Coding Safety Harness - Help Menu');
    }
    `, 'utf8');
    // README.md
    fs.writeFileSync(path.join(tempDir, 'README.md'), '# Mock README', 'utf8');
    // docs
    if (withDocs) {
        fs.mkdirSync(path.join(tempDir, 'docs'), { recursive: true });
        fs.writeFileSync(path.join(tempDir, 'docs', 'windows-smoke-test.md'), '# Windows Smoke Test', 'utf8');
        fs.writeFileSync(path.join(tempDir, 'docs', 'real-provider-dogfood.md'), '# Real Provider Dogfood', 'utf8');
    }
    // commit so git status clean
    (0, child_process_1.execSync)('git add .', { cwd: tempDir, stdio: 'ignore' });
    (0, child_process_1.execSync)('git commit -m "initial"', { cwd: tempDir, stdio: 'ignore' });
    return tempDir;
}
function cleanupWorkspace(dir) {
    try {
        fs.rmSync(dir, { recursive: true, force: true });
    }
    catch { }
}
(0, node_test_1.default)('release-check - successful validation on compliant workspace', async () => {
    const originalExit = process.exit;
    const originalLog = console.log;
    let exitCode;
    process.exit = ((code) => {
        exitCode = code;
        return undefined;
    });
    const logs = [];
    console.log = (...args) => {
        logs.push(args.join(' '));
    };
    const workspace = createMockReleaseWorkspace('0.9.0', true, true);
    try {
        (0, release_check_1.runReleaseCheck)(workspace);
        node_assert_1.default.strictEqual(exitCode, 0);
        node_assert_1.default.ok(logs.some(log => log.includes('[PASS] Package version exists')));
        node_assert_1.default.ok(logs.some(log => log.includes('[PASS] bin/jewel.js exists')));
        node_assert_1.default.ok(logs.some(log => log.includes('[PASS] dist/ directory exists')));
        node_assert_1.default.ok(logs.some(log => log.includes('[PASS] README file exists')));
        node_assert_1.default.ok(logs.some(log => log.includes('[PASS] docs/ directory exists')));
        node_assert_1.default.ok(logs.some(log => log.includes('Release Readiness Checklist finished with 0 Failures')));
    }
    finally {
        process.exit = originalExit;
        console.log = originalLog;
        cleanupWorkspace(workspace);
    }
});
(0, node_test_1.default)('release-check - warns on missing docs and below version target', async () => {
    const originalExit = process.exit;
    const originalLog = console.log;
    let exitCode;
    process.exit = ((code) => {
        exitCode = code;
        return undefined;
    });
    const logs = [];
    console.log = (...args) => {
        logs.push(args.join(' '));
    };
    // version 0.7.0 is below current release target, and withDocs = false
    const workspace = createMockReleaseWorkspace('0.7.0', false, true);
    try {
        (0, release_check_1.runReleaseCheck)(workspace);
        // Since missing docs produces warnings (not failures), it should still exit with 0!
        node_assert_1.default.strictEqual(exitCode, 0);
        node_assert_1.default.ok(logs.some(log => log.includes('[WARN] Package version 0.7.0 is below current target 0.9.0.')));
        node_assert_1.default.ok(logs.some(log => log.includes('[WARN] docs/ directory is missing.')));
    }
    finally {
        process.exit = originalExit;
        console.log = originalLog;
        cleanupWorkspace(workspace);
    }
});
(0, node_test_1.default)('release-check - dogfood fixture check behaves correctly', async () => {
    const originalExit = process.exit;
    const originalLog = console.log;
    let exitCode;
    process.exit = ((code) => {
        exitCode = code;
        return undefined;
    });
    const logs = [];
    console.log = (...args) => {
        logs.push(args.join(' '));
    };
    const workspace = createMockReleaseWorkspace('0.9.0', true, true);
    fs.mkdirSync(path.join(workspace, 'scripts'), { recursive: true });
    try {
        // Scenario 1: verify script exits with 0 (fixture is broken/passes validation)
        fs.writeFileSync(path.join(workspace, 'scripts', 'verify-dogfood-fixture.js'), 'process.exit(0);', 'utf8');
        exitCode = undefined;
        logs.length = 0;
        (0, release_check_1.runReleaseCheck)(workspace);
        node_assert_1.default.strictEqual(exitCode, 0);
        node_assert_1.default.ok(logs.some(log => log.includes('[PASS] Dogfood fixture initial state is broken as expected.')));
        // Scenario 2: verify script exits with 1 (fixture is fixed/fails validation)
        fs.writeFileSync(path.join(workspace, 'scripts', 'verify-dogfood-fixture.js'), 'process.exit(1);', 'utf8');
        exitCode = undefined;
        logs.length = 0;
        (0, release_check_1.runReleaseCheck)(workspace);
        node_assert_1.default.strictEqual(exitCode, 1);
        node_assert_1.default.ok(logs.some(log => log.includes('[FAIL] Dogfood fixture is not broken. src/math.ts appears already fixed.')));
    }
    finally {
        process.exit = originalExit;
        console.log = originalLog;
        cleanupWorkspace(workspace);
    }
});
