import test from 'node:test';
import assert from 'node:assert';
import { add, divide } from './math';

test('add works', () => {
  assert.strictEqual(add(2, 3), 5);
});

test('divide throws error on division by zero', () => {
  assert.throws(() => {
    divide(10, 0);
  }, /Cannot divide by zero/);
});
