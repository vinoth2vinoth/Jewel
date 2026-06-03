# Jewel v0.2 Hening and Safety Hardening Plan

## 1. Objectives
Implement Jewel v0.2, focused on safety hardening against malicious agent actions (path escape, protected file writes, unsafe commands, hidden rewrites, blind patches, and risky rollbacks).

## 2. Phases & Affected Files
1. **Phase 1: Fix Test Discovery**
   - Update `package.json` test script to `"node --test dist"`.
2. **Phase 2: Centralized Path Policy Module**
   - Add `minimatch` dependency.
   - Create `src/safety/path-policy.ts` containing:
     - `normalizeRepoPath`
     - `isPathInsideRoot`
     - `assertPathInsideRoot`
     - `matchesProtectedPattern`
     - `isProtectedPath`
     - `isDependencyPath`
     - `isLockfilePath`
     - `isAbsoluteOrEscapingPath`
3. **Phase 3: Replace Manual Path Protection Logic**
   - Refactor `src/core/session.ts`, `src/safety/diff-guard.ts`, and `src/cli/commands/audit.ts` to use `src/safety/path-policy.ts`.
4. **Phase 4: Safe Patch Writer**
   - Create `src/safety/safe-patch-writer.ts` with `applyPatchProposalSafely`.
   - Rejects: absolute paths, escaping paths, symlinks, protected/dependency/lockfile modifications, undeclared files in strict mode.
   - Operates in all-or-nothing (atomic) mode.
5. **Phase 5: Integrate Safe Patch Writer in Run Command**
   - Update `src/cli/commands/run.ts`.
6. **Phase 6: Human Diff Review Gate**
   - Update `src/core/config.ts` to support `requireHumanDiffApproval`.
   - Update `src/cli/commands/run.ts` to show git diff and ask for confirmation.
   - Add `jewel diff [session-id]` command.
   - Update `src/cli/index.ts` to support flags `--yes`, `--no-review`, and `--keep-failed`.
7. **Phase 7: Rollback Safety Hardening**
   - Update `src/cli/commands/rollback.ts` to support `--dry-run`, `--force`, detect commits after checkpoint, and write `before-rollback.patch`.
   - Update `src/cli/index.ts` to parse rollback options.
8. **Phase 8: Command Policy Hardening**
   - Update `src/safety/policy.ts` to block destructive PowerShell, Git, and secret access commands.
9. **Phase 9: Provider Config Placeholder**
   - Update `src/core/config.ts` with new provider/model fields.
   - Update `src/cli/commands/doctor.ts` to dynamically warn about API keys based on provider selection.
10. **Phase 10: Package Hygiene**
    - Update `package.json` to include only `dist`, `README.md`, and `package.json` in pack files. Verify with `npm pack --dry-run`.

## 3. Testing Strategy
- Add unit tests for `path-policy.ts` and `safe-patch-writer.ts`.
- Update tests for `policy.ts`, `rollback.ts`, and `doctor.ts` to verify the new rules and behavior.
- Ensure all 24+ tests compile and pass via `npm test`.
