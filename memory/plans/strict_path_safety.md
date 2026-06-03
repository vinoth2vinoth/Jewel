# Plan - Tighten path policy design and strict repo-relative path validation in Jewel

We need to fix the safety path logic to strictly enforce clean, repo-relative paths for LLM patch proposals.

## Affected Files
1. `src/safety/path-policy.ts`
2. `src/safety/path-policy.test.ts`
3. `src/safety/safe-patch-writer.ts`
4. `src/safety/safe-patch-writer.test.ts`

## Expected Changes
1. **path-policy.ts**:
   - Add `isSafeRepoRelativePath(candidate: string): boolean`. It must reject parent traversal (`..`), empty strings/segments, null bytes, absolute paths, drive prefixes, and UNC paths.
   - Update `isAbsoluteOrEscapingPath(root, candidate)` to block candidate paths that contain any `..` segment.
2. **path-policy.test.ts**:
   - Change the expectation for `../Project/Button.tsx` from `isPathInsideRoot === true` to `isAbsoluteOrEscapingPath === true`.
   - Add assertions verifying `isSafeRepoRelativePath` behavior on all positive and negative test cases.
3. **safe-patch-writer.ts**:
   - Call `isSafeRepoRelativePath` on the filePath before doing any path resolution.
   - Reject the patch if any file path is unsafe, writing nothing, and returning the exact clear block reason specified in the prompt.
4. **safe-patch-writer.test.ts**:
   - Add tests verifying the blocking of unsafe paths.
   - Add tests verifying that valid repo-relative paths are allowed and that partial writes are blocked.

## Verification
1. Run `npm run build`
2. Run `npm test`
3. Run `node dist/cli/index.js --help`
4. Run `npm pack --dry-run`
