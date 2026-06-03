import * as fs from 'fs';
import * as path from 'path';
import { loadConfig, DEFAULT_CONFIG } from '../../core/config';
import { getModelCapabilities } from '../../agents/model-capabilities';
import { runSmokeProvider } from './smoke-provider';
import { redactSecrets } from '../../safety/secret-redactor';

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

  // 2. Check Model Capabilities
  let config: any;
  try {
    config = loadConfig(cwd);
  } catch {
    config = { ...DEFAULT_CONFIG };
  }
  const model = modelOverride || config.model || '';
  const { capabilities, isKnown, warning } = getModelCapabilities(provider, model);
  if (warning) {
    console.log(`[WARN] ${warning}`);
  }

  const structuredOutputSupported = capabilities.supportsStructuredOutput ? 'Yes' : 'No';

  const reportsDir = path.join(cwd, '.jewel', 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  if (!apiKey) {
    const errorMsg = `Missing API key environment variable "${expectedKey}" for provider "${provider}".`;
    console.error(`Error: ${errorMsg}`);

    const finalReport = {
      provider,
      model: model || 'default',
      apiKeyPresent: 'No',
      structuredOutputSupported,
      smokeResult: 'FAIL',
      retryCount: 0,
      usage: null,
      redactionStatus: 'COMPLIANT',
      nextAction: `Set the ${expectedKey} environment variable.`,
      timestamp: new Date().toISOString()
    };

    fs.writeFileSync(
      path.join(reportsDir, 'provider-ready.json'),
      redactSecrets(JSON.stringify(finalReport, null, 2)),
      'utf8'
    );

    let md = `# Jewel Provider Readiness Report\n\n`;
    md += `- **Provider:** ${provider}\n`;
    md += `- **Model:** ${model || 'default'} (${isKnown ? 'Registered' : 'Unknown'})\n`;
    md += `- **API Key Present:** No (${expectedKey})\n`;
    md += `- **Supports Structured Output:** ${structuredOutputSupported}\n`;
    md += `- **Smoke Test Status:** FAIL\n`;
    md += `- **Timestamp:** ${finalReport.timestamp}\n\n`;
    md += `## Failure Details\n\n\`\`\`\n${errorMsg}\n\`\`\`\n`;
    md += `\n## Next Action\n\nSet the ${expectedKey} environment variable.\n`;

    fs.writeFileSync(path.join(reportsDir, 'provider-ready.md'), redactSecrets(md), 'utf8');
    console.log(`[-] Provider readiness check failed: ${errorMsg}`);
    console.log(`[+] Provider readiness report written to .jewel/reports/provider-ready.md and .json`);
    process.exit(1);
    return;
  }

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
    errorMsg = redactSecrets(err.message);
    console.error(`[-] Smoke test execution failed: ${errorMsg}`);
  }

  const nextAction = smokeStatus === 'FAIL'
    ? (provider === 'openrouter' && !capabilities.supportsStructuredOutput
       ? `Switch OpenRouter model to one that supports structured output (json_schema), or check OpenRouter documentation. For more details on model selection, please refer to docs/model-capabilities.md.`
       : `Verify API key validity, network connectivity, and retry.`)
    : `None. Provider is fully configured and ready.`;

  const retryCount = (smokeReport && smokeReport.usage && typeof smokeReport.usage.retryCount === 'number')
    ? smokeReport.usage.retryCount
    : 0;

  const usage = (smokeReport && smokeReport.usage && smokeReport.usage !== 'usage unavailable')
    ? smokeReport.usage
    : null;

  // 4. Write Provider Readiness Report
  const finalReport = {
    provider,
    model: model || 'default',
    apiKeyPresent: 'Yes',
    structuredOutputSupported,
    smokeResult: smokeStatus,
    retryCount,
    usage,
    redactionStatus: 'COMPLIANT',
    nextAction,
    timestamp: new Date().toISOString()
  };

  fs.writeFileSync(
    path.join(reportsDir, 'provider-ready.json'),
    redactSecrets(JSON.stringify(finalReport, null, 2)),
    'utf8'
  );

  let md = `# Jewel Provider Readiness Report\n\n`;
  md += `- **Provider:** ${provider}\n`;
  md += `- **Model:** ${model || 'default'} (${isKnown ? 'Registered' : 'Unknown'})\n`;
  md += `- **API Key Present:** Yes (${expectedKey})\n`;
  md += `- **Supports Structured Output:** ${structuredOutputSupported}\n`;
  md += `- **Smoke Test Status:** ${smokeStatus}\n`;
  md += `- **Retry Count:** ${retryCount}\n`;
  md += `- **Timestamp:** ${finalReport.timestamp}\n\n`;

  if (usage) {
    md += `## Usage metrics\n\n`;
    md += `- **Input Tokens:** ${usage.inputTokens ?? 0}\n`;
    md += `- **Output Tokens:** ${usage.outputTokens ?? 0}\n`;
    md += `- **Total Tokens:** ${usage.totalTokens ?? 0}\n`;
    if (usage.estimatedCostUsd !== undefined) {
      md += `- **Estimated Cost:** $${usage.estimatedCostUsd.toFixed(6)}\n`;
    }
    md += `\n`;
  }

  if (smokeStatus === 'FAIL') {
    md += `## Failure Details\n\n\`\`\`\n${errorMsg}\n\`\`\`\n`;
    md += `\n## Next Action\n\n${nextAction}\n`;
  } else {
    md += `## Readiness Summary\n\n[+] Provider "${provider}" is fully configured, validated, and ready for Jewel task execution.\n`;
  }

  fs.writeFileSync(path.join(reportsDir, 'provider-ready.md'), redactSecrets(md), 'utf8');
  console.log(`[+] Provider readiness report written to .jewel/reports/provider-ready.md and .json`);

  if (smokeStatus === 'FAIL') {
    process.exit(1);
  } else {
    process.exit(0);
  }
}
