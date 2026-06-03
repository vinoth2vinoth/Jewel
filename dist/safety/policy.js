"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkCommandPolicy = checkCommandPolicy;
exports.redactSecrets = redactSecrets;
function checkCommandPolicy(commandLine, config) {
    const normalized = commandLine.trim().toLowerCase();
    // 1. Git push check
    if (normalized.includes('git push')) {
        if (!config.allowGitPush) {
            return {
                allowed: false,
                reason: 'Git push command is blocked by configuration (allowGitPush: false).'
            };
        }
    }
    // 2. SSH keys access check
    if (/\.ssh/i.test(normalized) || /\bid_rsa\b/i.test(normalized) || /\bid_dsa\b/i.test(normalized) || /\bid_ecdsa\b/i.test(normalized) || /\bid_ed25519\b/i.test(normalized)) {
        return {
            allowed: false,
            reason: 'Commands attempting to access or reference SSH keys are blocked for security.'
        };
    }
    // 3. Printing or reading .env files
    const printEnvRegex = /\b(cat|type|more|less|get-content|gc|select-string|sls|head|tail|grep|strings)\b.*\.env/i;
    if (printEnvRegex.test(normalized)) {
        return {
            allowed: false,
            reason: 'Reading or outputting the contents of .env files is blocked to prevent secret exposure.'
        };
    }
    // 4. Modifying .env files
    const editEnvRegex = /(?:\b(echo|tee|nano|vi|vim|notepad|code|sed)\b.*\.env\b)|(\.env\b.*\b(echo|tee|nano|vi|vim|notepad|code|sed)\b)/i;
    const redirectEnvRegex = />\s*.*\.env/i; // e.g. echo "x" > .env
    if (editEnvRegex.test(normalized) || redirectEnvRegex.test(normalized) || normalized.includes(' .env=')) {
        return {
            allowed: false,
            reason: 'Directly editing or writing to .env files via CLI commands is blocked.'
        };
    }
    // 5. PowerShell destructive commands
    if (/\b(remove-item|ri)\b/i.test(normalized)) {
        const hasRecurse = /(?:^|\s)(-recurse|-r)\b/i.test(normalized);
        const hasForce = /(?:^|\s)(-force|-fo)\b/i.test(normalized);
        if (hasRecurse && hasForce) {
            return {
                allowed: false,
                reason: 'PowerShell destructive folder deletion is blocked.'
            };
        }
    }
    if (/\b(invoke-webrequest|iwr)\b/i.test(normalized) && /\b(invoke-expression|iex)\b/i.test(normalized)) {
        return {
            allowed: false,
            reason: 'Downloading and executing scripts directly is blocked.'
        };
    }
    if (normalized.includes('set-executionpolicy') && normalized.includes('bypass')) {
        return {
            allowed: false,
            reason: 'Bypassing execution policy is blocked.'
        };
    }
    if (normalized.includes('start-process') && normalized.includes('powershell')) {
        return {
            allowed: false,
            reason: 'Spawning new PowerShell instances via Start-Process is blocked.'
        };
    }
    // 6. Git destructive commands
    if (normalized.includes('git reset') && normalized.includes('--hard')) {
        return {
            allowed: false,
            reason: 'Hard git resets are blocked for safety.'
        };
    }
    if (normalized.includes('git clean') && normalized.includes('-fd')) {
        return {
            allowed: false,
            reason: 'Forced git cleaning is blocked for safety.'
        };
    }
    if (normalized.includes('git checkout') && normalized.includes('.')) {
        return {
            allowed: false,
            reason: 'Discarding local modifications via git checkout is blocked.'
        };
    }
    if (normalized.includes('git restore') && normalized.includes('.')) {
        return {
            allowed: false,
            reason: 'Discarding local modifications via git restore is blocked.'
        };
    }
    // 7. Package installation (new dependencies)
    const installRegex = /\b(npm\s+(install|i|add|in)|yarn\s+add|pnpm\s+add|bun\s+add)\b/i;
    if (installRegex.test(normalized)) {
        const tokens = normalized.split(/\s+/).filter(t => t && !t.startsWith('-'));
        const isInstallingSpecificPackage = tokens.length > 2 && (tokens[1] === 'install' || tokens[1] === 'i' || tokens[1] === 'add' || tokens[1] === 'in');
        const isAdd = normalized.includes('add');
        if ((isInstallingSpecificPackage || isAdd) && !config.allowNewDependencies) {
            return {
                allowed: false,
                reason: 'Installing new packages/dependencies is blocked unless allowNewDependencies is true.'
            };
        }
    }
    // 8. DB Migration checks
    if (normalized.includes('migrate') && !normalized.includes('status')) {
        return {
            allowed: false,
            reason: 'Database migration generation or execution is blocked by default safety policy.'
        };
    }
    // 9. chmod 777
    if (normalized.includes('chmod') && normalized.includes('777')) {
        return {
            allowed: false,
            reason: 'Setting overly permissive file permissions (chmod 777) is blocked.'
        };
    }
    // 10. Destructive command checks (rm -rf, rmdir /s, del /s, rd /s)
    if (/\brm\b.*(?:^|\s)-[a-z]*r/i.test(normalized) || /\brm\b.*(?:^|\s)-[a-z]*f/i.test(normalized)) {
        return {
            allowed: false,
            reason: 'Recursive or forced file deletion (rm -rf/rm -f) is blocked.'
        };
    }
    if (/\b(rmdir|rd)\b.*(?:^|\s)\/s/i.test(normalized) || /\brmdir\b.*(?:^|\s)-r/i.test(normalized)) {
        return {
            allowed: false,
            reason: 'Recursive directory deletion (rmdir /s) is blocked.'
        };
    }
    if (/\bdel\b.*(?:^|\s)\/s/i.test(normalized)) {
        return {
            allowed: false,
            reason: 'Recursive file deletion (del /s) is blocked.'
        };
    }
    // 11. Format, Shutdown, Reboot
    if (/\bformat\b/i.test(normalized)) {
        return {
            allowed: false,
            reason: 'The "format" command is blocked for system safety.'
        };
    }
    if (/\b(shutdown|reboot|init\s+6|init\s+0)\b/i.test(normalized)) {
        return {
            allowed: false,
            reason: 'System shutdown or reboot commands are blocked.'
        };
    }
    // 12. Remote execution: Invoke-Expression / iex, curl/wget piped to shell
    const remoteExecutionRegex = /\b(iex|invoke-expression)\b.*\b(http|ftp)/i;
    if (remoteExecutionRegex.test(normalized)) {
        return {
            allowed: false,
            reason: 'Running remote scripts via Invoke-Expression (iex) is blocked.'
        };
    }
    if (/\b(curl|wget)\b.*\|\s*\b(bash|sh|powershell|pwsh|cmd)\b/i.test(normalized)) {
        return {
            allowed: false,
            reason: 'Piping curl or wget output directly into a shell is blocked.'
        };
    }
    // Allow safe/known commands by default
    return { allowed: true };
}
function redactSecrets(text) {
    if (!text)
        return text;
    let redacted = text;
    // 1. OpenAI Keys
    redacted = redacted.replace(/sk-[a-zA-Z0-9_-]{32,}/g, '[REDACTED_OPENAI_KEY]');
    // 2. Anthropic Keys
    redacted = redacted.replace(/sk-ant-[a-zA-Z0-9_-]{30,}/g, '[REDACTED_ANTHROPIC_KEY]');
    // 3. Google/Gemini API Keys
    redacted = redacted.replace(/AIzaSy[a-zA-Z0-9_-]{33}/g, '[REDACTED_GEMINI_KEY]');
    // 4. GitHub Personal Access Tokens
    redacted = redacted.replace(/ghp_[a-zA-Z0-9]{36,40}/g, '[REDACTED_GITHUB_TOKEN]');
    // 5. Key-value secrets (e.g., PASSWORD=xyz, API_KEY=xyz)
    redacted = redacted.replace(/(password|token|secret|api_key|apikey|private_key|pwd)\s*=\s*['"]?[^\s'"]+['"]?/gi, (match, key) => {
        return `${key}=[REDACTED_SECRET]`;
    });
    return redacted;
}
