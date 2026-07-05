"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAgentAdapter = createAgentAdapter;
const adapter_1 = require("./adapter");
const openai_adapter_1 = require("./providers/openai-adapter");
const gemini_adapter_1 = require("./providers/gemini-adapter");
const anthropic_adapter_1 = require("./providers/anthropic-adapter");
const openrouter_adapter_1 = require("./providers/openrouter-adapter");
const deepseek_adapter_1 = require("./providers/deepseek-adapter");
const fallback_adapter_1 = require("./fallback-adapter");
function createSingleAdapter(provider) {
    switch (provider) {
        case 'none':
            return new adapter_1.MockAgentAdapter();
        case 'openai':
            return new openai_adapter_1.OpenAIAdapter();
        case 'gemini':
            return new gemini_adapter_1.GeminiAdapter();
        case 'anthropic':
            return new anthropic_adapter_1.AnthropicAdapter();
        case 'openrouter':
            return new openrouter_adapter_1.OpenRouterAdapter();
        case 'deepseek':
            return new deepseek_adapter_1.DeepSeekAdapter();
        default:
            throw new Error(`Unknown or invalid provider configured: "${provider}".`);
    }
}
function createAgentAdapter(config) {
    const provider = config.provider || 'none';
    // Opt-in provider fallback chain: primary provider first, then each
    // additional preferred provider, tried only on connection failures.
    const preferred = (config.preferredProviders || []).filter(p => p !== provider && p !== 'none' && ['openai', 'gemini', 'anthropic', 'openrouter', 'deepseek'].includes(p));
    if (provider !== 'none' && preferred.length > 0) {
        const chain = [
            { provider, create: () => createSingleAdapter(provider) },
            ...preferred.map(p => ({ provider: p, create: () => createSingleAdapter(p) }))
        ];
        return new fallback_adapter_1.FallbackAgentAdapter(chain);
    }
    return createSingleAdapter(provider);
}
