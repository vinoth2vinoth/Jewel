import test from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { validateMilestones, decomposeGoalHeuristic, planMilestones, readBlueprintMarker } from './milestones';
import { MockAgentAdapter } from '../agents/adapter';

test('milestones - validateMilestones accepts strings and objects, rejects junk', () => {
  const result = validateMilestones([
    'Build the login page',
    { title: 'Add tests for login' },
    '',
    42,
    { notATitle: true }
  ]);
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.milestones.length, 2);
  assert.strictEqual(result.milestones[0]?.id, 1);
  assert.strictEqual(result.milestones[0]?.status, 'pending');
  assert.ok(result.errors.length >= 3, 'invalid entries are reported');
});

test('milestones - validateMilestones rejects non-arrays and empty lists', () => {
  assert.strictEqual(validateMilestones('not an array').valid, false);
  assert.strictEqual(validateMilestones([]).valid, false);
  assert.strictEqual(validateMilestones([null, 3]).valid, false);
});

test('milestones - validateMilestones enforces limit and dedupes', () => {
  const many = Array.from({ length: 20 }, (_, i) => `Milestone number ${i}`);
  const result = validateMilestones(many, 5);
  assert.strictEqual(result.milestones.length, 5);

  const dupes = validateMilestones(['Do the thing', 'do the thing  ', 'Do another thing']);
  assert.strictEqual(dupes.milestones.length, 2);
});

test('milestones - decomposeGoalHeuristic splits multi-feature goals', () => {
  const milestones = decomposeGoalHeuristic('a todo app with delete buttons, dark mode and then user accounts');
  assert.ok(milestones.length >= 3);
  assert.ok(milestones[0]?.title.startsWith('Implement the core feature'));
  assert.ok(milestones[milestones.length - 1]?.title.toLowerCase().includes('test'));
});

test('milestones - decomposeGoalHeuristic handles simple goals', () => {
  const milestones = decomposeGoalHeuristic('fix the header');
  assert.strictEqual(milestones.length, 2);
  assert.ok(milestones[0]?.title.includes('fix the header'));
});

test('milestones - planMilestones uses LLM adapter when available', async () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jewel-ms-'));
  try {
    const result = await planMilestones(cwd, 'build a chat widget', new MockAgentAdapter());
    assert.strictEqual(result.source, 'llm');
    assert.strictEqual(result.milestones.length, 2);
    assert.ok(result.milestones[0]?.title.includes('build a chat widget'));
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('milestones - planMilestones falls back to heuristic without adapter', async () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jewel-ms-'));
  try {
    const result = await planMilestones(cwd, 'build a chat widget with emoji support', null);
    assert.strictEqual(result.source, 'heuristic');
    assert.ok(result.milestones.length >= 2);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('milestones - planMilestones uses blueprint marker when no goal given', async () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jewel-ms-'));
  try {
    fs.mkdirSync(path.join(cwd, '.jewel'), { recursive: true });
    fs.writeFileSync(path.join(cwd, '.jewel', 'blueprint.json'), JSON.stringify({ blueprintId: 'node-api' }), 'utf8');

    assert.strictEqual(readBlueprintMarker(cwd), 'node-api');

    const result = await planMilestones(cwd, undefined, null);
    assert.strictEqual(result.source, 'blueprint');
    assert.ok(result.milestones.length >= 3);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('milestones - planMilestones throws without goal and without marker', async () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'jewel-ms-'));
  try {
    await assert.rejects(() => planMilestones(cwd, undefined, null), /No project goal/);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});
