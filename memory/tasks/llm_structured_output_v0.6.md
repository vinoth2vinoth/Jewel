# Tasks - Jewel v0.6: Real Provider Structured Output & Hardening

- [x] Phase 1: Implement structured output JSON schemas in `src/agents/structured-schema.ts` and add tests in `src/agents/structured-schema.test.ts`.
- [x] Phase 2: Update configuration in `src/core/config.ts` to support `allowUnstructuredProviderFallback` (default false). Update provider adapters to use native JSON schemas/tools. Add tests.
- [x] Phase 3: Create model capability registry in `src/agents/model-capabilities.ts` and integrate warnings/blocks into the adapters planning flow.
- [x] Phase 4: Create response normalizer in `src/agents/providers/response-normalizer.ts` with secret redaction and error quality checks. Add test coverage.
- [x] Phase 5: Implement `jewel smoke-provider` command in `src/cli/commands/smoke-provider.ts` and wire it to index.ts and help command. Add tests.
- [x] Phase 6: Update `jewel doctor` diagnostics with checks for API keys, model support, and timeout parameters.
- [x] Phase 7: Harden `src/agents/providers/http-client.ts` with exponential backoff + jitter, selectively retrying only retryable status codes. Add tests.
- [x] Phase 8: Harden env-gated real provider checks in `src/agents/providers/real-llm-smoke.test.ts`.
- [x] Phase 9: Update documentation in `docs/real-provider-dogfood.md`.
- [x] Phase 10: Add/extend E2E integration tests to verify safe and unsafe mock provider flows.
- [x] Phase 11: Bump package version to `0.6.0` in `package.json` and `package-lock.json`.
- [x] Phase 12: Build and execute all tests successfully. Run manual e2e dogfood project check.
