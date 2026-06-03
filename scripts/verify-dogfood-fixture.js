#!/usr/bin/env node
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const dogfoodDir = path.join(__dirname, '../examples/dogfood-broken-project');

console.log('Verifying that dogfood project fixture is in a broken state...');

// 1. Clean up dist and .jewel directories in a cross-platform way
try {
  const distPath = path.join(dogfoodDir, 'dist');
  const jewelPath = path.join(dogfoodDir, '.jewel');
  if (fs.existsSync(distPath)) {
    fs.rmSync(distPath, { recursive: true, force: true });
  }
  if (fs.existsSync(jewelPath)) {
    fs.rmSync(jewelPath, { recursive: true, force: true });
  }
} catch (err) {
  console.error('Warning: Failed to clean up dogfood directories:', err.message);
}

// 2. Run npm test
let passed = false;
try {
  // Execute test suite, ignore output to stdout/stderr or capture it?
  // We can let it run and inherit stdio, or pipe it.
  execSync('npm test', { cwd: dogfoodDir, stdio: 'ignore' });
  passed = true;
} catch (err) {
  // Expected failure!
  passed = false;
}

if (passed) {
  console.error('\x1b[31m[FAIL] Dogfood fixture is not broken. src/math.ts appears already fixed.\x1b[0m');
  process.exit(1);
} else {
  console.log('\x1b[32m[PASS] Dogfood fixture is broken as expected.\x1b[0m');
  process.exit(0);
}
