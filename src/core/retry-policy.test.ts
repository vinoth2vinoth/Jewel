import test, { describe } from 'node:test';
import * as assert from 'assert';
import { createRetryState, recordRetryAttempt, shouldStopRetry } from './retry-policy';

describe('Retry Policy and Bounded Loops', () => {
  test('maxRetries is respected', () => {
    const state = createRetryState(3);
    
    // Attempt 0
    let decision = shouldStopRetry(state, 'error 1', 'BAD_IMPLEMENTATION', 'high', false);
    assert.strictEqual(decision.stop, false);
    recordRetryAttempt(state, 'error 1', 'BAD_IMPLEMENTATION');

    // Attempt 1
    decision = shouldStopRetry(state, 'error 2', 'BAD_IMPLEMENTATION', 'high', false);
    assert.strictEqual(decision.stop, false);
    recordRetryAttempt(state, 'error 2', 'BAD_IMPLEMENTATION');

    // Attempt 2
    decision = shouldStopRetry(state, 'error 3', 'BAD_IMPLEMENTATION', 'high', false);
    assert.strictEqual(decision.stop, false);
    recordRetryAttempt(state, 'error 3', 'BAD_IMPLEMENTATION');

    // Attempt 3 - limit reached
    decision = shouldStopRetry(state, 'error 4', 'BAD_IMPLEMENTATION', 'high', false);
    assert.strictEqual(decision.stop, true);
    assert.strictEqual(decision.status, 'RETRY_LIMIT_REACHED');
  });

  test('same failure repeated twice stops', () => {
    const state = createRetryState(3);
    
    // Attempt 0
    let decision = shouldStopRetry(state, 'assertion failed: 4 === 3', 'BAD_IMPLEMENTATION', 'high', false);
    assert.strictEqual(decision.stop, false);
    recordRetryAttempt(state, 'assertion failed: 4 === 3', 'BAD_IMPLEMENTATION');

    // Attempt 1 with same error log
    decision = shouldStopRetry(state, 'assertion failed: 4 === 3', 'BAD_IMPLEMENTATION', 'high', false);
    assert.strictEqual(decision.stop, true);
    assert.strictEqual(decision.status, 'RETRY_LIMIT_REACHED');
  });

  test('low confidence critic verdict stops immediately', () => {
    const state = createRetryState(3);
    const decision = shouldStopRetry(state, 'some error', 'BAD_GENERATED_TEST', 'low', false);
    assert.strictEqual(decision.stop, true);
    assert.strictEqual(decision.status, 'NEEDS_HUMAN_REVIEW');
  });

  test('UNKNOWN verdict stops immediately', () => {
    const state = createRetryState(3);
    const decision = shouldStopRetry(state, 'some error', 'UNKNOWN', 'high', false);
    assert.strictEqual(decision.stop, true);
    assert.strictEqual(decision.status, 'NEEDS_HUMAN_REVIEW');
  });

  test('existing test modification blocks immediately', () => {
    const state = createRetryState(3);
    const decision = shouldStopRetry(state, 'some error', 'BAD_GENERATED_TEST', 'high', true);
    assert.strictEqual(decision.stop, true);
    assert.strictEqual(decision.status, 'EXISTING_TEST_MODIFIED');
  });
});
