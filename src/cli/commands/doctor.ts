import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { isGitRepository } from '../../storage/git';
import { validateAndMergeConfig } from '../../core/config';
import { getModelCapabilities } from '../../agents/model-capabilities';

export function runDoctor(cwd: string = process.cwd()): void {
  console.log('Running Jewel Diagnostics (Doctor)...\n');

  let failCount = 0;
  let warnCount = 0;

  function report(status: 'PASS' | 'WARN' | 'FAIL', title: string, details?: string) {
    const symbol = status === 'PASS' ? '[PASS]' : status === 'WARN' ? '[WARN]' : '[FAIL]';
    console.log(`${symbol} ${title}`);
    if (details) {
      console.log(`       -> ${details}`);
    }
    if (status === 'FAIL') failCount++;
    if (status === 'WARN') warnCount++;
  }

  // 1. Node Version
  const nodeVersion = process.version;
  const major = parseInt(nodeVersion.substring(1).split('.')[0], 10);
  if (major >= 18) {
    report('PASS', `Node.js version is ${nodeVersion} (>= 18 required)`);
  } else {
    report('FAIL', `Node.js version is ${nodeVersion}. Jewel requires Node.js 18 or above.`);
  }

  // 2. npm Version
  try {
    const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
    report('PASS', `npm version is ${npmVersion}`);
  } catch {
    report('FAIL', 'npm is not available on your PATH.');
  }

  // 3. Git Availability
  let gitAvailable = false;
  try {
    const gitVersion = execSync('git --version', { encoding: 'utf8' }).trim();
    report('PASS', `Git is available: ${gitVersion}`);
    gitAvailable = true;
  } catch {
    report('FAIL', 'Git is not installed or not available on your PATH.');
  }

  // 4. Git Repo check
  if (gitAvailable) {
    if (isGitRepository(cwd)) {
      report('PASS', 'Workspace is a Git repository.');
    } else {
      report('WARN', 'Workspace is not a Git repository. Fallback backup directory strategy will be used.');
    }
  }

  // 5. Config file existence
  const configPath = path.join(cwd, 'jewel.config.json');
  let configExists = false;
  let config: any = null;
  if (fs.existsSync(configPath)) {
    try {
      const parsedRaw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      config = validateAndMergeConfig(parsedRaw);
      report('PASS', 'jewel.config.json exists and is valid configuration.');
      configExists = true;
      if (config.preferredProviders && config.preferredProviders.length > 0) {
        console.log(`Preferred Providers: ${config.preferredProviders.join(', ')}`);
      }
    } catch (err: any) {
      report('FAIL', 'jewel.config.json contains invalid configuration.', err.message);
    }
  } else {
    report('WARN', 'jewel.config.json is missing. Please run "jewel init".');
  }

  // 6. AGENTS.md existence
  const agentsMdPath = path.join(cwd, 'AGENTS.md');
  if (fs.existsSync(agentsMdPath)) {
    report('PASS', 'AGENTS.md exists (AI agents instructions page).');
  } else {
    report('WARN', 'AGENTS.md is missing. Agents will not have access to Jewel constraints.');
  }

  // 7. .jewel folder
  const dotJewelPath = path.join(cwd, '.jewel');
  if (fs.existsSync(dotJewelPath)) {
    report('PASS', '.jewel control directory exists.');
  } else {
    report('WARN', '.jewel control directory is missing.');
  }

  // 8. Verification commands configuration
  if (configExists && config) {
    const cmds = config.commands || {};
    const configuredCount = Object.values(cmds).filter(v => typeof v === 'string' && v.trim() !== '').length;
    if (configuredCount > 0) {
      report('PASS', `Verification commands configured: ${configuredCount} command(s) active.`);
    } else {
      report('WARN', 'No verification commands are configured in jewel.config.json. Jewel verify will skip checks.');
    }

    // 9. Protected files check
    const protectedFiles = config.protectedFiles || [];
    if (protectedFiles.length > 0) {
      report('PASS', `Protected files list is configured (${protectedFiles.length} patterns).`);
    } else {
      report('WARN', 'Protected files list in jewel.config.json is empty.');
    }

    // 10. Package scripts mapping
    const pkgPath = path.join(cwd, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        const scripts = pkg.scripts || {};
        const missingScripts: string[] = [];

        for (const [key, value] of Object.entries(cmds)) {
          if (typeof value === 'string' && value.startsWith('npm run ')) {
            const scriptName = value.replace('npm run ', '').trim();
            if (!scripts[scriptName]) {
              missingScripts.push(scriptName);
            }
          }
        }

        if (missingScripts.length === 0) {
          report('PASS', 'All npm-based verification commands map to valid package.json scripts.');
        } else {
          report('WARN', `Some verification commands reference scripts missing from package.json: ${missingScripts.join(', ')}`);
        }
      } catch {
        report('WARN', 'Could not parse package.json to verify script mappings.');
      }
    }

    // 11. Playwright E2E check
    const e2eCmd = cmds.e2e || '';
    if (e2eCmd.toLowerCase().includes('playwright')) {
      const nodeModulesPlaywright = path.join(cwd, 'node_modules', '@playwright');
      if (fs.existsSync(nodeModulesPlaywright)) {
        report('PASS', 'Playwright is installed for E2E testing.');
      } else {
        report('WARN', 'Playwright is referenced in e2e command, but not found in node_modules.');
      }
    }
  }

  // 12. API Key configuration
  const provider = config?.provider || 'none';
  const preferred = config?.preferredProviders || [];
  const providersToCheck = new Set<string>();
  if (provider !== 'none') {
    providersToCheck.add(provider);
  }
  for (const p of preferred) {
    if (p !== 'none') {
      providersToCheck.add(p);
    }
  }

  if (providersToCheck.size === 0) {
    if (provider === 'none') {
      report('PASS', 'LLM Provider is set to "none". API key checks skipped.');
    } else {
      report('PASS', 'No active or preferred LLM Providers configured. API key checks skipped.');
    }
  } else {
    const keyMap: Record<string, string> = {
      openai: 'OPENAI_API_KEY',
      anthropic: 'ANTHROPIC_API_KEY',
      gemini: 'GEMINI_API_KEY',
      openrouter: 'OPENROUTER_API_KEY',
      deepseek: 'DEEPSEEK_API_KEY'
    };
    for (const p of providersToCheck) {
      const expectedKey = keyMap[p];
      if (expectedKey) {
        if (process.env[expectedKey]) {
          report('PASS', `LLM Adapter key ${expectedKey} present in environment for provider "${p}".`);
        } else {
          report('WARN', `LLM Adapter key ${expectedKey} is missing from environment for provider "${p}". Real LLM runs using "${p}" will fail.`);
        }
      }
    }

    const model = config.model || '';
    const { capabilities, isKnown, warning } = getModelCapabilities(provider, model);
    if (!model) {
      report('WARN', `No model name configured for provider "${provider}". Defaulting to provider default.`);
    } else if (!isKnown) {
      report('WARN', `Model "${model}" is unknown to Jewel's capability registry. Capabilities might be assumed.`);
    } else {
      report('PASS', `Model "${model}" is registered and supported.`);
    }

    if (capabilities.supportsStructuredOutput) {
      report('PASS', `Model "${model || 'default'}" supports structured outputs natively.`);
    } else {
      report('WARN', `Model "${model || 'default'}" does not support structured outputs natively.`);
    }

    if (config.allowUnstructuredProviderFallback === true) {
      report('WARN', 'Configuration field "allowUnstructuredProviderFallback" is set to true. Fallbacks are allowed, which may reduce reliability.');
    } else {
      report('PASS', 'Configuration field "allowUnstructuredProviderFallback" is set to false.');
    }

    if (config.requireHumanDiffApproval === false) {
      report('WARN', 'Configuration field "requireHumanDiffApproval" is set to false while an active LLM provider is configured. This increases security risk.');
    } else {
      report('PASS', 'Configuration field "requireHumanDiffApproval" is set to true.');
    }

    const timeout = config.llmTimeoutMs ?? 60000;
    if (timeout < 1000 || timeout > 600000) {
      report('WARN', `LLM timeout "${timeout}ms" is outside of the recommended range (1s - 10mins).`);
    } else {
      report('PASS', `LLM timeout "${timeout}ms" is within recommended range.`);
    }

    const retries = config.llmMaxRetries ?? 2;
    if (retries < 0 || retries > 10) {
      report('WARN', `LLM max retries "${retries}" is outside of the recommended range (0 - 10).`);
    } else {
      report('PASS', `LLM max retries "${retries}" is within recommended range.`);
    }
  }

  console.log(`\nDiagnostics finished with ${failCount} Failures and ${warnCount} Warnings.`);

  if (failCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}
