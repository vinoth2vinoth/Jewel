"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.runDoctor = runDoctor;
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const git_1 = require("../../storage/git");
function runDoctor(cwd = process.cwd()) {
    console.log('Running Jewel Diagnostics (Doctor)...\n');
    let failCount = 0;
    let warnCount = 0;
    function report(status, title, details) {
        const symbol = status === 'PASS' ? '[PASS]' : status === 'WARN' ? '[WARN]' : '[FAIL]';
        console.log(`${symbol} ${title}`);
        if (details) {
            console.log(`       -> ${details}`);
        }
        if (status === 'FAIL')
            failCount++;
        if (status === 'WARN')
            warnCount++;
    }
    // 1. Node Version
    const nodeVersion = process.version;
    const major = parseInt(nodeVersion.substring(1).split('.')[0], 10);
    if (major >= 18) {
        report('PASS', `Node.js version is ${nodeVersion} (>= 18 required)`);
    }
    else {
        report('FAIL', `Node.js version is ${nodeVersion}. Jewel requires Node.js 18 or above.`);
    }
    // 2. npm Version
    try {
        const npmVersion = (0, child_process_1.execSync)('npm --version', { encoding: 'utf8' }).trim();
        report('PASS', `npm version is ${npmVersion}`);
    }
    catch {
        report('FAIL', 'npm is not available on your PATH.');
    }
    // 3. Git Availability
    let gitAvailable = false;
    try {
        const gitVersion = (0, child_process_1.execSync)('git --version', { encoding: 'utf8' }).trim();
        report('PASS', `Git is available: ${gitVersion}`);
        gitAvailable = true;
    }
    catch {
        report('FAIL', 'Git is not installed or not available on your PATH.');
    }
    // 4. Git Repo check
    if (gitAvailable) {
        if ((0, git_1.isGitRepository)(cwd)) {
            report('PASS', 'Workspace is a Git repository.');
        }
        else {
            report('WARN', 'Workspace is not a Git repository. Fallback backup directory strategy will be used.');
        }
    }
    // 5. Config file existence
    const configPath = path.join(cwd, 'jewel.config.json');
    let configExists = false;
    let config = null;
    if (fs.existsSync(configPath)) {
        try {
            config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            report('PASS', 'jewel.config.json exists and is valid JSON.');
            configExists = true;
        }
        catch (err) {
            report('FAIL', 'jewel.config.json exists but contains invalid JSON.', err.message);
        }
    }
    else {
        report('WARN', 'jewel.config.json is missing. Please run "jewel init".');
    }
    // 6. AGENTS.md existence
    const agentsMdPath = path.join(cwd, 'AGENTS.md');
    if (fs.existsSync(agentsMdPath)) {
        report('PASS', 'AGENTS.md exists (AI agents instructions page).');
    }
    else {
        report('WARN', 'AGENTS.md is missing. Agents will not have access to Jewel constraints.');
    }
    // 7. .jewel folder
    const dotJewelPath = path.join(cwd, '.jewel');
    if (fs.existsSync(dotJewelPath)) {
        report('PASS', '.jewel control directory exists.');
    }
    else {
        report('WARN', '.jewel control directory is missing.');
    }
    // 8. Verification commands configuration
    if (configExists && config) {
        const cmds = config.commands || {};
        const configuredCount = Object.values(cmds).filter(v => typeof v === 'string' && v.trim() !== '').length;
        if (configuredCount > 0) {
            report('PASS', `Verification commands configured: ${configuredCount} command(s) active.`);
        }
        else {
            report('WARN', 'No verification commands are configured in jewel.config.json. Jewel verify will skip checks.');
        }
        // 9. Protected files check
        const protectedFiles = config.protectedFiles || [];
        if (protectedFiles.length > 0) {
            report('PASS', `Protected files list is configured (${protectedFiles.length} patterns).`);
        }
        else {
            report('WARN', 'Protected files list in jewel.config.json is empty.');
        }
        // 10. Package scripts mapping
        const pkgPath = path.join(cwd, 'package.json');
        if (fs.existsSync(pkgPath)) {
            try {
                const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
                const scripts = pkg.scripts || {};
                const missingScripts = [];
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
                }
                else {
                    report('WARN', `Some verification commands reference scripts missing from package.json: ${missingScripts.join(', ')}`);
                }
            }
            catch {
                report('WARN', 'Could not parse package.json to verify script mappings.');
            }
        }
        // 11. Playwright E2E check
        const e2eCmd = cmds.e2e || '';
        if (e2eCmd.toLowerCase().includes('playwright')) {
            const nodeModulesPlaywright = path.join(cwd, 'node_modules', '@playwright');
            if (fs.existsSync(nodeModulesPlaywright)) {
                report('PASS', 'Playwright is installed for E2E testing.');
            }
            else {
                report('WARN', 'Playwright is referenced in e2e command, but not found in node_modules.');
            }
        }
    }
    // 12. API Key configuration
    const provider = config?.provider || 'none';
    if (provider === 'none') {
        report('PASS', 'LLM Provider is set to "none". API key checks skipped.');
    }
    else {
        const keyMap = {
            openai: 'OPENAI_API_KEY',
            anthropic: 'ANTHROPIC_API_KEY',
            gemini: 'GEMINI_API_KEY',
            openrouter: 'OPENROUTER_API_KEY'
        };
        const expectedKey = keyMap[provider];
        if (expectedKey) {
            if (process.env[expectedKey]) {
                report('PASS', `LLM Adapter key ${expectedKey} present in environment.`);
            }
            else {
                report('WARN', `LLM Adapter key ${expectedKey} is missing from environment. Real LLM agents won't work.`);
            }
        }
    }
    console.log(`\nDiagnostics finished with ${failCount} Failures and ${warnCount} Warnings.`);
    if (failCount > 0) {
        process.exit(1);
    }
    else {
        process.exit(0);
    }
}
