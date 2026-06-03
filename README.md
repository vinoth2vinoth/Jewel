# Jewel: Strict AI Coding Safety Harness

Jewel is a strict, verification-first AI coding harness CLI designed to force AI coding agents to follow disciplined software engineering principles. 

Inspired by Andrej Karpathy's style of coding:
1. Think before coding
2. Simplicity first
3. Surgical changes only
4. Goal-driven execution
5. Verify before declaring success
6. Rollback safely if verification fails
7. Never fake success
8. Never make broad unrelated changes
9. Never hide uncertainty
10. Never proceed without proof

> [!IMPORTANT]
> **Branding Notice**: Jewel is Karpathy-inspired but is *not* officially affiliated with or endorsed by Andrej Karpathy.

---

## What Jewel IS
- A local CLI harness that intercepts agent modifications.
- A strict guardrail checking command safety, file scoping, line change thresholds, and dependency additions.
- An automated runner for verification suites (lint, test, build, typecheck, e2e) that captures stdout/stderr.
- A rollback engine that leverages Git or backup snapshots to automatically revert changes when verification fails.
- An instruction generator (`AGENTS.md`) and safety skills suite (`.jewel/skills/`).

## What Jewel IS NOT
- A cloud dashboard or SaaS.
- A VS Code or editor extension.
- A multi-agent framework or swarm.
- A full Claude Code or Aider clone.

---

## Installation & Setup

### Local Development
Clone this repository and set up dependencies:
```bash
npm install
npm run build
```

To run Jewel locally:
```bash
node dist/cli/index.js --help
```

You can link it locally to expose the `jewel` binary:
```bash
npm link
jewel --help
```

---

## Command Reference

| Command | Description |
|---|---|
| `jewel init` | Initialize the config file, `AGENTS.md`, and default safety skills. |
| `jewel run "<task>"` | Execute a coding task wrapped in a session contract, checkpoint, validation, and critic check. |
| `jewel verify` | Manually trigger all active verification commands. |
| `jewel status` | Show current initialization status, git cleanliness, and recent sessions. |
| `jewel rollback` | Revert the workspace to the latest session checkpoint state. |
| `jewel audit` | Inspect repository configuration quality and security. |
| `jewel doctor` | Diagnose environment dependencies, Node, Git, API keys, and configuration. |

---

## Configuration: `jewel.config.json`

Default config contents:
```json
{
  "projectName": "",
  "mode": "strict",
  "maxRetries": 3,
  "maxFilesChanged": 8,
  "maxLinesChanged": 500,
  "requirePlanBeforeEdit": true,
  "requireVerificationBeforeDone": true,
  "allowNewDependencies": false,
  "allowProtectedFileChanges": false,
  "allowGitPush": false,
  "commands": {
    "lint": "",
    "typecheck": "",
    "test": "",
    "build": "",
    "e2e": ""
  },
  "protectedFiles": [
    ".env",
    ".env.local",
    ".env.*",
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "bun.lockb",
    "schema.prisma",
    "migrations/**",
    "src/auth/**",
    "src/payments/**",
    "src/billing/**",
    "src/security/**"
  ],
  "dangerousCommandPolicy": "block",
  "reportFormat": ["markdown", "json"]
}
```

---

## Windows & Cross-Platform Usage Examples

Jewel works out-of-the-box across **PowerShell, Command Prompt, Git Bash, and Unix terminals**.

### 1. PowerShell Workflow
```powershell
# 1. Initialize Jewel
jewel init

# 2. Diagnose setup
jewel doctor

# 3. Audit repository safety
jewel audit

# 4. Run a task with mock adapter (or manual edit)
jewel run "Implement arithmetic add helper" --mock --files "src/math.ts"

# 5. Check session status
jewel status

# 6. Revert changes if verification fails
jewel rollback
```

### 2. Git Bash (Unix syntax)
```bash
# Initialize and verify
jewel init
jewel doctor
jewel verify

# Run a specific task
jewel run "Update endpoint documentation" -f README.md -m
```

---

## Safety & Security Model (Phase 19)

1. **Destructive Commands Blocked**: Under `block` policy, dangerous commands (e.g., `rm -rf`, `del /s`, `format`, `shutdown`, `reboot`, remote script piping) are immediately caught and blocked.
2. **Environment Protection**: Direct prints or writes to `.env` files are blocked to prevent credential exposure.
3. **Secret Redaction**: Verification logs and reports automatically redact API keys, tokens, and credentials.
4. **Surgical Enforcement**: If an agent modifies files outside of the task contract `filesLikelyNeeded`, the Critic or Diff Guard blocks the run.

---

## Limitations
- Only inspects CLI-driven actions; direct manual filesystem manipulation outside of standard session windows isn't intercepted.
- Fallback backup copy-paste is used if Git is not installed, which might be slower on very large non-git folders. (Ensure Git is initialized for maximum performance).
