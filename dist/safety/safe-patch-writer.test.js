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
const safe_patch_writer_1 = require("./safe-patch-writer");
const config_1 = require("../core/config");
// Helper to create a temp directory
function createTempDir() {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jewel-test-safe-patch-'));
    // Write a basic package.json so we can test dependency checks
    fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({
        name: 'test-project',
        dependencies: {
            lodash: '^4.17.21'
        }
    }, null, 2), 'utf8');
    return tempDir;
}
function cleanupTempDir(dir) {
    try {
        fs.rmSync(dir, { recursive: true, force: true });
    }
    catch { }
}
(0, node_test_1.default)('safe-patch-writer - validation and writing checks', () => {
    const tempDir = createTempDir();
    const config = {
        ...config_1.DEFAULT_CONFIG,
        allowProtectedFileChanges: false,
        allowNewDependencies: false
    };
    const taskContract = {
        task: 'test task',
        understanding: 'test understanding',
        assumptions: [],
        filesLikelyNeeded: ['math.js', 'package.json', 'pnpm-lock.yaml', '.env', 'src/auth/login.ts'],
        forbiddenActions: [],
        successCriteria: [],
        riskLevel: 'low',
        requiresApproval: false,
        createdAt: new Date().toISOString(),
        mode: 'lax'
    };
    try {
        // 1. math.js inside root is allowed.
        const proposal1 = {
            files: [{ filePath: 'math.js', content: 'console.log("hello math");' }],
            explanation: 'add math'
        };
        const res1 = (0, safe_patch_writer_1.applyPatchProposalSafely)(proposal1, taskContract, config, tempDir);
        node_assert_1.default.ok(res1.success);
        node_assert_1.default.strictEqual(res1.appliedFiles[0], 'math.js');
        node_assert_1.default.strictEqual(fs.readFileSync(path.join(tempDir, 'math.js'), 'utf8'), 'console.log("hello math");');
        // 2. ../../outside.txt is blocked.
        const proposal2 = {
            files: [{ filePath: '../../outside.txt', content: 'hack' }],
            explanation: 'hack'
        };
        const res2 = (0, safe_patch_writer_1.applyPatchProposalSafely)(proposal2, taskContract, config, tempDir);
        node_assert_1.default.ok(!res2.success);
        node_assert_1.default.ok(res2.blockedFiles.some(b => b.filePath === '../../outside.txt' && b.reason.includes('Unsafe patch path')));
        // 3. /tmp/outside.txt is blocked.
        const proposal3 = {
            files: [{ filePath: '/tmp/outside.txt', content: 'hack' }],
            explanation: 'hack'
        };
        const res3 = (0, safe_patch_writer_1.applyPatchProposalSafely)(proposal3, taskContract, config, tempDir);
        node_assert_1.default.ok(!res3.success);
        node_assert_1.default.ok(res3.blockedFiles.some(b => b.filePath === '/tmp/outside.txt' && b.reason.includes('Unsafe patch path')));
        // 4. C:\Users\test\outside.txt style absolute path is blocked.
        const proposal4 = {
            files: [{ filePath: 'C:\\Users\\test\\outside.txt', content: 'hack' }],
            explanation: 'hack'
        };
        const res4 = (0, safe_patch_writer_1.applyPatchProposalSafely)(proposal4, taskContract, config, tempDir);
        node_assert_1.default.ok(!res4.success);
        node_assert_1.default.ok(res4.blockedFiles.some(b => b.filePath === 'C:\\Users\\test\\outside.txt' && b.reason.includes('Unsafe patch path')));
        // 5. .env is blocked by default.
        const proposal5 = {
            files: [{ filePath: '.env', content: 'SECRET=true' }],
            explanation: 'add secret'
        };
        const res5 = (0, safe_patch_writer_1.applyPatchProposalSafely)(proposal5, taskContract, config, tempDir);
        node_assert_1.default.ok(!res5.success);
        node_assert_1.default.ok(res5.blockedFiles.some(b => b.filePath === '.env' && b.reason.includes('protected')));
        // 6. src/auth/login.ts is blocked by default.
        const proposal6 = {
            files: [{ filePath: 'src/auth/login.ts', content: 'login logic' }],
            explanation: 'login'
        };
        const res6 = (0, safe_patch_writer_1.applyPatchProposalSafely)(proposal6, taskContract, config, tempDir);
        node_assert_1.default.ok(!res6.success);
        node_assert_1.default.ok(res6.blockedFiles.some(b => b.filePath === 'src/auth/login.ts' && b.reason.includes('protected')));
        // 7. package.json dependency write is blocked by default.
        const proposal7 = {
            files: [{
                    filePath: 'package.json',
                    content: JSON.stringify({
                        name: 'test-project',
                        dependencies: {
                            lodash: '^4.17.21',
                            express: '^4.18.2' // New dependency!
                        }
                    }, null, 2)
                }],
            explanation: 'add express'
        };
        const res7 = (0, safe_patch_writer_1.applyPatchProposalSafely)(proposal7, taskContract, config, tempDir);
        node_assert_1.default.ok(!res7.success);
        node_assert_1.default.ok(res7.blockedFiles.some(b => b.filePath === 'package.json' && b.reason.includes('dependencies')));
        // (Non-dependency change in package.json is allowed!)
        const proposal7NonDep = {
            files: [{
                    filePath: 'package.json',
                    content: JSON.stringify({
                        name: 'test-project-updated', // Updated name
                        dependencies: {
                            lodash: '^4.17.21'
                        }
                    }, null, 2)
                }],
            explanation: 'update name'
        };
        const res7NonDep = (0, safe_patch_writer_1.applyPatchProposalSafely)(proposal7NonDep, taskContract, config, tempDir);
        node_assert_1.default.ok(res7NonDep.success);
        // 8. pnpm-lock.yaml is blocked by default.
        const proposal8 = {
            files: [{ filePath: 'pnpm-lock.yaml', content: 'lock info' }],
            explanation: 'lockfile'
        };
        const res8 = (0, safe_patch_writer_1.applyPatchProposalSafely)(proposal8, taskContract, config, tempDir);
        node_assert_1.default.ok(!res8.success);
        node_assert_1.default.ok(res8.blockedFiles.some(b => b.filePath === 'pnpm-lock.yaml' && b.reason.includes('lockfile')));
        // 9. undeclared file write is blocked in strict mode.
        const strictContract = {
            ...taskContract,
            mode: 'strict',
            filesLikelyNeeded: ['math.js']
        };
        const proposal9 = {
            files: [{ filePath: 'other.js', content: 'console.log("other");' }],
            explanation: 'add other'
        };
        const res9 = (0, safe_patch_writer_1.applyPatchProposalSafely)(proposal9, strictContract, config, tempDir);
        node_assert_1.default.ok(!res9.success);
        node_assert_1.default.ok(res9.blockedFiles.some(b => b.filePath === 'other.js' && b.reason.includes('undeclared')));
        // 10. declared file write succeeds.
        const proposal10 = {
            files: [{ filePath: 'math.js', content: 'console.log("math 2");' }],
            explanation: 'update math'
        };
        const res10 = (0, safe_patch_writer_1.applyPatchProposalSafely)(proposal10, strictContract, config, tempDir);
        node_assert_1.default.ok(res10.success);
        // 11. if one file in a multi file patch is unsafe, none of the files are written.
        // Try to write allowed 'math.js' and blocked '../../outside.txt'.
        const proposal11 = {
            files: [
                { filePath: 'math.js', content: 'console.log("this should not write!");' },
                { filePath: '../../outside.txt', content: 'this is blocked' }
            ],
            explanation: 'multi-file'
        };
        // Prior content of math.js is 'console.log("math 2");'
        const res11 = (0, safe_patch_writer_1.applyPatchProposalSafely)(proposal11, strictContract, config, tempDir);
        node_assert_1.default.ok(!res11.success);
        // Assert math.js content was NOT modified because of atomic failure
        node_assert_1.default.strictEqual(fs.readFileSync(path.join(tempDir, 'math.js'), 'utf8'), 'console.log("math 2");');
        // 12. C:\Users\test\outside.txt is blocked explicitly
        const proposal12 = {
            files: [{ filePath: 'C:\\Users\\test\\outside.txt', content: 'hack' }],
            explanation: 'win absolute'
        };
        const res12 = (0, safe_patch_writer_1.applyPatchProposalSafely)(proposal12, taskContract, config, tempDir);
        node_assert_1.default.ok(!res12.success);
        node_assert_1.default.ok(res12.blockedFiles.some(b => b.reason.includes('Unsafe patch path')));
        // 13. C:/Users/test/outside.txt is blocked explicitly
        const proposal13 = {
            files: [{ filePath: 'C:/Users/test/outside.txt', content: 'hack' }],
            explanation: 'win absolute slash'
        };
        const res13 = (0, safe_patch_writer_1.applyPatchProposalSafely)(proposal13, taskContract, config, tempDir);
        node_assert_1.default.ok(!res13.success);
        node_assert_1.default.ok(res13.blockedFiles.some(b => b.reason.includes('Unsafe patch path')));
        // 14. UNC path is blocked explicitly
        const proposal14 = {
            files: [{ filePath: '\\\\server\\share\\file.txt', content: 'hack' }],
            explanation: 'unc backslash'
        };
        const res14 = (0, safe_patch_writer_1.applyPatchProposalSafely)(proposal14, taskContract, config, tempDir);
        node_assert_1.default.ok(!res14.success);
        node_assert_1.default.ok(res14.blockedFiles.some(b => b.reason.includes('Unsafe patch path')));
        const proposal14Slash = {
            files: [{ filePath: '//server/share/file.txt', content: 'hack' }],
            explanation: 'unc slash'
        };
        const res14Slash = (0, safe_patch_writer_1.applyPatchProposalSafely)(proposal14Slash, taskContract, config, tempDir);
        node_assert_1.default.ok(!res14Slash.success);
        node_assert_1.default.ok(res14Slash.blockedFiles.some(b => b.reason.includes('Unsafe patch path')));
        // 15. Null byte path is blocked explicitly
        const proposal15 = {
            files: [{ filePath: 'some\0file.txt', content: 'hack' }],
            explanation: 'null byte'
        };
        const res15 = (0, safe_patch_writer_1.applyPatchProposalSafely)(proposal15, taskContract, config, tempDir);
        node_assert_1.default.ok(!res15.success);
        node_assert_1.default.ok(res15.blockedFiles.some(b => b.reason.includes('Unsafe patch path')));
        // 16. ../Project/Button.tsx is blocked
        const proposal16 = {
            files: [{ filePath: '../Project/Button.tsx', content: 'hack' }],
            explanation: 'parent traversal'
        };
        const res16 = (0, safe_patch_writer_1.applyPatchProposalSafely)(proposal16, taskContract, config, tempDir);
        node_assert_1.default.ok(!res16.success);
        node_assert_1.default.ok(res16.blockedFiles.some(b => b.reason.includes('Unsafe patch path')));
        // 17. ../outside.txt is blocked
        const proposal17 = {
            files: [{ filePath: '../outside.txt', content: 'hack' }],
            explanation: 'parent traversal 2'
        };
        const res17 = (0, safe_patch_writer_1.applyPatchProposalSafely)(proposal17, taskContract, config, tempDir);
        node_assert_1.default.ok(!res17.success);
        node_assert_1.default.ok(res17.blockedFiles.some(b => b.reason.includes('Unsafe patch path')));
        // 18. src/../Button.tsx is blocked
        const proposal18 = {
            files: [{ filePath: 'src/../Button.tsx', content: 'hack' }],
            explanation: 'parent traversal 3'
        };
        const res18 = (0, safe_patch_writer_1.applyPatchProposalSafely)(proposal18, taskContract, config, tempDir);
        node_assert_1.default.ok(!res18.success);
        node_assert_1.default.ok(res18.blockedFiles.some(b => b.reason.includes('Unsafe patch path')));
        // 19. src/components/Button.tsx succeeds when declared in filesLikelyNeeded in strict mode
        const strictContract2 = {
            ...taskContract,
            mode: 'strict',
            filesLikelyNeeded: ['src/components/Button.tsx']
        };
        const proposal19 = {
            files: [{ filePath: 'src/components/Button.tsx', content: 'console.log("Button");' }],
            explanation: 'add button'
        };
        const res19 = (0, safe_patch_writer_1.applyPatchProposalSafely)(proposal19, strictContract2, config, tempDir);
        node_assert_1.default.ok(res19.success);
        node_assert_1.default.strictEqual(fs.readFileSync(path.join(tempDir, 'src/components/Button.tsx'), 'utf8'), 'console.log("Button");');
    }
    finally {
        cleanupTempDir(tempDir);
    }
});
(0, node_test_1.default)('safe-patch-writer - transactional rollback on failure', () => {
    const tempDir = createTempDir();
    const config = {
        ...config_1.DEFAULT_CONFIG,
        allowProtectedFileChanges: true
    };
    const taskContract = {
        task: 'rollback task',
        understanding: 'rollback',
        assumptions: [],
        filesLikelyNeeded: ['file1.txt', 'dir-error/subfile.txt'],
        forbiddenActions: [],
        successCriteria: [],
        riskLevel: 'low',
        requiresApproval: false,
        createdAt: new Date().toISOString(),
        mode: 'lax'
    };
    try {
        // Write pre-existing file1.txt
        const file1Path = path.join(tempDir, 'file1.txt');
        fs.writeFileSync(file1Path, 'original content', 'utf8');
        // Create a directory where we will try to write a file, which will fail
        const errorDir = path.join(tempDir, 'dir-error');
        fs.mkdirSync(errorDir, { recursive: true });
        // The proposal tries to modify file1.txt and write to a directory path 'dir-error'
        const proposal = {
            files: [
                { filePath: 'file1.txt', content: 'new content attempt' },
                { filePath: 'dir-error', content: 'this write should fail because dir-error is a directory' }
            ]
        };
        const sessionPath = path.join(tempDir, '.jewel-session');
        fs.mkdirSync(sessionPath, { recursive: true });
        const result = (0, safe_patch_writer_1.applyPatchProposalSafely)(proposal, taskContract, config, tempDir, sessionPath);
        node_assert_1.default.ok(!result.success);
        node_assert_1.default.ok(result.blockedFiles.some(b => b.filePath === 'write_failure'));
        // Assert file1.txt content was rolled back to original content
        node_assert_1.default.strictEqual(fs.readFileSync(file1Path, 'utf8'), 'original content');
        // Assert recovery file was written
        const recoveryFile = path.join(sessionPath, 'recovery', 'write-failure-recovery.json');
        node_assert_1.default.ok(fs.existsSync(recoveryFile));
        const recoveryData = JSON.parse(fs.readFileSync(recoveryFile, 'utf8'));
        node_assert_1.default.ok(recoveryData.error);
        node_assert_1.default.strictEqual(recoveryData.snapshots[0].filePath, path.resolve(tempDir, 'file1.txt'));
    }
    finally {
        cleanupTempDir(tempDir);
    }
});
(0, node_test_1.default)('safe-patch-writer - applies targeted search/replace edits', () => {
    const tempDir = createTempDir();
    const config = { ...config_1.DEFAULT_CONFIG, allowProtectedFileChanges: false, allowNewDependencies: false };
    const taskContract = {
        task: 'fix divide',
        understanding: 'test',
        assumptions: [],
        filesLikelyNeeded: ['math.js'],
        forbiddenActions: [],
        successCriteria: [],
        riskLevel: 'low',
        requiresApproval: false,
        createdAt: new Date().toISOString(),
        mode: 'lax'
    };
    fs.writeFileSync(path.join(tempDir, 'math.js'), 'function divide(a,b){return a/b;}\n', 'utf8');
    try {
        const proposal = {
            summary: 'guard zero',
            files: [{
                    filePath: 'math.js',
                    edits: [{ search: 'return a/b', replace: 'if(b===0) throw new Error("division by zero"); return a/b' }],
                    reason: 'prevent divide by zero'
                }],
            notes: [],
            riskLevel: 'low'
        };
        const result = (0, safe_patch_writer_1.applyPatchProposalSafely)(proposal, taskContract, config, tempDir);
        node_assert_1.default.ok(result.success);
        const updated = fs.readFileSync(path.join(tempDir, 'math.js'), 'utf8');
        node_assert_1.default.ok(updated.includes('division by zero'));
    }
    finally {
        cleanupTempDir(tempDir);
    }
});
