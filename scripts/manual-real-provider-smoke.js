#!/usr/bin/env node
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Check environment gating
if (process.env.JEWEL_RUN_REAL_LLM_TESTS !== 'true') {
  console.error('Error: JEWEL_RUN_REAL_LLM_TESTS is not set to true. Refusing to run.');
  process.exit(1);
}

const args = process.argv.slice(2);
const helpIndex = args.indexOf('--help') !== -1 || args.indexOf('-h') !== -1;

if (args.length === 0 || helpIndex) {
  console.log(`
Jewel CLI - Manual Real Provider Smoke Validator (Gemini & OpenRouter Focused)

Usage:
  node scripts/manual-real-provider-smoke.js <provider> [model] [options]

Providers:
  gemini      (Primary default, uses GEMINI_API_KEY)
  openrouter  (Primary default, uses OPENROUTER_API_KEY)
  openai      (Optional/Skipped by default unless requested, uses OPENAI_API_KEY)
  anthropic   (Optional/Skipped by default unless requested, uses ANTHROPIC_API_KEY)

Options:
  --write     Save smoke reports to .jewel/reports/ (default: does not write reports to disk)
  --schema    Enable native structured JSON schema mode
  -h, --help  Display this help menu

Examples:
  node scripts/manual-real-provider-smoke.js gemini gemini-2.5-flash
  node scripts/manual-real-provider-smoke.js openrouter openai/gpt-4o-mini --schema
  node scripts/manual-real-provider-smoke.js openai gpt-4o-mini
  `);
  process.exit(0);
}

const provider = args[0];
if (provider === 'none') {
  console.error('Error: Provider "none" is invalid for manual-real-provider-smoke.');
  process.exit(1);
}

const model = args[1] && !args[1].startsWith('-') ? args[1] : undefined;
const writeRequested = args.includes('--write');
const schemaRequested = args.includes('--schema');

// Resolve path to build output
const cliPath = path.join(__dirname, '../dist/cli/index.js');
if (!fs.existsSync(cliPath)) {
  console.error('Error: compiled CLI build not found at dist/cli/index.js. Please run "npm run build" first.');
  process.exit(1);
}

// Locate secret redactor helper
let redactSecrets = (text) => text; // fallback
try {
  const redactorPath = path.join(__dirname, '../dist/safety/secret-redactor.js');
  if (fs.existsSync(redactorPath)) {
    const redactor = require(redactorPath);
    if (typeof redactor.redactSecrets === 'function') {
      redactSecrets = redactor.redactSecrets;
    }
  }
} catch (err) {
  console.warn('Warning: Could not load secret redactor. Error messages might not be redacted.');
}

const cliArgs = ['smoke-provider', '--provider', provider];
if (model) {
  cliArgs.push('--model', model);
}
if (!writeRequested) {
  cliArgs.push('--no-write');
}
if (schemaRequested) {
  cliArgs.push('--schema');
}

console.log(`Executing: node dist/cli/index.js ${cliArgs.join(' ')}`);

const result = spawnSync('node', [cliPath, ...cliArgs], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe']
});

if (result.stdout) {
  console.log(redactSecrets(result.stdout));
}
if (result.stderr) {
  console.error(redactSecrets(result.stderr));
}

process.exit(result.status === null ? 1 : result.status);
