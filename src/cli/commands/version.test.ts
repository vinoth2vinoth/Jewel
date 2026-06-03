import test from 'node:test';
import assert from 'node:assert';
import { runVersion } from './version';

test('version command prints package and node version info', () => {
  const originalLog = console.log;
  const logs: string[] = [];
  console.log = (...args: any[]) => {
    logs.push(args.join(' '));
  };

  try {
    runVersion();
    
    // Assert version outputs something like "Jewel version: ..."
    const hasJewel = logs.some(log => log.includes('Jewel version:'));
    const hasNode = logs.some(log => log.includes('Node.js version:'));
    const hasPlatform = logs.some(log => log.includes('Platform:'));
    const hasConfig = logs.some(log => log.includes('Default configuration:'));

    assert.ok(hasJewel, 'Should print Jewel version');
    assert.ok(hasNode, 'Should print Node.js version');
    assert.ok(hasPlatform, 'Should print Platform');
    assert.ok(hasConfig, 'Should print Config details');
  } finally {
    console.log = originalLog;
  }
});
