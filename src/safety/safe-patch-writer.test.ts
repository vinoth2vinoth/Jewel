import test from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { applyPatchProposalSafely } from './safe-patch-writer';
import { DEFAULT_CONFIG } from '../core/config';
import { TaskContract } from '../core/session';

// Helper to create a temp directory
function createTempDir(): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jewel-test-safe-patch-'));
  // Write a basic package.json so we can test dependency checks
  fs.writeFileSync(
    path.join(tempDir, 'package.json'),
    JSON.stringify({
      name: 'test-project',
      dependencies: {
        lodash: '^4.17.21'
      }
    }, null, 2),
    'utf8'
  );
  return tempDir;
}

function cleanupTempDir(dir: string) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {}
}

test('safe-patch-writer - validation and writing checks', () => {
  const tempDir = createTempDir();

  const config = {
    ...DEFAULT_CONFIG,
    allowProtectedFileChanges: false,
    allowNewDependencies: false
  };

  const taskContract: TaskContract = {
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
    const res1 = applyPatchProposalSafely(proposal1, taskContract, config, tempDir);
    assert.ok(res1.success);
    assert.strictEqual(res1.appliedFiles[0], 'math.js');
    assert.strictEqual(fs.readFileSync(path.join(tempDir, 'math.js'), 'utf8'), 'console.log("hello math");');

    // 2. ../../outside.txt is blocked.
    const proposal2 = {
      files: [{ filePath: '../../outside.txt', content: 'hack' }],
      explanation: 'hack'
    };
    const res2 = applyPatchProposalSafely(proposal2, taskContract, config, tempDir);
    assert.ok(!res2.success);
    assert.ok(res2.blockedFiles.some(b => b.filePath === '../../outside.txt' && b.reason.includes('escapes')));

    // 3. /tmp/outside.txt is blocked.
    const proposal3 = {
      files: [{ filePath: '/tmp/outside.txt', content: 'hack' }],
      explanation: 'hack'
    };
    const res3 = applyPatchProposalSafely(proposal3, taskContract, config, tempDir);
    assert.ok(!res3.success);

    // 4. C:\Users\test\outside.txt style absolute path is blocked.
    const proposal4 = {
      files: [{ filePath: 'C:\\Users\\test\\outside.txt', content: 'hack' }],
      explanation: 'hack'
    };
    const res4 = applyPatchProposalSafely(proposal4, taskContract, config, tempDir);
    assert.ok(!res4.success);

    // 5. .env is blocked by default.
    const proposal5 = {
      files: [{ filePath: '.env', content: 'SECRET=true' }],
      explanation: 'add secret'
    };
    const res5 = applyPatchProposalSafely(proposal5, taskContract, config, tempDir);
    assert.ok(!res5.success);
    assert.ok(res5.blockedFiles.some(b => b.filePath === '.env' && b.reason.includes('protected')));

    // 6. src/auth/login.ts is blocked by default.
    const proposal6 = {
      files: [{ filePath: 'src/auth/login.ts', content: 'login logic' }],
      explanation: 'login'
    };
    const res6 = applyPatchProposalSafely(proposal6, taskContract, config, tempDir);
    assert.ok(!res6.success);
    assert.ok(res6.blockedFiles.some(b => b.filePath === 'src/auth/login.ts' && b.reason.includes('protected')));

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
    const res7 = applyPatchProposalSafely(proposal7, taskContract, config, tempDir);
    assert.ok(!res7.success);
    assert.ok(res7.blockedFiles.some(b => b.filePath === 'package.json' && b.reason.includes('dependencies')));

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
    const res7NonDep = applyPatchProposalSafely(proposal7NonDep, taskContract, config, tempDir);
    assert.ok(res7NonDep.success);

    // 8. pnpm-lock.yaml is blocked by default.
    const proposal8 = {
      files: [{ filePath: 'pnpm-lock.yaml', content: 'lock info' }],
      explanation: 'lockfile'
    };
    const res8 = applyPatchProposalSafely(proposal8, taskContract, config, tempDir);
    assert.ok(!res8.success);
    assert.ok(res8.blockedFiles.some(b => b.filePath === 'pnpm-lock.yaml' && b.reason.includes('lockfile')));

    // 9. undeclared file write is blocked in strict mode.
    const strictContract: TaskContract = {
      ...taskContract,
      mode: 'strict',
      filesLikelyNeeded: ['math.js']
    };
    const proposal9 = {
      files: [{ filePath: 'other.js', content: 'console.log("other");' }],
      explanation: 'add other'
    };
    const res9 = applyPatchProposalSafely(proposal9, strictContract, config, tempDir);
    assert.ok(!res9.success);
    assert.ok(res9.blockedFiles.some(b => b.filePath === 'other.js' && b.reason.includes('undeclared')));

    // 10. declared file write succeeds.
    const proposal10 = {
      files: [{ filePath: 'math.js', content: 'console.log("math 2");' }],
      explanation: 'update math'
    };
    const res10 = applyPatchProposalSafely(proposal10, strictContract, config, tempDir);
    assert.ok(res10.success);

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
    const res11 = applyPatchProposalSafely(proposal11, strictContract, config, tempDir);
    assert.ok(!res11.success);
    // Assert math.js content was NOT modified because of atomic failure
    assert.strictEqual(fs.readFileSync(path.join(tempDir, 'math.js'), 'utf8'), 'console.log("math 2");');

    // 12. C:\Users\test\outside.txt is blocked explicitly
    const proposal12 = {
      files: [{ filePath: 'C:\\Users\\test\\outside.txt', content: 'hack' }],
      explanation: 'win absolute'
    };
    const res12 = applyPatchProposalSafely(proposal12, taskContract, config, tempDir);
    assert.ok(!res12.success);
    assert.ok(res12.blockedFiles.some(b => b.reason.includes('absolute')));

    // 13. C:/Users/test/outside.txt is blocked explicitly
    const proposal13 = {
      files: [{ filePath: 'C:/Users/test/outside.txt', content: 'hack' }],
      explanation: 'win absolute slash'
    };
    const res13 = applyPatchProposalSafely(proposal13, taskContract, config, tempDir);
    assert.ok(!res13.success);
    assert.ok(res13.blockedFiles.some(b => b.reason.includes('absolute')));

    // 14. UNC path is blocked explicitly
    const proposal14 = {
      files: [{ filePath: '\\\\server\\share\\file.txt', content: 'hack' }],
      explanation: 'unc backslash'
    };
    const res14 = applyPatchProposalSafely(proposal14, taskContract, config, tempDir);
    assert.ok(!res14.success);
    assert.ok(res14.blockedFiles.some(b => b.reason.includes('absolute')));

    const proposal14Slash = {
      files: [{ filePath: '//server/share/file.txt', content: 'hack' }],
      explanation: 'unc slash'
    };
    const res14Slash = applyPatchProposalSafely(proposal14Slash, taskContract, config, tempDir);
    assert.ok(!res14Slash.success);
    assert.ok(res14Slash.blockedFiles.some(b => b.reason.includes('absolute')));

    // 15. Null byte path is blocked explicitly
    const proposal15 = {
      files: [{ filePath: 'some\0file.txt', content: 'hack' }],
      explanation: 'null byte'
    };
    const res15 = applyPatchProposalSafely(proposal15, taskContract, config, tempDir);
    assert.ok(!res15.success);
    assert.ok(res15.blockedFiles.some(b => b.reason.includes('null bytes')));

  } finally {
    cleanupTempDir(tempDir);
  }
});
