# Checklist: Interactive Override & Debug Loop (Phase 3)

- [x] Hardening preload script in `src/verification/preload.ts`
  - [x] Add public `spawn`/`spawnSync` patching
  - [x] Implement robust file path check with basename fallback
- [x] Add `customHint` support in adapter and prompt builder
  - [x] Update `PatchInput` interface in `src/agents/adapter.ts`
  - [x] Update `buildPatchProposalPrompt` in `src/agents/prompt-builder.ts` to append hint text
- [x] Implement interactive CLI loop on failures in `src/cli/commands/run.ts`
  - [x] Check `process.stdout.isTTY`, `process.env.CI`, and `interactiveRetryMode`
  - [x] Prompt user on retry loop termination/stop decision
  - [x] Support `r` (Retry with hint), `o` (Override and finalize), and `a` (Abort)
- [x] Verify implementation
  - [x] Compile changes (`npm run build`)
  - [x] Run full test suite (`npm test`)
  - [x] Write unit/E2E test cases to verify custom hint injection and override flow
