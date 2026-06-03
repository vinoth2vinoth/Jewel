#!/usr/bin/env node
const path = require('path');
const cli = require(path.join(__dirname, '../dist/cli/index.js'));

cli.main().catch(err => {
  console.error('Unhandled CLI error:', err);
  process.exit(1);
});
