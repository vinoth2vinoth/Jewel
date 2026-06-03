# Model Capabilities in Jewel

Jewel maintains a registry of model capabilities to ensure that requested LLMs support the safety features required by the harness (such as strict structured JSON schemas).

## What Model Capabilities Mean
Different LLM providers and models have varying degrees of support for:
1. **Structured Outputs (Strict JSON Schema)**: The ability to guarantee that the response strictly follows a provided JSON Schema (e.g., OpenAI's strict JSON schema mode, Gemini's responseSchema).
2. **Usage Reporting**: Providing precise token counters (input, output, total tokens) and estimated run costs.
3. **Safety Filters**: Aligning output structures to prevent code escape.

Jewel references this registry before invoking any LLM to ensure safety policies are not bypassed.

---

## Registry Support & Capabilities

### 1. Structured Output Support
Models that support structured output can be passed direct JSON schemas for the task plan, the code patch, and the diff critic review.
- **Supported Models**: `gpt-4o-mini`, `gpt-4o`, `gemini-1.5-flash`, `gemini-1.5-pro`, `claude-3-5-sonnet-latest`, `claude-3-5-haiku-latest`.
- **Unsupported/Fallback Models**: Standard LLMs that only support free-form completions.

### 2. Usage Reporting Support
Most registry models support usage reporting, providing input and output token tallies.
- **Supported Models**: OpenAI, Anthropic, Gemini, and OpenRouter API wrappers.
- **Provider None/Mock**: Marked clearly as `usage unavailable (mock)` to prevent fake cost metrics.

---

## Default, Unknown, and Fallback Behavior

### Default Model Behavior
By default, Jewel uses modern models registered with full structured output capabilities (e.g., `gpt-4o-mini` for OpenAI, `gemini-1.5-flash` for Gemini). These are pre-configured to execute quickly and with high reliability.

### Unknown Model Behavior
When you configure an unknown model (e.g., a newly released model not in the local registry):
1. **Warning**: Jewel will issue a warning indicating the model is unregistered.
2. **Block**: Jewel will **block** execution by default if the model is assumed to not support structured outputs, preventing silent failure.

### Fallback Behavior & `allowUnstructuredProviderFallback`
If a model does not support structured outputs, you can toggle the fallback setting in `jewel.config.json`:
```json
{
  "allowUnstructuredProviderFallback": true
}
```

> [!WARNING]
> Enabling `allowUnstructuredProviderFallback` strongly **reduces reliability**. When fallback is active:
> - Jewel requests JSON formatting via standard text prompt instructions rather than API schema enforcement.
> - The model is more prone to formatting errors, parser crashes, or missing task criteria.
> - It should only be used as a last resort or with highly capable frontier models.

---

## OpenRouter model selection for Jewel
To ensure the best experience when using OpenRouter with Jewel:
1. **Start with `openai/gpt-4o-mini`** if available. It is fast, cheap, and fully supports strict JSON schema mode.
2. **If schema unsupported**, try a different model with native structured output support (such as `anthropic/claude-3.5-sonnet` or `meta-llama/llama-3.3-70b-instruct`).
3. **If rate limited**, reduce test frequency or increase token bounds.
4. **If invalid JSON**, try a stronger, more capable model.
5. **Never enable `allowUnstructuredProviderFallback`** for important or production repositories.

---

## How to Choose a Safer Model
To ensure maximum safety and reliability while running Jewel:
1. **Prefer registry models**: Use pre-tested models such as `gpt-4o-mini` or `gemini-1.5-flash`.
2. **Require Strict JSON**: Leave `llmStrictJson` set to `true` in your configuration.
3. **Verify locally**: Always execute in dry-run mode (`--dry-run`) first to verify model selection.
