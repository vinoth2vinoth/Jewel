"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAgentAdapter = createAgentAdapter;
const adapter_1 = require("./adapter");
const openai_adapter_1 = require("./providers/openai-adapter");
const gemini_adapter_1 = require("./providers/gemini-adapter");
const anthropic_adapter_1 = require("./providers/anthropic-adapter");
const openrouter_adapter_1 = require("./providers/openrouter-adapter");
function createAgentAdapter(config) {
    const provider = config.provider || 'none';
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
        default:
            throw new Error(`Unknown or invalid provider configured: "${provider}".`);
    }
}
