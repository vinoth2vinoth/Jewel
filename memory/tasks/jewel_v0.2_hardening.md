# Jewel v0.2 Hening and Safety Hardening Tasks

## Phase 1: Fix Test Discovery
- [x] Update `package.json` test script to `"node --test dist"`.
- [x] Run `npm run build` and `npm test` to verify current tests run correctly.

## Phase 2: Add Centralized Path Policy Module
- [x] Install `minimatch` dependency.
- [x] Create `src/safety/path-policy.ts`.
- [x] Implement path normalization, boundary check, pattern checking functions.
- [x] Create `src/safety/path-policy.test.ts` with comprehensive matching tests.

## Phase 3: Replace Manual Protected Path Matching
- [x] Refactor path checking in `src/core/session.ts`.
- [x] Refactor path checking in `src/safety/diff-guard.ts`.
- [x] Refactor path checking in `src/cli/commands/audit.ts`.
- [x] Verify test suite compiles and passes.

## Phase 4: Add Safe Patch Writer
- [x] Create `src/safety/safe-patch-writer.ts` with atomic validation and writing.
- [x] Create `src/safety/safe-patch-writer.test.ts` verifying path boundary checks, protected checks, and all-or-nothing writes.

## Phase 5: Integrate Safe Patch Writer in Run Command
- [x] Refactor `src/cli/commands/run.ts` to use `applyPatchProposalSafely`.
- [x] Update report generation to document block findings.
- [x] Verify mock adapter runs cleanly.

## Phase 6: Human Diff Review Gate
- [x] Update `src/core/config.ts` to validate `requireHumanDiffApproval`.
- [x] Add diff approval loop, command line prompt, and flags (`--yes`, `--no-review`, `--keep-failed`) in `src/cli/commands/run.ts`.
- [x] Implement `jewel diff [session-id]` command.
- [x] Wire up command flags and routing in `src/cli/index.ts`.

## Phase 7: Rollback Safety Hardening
- [x] Add HEAD commit checks, new commit detection in `src/cli/commands/rollback.ts`.
- [x] Save `before-rollback.patch` prior to file restoration.
- [x] Implement `--dry-run` and `--force` flags.

## Phase 8: Command Policy Hardening
- [x] Update `src/safety/policy.ts` to block new dangerous PowerShell, Git, and secret access commands.
- [x] Write unit tests for the new blocked commands.

## Phase 9: Provider Config Placeholder
- [x] Update `src/core/config.ts` to add provider configuration placeholders.
- [x] Update `src/cli/commands/doctor.ts` to warn about keys selectively based on provider selection.

## Phase 10: Package Hygiene
- [x] Update `package.json` to include the `files` array.
- [x] Run `npm pack --dry-run` and inspect contents.

## Final Verification
- [x] Run all final verification checks and check off compliance.
