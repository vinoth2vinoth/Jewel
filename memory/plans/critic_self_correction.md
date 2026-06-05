# Design Plan: Critic Self-Correction & Loop Hardening

We will implement Phase 2 of the Jewel v0.10.0 roadmap: **Critic Self-Correction & Loop Hardening**. This enables automatic parsing of precise compiler and test failure outputs and feeds them, along with the failed code diff, back to the AI patch agent for iterative self-correction.

---

## 1. Affected Files

1. **`src/agents/adapter.ts`**:
   - Update the `PatchInput` interface to include an optional `failedDiff?: string;` field. This allows the runner to pass the exact diff of the failing attempt to the patch generation prompt.

2. **`src/agents/prompt-builder.ts`**:
   - **New Helper `formatVerificationResult`**: Implement a shared, DRY helper to format `VerificationReport` outputs. It will slice the **last** 4000 characters from stdout/stderr when they exceed limits, prepending `[... truncated output ...]\n`, and format only non-empty logs to avoid empty-header clutter.
   - **`buildTestCriticPrompt`**: Update to use `formatVerificationResult` for clean, detailed, and error-focused compiler/runner log inclusions.
   - **`buildPatchProposalPrompt`**: 
     - Update to use `formatVerificationResult` for clean, detailed, and error-focused compiler/runner log inclusions.
     - Include the failed code diff block (`failedDiff`) in the prompt if present, allowing the agent to analyze its own previous edits alongside the error logs.

3. **`src/cli/commands/run.ts`**:
   - In the retry loop of `runTask()`, calculate the git diff **exactly once per iteration** and store it in `diffContent`.
   - Reuse this block-scoped `diffContent` variable for both `reviewTestCorrectness` (if critic is called) and `proposePatch()` (passing it as `failedDiff`), avoiding redundant `execSync('git diff ...')` process invocations.

4. **`src/agents/prompt-builder.test.ts`**:
   - Fix the mislabeled test `'prompt-builder - buildTestCriticPrompt contains diff and verification results'` to import and call `buildTestCriticPrompt` instead of `buildDiffReviewPrompt`.
   - Add a separate unit test verifying `buildTestCriticPrompt` includes both stdout/stderr failed command blocks and the correct JSON schema instructions.

---

## 2. Expected Changes

### Implementation Details

#### Interface Update (`src/agents/adapter.ts`)
```typescript
export interface PatchInput {
  taskContract: TaskContract;
  allowedFiles: string[];
  repoContext: string;
  verificationResult: VerificationReport | null;
  testCriticResult?: TestCriticResult;
  config?: JewelConfig;
  sessionPath?: string;
  customHint?: string;
  criticResult?: CriticResult;
  failedDiff?: string; // New field
}
```

#### Shared Helper & Prompts (`src/agents/prompt-builder.ts`)
```typescript
export function formatVerificationResult(report: VerificationReport | null): string {
  if (!report) return 'No test runs performed yet.';
  
  let formatted = `Test run status: ${report.overallStatus}\nResults:\n`;
  for (const r of report.results) {
    formatted += `- ${r.commandKey} (${r.status}): ${r.errorMsg || ''}\n`;
    if (r.status === 'FAIL') {
      const formatLogSection = (header: string, content: string) => {
        if (!content || content.trim() === '') return '';
        const limit = 4000;
        let trimmed = content.trim();
        if (trimmed.length > limit) {
          trimmed = `[... truncated output ...]\n` + trimmed.slice(-limit);
        }
        return `  ${header}:\n  ` + trimmed.split('\n').join('\n  ') + '\n';
      };
      
      formatted += formatLogSection('STDOUT', r.stdout);
      formatted += formatLogSection('STDERR', r.stderr);
    }
  }
  return formatted.trim();
}
```

Use `formatVerificationResult(input.verificationResult)` in:
- `buildTestCriticPrompt`
- `buildPatchProposalPrompt`

In `buildPatchProposalPrompt`, append `failedDiff` if present:
```typescript
  const failedDiffStr = input.failedDiff
    ? `\nProposed Diff that failed verification:\n\`\`\`diff\n${input.failedDiff}\n\`\`\`\n`
    : '';
```

#### Single-Invocation Diff Logic (`src/cli/commands/run.ts`)
Inside `runTask()`, compute `diffContent` exactly once per retry iteration:
```typescript
      // 1. Compute git diff exactly once per iteration
      let diffContent = '';
      if (checkpoint.isGit && checkpoint.gitCheckpointSha) {
        try {
          diffContent = execSync(`git diff ${checkpoint.gitCheckpointSha}`, { cwd, encoding: 'utf8', env: { ...process.env, PAGER: 'cat' } });
        } catch {}
      }

      // 2. Pass to Multi-Agent Critic
      critic = await runMultiAgentCriticReview(contract, diffAnalysis, verification, config, adapter, sessionPath, diffContent);

      // ...
      
      // 3. Pass to Test Correctness Critic
      if (((verification && verification.overallStatus === 'FAIL') || existingTestModified) && isAgentMode && adapter && adapter.reviewTestCorrectness) {
        console.log('\n[Critic] Analyzing test failure correctness...');
        try {
          testCriticResult = await adapter.reviewTestCorrectness({
            taskContract: contract,
            diff: diffContent, // Reuse diffContent
            verificationResult: verification!,
            config,
            sessionPath
          });
          // ...
```
And pass `failedDiff: diffContent` to the retry `proposePatch()` call.

---

## 3. Testing and Verification Strategy

1. **Unit and Integration Tests**:
   - Rename and update the mislabeled test in `src/agents/prompt-builder.test.ts` to call `buildTestCriticPrompt` and assert it contains verification failures.
   - Assert `buildPatchProposalPrompt` incorporates `failedDiff` and detailed outputs correctly.
2. **End-to-End Workspace Verification**:
   - Compile the project with `npm run build`.
   - Run the full project test suite `npm test` to ensure all 152 tests compile and pass cleanly without regressions.
