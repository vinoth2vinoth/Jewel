import test from 'node:test';
import assert from 'node:assert';
import * as path from 'path';
import { diagnosticsFromVerificationReport } from './diagnostics';
import { VerificationReport } from '../verification/runner';

test('lsp diagnostics - maps failing test output to file locations', () => {
  const cwd = path.resolve('/project');
  const report: VerificationReport = {
    projectName: 'test',
    date: new Date().toISOString(),
    mode: 'strict',
    overallStatus: 'FAIL',
    stats: { passed: 0, failed: 1, skipped: 0, blocked: 0 },
    results: [{
      commandKey: 'test',
      commandLine: 'npm test',
      status: 'FAIL',
      exitCode: 1,
      stdout: '',
      stderr: 'AssertionError\n    at src/math.ts:12:5'
    }]
  };

  const map = diagnosticsFromVerificationReport(report, cwd);
  const mathUri = Object.keys(map).find(u => u.includes('math.ts'));
  assert.ok(mathUri);
  assert.ok(map[mathUri].length >= 1);
  assert.strictEqual(map[mathUri][0].source, 'jewel');
});

test('lsp diagnostics - empty pass report yields no diagnostics', () => {
  const report: VerificationReport = {
    projectName: 'test',
    date: new Date().toISOString(),
    mode: 'strict',
    overallStatus: 'PASS',
    stats: { passed: 1, failed: 0, skipped: 0, blocked: 0 },
    results: [{
      commandKey: 'test',
      commandLine: 'npm test',
      status: 'PASS',
      exitCode: 0,
      stdout: 'ok',
      stderr: ''
    }]
  };

  const map = diagnosticsFromVerificationReport(report, path.resolve('/project'));
  assert.strictEqual(Object.keys(map).length, 0);
});
