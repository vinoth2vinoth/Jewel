# Vinoth's Real Provider Validation Checklist

This checklist is custom-tailored for Windows PowerShell verification of Jewel against Gemini and OpenRouter.

## Preparation: Install and Verify CLI
1. Navigate to the root of the Jewel project directory.
2. Build the project and package it:
   ```powershell
   npm run build
   npm pack
   ```
3. Install the generated tarball globally:
   ```powershell
   npm install -g ./jewel-cli-0.7.1.tgz
   ```
4. Verify the version command outputs `0.7.1`:
   ```powershell
   jewel version
   ```
5. Run the release checklist to verify everything compiles and passes packages checks:
   ```powershell
   jewel release-check
   ```
   *Expected Outcome:* `Release Readiness Checklist finished with 0 Failures and 0 Warnings.`

---

## Part 1: Gemini Provider Validation

1. Configure your Gemini API key in the shell:
   ```powershell
   $env:GEMINI_API_KEY="your_actual_gemini_key_here"
   ```
2. Execute the connection smoke validation:
   ```powershell
   jewel smoke-provider --provider gemini --model gemini-2.5-flash --schema --no-write
   ```
   *Expected Outcome:* `[+] Smoke test passed successfully!`
3. Move into the dogfood sandbox:
   ```powershell
   cd examples/dogfood-broken-project
   ```
4. Clear previous test results:
   ```powershell
   Remove-Item -Recurse -Force dist, .jewel -ErrorAction SilentlyContinue
   ```
5. Run Jewel on the broken project using Gemini:
   ```powershell
   jewel run "fix the failing math test" --provider gemini --model gemini-2.5-flash --files src/math.ts
   ```
   *Expected Outcome:* 
   - Side-by-side diff matches what you expect.
   - Enter `y` to approve the diff.
   - Verification tests compile and run (`npm test` passes).
   - CLI prints success!
6. Reset the dogfood sandbox to its broken state for the next check:
   ```powershell
   git checkout -- src/math.ts
   ```

---

## Part 2: OpenRouter Provider Validation

1. Configure your OpenRouter API key in the shell:
   ```powershell
   $env:OPENROUTER_API_KEY="your_actual_openrouter_key_here"
   ```
2. Execute the connection smoke validation:
   ```powershell
   jewel smoke-provider --provider openrouter --model openai/gpt-4o-mini --schema --no-write
   ```
   *Expected Outcome:* `[+] Smoke test passed successfully!`
3. Make sure you are in `examples/dogfood-broken-project` and clear previous outputs:
   ```powershell
   cd examples/dogfood-broken-project
   Remove-Item -Recurse -Force dist, .jewel -ErrorAction SilentlyContinue
   ```
4. Run Jewel on the broken project using OpenRouter:
   ```powershell
   jewel run "fix the failing math test" --provider openrouter --model openai/gpt-4o-mini --files src/math.ts
   ```
   *Expected Outcome:*
   - Side-by-side diff matches what you expect.
   - Enter `y` to approve the diff.
   - Verification tests compile and run (`npm test` passes).
   - CLI prints success!

---

## Part 3: Inspect Logs and Reports
1. Examine the report generated under `.jewel/reports/latest-run.md` and `.jewel/reports/latest-run.json`.
2. Confirm there are **no plain-text API keys** or secrets logged. All credentials should be fully redacted.
3. Clean up the sandbox files when complete:
   ```powershell
   git checkout -- src/math.ts
   Remove-Item -Recurse -Force dist, .jewel -ErrorAction SilentlyContinue
   ```
