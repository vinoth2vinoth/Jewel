import test from 'node:test';
import assert from 'node:assert';
import { redactSecrets } from './secret-redactor';

test('secret-redactor - redactSecrets checks', () => {
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
    const redactedOpenAI = redactSecrets(textOpenAI);
    assert.ok(redactedOpenAI.includes('[REDACTED_OPENAI_API_KEY]'));
    assert.ok(!redactedOpenAI.includes('openai-api-key-value-123'));

    // 2. ANTHROPIC_API_KEY exact value redaction
    const textAnthropic = 'Executing with key: anthropic-api-key-value-456';
    const redactedAnthropic = redactSecrets(textAnthropic);
    assert.ok(redactedAnthropic.includes('[REDACTED_ANTHROPIC_API_KEY]'));
    assert.ok(!redactedAnthropic.includes('anthropic-api-key-value-456'));

    // 3. GEMINI_API_KEY exact value redaction
    const textGemini = 'Executing with key: gemini-api-key-value-789';
    const redactedGemini = redactSecrets(textGemini);
    assert.ok(redactedGemini.includes('[REDACTED_GEMINI_API_KEY]'));
    assert.ok(!redactedGemini.includes('gemini-api-key-value-789'));

    // 4. OPENROUTER_API_KEY exact value redaction
    const textOpenRouter = 'Executing with key: openrouter-api-key-value-000';
    const redactedOpenRouter = redactSecrets(textOpenRouter);
    assert.ok(redactedOpenRouter.includes('[REDACTED_OPENROUTER_API_KEY]'));
    assert.ok(!redactedOpenRouter.includes('openrouter-api-key-value-000'));

    // 5. GitHub token ghp_ pattern
    const textGithubGhp = 'My token is ghp_abcdefghijklmnopqrstuvwxyz0123456789';
    const redactedGithubGhp = redactSecrets(textGithubGhp);
    assert.ok(redactedGithubGhp.includes('[REDACTED_GITHUB_TOKEN]'));
    assert.ok(!redactedGithubGhp.includes('ghp_abcdef'));

    // 6. github_pat_ pattern
    const textGithubPat = 'My token is github_pat_1234567890abcdefghijklmnopqrstuvwxyz_ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890abcdefghijkl';
    const redactedGithubPat = redactSecrets(textGithubPat);
    assert.ok(redactedGithubPat.includes('[REDACTED_GITHUB_PAT]'));
    assert.ok(!redactedGithubPat.includes('github_pat_123'));

    // 7. private key block
    const textPrivateKey = `
-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0yVq9J...
-----END RSA PRIVATE KEY-----
    `;
    const redactedPriv = redactSecrets(textPrivateKey);
    assert.ok(redactedPriv.includes('[REDACTED_PRIVATE_KEY_BLOCK]'));
    assert.ok(!redactedPriv.includes('MIIEowIBAAKCAQEA0yVq9J'));

    // 8. .env style secret lines
    const textEnv = 'AWS_SECRET_ACCESS_KEY=my_aws_secret_key_123\nnormal_config=abc';
    const redactedEnv = redactSecrets(textEnv);
    assert.ok(redactedEnv.includes('AWS_SECRET_ACCESS_KEY=[REDACTED_ENV_SECRET]'));
    assert.ok(redactedEnv.includes('normal_config=abc'));

    // 9. Authorization Bearer token
    const textBearer = 'Authorization: Bearer myMockBearerToken123456789';
    const redactedBearer = redactSecrets(textBearer);
    assert.ok(redactedBearer.includes('Authorization: Bearer [REDACTED_BEARER_TOKEN]'));
    assert.ok(!redactedBearer.includes('myMockBearerToken123456789'));

    // 10. x-api-key header
    const textApiKeyHeader = 'x-api-key: header-api-key-secret-123456';
    const redactedApiKeyHeader = redactSecrets(textApiKeyHeader);
    assert.ok(redactedApiKeyHeader.includes('x-api-key: [REDACTED_API_KEY_HEADER]'));
    assert.ok(!redactedApiKeyHeader.includes('header-api-key-secret-123456'));

    // 11. Normal text remains unchanged
    const normalText = 'This is a normal paragraph with no secrets.';
    assert.strictEqual(redactSecrets(normalText), normalText);

  } finally {
    // Restore original process.env
    if (originalOpenAI) process.env.OPENAI_API_KEY = originalOpenAI; else delete process.env.OPENAI_API_KEY;
    if (originalAnthropic) process.env.ANTHROPIC_API_KEY = originalAnthropic; else delete process.env.ANTHROPIC_API_KEY;
    if (originalGemini) process.env.GEMINI_API_KEY = originalGemini; else delete process.env.GEMINI_API_KEY;
    if (originalOpenRouter) process.env.OPENROUTER_API_KEY = originalOpenRouter; else delete process.env.OPENROUTER_API_KEY;
  }
});
