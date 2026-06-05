"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const node_assert_1 = __importDefault(require("node:assert"));
const provider_factory_1 = require("./provider-factory");
const config_1 = require("../core/config");
const adapter_1 = require("./adapter");
const openai_adapter_1 = require("./providers/openai-adapter");
const gemini_adapter_1 = require("./providers/gemini-adapter");
const anthropic_adapter_1 = require("./providers/anthropic-adapter");
const openrouter_adapter_1 = require("./providers/openrouter-adapter");
(0, node_test_1.default)('provider-factory - createAgentAdapter cases', () => {
    // 1. none returns MockAgentAdapter
    const adapterNone = (0, provider_factory_1.createAgentAdapter)({ ...config_1.DEFAULT_CONFIG, provider: 'none' });
    node_assert_1.default.ok(adapterNone instanceof adapter_1.MockAgentAdapter);
    // 2. openai returns OpenAIAdapter
    const adapterOpenAI = (0, provider_factory_1.createAgentAdapter)({ ...config_1.DEFAULT_CONFIG, provider: 'openai' });
    node_assert_1.default.ok(adapterOpenAI instanceof openai_adapter_1.OpenAIAdapter);
    // 3. gemini returns GeminiAdapter
    const adapterGemini = (0, provider_factory_1.createAgentAdapter)({ ...config_1.DEFAULT_CONFIG, provider: 'gemini' });
    node_assert_1.default.ok(adapterGemini instanceof gemini_adapter_1.GeminiAdapter);
    // 4. anthropic returns AnthropicAdapter
    const adapterAnthropic = (0, provider_factory_1.createAgentAdapter)({ ...config_1.DEFAULT_CONFIG, provider: 'anthropic' });
    node_assert_1.default.ok(adapterAnthropic instanceof anthropic_adapter_1.AnthropicAdapter);
    // 5. openrouter returns OpenRouterAdapter
    const adapterOpenRouter = (0, provider_factory_1.createAgentAdapter)({ ...config_1.DEFAULT_CONFIG, provider: 'openrouter' });
    node_assert_1.default.ok(adapterOpenRouter instanceof openrouter_adapter_1.OpenRouterAdapter);
    // 6. unknown provider throws validation error
    node_assert_1.default.throws(() => {
        (0, provider_factory_1.createAgentAdapter)({ ...config_1.DEFAULT_CONFIG, provider: 'unknown' });
    }, /Unknown or invalid provider/);
});
