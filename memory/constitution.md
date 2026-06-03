# Jewel Project Constitution

## Build Instructions
This is a TypeScript-based Node.js project.
- Build command: `npm run build` (compiles TS files from `src/` to `dist/`)
- Development watch command: `npm run dev`

## Test Instructions
We use Node.js's built-in test runner or a lightweight framework to ensure compliance with the "minimal dependencies" principle.
- Test command: `npm test`

## Rules and Guidelines
1. Zero unnecessary external dependencies. Prefer Node.js built-ins (`fs`, `path`, `child_process`, `crypto`, `os`, `readline`).
2. Keep the design simple and robust.
3. Every CLI command must work on Windows (PowerShell/CMD) as well as cross-platform (Unix/macOS shell).
4. No fake success messages or placeholders. Verify all conditions programmatically.
