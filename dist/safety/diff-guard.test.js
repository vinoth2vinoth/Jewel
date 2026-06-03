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
const diff_guard_1 = require("./diff-guard");
const config_1 = require("../core/config");
const sandboxDir = path.join(__dirname, '../../sandbox-test-diff');
function cleanupSandbox() {
    if (fs.existsSync(sandboxDir)) {
        fs.rmSync(sandboxDir, { recursive: true, force: true });
    }
}
(0, node_test_1.default)('diff guard - non-git file comparisons', () => {
    cleanupSandbox();
    const originalDir = path.join(sandboxDir, 'backup');
    const currentDir = path.join(sandboxDir, 'current');
    fs.mkdirSync(originalDir, { recursive: true });
    fs.mkdirSync(currentDir, { recursive: true });
    // Baseline files
    fs.writeFileSync(path.join(originalDir, 'file1.txt'), 'hello world\nline 2\n');
    fs.writeFileSync(path.join(originalDir, 'package.json'), JSON.stringify({ dependencies: { lodash: '^1.0.0' } }));
    // Working copy changes
    fs.writeFileSync(path.join(currentDir, 'file1.txt'), 'hello world\nline 2 modified\nline 3 added\n');
    fs.writeFileSync(path.join(currentDir, 'package.json'), JSON.stringify({ dependencies: { lodash: '^1.0.0' } })); // no dependency change
    const checkpoint = {
        timestamp: '123',
        isGit: false,
        backupPath: originalDir
    };
    const passConfig = {
        ...config_1.DEFAULT_CONFIG,
        maxFilesChanged: 5,
        maxLinesChanged: 50
    };
    // Test 1: Normal small diff passes
    const analysis1 = (0, diff_guard_1.runDiffGuard)(checkpoint, passConfig, currentDir);
    node_assert_1.default.strictEqual(analysis1.status, 'PASS');
    node_assert_1.default.strictEqual(analysis1.changedFilesCount, 1); // package.json should not count as modified since content matches
    node_assert_1.default.ok(analysis1.addedLinesCount > 0);
    // Test 2: Protected file change blocks
    fs.writeFileSync(path.join(currentDir, '.env'), 'SECRET=123'); // protected file added
    const analysis2 = (0, diff_guard_1.runDiffGuard)(checkpoint, passConfig, currentDir);
    node_assert_1.default.strictEqual(analysis2.status, 'BLOCK'); // because allowProtectedFileChanges is false by default
    node_assert_1.default.ok(analysis2.protectedFilesChanged.includes('.env'));
    // Test 3: Dependency change blocks
    fs.writeFileSync(path.join(currentDir, '.env'), ''); // clear it
    fs.writeFileSync(path.join(currentDir, 'package.json'), JSON.stringify({ dependencies: { lodash: '^1.0.0', axios: '^2.0.0' } })); // axios added
    const analysis3 = (0, diff_guard_1.runDiffGuard)(checkpoint, passConfig, currentDir);
    node_assert_1.default.strictEqual(analysis3.status, 'BLOCK'); // because allowNewDependencies is false by default
    node_assert_1.default.strictEqual(analysis3.dependenciesChanged, true);
    // Test 4: Too many files changed blocks
    const strictFilesConfig = {
        ...config_1.DEFAULT_CONFIG,
        maxFilesChanged: 1
    };
    fs.writeFileSync(path.join(currentDir, 'file2.txt'), 'new file');
    const analysis4 = (0, diff_guard_1.runDiffGuard)(checkpoint, strictFilesConfig, currentDir);
    node_assert_1.default.strictEqual(analysis4.status, 'BLOCK');
    node_assert_1.default.ok(analysis4.findings.some(f => f.includes('Too many files changed')));
    cleanupSandbox();
});
