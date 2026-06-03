#!/usr/bin/env node
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Check environment gating
if (process.env.JEWEL_RUN_REAL_LLM_TESTS !== 'true') {
  console.error('Error: JEWEL_RUN_REAL_LLM_TESTS is not set to true. Refusing to run.');
  console.error('To run this script, set the environment variable first.');
  console.error('PowerShell: $env:JEWEL_RUN_REAL_LLM_TESTS="true"');
  console.error('Bash: export JEWEL_RUN_REAL_LLM_TESTS=true');
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
  -h, --help  Display this help menu

PowerShell Setup:
  $env:JEWEL_RUN_REAL_LLM_TESTS="true"
  $env:GEMINI_API_KEY="your_gemini_key"
  $env:OPENROUTER_API_KEY="your_openrouter_key"
  node scripts/manual-real-provider-smoke.js gemini gemini-2.5-flash
  node scripts/manual-real-provider-smoke.js openrouter openai/gpt-4o-mini

Bash Setup:
  export JEWEL_RUN_REAL_LLM_TESTS=true
  export GEMINI_API_KEY="your_gemini_key"
  export OPENROUTER_API_KEY="your_openrouter_key"
  node scripts/manual-real-provider-smoke.js gemini gemini-2.5-flash
  node scripts/manual-real-provider-smoke.js openrouter openai/gpt-4o-mini
  `);
  process.exit(0);
}

const provider = args[0];
if (provider === 'none') {
  console.error('Error: Provider "none" is invalid for manual-real-provider-smoke.');
  process.exit(1);
}

const validProviders = ['openai', 'gemini', 'anthropic', 'openrouter'];
if (!validProviders.includes(provider)) {
  console.error(`Error: Invalid provider "${provider}". Must be one of: ${validProviders.join(', ')}.`);
  process.exit(1);
}

const model = args[1] && !args[1].startsWith('-') ? args[1] : undefined;

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

// Check API Key existence before running
const keyMap = {
  gemini: 'GEMINI_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY'
};
const expectedKey = keyMap[provider];
if (expectedKey && !process.env[expectedKey]) {
  console.error(`Error: Missing API key environment variable "${expectedKey}" for provider "${provider}".`);
  process.exit(1);
}

// Check model capability
let supportsStructuredOutput = true;
try {
  const capPath = path.join(__dirname, '../dist/agents/model-capabilities.js');
  if (fs.existsSync(capPath)) {
    const { getModelCapabilities } = require(capPath);
    const { capabilities } = getModelCapabilities(provider, model || '');
    supportsStructuredOutput = capabilities.supportsStructuredOutput;
  }
} catch (err) {}

// Always run smoke-provider with --schema and --no-write
const cliArgs = ['smoke-provider', '--provider', provider];
if (model) {
  cliArgs.push('--model', model);
}
cliArgs.push('--schema');
cliArgs.push('--no-write');

console.log(`Executing: node dist/cli/index.js ${cliArgs.join(' ')}`);

const result = spawnSync('node', [cliPath, ...cliArgs], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe']
});

const output = redactSecrets(result.stdout || '');
const errorOutput = redactSecrets(result.stderr || '');

if (output) {
  console.log(output);
}
if (errorOutput) {
  console.error(errorOutput);
}

// Output switch guidance if schema unsupported
if (provider === 'openrouter' && !supportsStructuredOutput) {
  console.log(`\n[WARN] Model "${model || 'default'}" does not support structured outputs natively.`);
  console.log(`Next Action: Please switch models to one known to support structured outputs, such as "openai/gpt-4o-mini", "anthropic/claude-3.5-sonnet", or "meta-llama/llama-3.3-70b-instruct".`);
  console.log(`We recommend keeping "allowUnstructuredProviderFallback" disabled for maximum safety.`);
  console.log(`For more details on model selection, please refer to docs/model-capabilities.md.\n`);
}

// Save smoke report manually to .jewel/reports/provider-smoke.json & .md
const reportsDir = path.join(process.cwd(), '.jewel', 'reports');
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

const status = result.status === 0 ? 'PASS' : 'FAIL';
const timestamp = new Date().toISOString();

const finalReport = {
  provider,
  model: model || 'default',
  schemaMode: true,
  status,
  error: status === 'FAIL' ? (output + '\n' + errorOutput).trim() : null,
  timestamp
};

fs.writeFileSync(
  path.join(reportsDir, 'provider-smoke.json'),
  JSON.stringify(finalReport, null, 2),
  'utf8'
);

let md = `# Jewel Provider Smoke Test Report (Manual)\n\n`;
md += `- **Provider:** ${provider}\n`;
md += `- **Model:** ${model || 'default'}\n`;
md += `- **Schema Mode:** Enabled\n`;
md += `- **Status:** ${status}\n`;
md += `- **Timestamp:** ${timestamp}\n\n`;

if (status === 'FAIL') {
  md += `## Failure Reason\n\n\`\`\`\n${(output + '\n' + errorOutput).trim()}\n\`\`\`\n`;
  if (provider === 'openrouter' && !supportsStructuredOutput) {
    md += `\n## Next Action\n\nPlease switch models to one known to support structured outputs, such as "openai/gpt-4o-mini", "anthropic/claude-3.5-sonnet", or "meta-llama/llama-3.3-70b-instruct". For more information refer to docs/model-capabilities.md.\n`;
  }
} else {
  md += `## Smoke Result\n\nSmoke test passed successfully via manual validator.\n`;
}

fs.writeFileSync(path.join(reportsDir, 'provider-smoke.md'), md, 'utf8');
console.log(`[+] Manual validation smoke report saved to .jewel/reports/provider-smoke.md and .json`);

process.exit(result.status === null ? 1 : result.status);
