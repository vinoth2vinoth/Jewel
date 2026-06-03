import { JewelConfig } from '../core/config';

export interface PolicyResult {
  allowed: boolean;
  reason?: string;
}

export function checkCommandPolicy(commandLine: string, config: JewelConfig): PolicyResult {
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
  if (/\b\.ssh\b/i.test(normalized) || /\bid_rsa\b/i.test(normalized) || /\bid_dsa\b/i.test(normalized) || /\bid_ecdsa\b/i.test(normalized) || /\bid_ed25519\b/i.test(normalized)) {
    return {
      allowed: false,
      reason: 'Commands attempting to access or reference SSH keys are blocked for security.'
    };
  }

  // 3. Printing or reading .env files
  // Block print commands targeting .env files
  const printEnvRegex = /\b(cat|type|more|less|get-content|gc|head|tail|grep|strings)\b.*\.env\b/i;
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

  // 5. Package installation (new dependencies)
  const installRegex = /\b(npm\s+(install|i|add|in)|yarn\s+add|pnpm\s+add|bun\s+add)\b/i;
  if (installRegex.test(normalized)) {
    // Check if it's just a bare "npm install" or "npm i" which restores dependencies (often safe) vs adding a package
    const tokens = normalized.split(/\s+/).filter(t => t && !t.startsWith('-'));
    const isInstallingSpecificPackage = tokens.length > 2 && (tokens[1] === 'install' || tokens[1] === 'i' || tokens[1] === 'add' || tokens[1] === 'in');
    
    // Yarn, pnpm, bun add always add packages
    const isAdd = normalized.includes('add');

    if ((isInstallingSpecificPackage || isAdd) && !config.allowNewDependencies) {
      return {
        allowed: false,
        reason: 'Installing new packages/dependencies is blocked unless allowNewDependencies is true.'
      };
    }
  }

  // 6. DB Migration checks
  if (normalized.includes('migrate') && !normalized.includes('status')) {
    // prisma migrate, sequelize db:migrate etc.
    return {
      allowed: false,
      reason: 'Database migration generation or execution is blocked by default safety policy.'
    };
  }

  // 7. chmod 777
  if (normalized.includes('chmod') && normalized.includes('777')) {
    return {
      allowed: false,
      reason: 'Setting overly permissive file permissions (chmod 777) is blocked.'
    };
  }

  // 8. Destructive command checks (rm -rf, rmdir /s, del /s, rd /s)
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

  // 9. Format, Shutdown, Reboot
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

  // 10. Remote execution: Invoke-Expression / iex, curl/wget piped to shell
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

export function redactSecrets(text: string): string {
  if (!text) return text;

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
