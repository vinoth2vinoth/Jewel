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

---

## LLM Adapter Integration (v0.4.0)

Jewel supports running tasks using real LLM providers via a provider-neutral adapter layer:
- **none**: Runs in mock/dry-run mode using local mock files.
- **openai**: OpenAI Chat Completions adapter (`/v1/chat/completions`).
- **gemini**: Google Gemini generateContent REST API.
- **anthropic**: Anthropic Messages REST API.
- **openrouter**: OpenRouter Chat Completions REST API.

### Provider Environment Variables
Make sure to configure the corresponding API key in your environment:
- `OPENAI_API_KEY` (for OpenAI)
- `GEMINI_API_KEY` (for Gemini)
- `ANTHROPIC_API_KEY` (for Anthropic)
- `OPENROUTER_API_KEY` (for OpenRouter)

### CLI Overrides
You can override the configured provider, model, temperature, and tokens directly from the CLI on a per-run basis:
```bash
# Override provider and model
jewel run "Fix math divide test" --provider openai --model gpt-4o --temperature 0.2

# Override Gemini parameters
jewel run "Implement array helpers" --provider gemini --model gemini-1.5-pro --max-output-tokens 2000
```

### Cost & Token Reporting
When running tasks using real LLM providers, Jewel records input, output, and total token usage directly in the reports. These are stored at `.jewel/reports/latest-run.json` under the `usage` block.

---

## Using Real LLM Providers Safely

To ensure safety when integrating real LLM providers into your developer workflow, follow these guidelines:

1. **Start with provider none**: Use the mock adapter (`provider: "none"`) or manual edits first to understand the harness mechanics.
2. **Never paste secrets into prompts**: Do not input raw passwords, API keys, or database credentials in your task descriptions.
3. **Secret Redaction**: While Jewel automatically redacts known API keys (e.g. `sk-`, `github_pat_`), tokens, bearer authentication, and private key blocks from reports and logs, users must still avoid exposing sensitive private data.
4. **JSON Patches Only**: Real LLM adapters can only propose structured JSON patches containing file changes and plans. They never have direct write access to the filesystem.
5. **Strict safe-patch-writer Guard**: Jewel's [safe-patch-writer.ts](file:///C:/Users/vinot/Documents/IM/Active%20Projects/Project%20Jewel/src/safety/safe-patch-writer.ts) is the *only* component authorized to apply changes to your workspace. All proposals are checked for path escape and traversal before writing.
6. **Transactional Write Hardening**: Safe-patch-writer utilizes transactional snapshotting and rollback. If any file write fails during application (e.g. out of disk space, write block), all other files are restored to their original contents and newly created files are deleted.
7. **Always review diffs**: Before approving, thoroughly review the preview diff shown by the human diff review gate.
8. **Keep approval enabled**: Maintain `requireHumanDiffApproval: true` in your `jewel.config.json` when using real LLM providers.

---

## Dogfooding Demo Project
We have included a small broken dogfood project under `examples/dogfood-broken-project`.
To test Jewel inside it:
1. Navigate to the dogfood project directory.
2. Run `npm install` and `npm run build`.
3. Verify tests fail by running `npm test`.
4. Run the Jewel CLI to resolve the issue:
   ```bash
   node ../../dist/cli/index.js run "fix the failing math test" --provider none --mock --files src/math.ts --yes
   ```
5. Observe the successful build verification and output report under `.jewel/reports/latest-run.md`.

---

## Real Provider Smoke Tests
To run live API provider smoke tests against live endpoints:
1. Configure your API keys (`OPENAI_API_KEY`, `GEMINI_API_KEY`, etc.).
2. Set the smoke test flag to true:
   ```bash
   $env:JEWEL_RUN_REAL_LLM_TESTS="true"
   ```
3. Execute `npm test` to run both the mocked test suite and the real provider connection checks.

