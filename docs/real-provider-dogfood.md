# Real Provider Dogfooding Guide

This guide explains how to safely connect and test Jewel with real Large Language Model (LLM) providers like OpenAI, Gemini, Anthropic, and OpenRouter in real-world projects.

## ⚠️ Safety Warning: Start Small

> [!WARNING]
> - **Do NOT run Jewel blindly on important, production, or uncommitted repositories.**
> - Start by testing in a **tiny, mock project** or a clean fork first.
> - Ensure your working directory is clean (`git status`) before executing a task.

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
```

### Setting Environment Variables (Bash/Unix)
```bash
export OPENAI_API_KEY="sk-proj-..."
export GEMINI_API_KEY="AIzaSy..."
```

---

## 2. Safe Testing Best Practices

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

## 3. Provider and Model Overrides
You can select a provider and model in `jewel.config.json` or override them dynamically on a per-run basis using CLI parameters:

```bash
# Run with OpenAI gpt-4o-mini
jewel run "Fix typo in home page" -f src/App.tsx --provider openai --model gpt-4o-mini

# Run with Anthropic Claude 3.5 Sonnet
jewel run "Refactor auth middleware" -f src/middleware.ts --provider anthropic --model claude-3-5-sonnet-20241022

# Run with Gemini 1.5 Pro
jewel run "Optimize DB query" -f src/db.ts --provider gemini --model gemini-1.5-pro

# Run with OpenRouter Llama 3
jewel run "Write unit tests" -f src/util.ts --provider openrouter --model meta-llama/llama-3-70b-instruct
```

---

## 4. How to Inspect Run Reports
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

## 5. manual and Env-Gated Integration Testing
During standard project unit testing (`npm test`), Jewel **never** makes real API calls to remote LLM providers to avoid unwanted cost and API dependency.

Remote provider tests are strictly env-gated:
* To execute provider connection smoke checks, you must set:
  ```bash
  export JEWEL_RUN_REAL_LLM_TESTS="true"
  ```
* Running `npm test` with this variable set executes live connection checks against the remote endpoints using your configured API keys.
