# Gemini and OpenRouter Real Provider Validation

This guide explains how to validate Jewel using Gemini and OpenRouter in Windows PowerShell and Git Bash.

## ⚠️ CAUTION
- **Do not run these commands on production or uncommitted repositories.**
- Start inside the provided sandbox environment at `examples/dogfood-broken-project`.
- Keep `requireHumanDiffApproval: true` in your configuration to review diffs before they are written.

---

## 1. PowerShell Validation Commands (Windows Default)

### Gemini Validation
```powershell
# Set environment API key
$env:GEMINI_API_KEY="AIzaSy..."

# Run connection validation (smoke check)
jewel smoke-provider --provider gemini --model gemini-2.5-flash --schema --no-write

# Run actual dogfood task repair
jewel run "fix the failing math test" --provider gemini --model gemini-2.5-flash --files src/math.ts
```

### OpenRouter Validation
```powershell
# Set environment API key
$env:OPENROUTER_API_KEY="sk-or-v1..."

# Run connection validation (smoke check)
jewel smoke-provider --provider openrouter --model openai/gpt-4o-mini --schema --no-write

# Run actual dogfood task repair
jewel run "fix the failing math test" --provider openrouter --model openai/gpt-4o-mini --files src/math.ts
```

---

## 2. Git Bash Validation Commands (Unix Shell)

### Gemini Validation
```bash
export GEMINI_API_KEY="AIzaSy..."
jewel smoke-provider --provider gemini --model gemini-2.5-flash --schema --no-write
jewel run "fix the failing math test" --provider gemini --model gemini-2.5-flash --files src/math.ts
```

### OpenRouter Validation
```bash
export OPENROUTER_API_KEY="sk-or-v1..."
jewel smoke-provider --provider openrouter --model openai/gpt-4o-mini --schema --no-write
jewel run "fix the failing math test" --provider openrouter --model openai/gpt-4o-mini --files src/math.ts
```

---

## 3. Post-run Inspection
1. Always review the side-by-side git diff in your console and approve by typing `y` only if it looks correct.
2. Confirm the tests complete successfully during verification.
3. Check the markdown reports in `.jewel/reports/latest-run.md` and verify that **no API keys or credentials** are logged. (They should be automatically redacted by the secret redactor).

---

## 4. Troubleshooting Guide

### A. Missing API Key Error
* **Symptom:** CLI outputs `Error: Missing API key environment variable "GEMINI_API_KEY" ...`.
* **Fix:** Ensure the variable is set in the active terminal session. Note that setting `$env:KEY` in PowerShell only lasts for the lifetime of that terminal window. Check key spelling.

### B. Invalid JSON or Format Error
* **Symptom:** Failure stating `BLOCKED: Invalid JSON in LLM response ...`.
* **Fix:** Ensure `--schema` flag is used. If the model fails to adhere to the schema regularly, enable `allowUnstructuredProviderFallback: true` in your `jewel.config.json` to allow structured extraction fallback (note: fallback reduces strict validation guarantees).

### C. OpenRouter Unsupported Schema Error
* **Symptom:** Failure stating `Model "..." does not support structured outputs (response_format json_schema) ...`.
* **Fix:** Not all models hosted on OpenRouter support strict JSON schemas. Use models registered in Jewel's capability registry such as `openai/gpt-4o-mini`, `anthropic/claude-3.5-sonnet`, or `meta-llama/llama-3.3-70b-instruct`.

### D. Timeouts & Rate Limits (HTTP 429)
* **Symptom:** Timeout error during API call or HTTP status code 429.
* **Fix:** Jewel's HTTP client automatically performs exponential retries with jitter. If rate limits persist, consider lowering temperature to `0` or increasing `llmTimeoutMs` in your `jewel.config.json` configuration file.
