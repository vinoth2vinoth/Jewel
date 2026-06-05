# Design Plan: Process Auditor Integration (Phase 2)

This plan details the implementation of Phase 2: Runtime Process Auditing to monkey-patch process creation at the lowest Node.js levels (`ChildProcess.prototype.spawn` and `process.binding('spawn_sync').spawn`).

## Affected Files
1. **`src/verification/preload.ts`**: Update the preload script to monkey-patch `ChildProcess.prototype.spawn` and `process.binding('spawn_sync').spawn` using the parsed configuration.
2. **`src/verification/runner.test.ts`**: Rewrite the E2E process-auditor unit test to run a JS script file from disk instead of using `node -e` (which bypasses `NODE_OPTIONS`).

## Expected Changes

### `src/verification/preload.ts`
- Access `child_process.ChildProcess.prototype.spawn` and `process.binding('spawn_sync').spawn`.
- Define a helper `verifySpawnOptions(options: any)` that:
  - Joins the array `options.args` into a single command line string (or falls back to `options.file`).
  - Calls `checkCommandPolicy(fullCmd, config)`.
  - Throws an Error if not allowed.
- Override `ChildProcess.prototype.spawn` to call `verifySpawnOptions` before calling the original function.
- Override `process.binding('spawn_sync').spawn` to call `verifySpawnOptions` before calling the original function.

### `src/verification/runner.test.ts`
- Modify the unit test `verification runner - process auditing` to:
  - Write a temp helper script (e.g. `sandboxDir/test-trigger.js`) that runs `child_process.execSync('git push origin main')`.
  - Change the verification command `test` in `configWithAudit` to run `node sandboxDir/test-trigger.js` instead of `node -e`.
  - This ensures `NODE_OPTIONS` is correctly applied by Node.js.

## Verification & Testing Strategy
- Compile the changes: `npm run build`
- Run the test suite: `npm test`
- Check that all tests (including the process-auditing test) pass and block appropriately.
- Ensure temporary test files are cleaned up correctly in the sandbox teardown.
