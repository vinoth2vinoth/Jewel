# Real Provider Dogfooding Guide

This guide explains how to safely connect and test Jewel with real Large Language Model (LLM) providers like OpenAI, Gemini, Anthropic, and OpenRouter in real-world projects.

## ⚠️ Safety Warning: Start Small

> [!WARNING]
> - **Do NOT run Jewel blindly on important, production, or uncommitted repositories.**
> - Always start by testing on a **tiny, mock project** or a clean fork first.
> - Ensure your working directory is clean (`git status`) before executing a task.
> - Keep `--files` scope as narrow as possible.
> - Never disable `"requireHumanDiffApproval"` (leave it `true`) to ensure you can always inspect and reject any generated patch.

---

## 1. Environment Variables Configuration
Before configuring Jewel to use a real provider, export the matching API key to your environment. Jewel reads the following variables:

| LLM Provider | Environment Variable Name |
|---|---|
| **OpenAI** | `OPENAI_API_KEY` |
| **Gemini** | `GEMINI_API_KEY` |
| **Anthropic** | `ANTHROPIC_API_KEY` |
| **OpenRouter** | `OPENROUTER_API_KEY` |

### Setting Environment Variables (PowerShell)
```powershell
$env:OPENAI_API_KEY="sk-proj-..."
$env:GEMINI_API_KEY="AIzaSy..."
$env:ANTHROPIC_API_KEY="sk-ant-..."
$env:OPENROUTER_API_KEY="sk-or-..."
```

### Setting Environment Variables (Bash/Unix)
```bash
export OPENAI_API_KEY="sk-proj-..."
export GEMINI_API_KEY="AIzaSy..."
export ANTHROPIC_API_KEY="sk-ant-..."
export OPENROUTER_API_KEY="sk-or-..."
```

---

## 2. Validation with `smoke-provider`

Use the `jewel smoke-provider` command to run a harmless diagnostic check to verify that a provider is configured properly, responds to prompts, and supports structured JSON outputs correctly.

### Smoke Test Examples

```bash
# Smoke test OpenAI using schema mode (validates native structured outputs)
jewel smoke-provider --provider openai --model gpt-4o-mini --schema

# Smoke test Gemini without schema mode
jewel smoke-provider --provider gemini --model gemini-1.5-flash

# Smoke test Anthropic with no report-write
jewel smoke-provider --provider anthropic --model claude-3-5-haiku-20241022 --no-write

# Smoke test OpenRouter
jewel smoke-provider --provider openrouter --model openai/gpt-4o-mini --schema
```

### Checking Smoke Reports
Unless `--no-write` is specified, smoke results are saved to:
* **`.jewel/reports/provider-smoke.json`**: Contains full provider parameters, API status, raw response structure, token usage, and errors.
* **`.jewel/reports/provider-smoke.md`**: Human-readable summary of the test.

---

## 3. Safe Testing Best Practices

To ensure Jewel's safety harness guards your codebase effectively, follow these critical rules:

1. **Keep Human approval enabled**: Make sure `"requireHumanDiffApproval": true` is set in your `jewel.config.json`. This prompts you with a complete git diff preview before applying changes.
2. **Restrict Scope with `--files`**: Always use the `-f` or `--files` CLI parameter to declare exactly which files the agent is allowed to inspect and modify.
   ```bash
   jewel run "Fix division by zero bug" --files "src/math.ts"
   ```
3. **Use Dry-Run first**: Use the `--dry-run` flag to preview the task contract, risk level assessment, and allowed file scope before initiating LLM calls:
   ```bash
   jewel run "Fix division by zero bug" --files "src/math.ts" --dry-run
   ```

---

## 4. Provider and Model Overrides
You can select a provider and model in `jewel.config.json` or override them dynamically on a per-run basis using CLI parameters:

```bash
# Run with OpenAI gpt-4o-mini
jewel run "Fix typo in home page" -f src/App.tsx --provider openai --model gpt-4o-mini

# Run with Anthropic Claude 3.5 Sonnet
jewel run "Refactor auth middleware" -f src/middleware.ts --provider anthropic --model claude-3-5-sonnet-20241022

# Run with Gemini 1.5 Pro
jewel run "Optimize DB query" -f src/db.ts --provider gemini --model gemini-1.5-pro

# Run with OpenRouter Llama 3
jewel run "Write unit tests" -f src/util.ts --provider openrouter --model openai/gpt-4o-mini
```

---

## 5. How to Inspect Run Reports
After every execution, Jewel produces structured safety and verification reports in `.jewel/reports/`:

* **`latest-run.md`**: A human-friendly markdown report showing:
  - Jewel version
  - LLM Provider, Model, and Adapter name
  - Which verification commands actually executed
  - Diff guard status (changed files count, lines added/removed)
  - Safe patch writer status (PASS or BLOCKED with reasons)
  - Human review status (APPROVED or REJECTED)
  - Rollback status (N/A, ROLLED_BACK, or KEPT_FAILED)
  - Changed files lists and blocked file proposals
  - Token usage statistics
* **`latest-run.json`**: A machine-readable JSON representation of all execution metadata.

### Secret Redaction Policy
Jewel automatically redacts known API key patterns (e.g. `sk-`, `AIzaSy`), authorization headers, token strings, and private key blocks from reports, CLI logs, and saved session files.

---

## 6. Troubleshooting

### Invalid JSON Response
* **Symptoms**: Agent run fails with `BLOCKED: Invalid JSON in LLM response`.
* **Fixes**:
  - Verify that the model supports structured outputs or JSON mode.
  - Enable `"llmStrictJson": true` in `jewel.config.json`.
  - For models that don't support structured output schema mode, set `"allowUnstructuredProviderFallback": true` in your config to fall back to general JSON prompts.

### Schema Unsupported
* **Symptoms**: Adaptor planning fails with `Model X does not support structured output, and allowUnstructuredProviderFallback is false`.
* **Fixes**:
  - Switch to a modern, supported model (e.g., `gpt-4o`, `gemini-1.5-flash`, `claude-3-5-sonnet-20241022`).
  - If you must use an older model, set `"allowUnstructuredProviderFallback": true` in configuration to bypass the structured output requirement.

### Timeouts and Rate Limits
* **Symptoms**: Errors indicating `HTTP Error 429` (Rate Limit) or request timeouts.
* **Fixes**:
  - Jewel automatically retries 429 and 500-level errors using exponential backoff with random jitter.
  - If timeouts persist, increase `"llmTimeoutMs"` (e.g., `120000` for 2 minutes) or decrease task complexity to reduce the size of the repository context sent to the provider.
  - If you hit rate limits frequently, configure a higher `"llmMaxRetries"` (up to `5` or `10`) in `jewel.config.json`.
