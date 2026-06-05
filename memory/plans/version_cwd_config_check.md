# Design Plan: Add CWD Configuration Status to Version Command

Integrate a check for the existence of `jewel.config.json` inside the current working directory (`process.cwd()`) into the `jewel version` command.

## 1. Affected Files
1. **`src/cli/commands/version.ts`**:
   - Check if `jewel.config.json` exists in the current directory (`process.cwd()`).
   - If it exists, read and parse it. Handle potential issues:
     - Wrap reading and `JSON.parse` in a `try...catch` block to handle malformed JSON gracefully.
     - Check if `projectName` is specified. If `projectName` is missing or is not a string, fall back to an empty string.
     - If successfully parsed and found, print:
       `Active configuration: found (project: "<projectName>")`
     - If it does not exist or fails parsing, print:
       `Active configuration: none (using defaults)`
   - The new configuration status must be printed as the last line in the `runVersion` output block.

2. **`src/cli/commands/version.test.ts`**:
   - Update unit tests to mock `fs.existsSync` and `fs.readFileSync` using `node:test`'s mocking features to simulate:
     - When `jewel.config.json` does not exist (assert output includes `Active configuration: none (using defaults)`).
     - When `jewel.config.json` exists and is valid (assert output includes `Active configuration: found (project: "test-project")`).
     - When `jewel.config.json` exists but has invalid JSON or missing `projectName` (assert output gracefully falls back without throwing errors).
   - Mocking is crucial to prevent the ambient `jewel.config.json` in the root workspace from polluting test results.

## 2. Steps & Testing Strategy
1. Modify `src/cli/commands/version.ts` to locate and read `jewel.config.json` inside `process.cwd()`.
2. Update unit tests in `src/cli/commands/version.test.ts` to mock fs operations and verify all output states.
3. Build the project using `npm run build`.
4. Run tests using `npm test`.
