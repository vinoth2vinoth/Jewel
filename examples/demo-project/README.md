# Jewel Demo Project

This is a sandbox project designed to demonstrate the safety features of Jewel CLI.

## How to Run the Demo

To test Jewel with this repository, open your terminal (PowerShell, CMD, or Git Bash) inside this directory (`examples/demo-project`) and follow these steps:

### 1. Initialize Jewel
Setup configuration, AGENTS.md, and default safety skills:
```bash
node ../../dist/cli/index.js init
```
This creates:
- `jewel.config.json`
- `AGENTS.md`
- `.jewel/` folders and skills

### 2. Configure Verification Commands
Open `jewel.config.json` and configure the verification tests:
```json
  "commands": {
    "test": "npm test"
  }
```

### 3. Diagnose the Workspace
Run the doctor tool to verify environment compatibility:
```bash
node ../../dist/cli/index.js doctor
```

### 4. Run Verification (Passing)
Verify that our test suite runs and passes successfully:
```bash
node ../../dist/cli/index.js verify
```
Check the verification reports written to `.jewel/reports/latest.md` and `latest.json`.

### 5. Run Verification (Failing)
Set the fail-trigger environment variable and run verify to see Jewel capture failures:
- **PowerShell**:
  ```powershell
  $env:JEWEL_FAIL_DEMO="true"
  node ../../dist/cli/index.js verify
  Remove-Item Env:\JEWEL_FAIL_DEMO
  ```
- **Bash / Git Bash**:
  ```bash
  JEWEL_FAIL_DEMO="true" node ../../dist/cli/index.js verify
  ```

### 6. Perform a Security Audit
Assess repository safety:
```bash
node ../../dist/cli/index.js audit
```

### 7. Run a Task with Mock Adapter
Simulate an agent executing a task. This creates a session contract, checkpoints files, applies changes, run verification, and reviews the outcome:
```bash
node ../../dist/cli/index.js run "Update mathematics functions" --mock -f math.js
```
Examine `.jewel/sessions/` and `.jewel/reports/latest-run.md`.

### 8. View Status
Review recent sessions and checkpoints:
```bash
node ../../dist/cli/index.js status
```

### 9. Rollback Workspace
Revert files to the clean pre-run state:
```bash
node ../../dist/cli/index.js rollback
```
Confirm the files revert back.
