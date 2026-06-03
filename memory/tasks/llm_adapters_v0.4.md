# Tasks - Jewel v0.4: Multi Provider LLM Adapters and Real Project Dogfooding

- [x] Phase 1: Implement CLI provider flags & overrides in run command and report final configuration used.
- [x] Phase 2: Create shared HTTP client helper `src/agents/providers/http-client.ts`.
- [x] Phase 3: Update `src/agents/providers/openai-adapter.ts` to use the shared HTTP client helper.
- [x] Phase 4: Create Gemini adapter `src/agents/providers/gemini-adapter.ts` and add mocked fetch tests.
- [x] Phase 5: Create Anthropic adapter `src/agents/providers/anthropic-adapter.ts` and add mocked fetch tests.
- [x] Phase 6: Create OpenRouter adapter `src/agents/providers/openrouter-adapter.ts` and add mocked fetch tests.
- [x] Phase 7: Update provider factory `src/agents/provider-factory.ts` to support all adapters and validation.
- [x] Phase 8: Update `jewel doctor` in `src/cli/commands/doctor.ts` to check provider-specific API keys.
- [x] Phase 9: Implement transactional safe-patch-writer rollback hardening in `src/safety/safe-patch-writer.ts` and add tests.
- [x] Phase 10: Add real provider smoke tests behind the `JEWEL_RUN_REAL_LLM_TESTS` env flag.
- [x] Phase 11: Create dogfood demo project at `examples/dogfood-broken-project`.
- [x] Phase 12: Add token/cost reporting details to reports.
- [x] Phase 13: Update README with docs on providers, overrides, safety, and dogfood instructions.
- [x] Phase 14: Final verification (build, test suite passes, CLI help, dry-run pack).
