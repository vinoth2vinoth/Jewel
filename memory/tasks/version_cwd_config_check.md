# Task Checklist: Add CWD Configuration Status to Version Command

- [x] **1. Implement CWD Config Check in Version Command**
  - [x] Update `src/cli/commands/version.ts` to look for `jewel.config.json` in `process.cwd()`.
  - [x] Add `try...catch` wrapper to read and parse the file safely.
  - [x] Extract `projectName` and fall back gracefully if missing or invalid.
  - [x] Output the `Active configuration` line as the last line in the printed output.

- [x] **2. Write Mock-based Unit Tests**
  - [x] Update `src/cli/commands/version.test.ts` to mock `fs.existsSync` and `fs.readFileSync`.
  - [x] Add test case for when no config is present.
  - [x] Add test case for when a valid config is present.
  - [x] Add test case for when config contains malformed JSON or invalid project name.

- [x] **3. Build & Test Verification**
  - [x] Compile TypeScript files via `npm run build`.
  - [x] Run test suite via `npm test` and verify all tests pass.
