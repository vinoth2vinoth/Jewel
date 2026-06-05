# Design Plan: Session Cost & Budget Guard (Phase 4) - Revised

This plan details the implementation of Phase 4: Session Cost & Budget Guard to track and restrict the accumulated API cost of LLM adapter requests.

## Affected Files
1. **`src/core/config.ts`**: Add `maxSessionCost` to `JewelConfig` interface, defaults, and configuration validation.
2. **`src/agents/model-capabilities.ts`**:
   - Add input and output token pricing fields to the `ModelCapabilities` interface.
   - Populate input/output cost values (per million tokens) for standard OpenAI, Anthropic, Gemini, and OpenRouter models.
   - Implement OpenRouter model basename resolver to extract base pricing (e.g. `openai/gpt-4o-mini` -> `gpt-4o-mini` from `openai`).
   - Add a console warning if unknown models default to `0.0` pricing.
3. **`src/agents/adapter.ts`**: Update the accumulated `usage` object to track `estimatedCostUsd` and update `MockAgentAdapter` to simulate cost generation and checks.
4. **`src/agents/providers/openai-adapter.ts`**, **`src/agents/providers/anthropic-adapter.ts`**, **`src/agents/providers/gemini-adapter.ts`**, **`src/agents/providers/openrouter-adapter.ts`**:
   - Update `accumulateUsage` to add estimated cost tracking.
   - Inside `callLLM`, calculate the cost of the call based on model pricing, update `usage.estimatedCostUsd`, and throw a budget exception if the configured `maxSessionCost` is breached.
5. **`src/cli/errors.ts`**: Add support for the `BUDGET_EXCEEDED` error code in `toJewelError`.
6. **`src/cli/commands/run.ts`**:
   - Rethrow budget errors in try/catch blocks within the retry loop to avoid error masking.
   - Detect budget violations in the top-level catch block, set report status to `BUDGET_EXCEEDED`, run Git rollback, and exit with code 1.

---

## Detailed Expected Changes

### 1. Configuration Changes
In `src/core/config.ts`:
- Append `maxSessionCost?: number;` to the `JewelConfig` interface.
- Add `maxSessionCost: 0.0` to `DEFAULT_CONFIG`.
- Include `'maxSessionCost'` in the `numericFields` validation array in `validateAndMergeConfig()`.

### 2. Pricing Database & Resolution
In `src/agents/model-capabilities.ts`:
- Add `inputCostPerMillionToken?: number;` and `outputCostPerMillionToken?: number;` to `ModelCapabilities`.
- Populate standard costs in `CAPABILITY_REGISTRY`.
- In `getModelCapabilities()` pricing retrieval:
  - If the provider is `openrouter` and the model name contains a `/` (e.g., `openai/gpt-4o-mini`), parse it to resolve its capabilities and pricing from the base provider registry (e.g. resolve base provider `openai` and model `gpt-4o-mini`).
  - If a model is unknown or has no cost configuration, output a warning:
    `console.warn("[Warning] Pricing parameters missing for model X. Cost tracking will be disabled/inaccurate for this request.")`
  - Fallback pricing parameters default to `0.0`.

### 3. Usage Accumulator & Budget Guard Checks in Adapters
For each LLM adapter (`openai-adapter.ts`, `gemini-adapter.ts`, `anthropic-adapter.ts`, `openrouter-adapter.ts`):
1. **Update `accumulateUsage`** to add `estimatedCostUsd` parameter.
2. **Calculate Call Cost** in `callLLM()` post-normalization:
   ```typescript
    const { capabilities } = getModelCapabilities(providerName, model);
    const inputCost = (normalized.usage?.inputTokens || 0) * (capabilities.inputCostPerMillionToken || 0) / 1000000;
    const outputCost = (normalized.usage?.outputTokens || 0) * (capabilities.outputCostPerMillionToken || 0) / 1000000;
    const callCost = inputCost + outputCost;

   this.accumulateUsage({
     ...normalized.usage,
     retryCount: retryTracker.count,
     estimatedCostUsd: callCost
   });
   ```
3. **Budget Guard check**:
   ```typescript
   const maxSessionCost = config?.maxSessionCost;
   if (maxSessionCost !== undefined && maxSessionCost > 0) {
     const currentCost = this.usage?.estimatedCostUsd || 0;
     if (currentCost > maxSessionCost) {
       throw new Error(`[Jewel Budget Guard] Session cost limit exceeded: Current cost $${currentCost.toFixed(4)} exceeds maximum allowed budget of $${maxSessionCost.toFixed(2)}.`);
     }
   }
   ```

### 4. Mock Adapter Tracking & Testability
In `src/agents/adapter.ts` (`MockAgentAdapter`):
- Update `accumulateMockUsage()` to increment `this.usage.estimatedCostUsd` by `$0.05` on each call.
- Check budget in all adapter methods (`plan`, `proposePatch`, `reviewDiff`, `reviewTestCorrectness`):
  ```typescript
  const maxSessionCost = input.config?.maxSessionCost;
  if (maxSessionCost !== undefined && maxSessionCost > 0) {
    const currentCost = this.usage?.estimatedCostUsd || 0;
    if (currentCost > maxSessionCost) {
      throw new Error(`[Jewel Budget Guard] Session cost limit exceeded: Current cost $${currentCost.toFixed(4)} exceeds maximum allowed budget of $${maxSessionCost.toFixed(2)}.`);
    }
  }
  ```

### 5. Rethrowing Errors in `run.ts`
To prevent error masking:
- In `src/cli/commands/run.ts`, within the retry loop and initial blocks (where `proposePatch` or `reviewTestCorrectness` are called), any catch block must check if the error is a budget guard error:
  ```typescript
  } catch (err: any) {
    if (err.message && err.message.includes('[Jewel Budget Guard]')) {
      throw err;
    }
    // standard error handling...
  }
  ```
- In the top-level catch block in `runTask()`:
  - If the error is a budget error, set `reportStatus = 'BUDGET_EXCEEDED'`.
  - Write the final run report with `BUDGET_EXCEEDED` status.
  - Run Git rollback and call `process.exit(1)`.

### 6. Error Mapping in `errors.ts`
In `src/cli/errors.ts`:
- Check for `[Jewel Budget Guard]` or `Session cost limit exceeded` inside `toJewelError` and map it to `BUDGET_EXCEEDED`:
  ```typescript
  if (msg.includes('Budget Guard') || msg.includes('Session cost limit exceeded') || msg.includes('BUDGET_EXCEEDED')) {
    return new JewelError(
      'BUDGET_EXCEEDED',
      msg,
      'Increase the maxSessionCost threshold in jewel.config.json or verify that the model is not caught in a runaway loop.',
      err
    );
  }
  ```

---

## 6. Verification & Testing Strategy
- **Unit Test Case**: Write a test in `openai-adapter.test.ts` or similar that:
  - Instantiates an adapter.
  - Mocks consecutive completions returning non-zero usage.
  - Configures `maxSessionCost = 0.0001` (very low threshold).
  - Asserts that the second request throws a `Budget Guard` error.
- **E2E Test Case**: Configure a task command in `run-critic-retry.test.ts` with mock provider and `maxSessionCost: 0.0001`. Check that the task run fails, reports `BUDGET_EXCEEDED`, and rolls back files successfully.
