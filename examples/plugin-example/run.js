#!/usr/bin/env node
/**
 * Example Jewel critic plugin.
 * Reads PluginContext JSON from stdin; prints PluginResult JSON to stdout.
 */
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  let context = {};
  try {
    context = JSON.parse(input || '{}');
  } catch {}

  const diff = typeof context.diffContent === 'string' ? context.diffContent : '';
  const findings = [];
  if (diff.includes('package.json')) {
    findings.push('Diff touches package.json — review dependency changes carefully.');
  }

  const result = {
    status: findings.length > 0 ? 'WARN' : 'PASS',
    findings
  };
  process.stdout.write(JSON.stringify(result));
});
