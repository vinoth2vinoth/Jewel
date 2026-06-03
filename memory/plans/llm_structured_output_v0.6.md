# Plan - Jewel v0.6: Real Provider Reliability and Structured Output Hardening

This plan details the design and implementation details to implement v0.6, focusing on structured output schemas, provider adapters updates, model capability registry, response normalization, smoke test command, doctor diagnostics, retry logic, and env-gated integration tests.

## Affected Files
1. `src/agents/structured-schema.ts` (New: JSON Schema definitions for TaskContract, PatchProposal, and ReviewResult)
2. `src/agents/model-capabilities.ts` (New: capability checking for openai, gemini, anthropic, openrouter models)
3. `src/agents/providers/response-normalizer.ts` (New: normalizes all remote responses, usage metrics, finish reasons)
4. `src/cli/commands/smoke-provider.ts` (New: jewel smoke-provider command implementation)
5. `src/core/config.ts` (Update config structure to support `allowUnstructuredProviderFallback`)
6. `src/agents/providers/http-client.ts` (Hardened retry, error analysis, backoff with jitter)
7. `src/cli/index.ts` (Add smoke-provider command support, version bump to 0.6.0)
8. `src/cli/commands/doctor.ts` (Update check lists for LLM safety configurations)
9. `src/agents/providers/openai-adapter.ts`, `gemini-adapter.ts`, `anthropic-adapter.ts`, `openrouter-adapter.ts` (Structured Output support)
10. `docs/real-provider-dogfood.md` (Update troubleshooting, smoke-provider guidance)
11. `package.json`, `package-lock.json` (Bump to 0.6.0)

## Phase Details

### Phase 1: Structured Output Schema Module
- File: `src/agents/structured-schema.ts`
- Define JSON Schemas for `TaskContract`, `PatchProposal`, `ReviewResult`.
- Schemas must match TypeScript models.
- PatchProposal must have `noChangeNeeded` and `noChangeReason`.
- Write validation unit tests verifying that forbidden fields (e.g. `run`, `shell`, `exec`) are rejected and schema conditions are strictly tested.

### Phase 2: Provider-Specific Structured Output Wiring
- Add `allowUnstructuredProviderFallback: boolean` (default false) to configurations in `src/core/config.ts`.
- Update provider adapters (`openai-adapter.ts`, `gemini-adapter.ts`, `anthropic-adapter.ts`, `openrouter-adapter.ts`) to request JSON Schema output via their native API schema modes:
  - OpenAI: `response_format: { type: "json_schema", json_schema: { name: "...", schema: ... } }` for models that support it.
  - Gemini: `generationConfig: { responseMimeType: "application/json", responseSchema: ... }`
  - Anthropic: Use tools / input schemas (e.g. standard messages API tools config with single tool to return structured outputs, or strict instruction fallback if not supported).
  - OpenRouter: pass `response_format: { type: "json_schema", json_schema: ... }` if supported.
- If schema mode fails, fail cleanly unless fallback is explicitly allowed.

### Phase 3: Model Capability Registry
- File: `src/agents/model-capabilities.ts`
- Create lookup maps for common models under OpenAI, Gemini, Anthropic, OpenRouter.
- Record structured output support, usage info, limitations.
- If unstructured model is chosen, block task initiation unless fallback is allowed.

### Phase 4: Provider Response Normalization
- File: `src/agents/providers/response-normalizer.ts`
- Create a standard normalizer extracting text response, usage metrics, raw provider, model, and finish reason.
- Secrets are redacted from raw provider responses before saving/reporting.

### Phase 5: Real Provider Smoke Test Command
- File: `src/cli/commands/smoke-provider.ts`
- Add CLI execution path: `jewel smoke-provider --provider <p> --model <m>`
- Sends a tiny check prompt, asserts JSON parsing matches target schema, outputs report, and exits.

### Phase 6: Provider Reliability Diagnostics in `jewel doctor`
- File: `src/cli/commands/doctor.ts`
- Add checks for LLM configurations, timeout ranges, human approval warning if LLM is active but human review is bypassed.

### Phase 7: Provider Retry & Hardening
- File: `src/agents/providers/http-client.ts`
- Implement intelligent HTTP retries: only retry on retryable codes (429, 500, 502, 503, 504), do not retry client auth/validation codes (400, 401, 403).
- Exponential backoff with random jitter.
- Accumulate and record retry count in session metadata.

### Phase 8: Real Provider Env-Gated Tests
- Update `src/agents/providers/real-llm-smoke.test.ts`.

### Phase 9: Documentation
- Update `docs/real-provider-dogfood.md`.

### Phase 10: E2E Mock Dogfood Verification
- Setup and test end-to-end flows.

### Phase 11-12: Bump & Verification
- Bump package version to `0.6.0`, rebuild, and run all 75+ tests.
