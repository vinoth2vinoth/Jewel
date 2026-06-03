# Jewel CLI - Design Plan

## 1. Objectives
Build Jewel, a strict AI coding safety harness CLI that enforces disciplined software engineering rules (inspired by Andrej Karpathy coding principles) such as plan before coding, verification-first, command safety, surgical edits, diff guards, and git-based checkpoints.

## 2. File Architecture
- `package.json` & `tsconfig.json` - Build & execution config.
- `src/cli/index.ts` - CLI entry point parsing commands (init, run, verify, status, rollback, audit, doctor).
- `src/core/config.ts` - Config loader (`jewel.config.json` with strict validation & defaults).
- `src/core/session.ts` - Manages `.jewel/sessions` directory, saving task contracts, logs, and metadata.
- `src/safety/policy.ts` - Command policy whitelisting/blocking.
- `src/safety/diff-guard.ts` - Inspects diffs, counts changes, blocks if thresholds are exceeded or protected files are touched.
- `src/safety/critic.ts` - Rule-based critic reviewing diffs and verification reports.
- `src/storage/git.ts` - Git checkpointing, status capturing, and rollback.
- `src/storage/backup.ts` - Fallback backup strategy for non-git folders.
- `src/verification/runner.ts` - Executes verification commands, captures outputs, logs execution, and outputs MD/JSON reports.
- `src/agents/adapter.ts` - AgentAdapter interface and mock adapter.
- `src/cli/commands/*` - Execution logic for each command.
- `templates/` - Default files (config, AGENTS.md, skill templates).

## 3. Testing Strategy
- Tests written using Node's built-in `node:test` framework to avoid heavy external dependencies.
- Tests will cover:
  1. Config loader
  2. Command safety policy
  3. Task contract validation
  4. Diff guard
  5. Verification runner
  6. Git checkpointing and rollback fallback
  7. Audit checks
  8. Doctor checks
- Run tests via `npm test`.
