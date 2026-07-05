import test from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { runWatch } from './watch';

function createWatchWorkspace(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jewel-watch-'));
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'app.ts'), 'export const x = 1;\n');
  fs.writeFileSync(path.join(dir, 'jewel.config.json'), JSON.stringify({
    projectName: 'watch-test',
    mode: 'lax',
    provider: 'none',
    commands: { test: 'node -e "process.exit(0)"' },
    requireVerificationBeforeDone: false,
    reportFormat: ['json']
  }, null, 2));
  return dir;
}

test('watch - single verification run with --once equivalent', async () => {
  const dir = createWatchWorkspace();
  const originalExit = process.exit;
  process.exit = (() => {}) as typeof process.exit;

  try {
    await runWatch(dir, { once: true });
    const reportPath = path.join(dir, '.jewel', 'reports', 'latest.json');
    assert.ok(fs.existsSync(reportPath));
  } finally {
    process.exit = originalExit;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
