import test, { describe } from 'node:test';
import * as assert from 'assert';
import { checkTestChangePolicy } from './test-change-policy';

describe('Test Modification Policy', () => {
  const originalTest = `
    import { add } from './math';
    test('adds 1 + 2 to equal 3', () => {
      assert.strictEqual(add(1, 2), 3);
    });
  `;

  test('appending new tests at end of file passes', () => {
    const patchedTest = `
      import { add } from './math';
      test('adds 1 + 2 to equal 3', () => {
        assert.strictEqual(add(1, 2), 3);
      });
      test('adds 2 + 3 to equal 5', () => {
        assert.strictEqual(add(2, 3), 5);
      });
    `;
    const report = checkTestChangePolicy(originalTest, patchedTest, 'math.test.ts', true);
    assert.strictEqual(report.success, true);
    assert.strictEqual(report.appendOnly, true);
    assert.strictEqual(report.invasive, false);
    assert.deepStrictEqual(report.testProvenance.appendedTestNames, ["adds 2 + 3 to equal 5"]);
  });

  test('changing an existing assertion fails', () => {
    const patchedTest = `
      import { add } from './math';
      test('adds 1 + 2 to equal 3', () => {
        assert.strictEqual(add(1, 2), 4);
      });
    `;
    const report = checkTestChangePolicy(originalTest, patchedTest, 'math.test.ts', true);
    assert.strictEqual(report.success, false);
    assert.strictEqual(report.appendOnly, false);
    assert.strictEqual(report.invasive, true);
    assert.deepStrictEqual(report.testProvenance.modifiedTestNames, ["adds 1 + 2 to equal 3"]);
  });

  test('changing an existing test name fails', () => {
    const patchedTest = `
      import { add } from './math';
      test('adds 1 + 2 equals 3', () => {
        assert.strictEqual(add(1, 2), 3);
      });
    `;
    const report = checkTestChangePolicy(originalTest, patchedTest, 'math.test.ts', true);
    assert.strictEqual(report.success, false);
    assert.strictEqual(report.appendOnly, false);
    assert.strictEqual(report.invasive, true);
    assert.deepStrictEqual(report.testProvenance.removedTestNames, ["adds 1 + 2 to equal 3"]);
  });

  test('adding an import for new tests warns, not blocks', () => {
    const patchedTest = `
      import { add } from './math';
      import { multiply } from './math';
      test('adds 1 + 2 to equal 3', () => {
        assert.strictEqual(add(1, 2), 3);
      });
      test('multiplies 2 * 3 to equal 6', () => {
        assert.strictEqual(multiply(2, 3), 6);
      });
    `;
    const report = checkTestChangePolicy(originalTest, patchedTest, 'math.test.ts', true);
    assert.strictEqual(report.success, true);
    assert.strictEqual(report.invasive, false);
    assert.ok(report.findings.some(f => f.includes('[WARN]')));
  });

  test('adding an import without appending tests blocks', () => {
    const patchedTest = `
      import { add } from './math';
      import { multiply } from './math';
      test('adds 1 + 2 to equal 3', () => {
        assert.strictEqual(add(1, 2), 3);
      });
    `;
    const report = checkTestChangePolicy(originalTest, patchedTest, 'math.test.ts', true);
    assert.strictEqual(report.success, false);
    assert.strictEqual(report.invasive, true);
  });
});
