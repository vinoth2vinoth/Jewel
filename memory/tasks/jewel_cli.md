# Jewel CLI Implementation Tasks

## Phase 1: Project Setup
- [ ] Create `package.json` with scripts and dependencies.
- [ ] Create `tsconfig.json` for TypeScript compilation.
- [ ] Create folder structure under `src/`.
- [ ] Create CLI bin entry wrapper.
- [ ] Verify `npm run build` compiles successfully.

## Phase 2: Init Command & Templates
- [ ] Implement `jewel init` logic.
- [ ] Generate default `jewel.config.json`.
- [ ] Generate default `AGENTS.md` (Phase 3).
- [ ] Create `.jewel/skills` folder with default skills (Phase 4).
- [ ] Avoid overwriting existing files, print summaries.

## Phase 3 & 4: AGENTS.md & Skill Templates
- [ ] Put `AGENTS.md` and all 8 skills in a template folder/module.

## Phase 5: Config Loader
- [ ] Implement configuration reading, schema validation, and fallback defaults.

## Phase 6: Command Policy
- [ ] Implement command safety checker for both Windows and Unix commands.

## Phase 7: Git Checkpoint & Rollback
- [ ] Implement git checking, git status, git stash/commit checkpoints.
- [ ] Implement non-git backups folder mechanism.
- [ ] Implement `jewel status` and `jewel rollback`.

## Phase 8: Verification Runner
- [ ] Run commands, capture output and exit code.
- [ ] Generate `latest.md` and `latest.json` verification reports.

## Phase 9: Task Contract
- [ ] Define Task Contract schema.
- [ ] Implement contract generator and validator (handling risk assessment).

## Phase 10: Diff Guard
- [ ] Diff analysis on lines/files, protected files, dependencies, lockfiles.
- [ ] Block if limit exceeded.

## Phase 11: Critic Review
- [ ] Rules-based critic review for diffs/verifications.

## Phase 12: Run Command
- [ ] Wire up `jewel run "<task>"` workflow (validate, plan, checkpoint, execute, diff check, verify, critic, report).

## Phase 13 & 14: LLM Adapter & Providers
- [ ] Define AgentAdapter interface and implement Mock adapter.
- [ ] Implement optional LLM providers (OpenAI, Anthropic, Gemini) with secret redacting.

## Phase 15 & 16: Doctor & Audit
- [ ] Implement `jewel doctor` diagnostics.
- [ ] Implement `jewel audit` security and quality inspection.

## Phase 17: Demo Project
- [ ] Create `examples/demo-project` showing full usage.

## Phase 18: README
- [ ] Create detailed cross-platform user guide.

## Phase 19 & 20: Security & Testing
- [ ] Implement secret redaction (keys, passwords).
- [ ] Write tests covering all modules using Node.js runner.
- [ ] Verify clean build, lint, and tests pass.
