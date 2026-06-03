import * as fs from 'fs';
import * as path from 'path';
import { loadConfig, DEFAULT_CONFIG } from '../../core/config';
import { getModelCapabilities } from '../../agents/model-capabilities';
import { runSmokeProvider } from './smoke-provider';

export async function runProviderReady(
  provider: string,
  modelOverride?: string,
  cwd: string = process.cwd()
): Promise<void> {
  console.log(`Checking LLM Provider Readiness for "${provider}"...`);

  if (!provider || provider === 'none') {
    console.error('Error: Provider "none" (or empty) is invalid for provider-ready check.');
    process.exit(1);
    return;
  }

  const validProviders = ['openai', 'gemini', 'anthropic', 'openrouter'];
  if (!validProviders.includes(provider)) {
    console.error(`Error: Invalid provider "${provider}". Must be one of: ${validProviders.join(', ')}.`);
    process.exit(1);
    return;
  }

  // 1. Check API Key
  const keyMap: Record<string, string> = {
    openai: 'OPENAI_API_KEY',
    gemini: 'GEMINI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    openrouter: 'OPENROUTER_API_KEY'
  };
  const expectedKey = keyMap[provider];
  const apiKey = process.env[expectedKey];
  if (!apiKey) {
    console.error(`Error: Missing API key environment variable "${expectedKey}" for provider "${provider}".`);
    process.exit(1);
    return;
  }

  // 2. Check Model Capabilities
  let config: any;
  try {
    config = loadConfig(cwd);
  } catch {
    config = { ...DEFAULT_CONFIG };
  }
  const model = modelOverride || config.model;
  const { capabilities, isKnown, warning } = getModelCapabilities(provider, model || '');
  if (warning) {
    console.log(`[WARN] ${warning}`);
  }

  const supportsStructuredOutput = capabilities.supportsStructuredOutput;

  // 3. Run Smoke Provider with schema flag active and no-write (we write our own report)
  console.log('Running provider readiness smoke connection test...');
  let smokeStatus = 'FAIL';
  let errorMsg: string | null = null;
  let smokeReport: any = null;

  try {
    smokeReport = await runSmokeProvider(provider, model, true, true, cwd, true);
    smokeStatus = smokeReport.status;
    errorMsg = smokeReport.error;
  } catch (err: any) {
    smokeStatus = 'FAIL';
    errorMsg = err.message;
    console.error(`[-] Smoke test execution failed: ${err.message}`);
  }

  // 4. Write Provider Readiness Report
  const finalReport = {
    provider,
    model: model || 'default',
    apiKeyPresent: true,
    isModelKnown: isKnown,
    supportsStructuredOutput,
    smokeTestStatus: smokeStatus,
    error: errorMsg,
    timestamp: new Date().toISOString()
  };

  const reportsDir = path.join(cwd, '.jewel', 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(reportsDir, 'provider-readiness.json'),
    JSON.stringify(finalReport, null, 2),
    'utf8'
  );

  let md = `# Jewel Provider Readiness Report\n\n`;
  md += `- **Provider:** ${provider}\n`;
  md += `- **Model:** ${model || 'default'} (${isKnown ? 'Registered' : 'Unknown'})\n`;
  md += `- **API Key Present:** Yes (${expectedKey})\n`;
  md += `- **Supports Structured Output:** ${supportsStructuredOutput ? 'Yes' : 'No'}\n`;
  md += `- **Smoke Test Status:** ${smokeStatus}\n`;
  md += `- **Timestamp:** ${finalReport.timestamp}\n\n`;

  if (errorMsg) {
    md += `## Failure Details\n\n\`\`\`\n${errorMsg}\n\`\`\`\n`;
  } else {
    md += `## Readiness Summary\n\n[+] Provider "${provider}" is fully configured, validated, and ready for Jewel task execution.\n`;
  }

  fs.writeFileSync(path.join(reportsDir, 'provider-readiness.md'), md, 'utf8');
  console.log(`[+] Provider readiness report written to .jewel/reports/provider-readiness.md and .json`);

  if (smokeStatus === 'FAIL') {
    process.exit(1);
  } else {
    process.exit(0);
  }
}
