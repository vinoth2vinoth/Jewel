import test from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { validateMilestones } from './milestones';
import {
  createBuildState,
  loadBuildState,
  saveBuildState,
  nextMilestone,
  orchestrateBuild,
  writeBuildReport
} from './build-runner';

function makeState(titles: string[]) {
  const { milestones } = validateMilestones(titles);
  return createBuildState('test goal', milestones, 'heuristic');
}

test('build-runner - orchestrateBuild completes all milestones on success', async () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jewel-build-'));
  try {
    const state = makeState(['First milestone task', 'Second milestone task']);
    const executed: string[] = [];

    const result = await orchestrateBuild(cwd, state, async m => {
      executed.push(m.title);
      return { ok: true, sessionId: `session-${m.id}`, usage: { totalTokens: 100, estimatedCostUsd: 0.01 } };
    });

    assert.strictEqual(result.state.status, 'completed');
    assert.strictEqual(result.ranMilestones, 2);
    assert.strictEqual(executed.length, 2);
    assert.strictEqual(result.state.totalTokens, 200);
    assert.ok(Math.abs(result.state.totalCostUsd - 0.02) < 1e-9);
    assert.ok(result.state.milestones.every(m => m.status === 'completed'));
    assert.ok(fs.existsSync(path.join(cwd, '.jewel', 'build', 'state.json')));
    assert.ok(fs.existsSync(result.reportPath));
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('build-runner - failure pauses the build and persists state', async () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jewel-build-'));
  try {
    const state = makeState(['Milestone that works fine', 'Milestone that breaks here', 'Milestone never reached']);

    const result = await orchestrateBuild(cwd, state, async m => {
      if (m.id === 2) return { ok: false, error: 'verification failed' };
      return { ok: true, sessionId: `session-${m.id}` };
    });

    assert.strictEqual(result.state.status, 'paused');
    assert.strictEqual(result.state.milestones[0]?.status, 'completed');
    assert.strictEqual(result.state.milestones[1]?.status, 'failed');
    assert.strictEqual(result.state.milestones[1]?.error, 'verification failed');
    assert.strictEqual(result.state.milestones[2]?.status, 'pending');

    const report = fs.readFileSync(result.reportPath, 'utf8');
    assert.ok(report.includes('jewel build --resume'));
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('build-runner - loadBuildState round-trips and resume picks first non-completed', async () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jewel-build-'));
  try {
    const state = makeState(['Alpha milestone task', 'Beta milestone task', 'Gamma milestone task']);
    state.milestones[0]!.status = 'completed';
    state.milestones[0]!.sessionId = 'session-a';
    state.milestones[1]!.status = 'failed';
    state.milestones[1]!.error = 'tests failed';
    state.status = 'paused';
    state.totalTokens = 500;
    saveBuildState(cwd, state);

    const loaded = loadBuildState(cwd);
    assert.ok(loaded);
    assert.strictEqual(loaded.goal, 'test goal');
    assert.strictEqual(loaded.totalTokens, 500);
    assert.strictEqual(loaded.milestones[0]?.status, 'completed');
    assert.strictEqual(loaded.milestones[0]?.sessionId, 'session-a');
    assert.strictEqual(loaded.milestones[1]?.status, 'failed');
    assert.strictEqual(loaded.milestones[1]?.error, 'tests failed');

    // Resume: failed milestone is retried first
    const next = nextMilestone(loaded);
    assert.strictEqual(next?.title, 'Beta milestone task');

    // Resuming the loaded state retries the failed milestone and finishes
    const result = await orchestrateBuild(cwd, loaded, async () => ({ ok: true }));
    assert.strictEqual(result.state.status, 'completed');
    assert.strictEqual(result.ranMilestones, 2);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('build-runner - loadBuildState returns null for missing or corrupt state', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jewel-build-'));
  try {
    assert.strictEqual(loadBuildState(cwd), null);

    fs.mkdirSync(path.join(cwd, '.jewel', 'build'), { recursive: true });
    fs.writeFileSync(path.join(cwd, '.jewel', 'build', 'state.json'), '{not json', 'utf8');
    assert.strictEqual(loadBuildState(cwd), null);

    fs.writeFileSync(path.join(cwd, '.jewel', 'build', 'state.json'), JSON.stringify({ milestones: [] }), 'utf8');
    assert.strictEqual(loadBuildState(cwd), null);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('build-runner - writeBuildReport includes progress and cost', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jewel-build-'));
  try {
    const state = makeState(['Only milestone in this build']);
    state.milestones[0]!.status = 'completed';
    state.status = 'completed';
    state.totalCostUsd = 0.1234;
    const reportPath = writeBuildReport(cwd, state);
    const report = fs.readFileSync(reportPath, 'utf8');
    assert.ok(report.includes('1/1 milestones completed'));
    assert.ok(report.includes('$0.1234'));
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});
