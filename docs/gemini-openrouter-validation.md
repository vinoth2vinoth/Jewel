# Gemini and OpenRouter Real Provider Validation

This guide explains how to validate Jewel version `0.7.2` using Gemini and OpenRouter, with a focus on Windows PowerShell.

## ⚠️ CAUTION & SAFETY RULES
1. **Do not run these commands on production or uncommitted repositories.**
2. Start only inside the provided sandbox environment at `examples/dogfood-broken-project`.
3. Keep `requireHumanDiffApproval: true` in your configuration to review diffs before they are written.
4. Always use `-f` / `--files` to scope the workspace.
5. Inspect `.jewel/reports/latest-run.md` and confirm that **no secrets or API keys** appear in any files in `.jewel/reports/`.
6. Restore the dogfood fixture to its broken state after testing.

---

## 1. Installation from Local Tarball
First, pack and install Jewel locally:
```powershell
# PowerShell (Windows)
npm pack
npm install -g .\jewel-cli-0.7.2.tgz
jewel version
jewel release-check
```

*Git Bash Alternative:*
```bash
# Git Bash
npm pack
npm install -g ./jewel-cli-0.7.2.tgz
jewel version
jewel release-check
```

---

## 2. Gemini Setup & Validation

```powershell
# Windows PowerShell
$env:GEMINI_API_KEY="your_actual_api_key_here"

# 1. Run provider readiness check (checks capability registry and connections)
jewel provider-ready --provider gemini --model gemini-2.5-flash

# 2. Run schema smoke check (no-write)
jewel smoke-provider --provider gemini --model gemini-2.5-flash --schema --no-write
```

*Git Bash Alternative:*
```bash
# Git Bash
export GEMINI_API_KEY="your_actual_api_key_here"
jewel provider-ready --provider gemini --model gemini-2.5-flash
jewel smoke-provider --provider gemini --model gemini-2.5-flash --schema --no-write
```

---

## 3. OpenRouter Setup & Validation

```powershell
# Windows PowerShell
$env:OPENROUTER_API_KEY="your_actual_api_key_here"

# 1. Run provider readiness check
jewel provider-ready --provider openrouter --model openai/gpt-4o-mini

# 2. Run schema smoke check (no-write)
jewel smoke-provider --provider openrouter --model openai/gpt-4o-mini --schema --no-write
```

*Git Bash Alternative:*
```bash
# Git Bash
export OPENROUTER_API_KEY="your_actual_api_key_here"
jewel provider-ready --provider openrouter --model openai/gpt-4o-mini
jewel smoke-provider --provider openrouter --model openai/gpt-4o-mini --schema --no-write
```

---

## 4. Real Project Dogfooding

Verify that Jewel can repair the failing test in the dogfood repository:

### Gemini Dogfood Repair:
```powershell
# PowerShell (Windows)
cd examples\dogfood-broken-project
npm test # (Should fail initially)

jewel run "fix the failing math test" --provider gemini --model gemini-2.5-flash --files src/math.ts

npm test # (Should pass after Jewel applies patch)
```

### OpenRouter Dogfood Repair:
```powershell
# PowerShell (Windows)
cd examples\dogfood-broken-project
npm test # (Should fail initially)

jewel run "fix the failing math test" --provider openrouter --model openai/gpt-4o-mini --files src/math.ts

npm test # (Should pass after Jewel applies patch)
```

*Git Bash Alternative:*
```bash
# Git Bash
cd examples/dogfood-broken-project
npm test
jewel run "fix the failing math test" --provider openrouter --model openai/gpt-4o-mini --files src/math.ts
npm test
```

---

## 5. Cleanup & Resetting Dogfood Fixture
After completing tests, restore the math fixture to its intentionally broken state so that validation can be repeated or built safely:
```powershell
# PowerShell (Windows)
git restore src/math.ts
# or discard changes in git
git checkout -- src/math.ts
```

*Git Bash Alternative:*
```bash
# Git Bash
git restore src/math.ts
```

---

## 6. Troubleshooting Guide

### A. Missing API Key Error
* **Symptom:** CLI outputs `Error: Missing API key environment variable "GEMINI_API_KEY" ...`.
* **PowerShell Fix:** Run `$env:GEMINI_API_KEY="your_key"`. Note that environment variables set via `$env:` only persist for the duration of the current PowerShell window.
* **Bash Fix:** Run `export GEMINI_API_KEY="your_key"`.

### B. Invalid JSON or Format Error
* **Symptom:** Failure stating `BLOCKED: Invalid JSON in LLM response ...`.
* **Fix:** Ensure the model supports strict structured outputs natively. If a model fails to adhere to schemas regularly, you may enable fallback by setting `"allowUnstructuredProviderFallback": true` in `jewel.config.json` (warning: fallback reduces safety and reliability).

### C. OpenRouter Schema Unsupported Error
* **Symptom:** Failure stating `Model "..." does not support structured outputs (response_format json_schema) ...`.
* **Fix:** OpenRouter structured outputs are model-dependent. Choose a model registered in Jewel's registry that natively supports json_schema, such as `openai/gpt-4o-mini` or `anthropic/claude-3.5-sonnet`. Avoid enabling unstructured fallback for important repositories. Refer to [model-capabilities.md](file:///C:/Users/vinot/Documents/IM/Active%20Projects/Project%20Jewel/docs/model-capabilities.md) for recommendations.

### D. Timeouts & Rate Limits (HTTP 429)
* **Symptom:** Network request timeouts or HTTP status code 429.
* **Fix:** Jewel's HTTP client automatically performs exponential retries with jitter. If rate limits persist, lower the test frequency, reduce `llmMaxRetries`, or increase `llmTimeoutMs` in your `jewel.config.json` file.
