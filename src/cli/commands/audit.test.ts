import test from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import { runAudit } from './audit';

const sandboxDir = path.join(__dirname, '../../../sandbox-test-audit');

test('audit checks - generates markdown and json reports', () => {
  if (fs.existsSync(sandboxDir)) {
    fs.rmSync(sandboxDir, { recursive: true, force: true });
  }
  fs.mkdirSync(sandboxDir, { recursive: true });

  try {
    runAudit(sandboxDir);

    const reportsDir = path.join(sandboxDir, '.jewel', 'reports');
    assert.ok(fs.existsSync(path.join(reportsDir, 'audit.json')));
    assert.ok(fs.existsSync(path.join(reportsDir, 'audit.md')));

    const data = JSON.parse(fs.readFileSync(path.join(reportsDir, 'audit.json'), 'utf8'));
    assert.ok(data.checks.length > 0);
    assert.ok(data.timestamp);
  } finally {
    if (fs.existsSync(sandboxDir)) {
      fs.rmSync(sandboxDir, { recursive: true, force: true });
    }
  }
});
