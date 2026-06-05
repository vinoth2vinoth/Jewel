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
(0, node_test_1.default)('diff guard - AST signature changes', () => {
    cleanupSandbox();
    const originalDir = path.join(sandboxDir, 'backup');
    const currentDir = path.join(sandboxDir, 'current');
    fs.mkdirSync(originalDir, { recursive: true });
    fs.mkdirSync(currentDir, { recursive: true });
    const checkpoint = {
        timestamp: '123',
        isGit: false,
        backupPath: originalDir
    };
    const astConfig = {
        ...config_1.DEFAULT_CONFIG,
        useASTDiffGuard: true
    };
    // Test 1: Deleting function signature blocks
    fs.writeFileSync(path.join(originalDir, 'math.ts'), 'export function add(a: number, b: number): number { return a + b; }\nexport function subtract(a: number, b: number): number { return a - b; }\n');
    fs.writeFileSync(path.join(currentDir, 'math.ts'), 'export function add(a: number, b: number): number { return a + b; }\n' // subtract deleted
    );
    const analysis1 = (0, diff_guard_1.runDiffGuard)(checkpoint, astConfig, currentDir);
    node_assert_1.default.strictEqual(analysis1.status, 'BLOCK');
    node_assert_1.default.ok(analysis1.findings.some(f => f.includes("Deleted or modified signature of 'function subtract(a,b)'")));
    // Test 2: Changing parameter signature blocks
    fs.writeFileSync(path.join(currentDir, 'math.ts'), 'export function add(a: number): number { return a; }\nexport function subtract(a: number, b: number): number { return a - b; }\n' // add parameter deleted
    );
    const analysis2 = (0, diff_guard_1.runDiffGuard)(checkpoint, astConfig, currentDir);
    node_assert_1.default.strictEqual(analysis2.status, 'BLOCK');
    node_assert_1.default.ok(analysis2.findings.some(f => f.includes("Deleted or modified signature of 'function add(a,b)'")));
    // Test 3: Changing function body but keeping signature passes
    fs.writeFileSync(path.join(currentDir, 'math.ts'), 'export function add(a: number, b: number): number { console.log("adding"); return a + b; }\nexport function subtract(a: number, b: number): number { return a - b; }\n');
    const analysis3 = (0, diff_guard_1.runDiffGuard)(checkpoint, astConfig, currentDir);
    node_assert_1.default.strictEqual(analysis3.status, 'PASS');
    // Test 4: AST diff guard is skipped if configuration option is false
    const noAstConfig = {
        ...config_1.DEFAULT_CONFIG,
        useASTDiffGuard: false
    };
    fs.writeFileSync(path.join(currentDir, 'math.ts'), 'export function add(a: number): number { return a; }\nexport function subtract(a: number, b: number): number { return a - b; }\n');
    const analysis4 = (0, diff_guard_1.runDiffGuard)(checkpoint, noAstConfig, currentDir);
    node_assert_1.default.strictEqual(analysis4.status, 'PASS'); // skipped AST block, passes standard checks
    cleanupSandbox();
});
(0, node_test_1.default)('diff guard - AST semantic dependency checks', () => {
    cleanupSandbox();
    const originalDir = path.join(sandboxDir, 'backup');
    const currentDir = path.join(sandboxDir, 'current');
    fs.mkdirSync(originalDir, { recursive: true });
    fs.mkdirSync(currentDir, { recursive: true });
    const checkpoint = {
        timestamp: '123',
        isGit: false,
        backupPath: originalDir
    };
    const config = {
        ...config_1.DEFAULT_CONFIG,
        useASTDiffGuard: true,
        protectedFiles: ['src/payments/**'],
        allowProtectedFileChanges: true
    };
    // Setup a modified file math.ts
    fs.writeFileSync(path.join(originalDir, 'math.ts'), 'export function add(a: number, b: number) { return a + b; }\n');
    fs.writeFileSync(path.join(currentDir, 'math.ts'), 'export function add(a: number, b: number) { console.log("body change"); return a + b; }\n');
    // Setup a protected file that imports math.ts
    fs.mkdirSync(path.join(currentDir, 'src/payments'), { recursive: true });
    fs.writeFileSync(path.join(currentDir, 'src/payments/billing.ts'), 'import { add } from "../../math";\nconsole.log(add(1, 2));\n');
    const analysis = (0, diff_guard_1.runDiffGuard)(checkpoint, config, currentDir);
    node_assert_1.default.strictEqual(analysis.status, 'WARN');
    node_assert_1.default.ok(analysis.findings.some(f => f.includes("Modified file 'math.ts' is referenced by protected module 'src/payments/billing.ts'")));
    cleanupSandbox();
});
(0, node_test_1.default)('diff guard - AST allowed symbol changes bypass block', () => {
    cleanupSandbox();
    const originalDir = path.join(sandboxDir, 'backup');
    const currentDir = path.join(sandboxDir, 'current');
    fs.mkdirSync(originalDir, { recursive: true });
    fs.mkdirSync(currentDir, { recursive: true });
    const checkpoint = {
        timestamp: '123',
        isGit: false,
        backupPath: originalDir
    };
    const astConfig = {
        ...config_1.DEFAULT_CONFIG,
        useASTDiffGuard: true
    };
    // Original files: math.ts contains add and subtract
    fs.writeFileSync(path.join(originalDir, 'math.ts'), 'export function add(a: number, b: number): number { return a + b; }\nexport function subtract(a: number, b: number): number { return a - b; }\n');
    // Current files: delete subtract
    fs.writeFileSync(path.join(currentDir, 'math.ts'), 'export function add(a: number, b: number): number { return a + b; }\n');
    // 1. Without allowed symbol changes: blocked
    const analysisBlocked = (0, diff_guard_1.runDiffGuard)(checkpoint, astConfig, currentDir);
    node_assert_1.default.strictEqual(analysisBlocked.status, 'BLOCK');
    node_assert_1.default.ok(analysisBlocked.findings.some(f => f.includes("Deleted or modified signature of 'function subtract(a,b)'")));
    // 2. With allowed symbol changes containing 'subtract': passes
    const analysisPassed = (0, diff_guard_1.runDiffGuard)(checkpoint, astConfig, currentDir, ['subtract']);
    node_assert_1.default.strictEqual(analysisPassed.status, 'PASS');
    // 3. With config-level allowed symbol changes containing 'subtract': passes
    const configWithAllowed = {
        ...astConfig,
        allowedSymbolChanges: ['subtract']
    };
    const analysisPassedConfig = (0, diff_guard_1.runDiffGuard)(checkpoint, configWithAllowed, currentDir);
    node_assert_1.default.strictEqual(analysisPassedConfig.status, 'PASS');
    // Verify that AST diffs are populated even when useASTDiffGuard is false
    const configDisabledGuard = {
        ...config_1.DEFAULT_CONFIG,
        useASTDiffGuard: false
    };
    const analysisDisabled = (0, diff_guard_1.runDiffGuard)(checkpoint, configDisabledGuard, currentDir);
    node_assert_1.default.ok(analysisDisabled.astDiffs && analysisDisabled.astDiffs.length > 0, 'Should collect astDiffs when guard is disabled');
    const mathDiff = analysisDisabled.astDiffs.find(d => d.file === 'math.ts');
    node_assert_1.default.ok(mathDiff, 'Should find AST diff for math.ts');
    const hasDeleted = mathDiff.items.some(i => i.type === 'deleted' && i.signature.includes('subtract'));
    node_assert_1.default.ok(hasDeleted, 'Should contain deleted subtract signature');
    cleanupSandbox();
});
