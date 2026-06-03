import * as fs from 'fs';
import * as path from 'path';
import { loadConfig, DEFAULT_CONFIG } from '../../core/config';
import { createAgentAdapter } from '../../agents/provider-factory';
import { redactSecrets } from '../../safety/secret-redactor';
import { ReviewInput } from '../../agents/adapter';

export async function runSmokeProvider(
  providerOverride?: string,
  modelOverride?: string,
  schemaFlag?: boolean,
  noWriteFlag?: boolean,
  cwd: string = process.cwd(),
  bypassExit: boolean = false
): Promise<any> {
  console.log('Running Jewel Provider Smoke Test...');

  let config: any;
  try {
    config = loadConfig(cwd);
  } catch {
    config = { ...DEFAULT_CONFIG };
  }

  const provider = providerOverride || config.provider || 'none';
  const model = modelOverride || config.model;

  if (provider === 'none') {
    const msg = 'Error: Provider "none" is invalid for smoke-provider.';
    console.error(msg);
    if (bypassExit) throw new Error(msg);
    process.exit(1);
    return;
  }

  const validProviders = ['openai', 'gemini', 'anthropic', 'openrouter'];
  if (!validProviders.includes(provider)) {
    const msg = `Error: Invalid provider "${provider}". Must be one of: ${validProviders.join(', ')}.`;
    console.error(msg);
    if (bypassExit) throw new Error(msg);
    process.exit(1);
    return;
  }

  const keyMap: Record<string, string> = {
    openai: 'OPENAI_API_KEY',
    gemini: 'GEMINI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    openrouter: 'OPENROUTER_API_KEY'
  };

  const expectedKey = keyMap[provider];
  if (!process.env[expectedKey]) {
    const msg = `Error: Missing API key environment variable "${expectedKey}" for provider "${provider}".`;
    console.error(msg);
    if (bypassExit) throw new Error(msg);
    process.exit(1);
    return;
  }

  // Create temporary config for adapter creation
  const testConfig = {
    ...config,
    provider,
    model,
    llmStrictJson: !!schemaFlag,
    allowUnstructuredProviderFallback: false // Enforce strict mode
  };

  let adapter;
  try {
    adapter = createAgentAdapter(testConfig);
  } catch (err: any) {
    console.error(`Error instantiating provider adapter: ${err.message}`);
    if (bypassExit) throw err;
    process.exit(1);
    return;
  }

  // Create dummy review input
  const input: ReviewInput = {
    diff: 'diff --git a/smoke.txt b/smoke.txt\nnew file mode 100644\n--- /dev/null\n+++ b/smoke.txt\n@@ -0,0 +1 @@\n+smoke test passed',
    verificationResult: {
      projectName: 'smoke',
      overallStatus: 'PASS',
      stats: { passed: 1, failed: 0, blocked: 0, skipped: 0 },
      results: [],
      date: new Date().toISOString(),
      mode: 'strict'
    },
    taskContract: {
      task: 'smoke test',
      understanding: 'smoke test',
      assumptions: [],
      filesLikelyNeeded: [],
      forbiddenActions: [],
      successCriteria: ['smoke test'],
      riskLevel: 'low',
      requiresApproval: false,
      createdAt: new Date().toISOString(),
      mode: 'strict'
    },
    config: testConfig
  };

  let status = 'PASS';
  let errorMsg: string | undefined;
  let result: any = null;

  try {
    console.log(`Calling provider "${provider}" with model "${model || 'default'}"...`);
    result = await adapter.reviewDiff(input);
  } catch (err: any) {
    status = 'FAIL';
    errorMsg = redactSecrets(err.message);
    console.error(`[-] Provider smoke test failed: ${errorMsg}`);
  }

  let tokenUsage = 'usage unavailable';
  let usageObj: any = 'usage unavailable';
  if (adapter.usage) {
    tokenUsage = `Input: ${adapter.usage.inputTokens ?? 0}, Output: ${adapter.usage.outputTokens ?? 0}, Total: ${adapter.usage.totalTokens ?? 0}`;
    usageObj = {
      inputTokens: adapter.usage.inputTokens,
      outputTokens: adapter.usage.outputTokens,
      totalTokens: adapter.usage.totalTokens,
      estimatedCostUsd: adapter.usage.estimatedCostUsd,
      retryCount: adapter.usage.retryCount ?? 0
    };
  }

  const finalReport = {
    provider,
    model: model || 'default',
    schemaMode: !!schemaFlag,
    status,
    usage: usageObj,
    error: errorMsg || null,
    timestamp: new Date().toISOString()
  };

  if (!noWriteFlag) {
    const reportsDir = path.join(cwd, '.jewel', 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const jsonReport = redactSecrets(JSON.stringify(finalReport, null, 2));
    fs.writeFileSync(path.join(reportsDir, 'provider-smoke.json'), jsonReport, 'utf8');

    let md = `# Jewel Provider Smoke Test Report\n\n`;
    md += `- **Provider:** ${provider}\n`;
    md += `- **Model:** ${model || 'default'}\n`;
    md += `- **Schema Mode:** ${schemaFlag ? 'Enabled' : 'Disabled'}\n`;
    md += `- **Status:** ${status}\n`;
    md += `- **Token Usage:** ${tokenUsage}\n`;
    md += `- **Timestamp:** ${finalReport.timestamp}\n\n`;

    if (errorMsg) {
      md += `## Failure Reason\n\n\`\`\`\n${errorMsg}\n\`\`\`\n`;
    } else {
      md += `## Smoke Result\n\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\`\n`;
    }

    fs.writeFileSync(path.join(reportsDir, 'provider-smoke.md'), redactSecrets(md), 'utf8');
    console.log(`[+] Smoke report saved to .jewel/reports/provider-smoke.md and .json`);
  }

  if (status === 'FAIL') {
    if (bypassExit) return finalReport;
    process.exit(1);
  } else {
    console.log('[+] Smoke test passed successfully!');
    if (bypassExit) return finalReport;
    process.exit(0);
  }
}
