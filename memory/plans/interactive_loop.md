# Design Plan: Interactive Override & Debug Loop (Phase 3) & Preloader Hardening (Phase 2 Refinement)

This plan details the implementation of Phase 3 (Interactive Override & Debug Loop) and a zero-bypass refinement for Phase 2.

## Affected Files
1. **`src/verification/preload.ts`**: Add fallback monkey-patches for the high-level `child_process.spawn` and `child_process.spawnSync` to complement the low-level patches.
2. **`src/agents/adapter.ts`**: Add optional `customHint?: string;` to `PatchInput` interface.
3. **`src/agents/prompt-builder.ts`**: Modify `buildPatchProposalPrompt` to inject the user's custom retry hint if present.
4. **`src/cli/commands/run.ts`**: Implement the interactive CLI prompt loop when verification or safety checks fail in an interactive terminal.

## Expected Changes

### 1. Preloader Hardening (Phase 2 Refinement)
In `src/verification/preload.ts`:
- Re-add the module-level patches for `child_process.spawn` and `child_process.spawnSync`.
- This ensures that if the low-level prototype/binding patching is blocked or behaves differently on certain Node environments, the high-level public APIs are still securely intercepted.
- Reconstruct the full command checked by policy using a robust path basename checker.

### 2. Prompt Hint Integration
In `src/agents/adapter.ts`:
- Append `customHint?: string;` to the `PatchInput` interface.

In `src/agents/prompt-builder.ts`:
- In `buildPatchProposalPrompt`, check if `input.customHint` is defined.
- If so, append it under a clear header `User Custom Guidance Hint:` in the generated prompt text.

### 3. Interactive CLI Prompts
In `src/cli/commands/run.ts`:
- Determine if the terminal session is interactive:
  ```typescript
  const isInteractive = !!process.stdout.isTTY && !process.env.CI && config.interactiveRetryMode;
  ```
- If a check fails (either inside the retry loop because `finalStopDecision.stop` is true, or because the maximum retries were exhausted):
  - If `isInteractive` is true, display a prompt:
    `[r] Retry with custom hint`
    `[o] Override failure and finalize`
    `[a] Abort and rollback (default)`
  - Handle user choices:
    - **`r`**: Ask user for hint text. Increment `maxRetries` by 1. Clear `finalStopDecision` so the loop continues. Pass the hint to the subsequent patch proposal.
    - **`o`**: Set `passedAll = true`, `approved = true`. Break the retry loop to finalize.
    - **`a`**: Keep the failure state and break the loop.

## Verification & Testing Strategy
- Compile the changes: `npm run build`
- Run the test suite: `npm test`
- Write unit/E2E tests in a new test file `src/cli/commands/run-interactive.test.ts` or add to `src/cli/commands/run.test.ts` to verify:
  - Custom hint is passed to `proposePatch`.
  - Override option sets correct statuses and passes the harness.
