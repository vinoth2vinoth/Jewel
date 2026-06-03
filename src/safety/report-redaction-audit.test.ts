import test from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { auditReports } from './report-redaction-audit';

function createTempReportsDir(): { tempDir: string; reportsDir: string } {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jewel-audit-test-'));
  const reportsDir = path.join(tempDir, '.jewel', 'reports');
  fs.mkdirSync(reportsDir, { recursive: true });
  return { tempDir, reportsDir };
}

function cleanupTempDir(dir: string) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {}
}

test('report redaction audit - clean reports pass', () => {
  const { tempDir, reportsDir } = createTempReportsDir();
  try {
    fs.writeFileSync(path.join(reportsDir, 'report1.json'), JSON.stringify({ status: 'PASS', info: 'all good' }), 'utf8');
    fs.writeFileSync(path.join(reportsDir, 'report2.md'), '# Run summary\nNo leaks here.', 'utf8');

    const result = auditReports(tempDir);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.leakedFiles.length, 0);
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('report redaction audit - flags OpenAI sk- style keys', () => {
  const { tempDir, reportsDir } = createTempReportsDir();
  try {
    fs.writeFileSync(
      path.join(reportsDir, 'leak.json'),
      JSON.stringify({ status: 'FAIL', keyUsed: 'sk-proj-123456789012345678901234567890' }),
      'utf8'
    );

    const result = auditReports(tempDir);
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.leakedFiles.length, 1);
    assert.strictEqual(result.leakedFiles[0].filePath, '.jewel/reports/leak.json');
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('report redaction audit - flags GitHub PATs', () => {
  const { tempDir, reportsDir } = createTempReportsDir();
  try {
    fs.writeFileSync(
      path.join(reportsDir, 'leak.md'),
      '# Leak\ngithub_pat_123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890',
      'utf8'
    );

    const result = auditReports(tempDir);
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.leakedFiles.length, 1);
    assert.strictEqual(result.leakedFiles[0].filePath, '.jewel/reports/leak.md');
  } finally {
    cleanupTempDir(tempDir);
  }
});
