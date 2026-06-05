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
(0, node_test_1.default)('config loader - sandbox parameters validation', () => {
    const defaults = (0, config_1.validateAndMergeConfig)({});
    node_assert_1.default.strictEqual(defaults.useSandbox, false);
    node_assert_1.default.strictEqual(defaults.sandboxFallbackToHost, false);
    node_assert_1.default.strictEqual(defaults.sandboxImage, 'node:18-slim');
    node_assert_1.default.deepStrictEqual(defaults.sandboxVolumes, {});
    node_assert_1.default.deepStrictEqual(defaults.sandboxEnv, {});
    const valid = (0, config_1.validateAndMergeConfig)({
        useSandbox: true,
        sandboxFallbackToHost: true,
        sandboxImage: 'node:20',
        sandboxVolumes: { './my-host': '/my-container' },
        sandboxEnv: { 'API_KEY': '$API_KEY' }
    });
    node_assert_1.default.strictEqual(valid.useSandbox, true);
    node_assert_1.default.strictEqual(valid.sandboxFallbackToHost, true);
    node_assert_1.default.strictEqual(valid.sandboxImage, 'node:20');
    node_assert_1.default.deepStrictEqual(valid.sandboxVolumes, { './my-host': '/my-container' });
    node_assert_1.default.deepStrictEqual(valid.sandboxEnv, { 'API_KEY': '$API_KEY' });
    // Invalid types
    node_assert_1.default.throws(() => {
        (0, config_1.validateAndMergeConfig)({ useSandbox: 'not-a-bool' });
    }, /useSandbox.*must be a boolean/);
    node_assert_1.default.throws(() => {
        (0, config_1.validateAndMergeConfig)({ sandboxFallbackToHost: 'not-a-bool' });
    }, /sandboxFallbackToHost.*must be a boolean/);
    node_assert_1.default.throws(() => {
        (0, config_1.validateAndMergeConfig)({ sandboxImage: 123 });
    }, /sandboxImage.*must be a string/);
    node_assert_1.default.throws(() => {
        (0, config_1.validateAndMergeConfig)({ sandboxVolumes: 'not-an-object' });
    }, /sandboxVolumes.*must be an object/);
    node_assert_1.default.throws(() => {
        (0, config_1.validateAndMergeConfig)({ sandboxVolumes: [] }); // array is an object in JS
    }, /sandboxVolumes.*must be an object/);
    node_assert_1.default.throws(() => {
        (0, config_1.validateAndMergeConfig)({ sandboxVolumes: { '/host': 'relative/container' } });
    }, /sandboxVolumes.*destination path.*must be absolute/);
    node_assert_1.default.throws(() => {
        (0, config_1.validateAndMergeConfig)({ sandboxEnv: 'not-an-object' });
    }, /sandboxEnv.*must be an object/);
});
(0, node_test_1.default)('config loader - allowedSymbolChanges validation', () => {
    const result = (0, config_1.validateAndMergeConfig)({
        allowedSymbolChanges: ['myFunc', 'MyClass.myMethod']
    });
    node_assert_1.default.deepStrictEqual(result.allowedSymbolChanges, ['myFunc', 'MyClass.myMethod']);
    node_assert_1.default.throws(() => {
        (0, config_1.validateAndMergeConfig)({ allowedSymbolChanges: 'not-an-array' });
    }, /allowedSymbolChanges.*must be an array/);
    node_assert_1.default.throws(() => {
        (0, config_1.validateAndMergeConfig)({ allowedSymbolChanges: [123] });
    }, /allowedSymbolChanges\[0\].*must be a string/);
});
(0, node_test_1.default)('config loader - sandbox network, read-only root, and write paths validation', () => {
    const defaults = (0, config_1.validateAndMergeConfig)({});
    node_assert_1.default.strictEqual(defaults.sandboxNetwork, 'none');
    node_assert_1.default.strictEqual(defaults.sandboxReadOnlyRoot, true);
    node_assert_1.default.deepStrictEqual(defaults.sandboxWritePaths, []);
    const valid = (0, config_1.validateAndMergeConfig)({
        sandboxNetwork: 'bridge',
        sandboxReadOnlyRoot: false,
        sandboxWritePaths: ['coverage', 'src/temp']
    });
    node_assert_1.default.strictEqual(valid.sandboxNetwork, 'bridge');
    node_assert_1.default.strictEqual(valid.sandboxReadOnlyRoot, false);
    node_assert_1.default.deepStrictEqual(valid.sandboxWritePaths, ['coverage', 'src/temp']);
    // Invalid sandboxNetwork
    node_assert_1.default.throws(() => {
        (0, config_1.validateAndMergeConfig)({ sandboxNetwork: 'invalid-net' });
    }, /sandboxNetwork.*must be one of/);
    // Invalid sandboxReadOnlyRoot
    node_assert_1.default.throws(() => {
        (0, config_1.validateAndMergeConfig)({ sandboxReadOnlyRoot: 'not-a-bool' });
    }, /sandboxReadOnlyRoot.*must be a boolean/);
    // Invalid sandboxWritePaths type
    node_assert_1.default.throws(() => {
        (0, config_1.validateAndMergeConfig)({ sandboxWritePaths: 'not-an-array' });
    }, /sandboxWritePaths.*must be an array/);
    node_assert_1.default.throws(() => {
        (0, config_1.validateAndMergeConfig)({ sandboxWritePaths: [123] });
    }, /sandboxWritePaths\[0\].*must be a string/);
    // Path Escape & Traversal rejections
    // 1. Colon detection
    node_assert_1.default.throws(() => {
        (0, config_1.validateAndMergeConfig)({ sandboxWritePaths: ['C:escaped'] });
    }, /contains a colon/);
    // 2. Absolute paths
    node_assert_1.default.throws(() => {
        (0, config_1.validateAndMergeConfig)({ sandboxWritePaths: ['/absolute'] });
    }, /must be a relative path/);
    node_assert_1.default.throws(() => {
        (0, config_1.validateAndMergeConfig)({ sandboxWritePaths: ['\\\\unc\\path'] });
    }, /must be a relative path/);
    // 3. Root references
    node_assert_1.default.throws(() => {
        (0, config_1.validateAndMergeConfig)({ sandboxWritePaths: ['.'] });
    }, /must be a relative path/);
    node_assert_1.default.throws(() => {
        (0, config_1.validateAndMergeConfig)({ sandboxWritePaths: ['./'] });
    }, /must be a relative path/);
    node_assert_1.default.throws(() => {
        (0, config_1.validateAndMergeConfig)({ sandboxWritePaths: [''] });
    }, /must be a relative path/);
    // 4. Parent directory traversals (lexical)
    node_assert_1.default.throws(() => {
        (0, config_1.validateAndMergeConfig)({ sandboxWritePaths: ['..'] });
    }, /must be a relative path/);
    node_assert_1.default.throws(() => {
        (0, config_1.validateAndMergeConfig)({ sandboxWritePaths: ['../escaped'] });
    }, /must be a relative path/);
    node_assert_1.default.throws(() => {
        (0, config_1.validateAndMergeConfig)({ sandboxWritePaths: ['foo/../../escaped'] });
    }, /must be a relative path/);
    node_assert_1.default.throws(() => {
        (0, config_1.validateAndMergeConfig)({ sandboxWritePaths: ['foo\\..\\..\\escaped'] });
    }, /must be a relative path/);
    // Deduplication and canonical normalization
    const deduplicated = (0, config_1.validateAndMergeConfig)({
        sandboxWritePaths: [
            'coverage/',
            'coverage',
            'foo/bar',
            'foo\\bar',
            'foo/bar/'
        ]
    });
    node_assert_1.default.deepStrictEqual(deduplicated.sandboxWritePaths, ['coverage', 'foo/bar']);
});
