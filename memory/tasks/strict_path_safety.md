# Tasks - Strict path safety in Jewel v0.2

- [x] Implement `isSafeRepoRelativePath` in `src/safety/path-policy.ts`.
- [x] Update `isAbsoluteOrEscapingPath` in `src/safety/path-policy.ts` to block paths with `..` segments.
- [x] Update tests in `src/safety/path-policy.test.ts`.
- [x] Update `validateProposedFile` in `src/safety/safe-patch-writer.ts` to check `isSafeRepoRelativePath`.
- [x] Add tests to `src/safety/safe-patch-writer.test.ts`.
- [x] Build and test the codebase to verify zero failures.
- [x] Verify `node dist/cli/index.js --help` and `npm pack --dry-run` success.
