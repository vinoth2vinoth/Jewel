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
- **A verification-first AI coding safety harness**: Jewel wraps LLM executions in rigorous checkpoints, diff guards, and verification tests.
- **Provider-neutral**: Supports OpenAI, Gemini, Anthropic, OpenRouter, and a mock adapter out of the box.
- **Local-first**: Runs locally on your machine, managing your working directory via Git commits or copy snapshots.
- **Strict about file scope**: Ensures LLM agent proposals never write to files outside the declared task scope.
- **Safe-patch-writer protected**: Validates all incoming patch proposals for path escapes, traversal, absolute targets, and UNC targets before editing files.
- **Human-review friendly**: Prompts users with clean side-by-side git diff previews before applying any changes.
- **Built-in Secret Audit**: Scans reports and runs verification audits to identify and block leaked credentials.

## What Jewel IS NOT
- **A full Claude Code clone**: Jewel focuses specifically on the safety harness, checkpoint, and verification runner layers, not on building autonomous multi-agent loops.
- **A replacement for git**: Jewel relies on your existing git workflow for checkpoints and rollbacks.
- **A guarantee that AI code is perfect**: While Jewel enforces tests, compiling, and lint checks, it does not guarantee logical correctness.
- **A tool that should be run blindly on production repos**: Users should always review proposals and run tests before final commits.

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

### Global Local Installation & Verification
You can package and install Jewel globally from a local tarball to verify its behavior:
1. Package the project into a tarball:
   ```bash
   npm pack
   ```
   This generates a file like `jewel-cli-0.7.0.tgz`.
2. Install the package globally from the local tarball:
   ```bash
   npm install -g ./jewel-cli-0.7.0.tgz
   ```
3. Verify that the global command is available:
   ```bash
   jewel --help
   jewel version
   ```
4. Diagnose the workspace environment:
   ```bash
   jewel doctor
   ```
5. Initialize Jewel in a test directory:
   ```bash
   jewel init
   ```
6. Run verification checks:
   ```bash
   jewel verify
   ```

### Uninstalling
To completely uninstall the globally installed Jewel CLI:
```bash
npm uninstall -g jewel-cli
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
| `jewel release-check` | Run public release readiness checks (verifies version, dist files, documentation, package files list, no test packaging, and performs leaked credentials checks). |
| `jewel smoke-provider --provider <name>` | Verify connection and message format with a selected LLM provider. |
| `jewel version` | Output package and Node version information. |

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

## Safety & Security Model

1. **Destructive Commands Blocked**: Under `block` policy, dangerous commands (e.g., `rm -rf`, `del /s`, `format`, `shutdown`, `reboot`, remote script piping) are immediately caught and blocked.
2. **Environment Protection**: Direct prints or writes to `.env` files are blocked to prevent credential exposure.
3. **Secret Redaction**: Verification logs and reports automatically redact API keys, tokens, and credentials.
4. **Report Leak Audits**: The `release-check` command automatically scans report artifacts for sensitive keys (`sk-`, GitHub tokens, etc.) to ensure no leaks occur before code sharing.
5. **Surgical Enforcement**: If an agent modifies files outside of the task contract `filesLikelyNeeded`, the Critic or Diff Guard blocks the run.

---

## Limitations
- Only inspects CLI-driven actions; direct manual filesystem manipulation outside of standard session windows isn't intercepted.
- Fallback backup copy-paste is used if Git is not installed, which might be slower on very large non-git folders. (Ensure Git is initialized for maximum performance).

---

## LLM Adapter Integration

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

### Cost & Token Usage Reporting
When running tasks using real LLM providers, Jewel records input, output, and total token usage directly in the reports. These are stored at `.jewel/reports/latest-run.json` under the `usage` block. When provider is `none` or mock is run, usage is reported as unavailable or mock without faking costs.

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

## Real Provider Smoke & Integration Tests
To run live API provider smoke tests against live endpoints manually:
1. Configure your API keys (`OPENAI_API_KEY`, `GEMINI_API_KEY`, etc.).
2. Set the smoke test flag to true:
   ```bash
   $env:JEWEL_RUN_REAL_LLM_TESTS="true" # Windows PowerShell
   # or export JEWEL_RUN_REAL_LLM_TESTS="true" (Unix/Git Bash)
   ```
3. Use the validator helper script:
   ```bash
   node scripts/manual-real-provider-smoke.js openai gpt-4o-mini --schema
   ```
4. Read the guidelines in [docs/manual-real-provider-validation.md](file:///C:/Users/vinot/Documents/IM%2FActive%20Projects%2FProject%20Jewel%2Fdocs%2Fmanual-real-provider-validation.md) for full details.
