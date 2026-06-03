"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_SKILLS = exports.AGENTS_MD_CONTENT = exports.DEFAULT_CONFIG_CONTENT = void 0;
exports.DEFAULT_CONFIG_CONTENT = `{
  "projectName": "",
  "mode": "strict",
  "maxRetries": 3,
  "maxFilesChanged": 8,
  "maxLinesChanged": 500,
  "requirePlanBeforeEdit": true,
  "requireVerificationBeforeDone": true,
  "allowNewDependencies": false,
  "allowProtectedFileChanges": false,
  "allowGitPush": false,
  "requireHumanDiffApproval": true,
  "provider": "none",
  "model": "",
  "temperature": 0,
  "maxOutputTokens": 4000,
  "commands": {
    "lint": "",
    "typecheck": "",
    "test": "",
    "build": "",
    "e2e": ""
  },
  "protectedFiles": [
    ".env",
    ".env.local",
    ".env.*",
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "bun.lockb",
    "schema.prisma",
    "migrations/**",
    "src/auth/**",
    "src/payments/**",
    "src/billing/**",
    "src/security/**"
  ],
  "dangerousCommandPolicy": "block",
  "reportFormat": ["markdown", "json"]
}`;
exports.AGENTS_MD_CONTENT = `# AGENTS.md

You are working inside a repository protected by Jewel.

Core rules:
1. Think before coding.
2. Prefer simple solutions.
3. Make surgical changes only.
4. Do not refactor unrelated code.
5. Do not add dependencies unless approved.
6. Do not touch protected files unless approved.
7. Do not claim success without running verification.
8. Explain every changed file.
9. If the task is ambiguous, state assumptions before editing.
10. If verification fails, use the exact error logs to fix the issue.
11. If the same error repeats, stop and ask for help.
12. Never fake command output.
13. Never invent test results.
14. Never silently skip verification.
15. Never delete code unless clearly required.

Jewel required workflow:
1. Create task contract.
2. Create checkpoint.
3. Edit only in approved scope.
4. Run checks.
5. Review diff.
6. Produce final report.
`;
exports.DEFAULT_SKILLS = [
    {
        folder: 'think-before-coding',
        content: `---
name: think-before-coding
description: Use before any code edit to understand the task, assumptions, scope, and success criteria.
---

Rules:
1. Restate the task.
2. Identify assumptions.
3. Identify likely files.
4. Identify risks.
5. Define success criteria.
6. Do not edit files until this is complete.
`
    },
    {
        folder: 'simplicity-first',
        content: `---
name: simplicity-first
description: Use when designing or modifying code to avoid overengineering.
---

Rules:
1. Choose the smallest working solution.
2. Do not introduce frameworks unless required.
3. Do not create abstractions for one use case.
4. Prefer readable code over clever code.
5. Avoid large rewrites.
6. Explain why any new abstraction is necessary.
`
    },
    {
        folder: 'surgical-changes',
        content: `---
name: surgical-changes
description: Use during implementation to keep changes small, scoped, and directly tied to the task.
---

Rules:
1. Change the fewest files required.
2. Do not edit unrelated files.
3. Do not rename files unless required.
4. Do not change public APIs unless required.
5. Do not modify formatting across unrelated files.
6. If more than maxFilesChanged is needed, stop and request expanded scope.
`
    },
    {
        folder: 'goal-driven-execution',
        content: `---
name: goal-driven-execution
description: Use to keep work tied to measurable success criteria.
---

Rules:
1. Every task must have success criteria.
2. Every changed file must map to at least one success criterion.
3. Do not add nice to have features.
4. Do not continue improving vaguely.
5. Stop when success criteria are met and verified.
`
    },
    {
        folder: 'verification-first',
        content: `---
name: verification-first
description: Use before declaring work complete.
---

Rules:
1. Run configured verification commands.
2. Capture real stdout and stderr.
3. Report pass or fail honestly.
4. Never claim success if a command failed.
5. If a command is missing, report it as skipped, not passed.
6. Produce a final verification summary.
`
    },
    {
        folder: 'safe-shell',
        content: `---
name: safe-shell
description: Use before running shell commands to avoid destructive or unsafe operations.
---

Rules:
1. Block destructive commands.
2. Block remote scripts piped into shell.
3. Block package installation unless approved.
4. Block git push unless approved.
5. Block commands that expose secrets.
6. Prefer read only commands first.
`
    },
    {
        folder: 'safe-refactoring',
        content: `---
name: safe-refactoring
description: Use when refactoring is requested or unavoidable.
---

Rules:
1. Refactor only when required.
2. Keep behavior unchanged unless requested.
3. Add or run tests before and after.
4. Use small sequential changes.
5. Do not mix refactor and feature work unless required.
`
    },
    {
        folder: 'visual-testing',
        content: `---
name: visual-testing
description: Use for web apps that require end user visual verification.
---

Rules:
1. Start the dev server if configured.
2. Visit important pages.
3. Capture screenshots if Playwright is configured.
4. Test forms, buttons, navigation, and error states.
5. Report visual bugs with reproduction steps.
6. Do not claim visual verification unless it actually ran.
`
    }
];
