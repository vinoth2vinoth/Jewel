import test from 'node:test';
import assert from 'node:assert';
import { compactRepoContext, compactSummaryText } from './context-budget';

function makeContext(files: { name: string; size: number }[]): string {
  return files
    .map(f => `=== File: ${f.name} ===\n${'x'.repeat(f.size)}\n`)
    .join('\n');
}

test('context-budget - returns input unchanged when under budget', () => {
  const context = makeContext([{ name: 'a.ts', size: 100 }, { name: 'b.ts', size: 100 }]);
  assert.strictEqual(compactRepoContext(context, 10_000), context);
});

test('context-budget - compacts over-budget context and keeps all file headers', () => {
  const context = makeContext([
    { name: 'most-relevant.ts', size: 3000 },
    { name: 'second.ts', size: 3000 },
    { name: 'least-relevant.ts', size: 3000 }
  ]);
  const compacted = compactRepoContext(context, 5000);

  assert.ok(compacted.length <= 5500, `compacted length ${compacted.length} is near budget`);
  assert.ok(compacted.includes('=== File: most-relevant.ts ==='));
  assert.ok(compacted.includes('=== File: second.ts ==='));
  assert.ok(compacted.includes('=== File: least-relevant.ts ==='));
  assert.ok(compacted.includes('truncated by Jewel context budget') || compacted.includes('content omitted by Jewel context budget'));
});

test('context-budget - most relevant (first) file keeps the most content', () => {
  const context = makeContext([
    { name: 'first.ts', size: 4000 },
    { name: 'last.ts', size: 4000 }
  ]);
  const compacted = compactRepoContext(context, 4500);

  const firstIdx = compacted.indexOf('=== File: first.ts ===');
  const lastIdx = compacted.indexOf('=== File: last.ts ===');
  const firstBlock = compacted.slice(firstIdx, lastIdx);
  const lastBlock = compacted.slice(lastIdx);
  assert.ok(firstBlock.length > lastBlock.length, 'first file retains more content than last');
});

test('context-budget - handles context without file markers', () => {
  const blob = 'y'.repeat(10_000);
  const compacted = compactRepoContext(blob, 2000);
  assert.ok(compacted.length <= 2100);
  assert.ok(compacted.includes('truncated by Jewel context budget'));
});

test('context-budget - compactSummaryText keeps head and tail', () => {
  const text = 'HEAD-MARKER ' + 'z'.repeat(10_000) + ' TAIL-MARKER';
  const compacted = compactSummaryText(text, 2000);
  assert.ok(compacted.length <= 2100);
  assert.ok(compacted.startsWith('HEAD-MARKER'));
  assert.ok(compacted.endsWith('TAIL-MARKER'));
  assert.ok(compacted.includes('truncated by Jewel context budget'));
});
