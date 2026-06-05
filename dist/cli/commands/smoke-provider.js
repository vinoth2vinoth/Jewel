"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.runSmokeProvider = runSmokeProvider;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const config_1 = require("../../core/config");
const provider_factory_1 = require("../../agents/provider-factory");
const secret_redactor_1 = require("../../safety/secret-redactor");
async function runSmokeProvider(providerOverride, modelOverride, schemaFlag, noWriteFlag, cwd = process.cwd(), bypassExit = false) {
    console.log('Running Jewel Provider Smoke Test...');
    let config;
    try {
        config = (0, config_1.loadConfig)(cwd);
    }
    catch {
        config = { ...config_1.DEFAULT_CONFIG };
    }
    const provider = providerOverride || config.provider || 'none';
    const model = modelOverride || config.model;
    if (provider === 'none') {
        const msg = 'Error: Provider "none" is invalid for smoke-provider.';
        console.error(msg);
        if (bypassExit)
            throw new Error(msg);
        process.exit(1);
        return;
    }
    const validProviders = ['openai', 'gemini', 'anthropic', 'openrouter'];
    if (!validProviders.includes(provider)) {
        const msg = `Error: Invalid provider "${provider}". Must be one of: ${validProviders.join(', ')}.`;
        console.error(msg);
        if (bypassExit)
            throw new Error(msg);
        process.exit(1);
        return;
    }
    const keyMap = {
        openai: 'OPENAI_API_KEY',
        gemini: 'GEMINI_API_KEY',
        anthropic: 'ANTHROPIC_API_KEY',
        openrouter: 'OPENROUTER_API_KEY'
    };
    const expectedKey = keyMap[provider];
    if (!process.env[expectedKey]) {
        const msg = `Error: Missing API key environment variable "${expectedKey}" for provider "${provider}".`;
        console.error(msg);
        if (bypassExit)
            throw new Error(msg);
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
        adapter = (0, provider_factory_1.createAgentAdapter)(testConfig);
    }
    catch (err) {
        console.error(`Error instantiating provider adapter: ${err.message}`);
        if (bypassExit)
            throw err;
        process.exit(1);
        return;
    }
    // Create dummy review input
    const input = {
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
    let errorMsg;
    let result = null;
    try {
        console.log(`Calling provider "${provider}" with model "${model || 'default'}"...`);
        result = await adapter.reviewDiff(input);
    }
    catch (err) {
        status = 'FAIL';
        errorMsg = (0, secret_redactor_1.redactSecrets)(err.message);
        console.error(`[-] Provider smoke test failed: ${errorMsg}`);
    }
    let tokenUsage = 'usage unavailable';
    let usageObj = 'usage unavailable';
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
        const jsonReport = (0, secret_redactor_1.redactSecrets)(JSON.stringify(finalReport, null, 2));
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
        }
        else {
            md += `## Smoke Result\n\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\`\n`;
        }
        fs.writeFileSync(path.join(reportsDir, 'provider-smoke.md'), (0, secret_redactor_1.redactSecrets)(md), 'utf8');
        console.log(`[+] Smoke report saved to .jewel/reports/provider-smoke.md and .json`);
    }
    if (status === 'FAIL') {
        if (bypassExit)
            return finalReport;
        process.exit(1);
    }
    else {
        console.log('[+] Smoke test passed successfully!');
        if (bypassExit)
            return finalReport;
        process.exit(0);
    }
}
