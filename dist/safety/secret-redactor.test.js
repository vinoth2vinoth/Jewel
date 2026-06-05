"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const node_assert_1 = __importDefault(require("node:assert"));
const secret_redactor_1 = require("./secret-redactor");
(0, node_test_1.default)('secret-redactor - redactSecrets checks', () => {
    // Setup mock environment variables for key exact value tests
    const originalOpenAI = process.env.OPENAI_API_KEY;
    const originalAnthropic = process.env.ANTHROPIC_API_KEY;
    const originalGemini = process.env.GEMINI_API_KEY;
    const originalOpenRouter = process.env.OPENROUTER_API_KEY;
    process.env.OPENAI_API_KEY = 'openai-api-key-value-123';
    process.env.ANTHROPIC_API_KEY = 'anthropic-api-key-value-456';
    process.env.GEMINI_API_KEY = 'gemini-api-key-value-789';
    process.env.OPENROUTER_API_KEY = 'openrouter-api-key-value-000';
    try {
        // 1. OPENAI_API_KEY exact value redaction
        const textOpenAI = 'Executing with key: openai-api-key-value-123';
        const redactedOpenAI = (0, secret_redactor_1.redactSecrets)(textOpenAI);
        node_assert_1.default.ok(redactedOpenAI.includes('[REDACTED_OPENAI_API_KEY]'));
        node_assert_1.default.ok(!redactedOpenAI.includes('openai-api-key-value-123'));
        // 2. ANTHROPIC_API_KEY exact value redaction
        const textAnthropic = 'Executing with key: anthropic-api-key-value-456';
        const redactedAnthropic = (0, secret_redactor_1.redactSecrets)(textAnthropic);
        node_assert_1.default.ok(redactedAnthropic.includes('[REDACTED_ANTHROPIC_API_KEY]'));
        node_assert_1.default.ok(!redactedAnthropic.includes('anthropic-api-key-value-456'));
        // 3. GEMINI_API_KEY exact value redaction
        const textGemini = 'Executing with key: gemini-api-key-value-789';
        const redactedGemini = (0, secret_redactor_1.redactSecrets)(textGemini);
        node_assert_1.default.ok(redactedGemini.includes('[REDACTED_GEMINI_API_KEY]'));
        node_assert_1.default.ok(!redactedGemini.includes('gemini-api-key-value-789'));
        // 4. OPENROUTER_API_KEY exact value redaction
        const textOpenRouter = 'Executing with key: openrouter-api-key-value-000';
        const redactedOpenRouter = (0, secret_redactor_1.redactSecrets)(textOpenRouter);
        node_assert_1.default.ok(redactedOpenRouter.includes('[REDACTED_OPENROUTER_API_KEY]'));
        node_assert_1.default.ok(!redactedOpenRouter.includes('openrouter-api-key-value-000'));
        // 5. GitHub token ghp_ pattern
        const textGithubGhp = 'My token is ghp_abcdefghijklmnopqrstuvwxyz0123456789';
        const redactedGithubGhp = (0, secret_redactor_1.redactSecrets)(textGithubGhp);
        node_assert_1.default.ok(redactedGithubGhp.includes('[REDACTED_GITHUB_TOKEN]'));
        node_assert_1.default.ok(!redactedGithubGhp.includes('ghp_abcdef'));
        // 6. github_pat_ pattern
        const textGithubPat = 'My token is github_pat_1234567890abcdefghijklmnopqrstuvwxyz_ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890abcdefghijkl';
        const redactedGithubPat = (0, secret_redactor_1.redactSecrets)(textGithubPat);
        node_assert_1.default.ok(redactedGithubPat.includes('[REDACTED_GITHUB_PAT]'));
        node_assert_1.default.ok(!redactedGithubPat.includes('github_pat_123'));
        // 7. private key block
        const textPrivateKey = `
-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0yVq9J...
-----END RSA PRIVATE KEY-----
    `;
        const redactedPriv = (0, secret_redactor_1.redactSecrets)(textPrivateKey);
        node_assert_1.default.ok(redactedPriv.includes('[REDACTED_PRIVATE_KEY_BLOCK]'));
        node_assert_1.default.ok(!redactedPriv.includes('MIIEowIBAAKCAQEA0yVq9J'));
        // 8. .env style secret lines
        const textEnv = 'AWS_SECRET_ACCESS_KEY=my_aws_secret_key_123\nnormal_config=abc';
        const redactedEnv = (0, secret_redactor_1.redactSecrets)(textEnv);
        node_assert_1.default.ok(redactedEnv.includes('AWS_SECRET_ACCESS_KEY=[REDACTED_ENV_SECRET]'));
        node_assert_1.default.ok(redactedEnv.includes('normal_config=abc'));
        // 9. Authorization Bearer token
        const textBearer = 'Authorization: Bearer myMockBearerToken123456789';
        const redactedBearer = (0, secret_redactor_1.redactSecrets)(textBearer);
        node_assert_1.default.ok(redactedBearer.includes('Authorization: Bearer [REDACTED_BEARER_TOKEN]'));
        node_assert_1.default.ok(!redactedBearer.includes('myMockBearerToken123456789'));
        // 10. x-api-key header
        const textApiKeyHeader = 'x-api-key: header-api-key-secret-123456';
        const redactedApiKeyHeader = (0, secret_redactor_1.redactSecrets)(textApiKeyHeader);
        node_assert_1.default.ok(redactedApiKeyHeader.includes('x-api-key: [REDACTED_API_KEY_HEADER]'));
        node_assert_1.default.ok(!redactedApiKeyHeader.includes('header-api-key-secret-123456'));
        // 11. Normal text remains unchanged
        const normalText = 'This is a normal paragraph with no secrets.';
        node_assert_1.default.strictEqual((0, secret_redactor_1.redactSecrets)(normalText), normalText);
    }
    finally {
        // Restore original process.env
        if (originalOpenAI)
            process.env.OPENAI_API_KEY = originalOpenAI;
        else
            delete process.env.OPENAI_API_KEY;
        if (originalAnthropic)
            process.env.ANTHROPIC_API_KEY = originalAnthropic;
        else
            delete process.env.ANTHROPIC_API_KEY;
        if (originalGemini)
            process.env.GEMINI_API_KEY = originalGemini;
        else
            delete process.env.GEMINI_API_KEY;
        if (originalOpenRouter)
            process.env.OPENROUTER_API_KEY = originalOpenRouter;
        else
            delete process.env.OPENROUTER_API_KEY;
    }
});
