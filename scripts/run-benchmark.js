#!/usr/bin/env node
/**
 * Jewel benchmark harness — delegates to compiled benchmark command.
 * Usage: node scripts/run-benchmark.js [--mock] [--live]
 */
const path = require('path');
const fs = require('fs');

const rootDir = path.join(__dirname, '..');
const cliEntry = path.join(rootDir, 'dist', 'cli', 'index.js');

if (!fs.existsSync(cliEntry)) {
  console.error('[benchmark] dist/cli/index.js not found. Run npm run build first.');
  process.exit(1);
}

const useMock = process.argv.includes('--mock') || !process.argv.includes('--live');
const args = [cliEntry, 'benchmark'];
if (useMock) args.push('--mock');

const { spawnSync } = require('child_process');
const result = spawnSync(process.execPath, args, { cwd: rootDir, stdio: 'inherit' });
process.exit(result.status === null ? 1 : result.status);
