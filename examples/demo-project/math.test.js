const assert = require('assert');
const { add, divide } = require('./math');

console.log('Running math tests...');

// 1. Passing test
try {
  assert.strictEqual(add(2, 3), 5);
  console.log('  [PASS] add(2, 3) should equal 5');
} catch (err) {
  console.error('  [FAIL] add(2, 3) test failed:', err.message);
  process.exit(1);
}

// 2. Intentionally breakable test
if (process.env.JEWEL_FAIL_DEMO === 'true') {
  console.log('  [INFO] JEWEL_FAIL_DEMO environment variable is true. Triggering failure.');
  try {
    // Assert 10 / 0 returns 10 (which is mathematically false and will fail/throw)
    assert.strictEqual(divide(10, 0), 10);
    console.log('  [PASS] divide by zero test');
  } catch (err) {
    console.error('  [FAIL] divide(10, 0) test failed (as expected):', err.message);
    process.exit(1);
  }
} else {
  try {
    assert.throws(() => divide(10, 0), /Cannot divide by zero/);
    console.log('  [PASS] divide(10, 0) should throw exception');
  } catch (err) {
    console.error('  [FAIL] exception test failed:', err.message);
    process.exit(1);
  }
}

console.log('\nAll tests executed successfully.');
process.exit(0);
