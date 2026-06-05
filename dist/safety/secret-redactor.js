"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redactSecrets = redactSecrets;
function redactSecrets(content) {
    if (!content)
        return content;
    let redacted = content;
    // 1. Redact exact values of keys from process.env if they are configured
    const envKeys = [
        'OPENAI_API_KEY',
        'ANTHROPIC_API_KEY',
        'GEMINI_API_KEY',
        'OPENROUTER_API_KEY',
        'GITHUB_TOKEN'
    ];
    for (const key of envKeys) {
        const val = process.env[key];
        if (val && val.length > 3) {
            // Escape regex special chars
            const escapedVal = val.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            const regex = new RegExp(escapedVal, 'g');
            redacted = redacted.replace(regex, `[REDACTED_${key}]`);
        }
    }
    // 2. Redact keys starting with sk-
    redacted = redacted.replace(/\bsk-[a-zA-Z0-9_-]{12,}\b/g, '[REDACTED_SK_KEY]');
    // 3. Redact GitHub tokens
    redacted = redacted.replace(/\bgh[p|o|u|s]_[a-zA-Z0-9]{36,40}\b/g, '[REDACTED_GITHUB_TOKEN]');
    redacted = redacted.replace(/\bgithub_pat_[a-zA-Z0-9_]{82,}\b/g, '[REDACTED_GITHUB_PAT]');
    // 4. Redact private key blocks
    redacted = redacted.replace(/-----BEGIN [A-Z_ ]+-----[\s\S]*?-----END [A-Z_ ]+-----/g, '[REDACTED_PRIVATE_KEY_BLOCK]');
    // 4a. Authorization Bearer token
    redacted = redacted.replace(/\b(bearer\s+)([a-zA-Z0-9_\-\.\~]{10,})/gi, '$1[REDACTED_BEARER_TOKEN]');
    // 4b. x-api-key headers
    redacted = redacted.replace(/\b(x-api-key|x-api-token|api-key)\s*[:=]\s*["']?([a-zA-Z0-9_\-\.]{10,})/gi, (match, prefix, key) => {
        return match.replace(key, '[REDACTED_API_KEY_HEADER]');
    });
    // 5. Common API key patterns (JSON/YAML/Headers config style: key: val or key = val)
    redacted = redacted.replace(/(api[-_]?key|secret|token|password|pass|pwd)(?:\s*[:=]\s*["']?)([a-zA-Z0-9_-]{24,})["']?/gi, (match, p1, p2) => {
        return match.replace(p2, '[REDACTED_KEY_PATTERN]');
    });
    // 6. .env style lines (e.g. AWS_SECRET_ACCESS_KEY=xxx, DB_PASSWORD=xxx)
    redacted = redacted.replace(/(^[a-zA-Z0-9_-]*(?:SECRET|KEY|PASSWORD|TOKEN|PASS|PWD|AUTH)[a-zA-Z0-9_-]*\s*=\s*)([^\s'"]+)/gim, (match, prefix, secret) => {
        // Avoid redacting comments or simple words
        if (secret.length > 3) {
            return `${prefix}[REDACTED_ENV_SECRET]`;
        }
        return match;
    });
    return redacted;
}
