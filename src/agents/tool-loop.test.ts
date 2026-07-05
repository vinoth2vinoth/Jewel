import test from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { executeAgentTool, isAllowedTool } from './tools/registry';
import { runAgentToolLoop, validateToolLoopDecision, heuristicToolDecision } from './tool-loop';
import { DEFAULT_CONFIG } from '../core/config';
import { MockAgentAdapter } from './adapter';

test('tool registry - executes read-only tools safely', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jewel-tools-'));
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'app.ts'), 'export const x = 1;\n');
  try {
    assert.ok(isAllowedTool('grep'));
    assert.ok(!isAllowedTool('exec'));
    const listed = executeAgentTool('list_dir', { dir: 'src' }, dir);
    assert.ok(listed.output.includes('src/app.ts'));
    const read = executeAgentTool('read_file', { path: 'src/app.ts' }, dir);
    assert.ok(read.output.includes('export const x'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('tool loop - validateToolLoopDecision schema', () => {
  const valid = validateToolLoopDecision({
    action: 'done',
    reason: 'enough context',
    summary: 'Found math.ts'
  });
  assert.strictEqual(valid.action, 'done');

  assert.throws(() => {
    validateToolLoopDecision({ action: 'tool', reason: 'missing tool' });
  });
});

test('tool loop - mock adapter exploration writes session memory', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jewel-toolloop-'));
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'math.ts'), 'export function divide(a: number, b: number) { return a / b; }\n');
  const sessionPath = path.join(dir, '.jewel', 'sessions', 'test-session');
  fs.mkdirSync(sessionPath, { recursive: true });

  try {
    const adapter = new MockAgentAdapter();
    const result = await runAgentToolLoop({
      task: 'fix math divide by zero',
      cwd: dir,
      config: { ...DEFAULT_CONFIG, agentToolLoopMaxSteps: 4 },
      adapter,
      sessionPath,
      initialFiles: ['src/math.ts']
    });

    assert.ok(result.steps.length >= 3);
    assert.ok(result.discoveredFiles.includes('src/math.ts'));
    assert.ok(fs.existsSync(path.join(sessionPath, 'exploration-log.json')));
    assert.strictEqual(result.stoppedReason, 'done');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('tool loop - heuristic fallback when no adapter', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jewel-toolloop-heur-'));
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'main.ts'), 'main();\n');
  const sessionPath = path.join(dir, '.jewel', 'sessions', 'heur');
  fs.mkdirSync(sessionPath, { recursive: true });
  try {
    const decision = heuristicToolDecision({
      task: 'update main entry',
      cwd: dir,
      config: DEFAULT_CONFIG,
      step: 1,
      maxSteps: 8,
      priorSteps: [],
      initialFiles: ['src/main.ts']
    });
    assert.strictEqual(decision.action, 'tool');
    assert.strictEqual(decision.tool, 'list_dir');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
