# Checklist: Critic Self-Correction & Loop Hardening

- [x] Update `src/agents/adapter.ts` to add `failedDiff?: string;` to `PatchInput`
- [x] Implement `formatVerificationResult` helper in `src/agents/prompt-builder.ts` with error-log-tail extraction (last 4000 chars)
- [x] Integrate `formatVerificationResult` in `buildTestCriticPrompt` and `buildPatchProposalPrompt`
- [x] Integrate `failedDiff` prompt inclusion in `buildPatchProposalPrompt`
- [x] Refactor `src/cli/commands/run.ts` to compute `diffContent` once and reuse it for both `reviewTestCorrectness` and `proposePatch` on retry
- [x] Fix the mislabeled test in `src/agents/prompt-builder.test.ts` to call `buildTestCriticPrompt`
- [x] Add new unit tests in `src/agents/prompt-builder.test.ts` verifying `buildTestCriticPrompt` formats output with correct logs and stdout/stderr failure logs
- [x] Compile and verify all tests pass cleanly using `npm run build` and `npm test`
