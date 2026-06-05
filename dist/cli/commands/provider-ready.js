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
exports.runProviderReady = runProviderReady;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const config_1 = require("../../core/config");
const model_capabilities_1 = require("../../agents/model-capabilities");
const smoke_provider_1 = require("./smoke-provider");
const secret_redactor_1 = require("../../safety/secret-redactor");
async function runProviderReady(provider, modelOverride, cwd = process.cwd()) {
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
    const keyMap = {
        openai: 'OPENAI_API_KEY',
        gemini: 'GEMINI_API_KEY',
        anthropic: 'ANTHROPIC_API_KEY',
        openrouter: 'OPENROUTER_API_KEY'
    };
    const expectedKey = keyMap[provider];
    const apiKey = process.env[expectedKey];
    // 2. Check Model Capabilities
    let config;
    try {
        config = (0, config_1.loadConfig)(cwd);
    }
    catch {
        config = { ...config_1.DEFAULT_CONFIG };
    }
    const model = modelOverride || config.model || '';
    const { capabilities, isKnown, warning } = (0, model_capabilities_1.getModelCapabilities)(provider, model);
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
        fs.writeFileSync(path.join(reportsDir, 'provider-ready.json'), (0, secret_redactor_1.redactSecrets)(JSON.stringify(finalReport, null, 2)), 'utf8');
        let md = `# Jewel Provider Readiness Report\n\n`;
        md += `- **Provider:** ${provider}\n`;
        md += `- **Model:** ${model || 'default'} (${isKnown ? 'Registered' : 'Unknown'})\n`;
        md += `- **API Key Present:** No (${expectedKey})\n`;
        md += `- **Supports Structured Output:** ${structuredOutputSupported}\n`;
        md += `- **Smoke Test Status:** FAIL\n`;
        md += `- **Timestamp:** ${finalReport.timestamp}\n\n`;
        md += `## Failure Details\n\n\`\`\`\n${errorMsg}\n\`\`\`\n`;
        md += `\n## Next Action\n\nSet the ${expectedKey} environment variable.\n`;
        fs.writeFileSync(path.join(reportsDir, 'provider-ready.md'), (0, secret_redactor_1.redactSecrets)(md), 'utf8');
        console.log(`[-] Provider readiness check failed: ${errorMsg}`);
        console.log(`[+] Provider readiness report written to .jewel/reports/provider-ready.md and .json`);
        process.exit(1);
        return;
    }
    // 3. Run Smoke Provider with schema flag active and no-write (we write our own report)
    console.log('Running provider readiness smoke connection test...');
    let smokeStatus = 'FAIL';
    let errorMsg = null;
    let smokeReport = null;
    try {
        smokeReport = await (0, smoke_provider_1.runSmokeProvider)(provider, model, true, true, cwd, true);
        smokeStatus = smokeReport.status;
        errorMsg = smokeReport.error;
    }
    catch (err) {
        smokeStatus = 'FAIL';
        errorMsg = (0, secret_redactor_1.redactSecrets)(err.message);
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
    fs.writeFileSync(path.join(reportsDir, 'provider-ready.json'), (0, secret_redactor_1.redactSecrets)(JSON.stringify(finalReport, null, 2)), 'utf8');
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
    }
    else {
        md += `## Readiness Summary\n\n[+] Provider "${provider}" is fully configured, validated, and ready for Jewel task execution.\n`;
    }
    fs.writeFileSync(path.join(reportsDir, 'provider-ready.md'), (0, secret_redactor_1.redactSecrets)(md), 'utf8');
    console.log(`[+] Provider readiness report written to .jewel/reports/provider-ready.md and .json`);
    if (smokeStatus === 'FAIL') {
        process.exit(1);
    }
    else {
        process.exit(0);
    }
}
