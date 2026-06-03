# Jewel CLI Implementation Tasks

## Phase 1: Project Setup
- [x] Create `package.json` with scripts and dependencies.
- [x] Create `tsconfig.json` for TypeScript compilation.
- [x] Create folder structure under `src/`.
- [x] Create CLI bin entry wrapper.
- [x] Verify `npm run build` compiles successfully.

## Phase 2: Init Command & Templates
- [x] Implement `jewel init` logic.
- [x] Generate default `jewel.config.json`.
- [x] Generate default `AGENTS.md` (Phase 3).
- [x] Create `.jewel/skills` folder with default skills (Phase 4).
- [x] Avoid overwriting existing files, print summaries.

## Phase 3 & 4: AGENTS.md & Skill Templates
- [x] Put `AGENTS.md` and all 8 skills in a template folder/module.

## Phase 5: Config Loader
- [x] Implement configuration reading, schema validation, and fallback defaults.

## Phase 6: Command Policy
- [x] Implement command safety checker for both Windows and Unix commands.

## Phase 7: Git Checkpoint & Rollback
- [x] Implement git checking, git status, git stash/commit checkpoints.
- [x] Implement non-git backups folder mechanism.
- [x] Implement `jewel status` and `jewel rollback`.

## Phase 8: Verification Runner
- [x] Run commands, capture output and exit code.
- [x] Generate `latest.md` and `latest.json` verification reports.

## Phase 9: Task Contract
- [x] Define Task Contract schema.
- [x] Implement contract generator and validator (handling risk assessment).

## Phase 10: Diff Guard
- [x] Diff analysis on lines/files, protected files, dependencies, lockfiles.
- [x] Block if limit exceeded.

## Phase 11: Critic Review
- [x] Rules-based critic review for diffs/verifications.

## Phase 12: Run Command
- [x] Wire up `jewel run "<task>"` workflow (validate, plan, checkpoint, execute, diff check, verify, critic, report).

## Phase 13 & 14: LLM Adapter & Providers
- [x] Define AgentAdapter interface and implement Mock adapter.
- [x] Implement optional LLM providers (OpenAI, Anthropic, Gemini) with secret redacting.

## Phase 15 & 16: Doctor & Audit
- [x] Implement `jewel doctor` diagnostics.
- [x] Implement `jewel audit` security and quality inspection.

## Phase 17: Demo Project
- [x] Create `examples/demo-project` showing full usage.

## Phase 18: README
- [x] Create detailed cross-platform user guide.

## Phase 19 & 20: Security & Testing
- [x] Implement secret redaction (keys, passwords).
- [x] Write tests covering all modules using Node.js runner.
- [x] Verify clean build, lint, and tests pass.
