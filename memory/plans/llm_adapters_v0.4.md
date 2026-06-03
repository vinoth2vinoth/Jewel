# Plan - Jewel v0.4: Multi Provider LLM Adapters and Real Project Dogfooding

This plan outlines the design and implementation details for Jewel v0.4, bringing support for Gemini, Anthropic, and OpenRouter, command line overrides, shared HTTP helper, transactional safe-patch-writer, token/cost reporting, and a dogfooding demo project.

## Affected Files
1. `src/cli/commands/run.ts` (CLI flags, provider overrides, report final model/provider)
2. `src/cli/index.ts` (Wiring new flags to run command)
3. `src/agents/providers/http-client.ts` (New shared HTTP request helper)
4. `src/agents/providers/gemini-adapter.ts` (New Gemini adapter)
5. `src/agents/providers/anthropic-adapter.ts` (New Anthropic adapter)
6. `src/agents/providers/openrouter-adapter.ts` (New OpenRouter adapter)
7. `src/agents/providers/openai-adapter.ts` (Refactor to use shared HTTP client)
8. `src/agents/provider-factory.ts` (Add Gemini, Anthropic, OpenRouter)
9. `src/cli/commands/doctor.ts` (Provider-specific API key checks)
10. `src/safety/safe-patch-writer.ts` (Harden with transactional snapshot and rollback)
11. `src/agents/providers/gemini-adapter.test.ts` (New tests)
12. `src/agents/providers/anthropic-adapter.test.ts` (New tests)
13. `src/agents/providers/openrouter-adapter.test.ts` (New tests)
14. `src/safety/safe-patch-writer.test.ts` (Add rollback on failure tests)
15. `examples/dogfood-broken-project/*` (New dogfood project)
16. `README.md` (Update docs)

## Phase Details

### Phase 1: Provider CLI overrides
- Support `--provider`, `--model`, `--temperature`, `--max-output-tokens` in `src/cli/index.ts` and parse them.
- Pass them as options to `runTask`.
- Merge these values on top of loaded configuration. If `provider` is invalid, fail before checkpointing.

### Phase 2, 3, 4: Gemini, Anthropic, and OpenRouter Adapters
- Implement respective providers in `src/agents/providers/` without external SDKs.
- Call shared prompt builder, format system/user messages per provider API schema, and parse output through validators.

### Phase 5: Shared Provider HTTP Helper
- Implement retry loop, timeout via `AbortController`, error redaction, non-200 handling in `http-client.ts`.
- Refactor all adapters to consume this helper.

### Phase 6: Provider Factory Update
- Register new adapters in `src/agents/provider-factory.ts`.

### Phase 7: Doctor Update
- Update API key check logic to target only the configured provider.

### Phase 8: Transactional safe-patch-writer
- Snapshot original contents of files that will be modified.
- Keep track of whether new files exist before writing them.
- If any write fails during the write phase, rollback by restoring original contents and deleting newly created files.

### Phase 9: Real smoke tests behind flags
- Add integration tests that execute only if `JEWEL_RUN_REAL_LLM_TESTS` is `true`.

### Phase 10: Dogfood Project
- Create `examples/dogfood-broken-project/` containing buggy code, unit test, config, and a README demonstrating the tool.

### Phase 11: Cost & Token Reporting
- Add optional `usage` details in adapters and include token count / cost details in run reports.

### Phase 12: README Update
- Document all new flags, providers, variables, dogfood setup, and warning policies.

## Verification
- Build and run the test suite (`npm run build && npm test`).
- Assert that version, dry-run pack, and binary execution pass.
