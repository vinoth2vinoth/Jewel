import test from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { listRecentSessions, getSessionForResume, formatSessionHistoryTable } from './session-history';

test('session-history - lists and resumes sessions', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jewel-history-'));
  const sessionId = 'session-2026-07-05T12-00-00-000Z';
  const sessionPath = path.join(dir, '.jewel', 'sessions', sessionId);
  fs.mkdirSync(sessionPath, { recursive: true });
  fs.writeFileSync(path.join(sessionPath, 'task-contract.json'), JSON.stringify({
    task: 'fix math test',
    riskLevel: 'low',
    createdAt: '2026-07-05T12:00:00.000Z',
    filesLikelyNeeded: ['src/math.ts']
  }, null, 2));
  fs.writeFileSync(path.join(sessionPath, 'run-report.json'), JSON.stringify({ status: 'SUCCESS' }));

  try {
    const list = listRecentSessions(dir, 5);
    assert.strictEqual(list.length, 1);
    assert.strictEqual(list[0].status, 'SUCCESS');
    assert.strictEqual(list[0].task, 'fix math test');

    const resume = getSessionForResume(dir);
    assert.ok(resume);
    assert.strictEqual(resume!.task, 'fix math test');
    assert.deepStrictEqual(resume!.files, ['src/math.ts']);

    const table = formatSessionHistoryTable(list);
    assert.ok(table.includes('fix math test'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
