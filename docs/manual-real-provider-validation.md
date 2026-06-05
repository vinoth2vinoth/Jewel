# Manual Real Provider Validation Checklist

This guide provides a step-by-step procedure to manually validate Jewel against real LLM providers in a global installation environment before final release.

## ⚠️ CRITICAL WARNING: Start in a Sandbox Repo
> [!CAUTION]
> - **Never** run these dogfood checks on an important, production, or uncommitted repository.
> - Always perform validation in a **new, empty throwaway repository** initialized from scratch.

---

## Validation Steps

Follow these steps to verify that the CLI, git checkpointing, verification flow, and secret redaction operate correctly under global usage.

### Step 1: Pack and Install Jewel Globally
1. From the root of the Jewel project repository, build the source and pack it:
   ```bash
   npm run build
   npm pack
   ```
   This creates a file named `jewel-cli-0.8.0.tgz` (or current package version).
2. Install Jewel globally using the generated tarball:
   ```bash
   npm install -g ./jewel-cli-0.8.0.tgz
   ```
3. Verify that the global installation works:
   ```bash
   jewel --help
   jewel version
   ```

### Step 2: Create a Throwaway Sandbox Repository
1. Initialize a clean test project in a separate directory:
   ```bash
   mkdir ~/jewel-dogfood-test
   cd ~/jewel-dogfood-test
   git init
   git config user.name "Dogfood Test"
   git config user.email "dogfood@test.com"
   ```
2. Create a basic failing test setup:
   - Create `package.json`:
     ```json
     {
       "name": "dogfood-test",
       "version": "1.0.0",
       "scripts": {
         "test": "node --test src/math.test.js"
       }
     }
     ```
   - Create a source file `src/math.js`:
     ```javascript
     function add(a, b) {
       return a + b;
     }
     // Bug: division throws nothing on division by zero
     function divide(a, b) {
       return a / b;
     }
     module.exports = { add, divide };
     ```
   - Create a failing test file `src/math.test.js`:
     ```javascript
     const test = require('node:test');
     const assert = require('node:assert');
     const { add, divide } = require('./math');

     test('add works', () => {
       assert.strictEqual(add(2, 3), 5);
     });

     test('divide throws on division by zero', () => {
       assert.throws(() => divide(5, 0), /Cannot divide by zero/);
     });
     ```
3. Commit the initial setup:
   ```bash
   git add .
   git commit -m "initial broken commit"
   ```
4. Confirm the test fails:
   ```bash
   npm test
   ```

### Step 3: Initialize Jewel Configuration
Initialize Jewel in the test repo:
```bash
jewel init
```
This creates `jewel.config.json` and `AGENTS.md`. Configure the verification test command:
```json
"commands": {
  "test": "npm test"
}
```

---

## Step 4: Run Smoke Tests Per Provider
Configure API keys in your current shell and run validation tests. Repeat for each provider if keys are available.

### 1. OpenAI Smoke Test
1. Set key:
   ```bash
   export OPENAI_API_KEY="sk-proj-..."
   ```
2. Run smoke check:
   ```bash
   jewel smoke-provider --provider openai --model gpt-4o-mini --schema
   ```
3. Run actual patch proposal on `src/math.js`:
   ```bash
   jewel run "Fix the divide function to throw an error 'Cannot divide by zero' when denominator b is 0" --provider openai --model gpt-4o-mini -f src/math.js
   ```
4. Verify:
   - Inspect the git diff shown in the terminal during the human approval prompt.
   - Accept the change by typing `y`.
   - Ensure the verification tests execute and pass.
   - Verify the post-run report contains **no** leaked API key characters.

### 2. Gemini Smoke Test
1. Set key:
   ```bash
   export GEMINI_API_KEY="AIzaSy..."
   ```
2. Run smoke check:
   ```bash
   jewel smoke-provider --provider gemini --model gemini-1.5-flash --schema
   ```
3. Run patch proposal:
   ```bash
   jewel run "Fix division by zero error" --provider gemini --model gemini-1.5-flash -f src/math.js
   ```
4. Accept, verify tests pass, and check report logs.

### 3. Anthropic Smoke Test
1. Set key:
   ```bash
   export ANTHROPIC_API_KEY="sk-ant-..."
   ```
2. Run smoke check:
   ```bash
   jewel smoke-provider --provider anthropic --model claude-3-5-haiku-20241022 --schema
   ```
3. Run patch proposal:
   ```bash
   jewel run "Fix division by zero in divide function" --provider anthropic --model claude-3-5-haiku-20241022 -f src/math.js
   ```
4. Accept, verify tests pass, and check report logs.

### 4. OpenRouter Smoke Test
1. Set key:
   ```bash
   export OPENROUTER_API_KEY="sk-or-..."
   ```
2. Run smoke check:
   ```bash
   jewel smoke-provider --provider openrouter --model openai/gpt-4o-mini --schema
   ```
3. Run patch proposal:
   ```bash
   jewel run "Fix divide by zero" --provider openrouter --model openai/gpt-4o-mini -f src/math.js
   ```
4. Accept, verify tests pass, and check report logs.

---

## Step 5: Report Redaction Audit
Run the release checklist command in the sandbox directory to verify that no secret keys have leaked into the reports:
```bash
jewel release-check
```
Ensure that the "Report redaction audit passed" check is green.
If you find any warnings, inspect the generated `.jewel/reports/latest-run.json` or `.jewel/reports/provider-smoke.json` files to resolve the leak before publishing.
