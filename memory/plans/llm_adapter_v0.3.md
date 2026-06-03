# Plan - Jewel v0.3: Real LLM Adapter Foundation

We will implement the LLM Adapter Foundation for Jewel, adding safe provider-neutral interfaces, OpenAI adapter (using Node 18+ native fetch), strict prompt building, JSON extraction/validation, provider factory, CLI integration, secret redaction, and comprehensive unit tests.

## Phase 1: Provider Config Model
- Update `JewelConfig` in `src/core/config.ts` to include:
  - `provider`: `'none' | 'openai' | 'anthropic' | 'gemini' | 'openrouter'`
  - `model`: string
  - `temperature`: number
  - `maxOutputTokens`: number
  - `llmTimeoutMs`: number
  - `llmMaxRetries`: number
  - `llmStrictJson`: boolean
- Update `DEFAULT_CONFIG` with default values.
- Update `validateAndMergeConfig` to support and validate these fields.
- Update `src/cli/commands/doctor.ts` to call `validateAndMergeConfig` when checking `jewel.config.json` so config validation errors result in a `FAIL` report.

## Phase 2: Define Provider-Neutral LLM Interfaces
- Update `src/agents/adapter.ts`:
  - Define `LLMMessage`, `LLMRequest`, `LLMResponse`.
  - Update `PatchProposal` to include `summary`, `files` (with `filePath`, `content`, `reason`), `notes`, and `riskLevel`.
  - Implement a validation schema/function for `PatchProposal` (rejecting empty/missing values, invalid riskLevel, and unsafe keys like shell/command/run).

## Phase 3: Create Strict Prompt Builder
- Create `src/agents/prompt-builder.ts`:
  - Functions: `buildPlanningPrompt`, `buildPatchProposalPrompt`, `buildDiffReviewPrompt`.
  - Enforce strict JSON output, no command execution, no absolute paths, no parent traversals, and surgical changes.

## Phase 4: Create JSON Extraction and Validation Module
- Create `src/agents/json-response.ts`:
  - Functions: `extractJsonObject`, `validateTaskContractJson`, `validatePatchProposalJson`, `validateReviewResultJson`.
  - Cleanly extract JSON from markdown/fenced blocks, reject malformed or multiple objects, and run structure validation.

## Phase 5: Implement OpenAI Adapter
- Create `src/agents/providers/openai-adapter.ts`:
  - Call OpenAI chat completion endpoint using Node native `fetch`.
  - Validate environment variables (`OPENAI_API_KEY`).
  - Implement retry logic (up to `llmMaxRetries`), timeouts (`llmTimeoutMs`), and API error handling.

## Phase 6: Provider Factory
- Create `src/agents/provider-factory.ts`:
  - `createAgentAdapter(config: JewelConfig): AgentAdapter`
  - Map `none` to `MockAgentAdapter`, `openai` to `OpenAIAdapter`. Other providers throw not-implemented errors.

## Phase 7: Wire Provider Factory into Jewel Run
- Update `src/cli/commands/run.ts`:
  - Retrieve the correct adapter using the factory.
  - Call the real LLM adapter functions and pass their responses through parsing/validation and existing safety gates.
  - Save LLM interaction debug files inside `.jewel/logs` with redacted secrets.

## Phase 8: Secret Redaction Utility
- Create `src/safety/secret-redactor.ts`:
  - Implement `redactSecrets(content: string): string` to strip environment variables, sk- API keys, GitHub tokens, and private key blocks.
  - Apply redaction to all log outputs, CLI debug reports, and error messages.

## Phase 9: Verification and Testing
- Create and update unit tests for config, prompts, JSON parsing, adapters, factory, and secret redaction.
- Verify everything compiles and passes all tests (existing and new).
