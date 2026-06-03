# Vinoth's Real Provider Validation Checklist (Jewel v0.7.2)

This checklist is custom-tailored for Windows PowerShell verification of Jewel `0.7.2` against Gemini and OpenRouter.

## ⚠️ Safety Warnings
* **DO NOT run these commands on production or uncommitted repositories.**
* Always keep `requireHumanDiffApproval: true` in your configuration to review diffs before they are written.
* Verify that no plain-text API keys or credentials are printed in logs or reports.

---

## Step-by-Step Validation Guide

### Step 1: Install Jewel globally from local tarball
Run the following commands in the root of the Jewel project directory:
```powershell
# 1. Compile the project
npm run build

# 2. Package the tarball
npm pack

# 3. Install globally from generated tarball
npm install -g .\jewel-cli-0.7.2.tgz
```

### Step 2: Verify CLI version
```powershell
jewel version
```
*Expected PASS point:* Output shows `Jewel version: 0.7.2`.

### Step 3: Run release checks
```powershell
jewel release-check
```
*Expected PASS point:* Outputs `Release Readiness Checklist finished with 0 Failures and 0 Warnings.`

### Step 4: Configure Gemini credentials
```powershell
$env:GEMINI_API_KEY="your_actual_gemini_key_here"
```

### Step 5: Run Gemini provider-ready check
```powershell
jewel provider-ready --provider gemini --model gemini-2.5-flash
```
*Expected PASS point:* Outputs success and generates report at `.jewel/reports/provider-ready.md` and `.json`.
*Expected FAIL point:* Fails cleanly if `$env:GEMINI_API_KEY` is not set or is empty.

### Step 6: Run Gemini smoke connection test
```powershell
jewel smoke-provider --provider gemini --model gemini-2.5-flash --schema --no-write
```
*Expected PASS point:* Outputs `[+] Smoke test passed successfully!`.

### Step 7: Configure OpenRouter credentials
```powershell
$env:OPENROUTER_API_KEY="your_actual_openrouter_key_here"
```

### Step 8: Run OpenRouter provider-ready check
```powershell
jewel provider-ready --provider openrouter --model openai/gpt-4o-mini
```
*Expected PASS point:* Outputs success and generates report at `.jewel/reports/provider-ready.md` and `.json`.
*Expected FAIL point:* Fails cleanly if `$env:OPENROUTER_API_KEY` is not set, or if an unsupported structured output model is selected (showing model-switch guidance).

### Step 9: Run OpenRouter smoke connection test
```powershell
jewel smoke-provider --provider openrouter --model openai/gpt-4o-mini --schema --no-write
```
*Expected PASS point:* Outputs `[+] Smoke test passed successfully!`.

### Step 10: Run Gemini dogfood task repair
```powershell
# Navigate to the sandbox folder
cd examples/dogfood-broken-project

# Run initial test suite to verify failure
npm test # (Should fail initially on b===0 math test)

# Run Jewel run command using Gemini
jewel run "fix the failing math test" --provider gemini --model gemini-2.5-flash --files src/math.ts

# Confirm git diff is clean, review changes side-by-side, type 'y' to approve.
# Verify tests compile and run successfully now:
npm test # (Should pass after Jewel applies patch)
```

### Step 11: Restore dogfood fixture to broken state
```powershell
# Discard applied changes
git restore src/math.ts
# Verify npm test fails again
npm test # (Should fail again)
```

### Step 12: Run OpenRouter dogfood task repair
```powershell
# Run Jewel run command using OpenRouter
jewel run "fix the failing math test" --provider openrouter --model openai/gpt-4o-mini --files src/math.ts

# Review and approve git diff.
# Verify tests compile and run successfully:
npm test # (Should pass after Jewel applies patch)
```

### Step 13: Inspect latest-run report
Examine `.jewel/reports/latest-run.md` and verify that the repair process, verification command log, and critic feedback are captured correctly.

### Step 14: Inspect provider-ready / provider-smoke reports
Inspect `.jewel/reports/provider-ready.md` and `.jewel/reports/provider-smoke.md` reports.

### Step 15: Confirm no secrets in reports
Verify that **no credentials, Authorization headers, or API keys** appear anywhere inside the `.jewel/reports/` folder. All keys must be redacted (replaced with `[REDACTED_API_KEY]` or similar).

### Step 16: Record results
Please fill out the following results template and share it back for the next hardening pass.

---

## Validation Results Table

| Step | Provider | Model | Status (PASS/FAIL) | Notes / Error Messages |
| --- | --- | --- | --- | --- |
| 1 | Gemini | gemini-2.5-flash | | |
| 2 | OpenRouter | openai/gpt-4o-mini | | |
| 3 | Gemini Dogfood | gemini-2.5-flash | | |
| 4 | OpenRouter Dogfood | openai/gpt-4o-mini | | |

---

## Cleanup Commands
Once you have recorded your results, restore the sandbox to its initial clean state:
```powershell
# PowerShell (Windows)
git restore src/math.ts
Remove-Item -Recurse -Force dist, .jewel -ErrorAction SilentlyContinue
```
