"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const node_assert_1 = __importDefault(require("node:assert"));
const config_1 = require("./config");
(0, node_test_1.default)('config loader - default config', () => {
    const result = (0, config_1.validateAndMergeConfig)({});
    node_assert_1.default.deepStrictEqual(result, config_1.DEFAULT_CONFIG);
});
(0, node_test_1.default)('config loader - valid partial config overrides defaults', () => {
    const result = (0, config_1.validateAndMergeConfig)({
        projectName: 'MyTestProject',
        maxRetries: 5,
        commands: {
            test: 'npm run test-ci'
        }
    });
    node_assert_1.default.strictEqual(result.projectName, 'MyTestProject');
    node_assert_1.default.strictEqual(result.maxRetries, 5);
    node_assert_1.default.strictEqual(result.commands.test, 'npm run test-ci');
    node_assert_1.default.strictEqual(result.commands.build, ''); // should fall back to default
});
(0, node_test_1.default)('config loader - invalid types throw error', () => {
    node_assert_1.default.throws(() => {
        (0, config_1.validateAndMergeConfig)({ projectName: 123 });
    }, /projectName.*must be a string/);
    node_assert_1.default.throws(() => {
        (0, config_1.validateAndMergeConfig)({ mode: 'unsafe' });
    }, /mode.*must be "strict" or "lax"/);
    node_assert_1.default.throws(() => {
        (0, config_1.validateAndMergeConfig)({ maxRetries: -1 });
    }, /maxRetries.*must be a non-negative number/);
    node_assert_1.default.throws(() => {
        (0, config_1.validateAndMergeConfig)({ requirePlanBeforeEdit: 'yes' });
    }, /requirePlanBeforeEdit.*must be a boolean/);
    // v0.3 LLM Config validation
    node_assert_1.default.throws(() => {
        (0, config_1.validateAndMergeConfig)({ provider: 'invalid_provider' });
    }, /provider.*must be one of/);
    node_assert_1.default.throws(() => {
        (0, config_1.validateAndMergeConfig)({ llmTimeoutMs: -10 });
    }, /llmTimeoutMs.*must be a non-negative number/);
    node_assert_1.default.throws(() => {
        (0, config_1.validateAndMergeConfig)({ llmMaxRetries: 'invalid' });
    }, /llmMaxRetries.*must be a non-negative number/);
    node_assert_1.default.throws(() => {
        (0, config_1.validateAndMergeConfig)({ llmStrictJson: 'not_bool' });
    }, /llmStrictJson.*must be a boolean/);
    // Check valid LLM fields work
    const valid = (0, config_1.validateAndMergeConfig)({
        provider: 'openai',
        model: 'gpt-4o',
        temperature: 0.7,
        maxOutputTokens: 2000,
        llmTimeoutMs: 30000,
        llmMaxRetries: 3,
        llmStrictJson: false
    });
    node_assert_1.default.strictEqual(valid.provider, 'openai');
    node_assert_1.default.strictEqual(valid.model, 'gpt-4o');
    node_assert_1.default.strictEqual(valid.temperature, 0.7);
    node_assert_1.default.strictEqual(valid.maxOutputTokens, 2000);
    node_assert_1.default.strictEqual(valid.llmTimeoutMs, 30000);
    node_assert_1.default.strictEqual(valid.llmMaxRetries, 3);
    node_assert_1.default.strictEqual(valid.llmStrictJson, false);
    // Critics validation tests
    node_assert_1.default.throws(() => {
        (0, config_1.validateAndMergeConfig)({ critics: 'not_an_array' });
    }, /critics.*must be an array/);
    node_assert_1.default.throws(() => {
        (0, config_1.validateAndMergeConfig)({ critics: ['invalid_critic'] });
    }, /critics\[0\].*must be one of "security", "linter", or "architect"/);
    const configWithCritics = (0, config_1.validateAndMergeConfig)({
        critics: ['security', 'linter', 'architect']
    });
    node_assert_1.default.deepStrictEqual(configWithCritics.critics, ['security', 'linter', 'architect']);
});
