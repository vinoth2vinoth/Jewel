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
exports.runAudit = runAudit;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const git_1 = require("../../storage/git");
function runAudit(cwd = process.cwd()) {
    console.log('Running Jewel Repository Safety and Quality Audit...\n');
    const checks = [];
    // Helper to push checks
    const addCheck = (id, title, status, details) => {
        checks.push({ id, title, status, details });
    };
    // 1. Is project initialized
    const configPath = path.join(cwd, 'jewel.config.json');
    let initialized = false;
    let config = null;
    if (fs.existsSync(configPath)) {
        try {
            config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            addCheck('initialized', 'Jewel Config File', 'PASS', 'jewel.config.json is present and valid.');
            initialized = true;
        }
        catch {
            addCheck('initialized', 'Jewel Config File', 'FAIL', 'jewel.config.json contains malformed JSON.');
        }
    }
    else {
        addCheck('initialized', 'Jewel Config File', 'FAIL', 'jewel.config.json is missing.');
    }
    // 2. Verification commands configured
    if (initialized && config) {
        const cmds = config.commands || {};
        const hasCmds = Object.values(cmds).some((v) => v && v.trim() !== '');
        if (hasCmds) {
            addCheck('verification_cmds', 'Verification Commands', 'PASS', 'At least one verification command is configured.');
        }
        else {
            addCheck('verification_cmds', 'Verification Commands', 'WARN', 'No verification commands are configured in jewel.config.json.');
        }
    }
    else {
        addCheck('verification_cmds', 'Verification Commands', 'FAIL', 'Cannot audit verification commands because configuration is invalid.');
    }
    // 3. Protected files defined
    if (initialized && config) {
        const protectedFiles = config.protectedFiles || [];
        if (protectedFiles.length > 0) {
            addCheck('protected_files', 'Protected Files List', 'PASS', `${protectedFiles.length} file patterns are protected.`);
        }
        else {
            addCheck('protected_files', 'Protected Files List', 'WARN', 'No protected files are configured in jewel.config.json.');
        }
    }
    else {
        addCheck('protected_files', 'Protected Files List', 'FAIL', 'Cannot audit protected files configuration.');
    }
    // 4. Dangerous commands blocked
    if (initialized && config) {
        if (config.dangerousCommandPolicy === 'block') {
            addCheck('dangerous_commands', 'Dangerous Command Policy', 'PASS', 'Dangerous command policy is set to strict "block".');
        }
        else {
            addCheck('dangerous_commands', 'Dangerous Command Policy', 'WARN', `Dangerous command policy is set to laxer "${config.dangerousCommandPolicy}".`);
        }
    }
    else {
        addCheck('dangerous_commands', 'Dangerous Command Policy', 'FAIL', 'Cannot audit dangerous command policy.');
    }
    // 5. AGENTS.md present
    const agentsMdPath = path.join(cwd, 'AGENTS.md');
    if (fs.existsSync(agentsMdPath)) {
        addCheck('agents_md', 'AGENTS.md File', 'PASS', 'AGENTS.md instructions page is present in project root.');
    }
    else {
        addCheck('agents_md', 'AGENTS.md File', 'FAIL', 'AGENTS.md is missing. AI coding agents may make unaligned modifications.');
    }
    // 6. Skills present
    const skillsDir = path.join(cwd, '.jewel', 'skills');
    if (fs.existsSync(skillsDir)) {
        const skills = fs.readdirSync(skillsDir).filter(f => fs.statSync(path.join(skillsDir, f)).isDirectory());
        if (skills.length > 0) {
            addCheck('skills_present', 'Jewel Skills', 'PASS', `${skills.length} safety skill(s) present in .jewel/skills.`);
        }
        else {
            addCheck('skills_present', 'Jewel Skills', 'WARN', 'Skills directory exists but contains no safety skills.');
        }
    }
    else {
        addCheck('skills_present', 'Jewel Skills', 'WARN', '.jewel/skills directory is missing.');
    }
    // 7. Git clean check
    const isGit = (0, git_1.isGitRepository)(cwd);
    if (isGit) {
        const gitStatus = (0, git_1.getGitStatus)(cwd);
        if (!gitStatus) {
            addCheck('git_clean', 'Git Cleanliness', 'PASS', 'Working directory is clean.');
        }
        else {
            addCheck('git_clean', 'Git Cleanliness', 'WARN', 'Working directory has uncommitted modifications.');
        }
    }
    else {
        addCheck('git_clean', 'Git Cleanliness', 'WARN', 'Not a git repository. Git cleanliness tracking is unavailable.');
    }
    // 8. Package scripts available
    const pkgPath = path.join(cwd, 'package.json');
    if (fs.existsSync(pkgPath)) {
        try {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
            const scripts = pkg.scripts || {};
            const count = Object.keys(scripts).length;
            if (count > 0) {
                addCheck('package_scripts', 'Package Scripts', 'PASS', `${count} npm package script(s) defined in package.json.`);
            }
            else {
                addCheck('package_scripts', 'Package Scripts', 'WARN', 'package.json exists but contains no scripts.');
            }
        }
        catch {
            addCheck('package_scripts', 'Package Scripts', 'WARN', 'package.json exists but is not valid JSON.');
        }
    }
    else {
        addCheck('package_scripts', 'Package Scripts', 'WARN', 'package.json is missing.');
    }
    // 9. Obvious missing tests
    // Look for test/ or tests/ folder or files matching *.test.* or *.spec.*
    const lookForTests = (dir) => {
        if (!fs.existsSync(dir))
            return false;
        const list = fs.readdirSync(dir);
        for (const f of list) {
            if (['node_modules', '.git', '.jewel'].includes(f))
                continue;
            const fullPath = path.join(dir, f);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                if (f.toLowerCase() === 'test' || f.toLowerCase() === 'tests')
                    return true;
                if (lookForTests(fullPath))
                    return true;
            }
            else {
                if (/\.(test|spec)\.[a-zA-Z0-9]+$/.test(f))
                    return true;
            }
        }
        return false;
    };
    const hasTests = lookForTests(cwd);
    if (hasTests) {
        addCheck('tests_exist', 'Test Suite Presence', 'PASS', 'Found test directories or files.');
    }
    else {
        addCheck('tests_exist', 'Test Suite Presence', 'WARN', 'No test directories or test files (e.g. *.test.*, *.spec.*) detected.');
    }
    // 10. Risky files changed
    // Check if there are dirty protected files
    if (isGit) {
        try {
            const statusOutput = (0, child_process_1.execSync)('git diff --name-only', { cwd, encoding: 'utf8' }).trim();
            if (statusOutput) {
                const dirtyFiles = statusOutput.split('\n');
                const dirtyProtected = dirtyFiles.filter((f) => {
                    if (f.endsWith('.env') || f.startsWith('src/auth') || f.startsWith('src/security'))
                        return true;
                    // check config list too
                    if (config && config.protectedFiles) {
                        for (const pattern of config.protectedFiles) {
                            const regex = new RegExp(`^${pattern.replace(/\./g, '\\.').replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*')}$`);
                            if (regex.test(f))
                                return true;
                        }
                    }
                    return false;
                });
                if (dirtyProtected.length > 0) {
                    addCheck('risky_changes', 'Risky Working Tree Changes', 'WARN', `Modifications detected in protected files: ${dirtyProtected.join(', ')}`);
                }
                else {
                    addCheck('risky_changes', 'Risky Working Tree Changes', 'PASS', 'No modifications in protected files.');
                }
            }
            else {
                addCheck('risky_changes', 'Risky Working Tree Changes', 'PASS', 'No working tree changes.');
            }
        }
        catch {
            addCheck('risky_changes', 'Risky Working Tree Changes', 'WARN', 'Failed to inspect git diff for risky modifications.');
        }
    }
    else {
        addCheck('risky_changes', 'Risky Working Tree Changes', 'PASS', 'Not git repository (skipped).');
    }
    // Write audit reports
    const reportsDir = path.join(cwd, '.jewel', 'reports');
    if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
    }
    // Save JSON
    const auditReport = {
        timestamp: new Date().toISOString(),
        checks
    };
    fs.writeFileSync(path.join(reportsDir, 'audit.json'), JSON.stringify(auditReport, null, 2), 'utf8');
    // Save MD
    let md = `# Jewel Safety and Quality Audit Report\n\n`;
    md += `**Date:** ${auditReport.timestamp}\n\n`;
    md += `## Check Results\n\n`;
    md += `| Check | Status | Description |\n`;
    md += `|---|---|---|\n`;
    for (const c of checks) {
        md += `| ${c.title} | **${c.status}** | ${c.details} |\n`;
    }
    md += `\n`;
    md += `## Summary\n\n`;
    const fails = checks.filter(c => c.status === 'FAIL').length;
    const warns = checks.filter(c => c.status === 'WARN').length;
    const passes = checks.filter(c => c.status === 'PASS').length;
    md += `- **Passes:** ${passes}\n`;
    md += `- **Warnings:** ${warns}\n`;
    md += `- **Failures:** ${fails}\n\n`;
    if (fails > 0) {
        md += `> [!WARNING]\n`;
        md += `> The repository has ${fails} safety failures. Fix failures highlighted in the table above before running agent tasks.\n`;
    }
    else {
        md += `> [!NOTE]\n`;
        md += `> Repository safety and configuration checks passed.\n`;
    }
    fs.writeFileSync(path.join(reportsDir, 'audit.md'), md, 'utf8');
    // Console output
    console.log('--- Audit Check List ---');
    for (const c of checks) {
        console.log(`  [${c.status}] ${c.title}: ${c.details}`);
    }
    console.log(`\nAudit completed: ${passes} Passes, ${warns} Warnings, ${fails} Failures.`);
}
