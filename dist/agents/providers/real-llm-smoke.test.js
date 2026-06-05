"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const node_assert_1 = __importDefault(require("node:assert"));
const openai_adapter_1 = require("./openai-adapter");
const gemini_adapter_1 = require("./gemini-adapter");
const anthropic_adapter_1 = require("./anthropic-adapter");
const openrouter_adapter_1 = require("./openrouter-adapter");
const config_1 = require("../../core/config");
const secret_redactor_1 = require("../../safety/secret-redactor");
(0, node_test_1.default)('real provider smoke tests - only runs when JEWEL_RUN_REAL_LLM_TESTS is true', async () => {
    if (process.env.JEWEL_RUN_REAL_LLM_TESTS !== 'true') {
        console.log('Skipping real LLM provider tests (JEWEL_RUN_REAL_LLM_TESTS is not set to true).');
        return;
    }
    const task = 'Return a JSON object conforming to TaskContract schema for a dummy task.';
    const repoSummary = 'Files:\n- dummy.txt';
    // 1. OpenAI
    if (process.env.OPENAI_API_KEY) {
        console.log('Running real OpenAI smoke test...');
        try {
            const adapter = new openai_adapter_1.OpenAIAdapter();
            const plan = await adapter.plan({
                task,
                repoSummary,
                config: { ...config_1.DEFAULT_CONFIG, model: 'gpt-4o-mini' },
                skills: []
            });
            node_assert_1.default.ok(plan.task);
            node_assert_1.default.ok(plan.understanding);
        }
        catch (err) {
            throw new Error(`OpenAI test failed: ${(0, secret_redactor_1.redactSecrets)(err.message)}`);
        }
    }
    else {
        console.log('Skipping OpenAI real provider test (OPENAI_API_KEY missing).');
    }
    // 2. Gemini
    if (process.env.GEMINI_API_KEY) {
        console.log('Running real Gemini smoke test...');
        try {
            const adapter = new gemini_adapter_1.GeminiAdapter();
            const plan = await adapter.plan({
                task,
                repoSummary,
                config: { ...config_1.DEFAULT_CONFIG, model: 'gemini-1.5-flash' },
                skills: []
            });
            node_assert_1.default.ok(plan.task);
            node_assert_1.default.ok(plan.understanding);
        }
        catch (err) {
            throw new Error(`Gemini test failed: ${(0, secret_redactor_1.redactSecrets)(err.message)}`);
        }
    }
    else {
        console.log('Skipping Gemini real provider test (GEMINI_API_KEY missing).');
    }
    // 3. Anthropic
    if (process.env.ANTHROPIC_API_KEY) {
        console.log('Running real Anthropic smoke test...');
        try {
            const adapter = new anthropic_adapter_1.AnthropicAdapter();
            const plan = await adapter.plan({
                task,
                repoSummary,
                config: { ...config_1.DEFAULT_CONFIG, model: 'claude-3-5-haiku-20241022' },
                skills: []
            });
            node_assert_1.default.ok(plan.task);
            node_assert_1.default.ok(plan.understanding);
        }
        catch (err) {
            throw new Error(`Anthropic test failed: ${(0, secret_redactor_1.redactSecrets)(err.message)}`);
        }
    }
    else {
        console.log('Skipping Anthropic real provider test (ANTHROPIC_API_KEY missing).');
    }
    // 4. OpenRouter
    if (process.env.OPENROUTER_API_KEY) {
        console.log('Running real OpenRouter smoke test...');
        try {
            const adapter = new openrouter_adapter_1.OpenRouterAdapter();
            const plan = await adapter.plan({
                task,
                repoSummary,
                config: { ...config_1.DEFAULT_CONFIG, model: 'openai/gpt-4o-mini' },
                skills: []
            });
            node_assert_1.default.ok(plan.task);
            node_assert_1.default.ok(plan.understanding);
        }
        catch (err) {
            throw new Error(`OpenRouter test failed: ${(0, secret_redactor_1.redactSecrets)(err.message)}`);
        }
    }
    else {
        console.log('Skipping OpenRouter real provider test (OPENROUTER_API_KEY missing).');
    }
});
