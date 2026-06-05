# Checklist: Process Auditor Integration (Phase 2)

- [x] Implement lowest-level monkey-patching in `src/verification/preload.ts`
  - [x] Patch `child_process.ChildProcess.prototype.spawn`
  - [x] Patch `process.binding('spawn_sync').spawn`
  - [x] Handle argument extraction and policy check in a robust, cross-platform helper
- [x] Fix E2E process auditing test in `src/verification/runner.test.ts`
  - [x] Use file-on-disk execution instead of `node -e` to ensure `NODE_OPTIONS` isn't ignored
- [x] Compile and verify changes
  - [x] Run `npm run build`
  - [x] Run `npm test` and ensure all tests pass
