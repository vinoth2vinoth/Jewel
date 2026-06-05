import test from 'node:test';
import assert from 'node:assert';
import { tokenizeInput, parseOptions } from './tui';

test('TUI Tokenizer - splits by space and supports quotes', () => {
  const input = 'run "fix some broken tests" --mock -f "src/index.ts, src/math.ts"';
  const tokens = tokenizeInput(input);

  assert.deepStrictEqual(tokens, [
    'run',
    'fix some broken tests',
    '--mock',
    '-f',
    'src/index.ts, src/math.ts'
  ]);
});

test('TUI Tokenizer - handles single quotes', () => {
  const input = "run 'fix formatting' --yes";
  const tokens = tokenizeInput(input);

  assert.deepStrictEqual(tokens, [
    'run',
    'fix formatting',
    '--yes'
  ]);
});

test('TUI Option Parser - boolean flags', () => {
  const tokens = ['run', 'some task', '--mock', '--yes', '--no-review', '--keep-failed', '--dry-run', '--ui', '--schema', '--no-write', '--force'];
  const { options, remaining } = parseOptions(tokens);

  assert.strictEqual(options.mock, true);
  assert.strictEqual(options.yes, true);
  assert.strictEqual(options.noReview, true);
  assert.strictEqual(options.keepFailed, true);
  assert.strictEqual(options.dryRun, true);
  assert.strictEqual(options.ui, true);
  assert.strictEqual(options.schema, true);
  assert.strictEqual(options.noWrite, true);
  assert.strictEqual(options.force, true);

  assert.deepStrictEqual(remaining, ['run', 'some task']);
});

test('TUI Option Parser - valued options and flag protection', () => {
  const tokens = ['run', 'task', '--provider', 'openai', '--model', 'gpt-4o', '-f', 'src/math.ts'];
  const { options, remaining } = parseOptions(tokens);

  assert.strictEqual(options.provider, 'openai');
  assert.strictEqual(options.model, 'gpt-4o');
  assert.deepStrictEqual(options.files, ['src/math.ts']);
  assert.deepStrictEqual(remaining, ['run', 'task']);
});

test('TUI Option Parser - adjacent flag protection (do not consume flag as value)', () => {
  const tokens = ['run', 'task', '--provider', '--mock', '--model', 'gpt-4o'];
  const { options, remaining } = parseOptions(tokens);

  // --provider has no valid value (next token starts with '-')
  assert.strictEqual(options.provider, undefined);
  assert.strictEqual(options.mock, true);
  assert.strictEqual(options.model, 'gpt-4o');
  assert.deepStrictEqual(remaining, ['run', 'task']);
});

test('TUI Option Parser - numeric coercion', () => {
  const tokens = ['run', 'task', '--temperature', '0.5', '--max-output-tokens', '2000'];
  const { options, remaining } = parseOptions(tokens);

  assert.strictEqual(options.temperature, 0.5);
  assert.strictEqual(options.maxOutputTokens, 2000);
  assert.deepStrictEqual(remaining, ['run', 'task']);
});

test('TUI Option Parser - missing valued options handle gracefully', () => {
  const tokens = ['run', 'task', '--provider'];
  const { options, remaining } = parseOptions(tokens);

  assert.strictEqual(options.provider, undefined);
  assert.deepStrictEqual(remaining, ['run', 'task']);
});
