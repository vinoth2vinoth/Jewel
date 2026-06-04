import { AgentAdapter, PlanInput, PatchInput, ReviewInput, PatchProposal, ReviewResult, TestCriticResult, LLMMessage } from '../adapter';
import { TaskContract } from '../../core/session';
import { extractJsonObject, validateTaskContractJson, validatePatchProposalJson, validateReviewResultJson, validateTestCriticResultJson } from '../json-response';
import { buildPlanningPrompt, buildPatchProposalPrompt, buildDiffReviewPrompt, buildTestCriticPrompt } from '../prompt-builder';
import { postJsonWithRetry } from './http-client';
import { TaskContractSchema, PatchProposalSchema, ReviewResultSchema, TestCriticResultSchema } from '../structured-schema';
import { getModelCapabilities } from '../model-capabilities';
import { normalizeResponse } from './response-normalizer';

export class OpenRouterAdapter implements AgentAdapter {
  name = 'openrouter';
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    estimatedCostUsd?: number;
    retryCount?: number;
  };

  private accumulateUsage(usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number; retryCount?: number }) {
    if (!usage) return;
    if (!this.usage) {
      this.usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0, retryCount: 0 };
    }
    this.usage.inputTokens = (this.usage.inputTokens || 0) + (usage.inputTokens || 0);
    this.usage.outputTokens = (this.usage.outputTokens || 0) + (usage.outputTokens || 0);
    this.usage.totalTokens = (this.usage.totalTokens || 0) + (usage.totalTokens || 0);
    this.usage.retryCount = (this.usage.retryCount || 0) + (usage.retryCount || 0);
  }

  async plan(input: PlanInput): Promise<TaskContract> {
    const prompt = buildPlanningPrompt(input);
    const systemPrompt = "You are a planning assistant. You must return only a valid JSON object adhering to the TaskContract schema.";
    const response = await this.callLLM([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ], input.config, 'plan', input.sessionPath);

    try {
      const parsed = extractJsonObject(response);
      return validateTaskContractJson(parsed);
    } catch (err: any) {
      throw new Error(`BLOCKED: Invalid JSON in LLM response: ${err.message}`);
    }
  }

  async proposePatch(input: PatchInput): Promise<PatchProposal> {
    const prompt = buildPatchProposalPrompt(input);
    const systemPrompt = "You are a patch proposer. You must return only a valid JSON object adhering to the PatchProposal schema.";
    
    const config = input.config || {
      model: 'openai/gpt-4o-mini',
      temperature: 0,
      maxOutputTokens: 4000,
      llmTimeoutMs: 60000,
      llmMaxRetries: 2,
      llmStrictJson: true,
      allowUnstructuredProviderFallback: false
    } as any;

    const response = await this.callLLM([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ], config, 'proposePatch', input.sessionPath);

    try {
      const parsed = extractJsonObject(response);
      return validatePatchProposalJson(parsed);
    } catch (err: any) {
      throw new Error(`BLOCKED: Invalid JSON in LLM response: ${err.message}`);
    }
  }

  async reviewDiff(input: ReviewInput): Promise<ReviewResult> {
    const prompt = buildDiffReviewPrompt(input);
    const systemPrompt = "You are a security critic. You must return only a valid JSON object adhering to the ReviewResult schema.";
    
    const config = input.config || {
      model: 'google/gemini-2.5-flash',
      temperature: 0,
      maxOutputTokens: 4000,
      llmTimeoutMs: 60000,
      llmMaxRetries: 2,
      llmStrictJson: true,
      allowUnstructuredProviderFallback: false
    } as any;

    const response = await this.callLLM([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ], config, 'reviewDiff', input.sessionPath);

    try {
      const parsed = extractJsonObject(response);
      return validateReviewResultJson(parsed);
    } catch (err: any) {
      throw new Error(`BLOCKED: Invalid JSON in LLM response: ${err.message}`);
    }
  }

  async reviewTestCorrectness(input: ReviewInput): Promise<TestCriticResult> {
    const prompt = buildTestCriticPrompt(input);
    const systemPrompt = "You are a test correctness critic. You must return only a valid JSON object adhering to the TestCriticResult schema.";
    
    const config = input.config || {
      model: 'google/gemini-2.5-flash',
      temperature: 0,
      maxOutputTokens: 4000,
      llmTimeoutMs: 60000,
      llmMaxRetries: 2,
      llmStrictJson: true,
      allowUnstructuredProviderFallback: false
    } as any;

    const response = await this.callLLM([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ], config, 'reviewTestCorrectness', input.sessionPath);

    try {
      const parsed = extractJsonObject(response);
      return validateTestCriticResultJson(parsed);
    } catch (err: any) {
      throw new Error(`BLOCKED: Invalid JSON in LLM response: ${err.message}`);
    }
  }

  private async callLLM(messages: LLMMessage[], config: any, method: string, sessionPath?: string): Promise<string> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY is not set in the environment.');
    }

    const model = config.model || 'openai/gpt-4o-mini';
    const temperature = typeof config.temperature === 'number' ? config.temperature : 0;
    const maxTokens = typeof config.maxOutputTokens === 'number' ? config.maxOutputTokens : 4000;
    const timeoutMs = typeof config.llmTimeoutMs === 'number' ? config.llmTimeoutMs : 60000;
    const maxRetries = typeof config.llmMaxRetries === 'number' ? config.llmMaxRetries : 2;

    const { capabilities, isKnown, warning } = getModelCapabilities('openrouter', model);
    if (warning) {
      console.warn(`[Warning] ${warning}`);
    }

    if (!capabilities.supportsStructuredOutput && !config.allowUnstructuredProviderFallback) {
      throw new Error(`FAIL: Model "${model}" does not support structured outputs (response_format json_schema) in OpenRouter registry.
      This is a likely model capability mismatch since structured output (strict JSON schema) is required for Jewel safety harnesses.
      Next Action: Please try switching models to one known to support structured outputs, such as "openai/gpt-4o-mini", "anthropic/claude-3.5-sonnet", or "meta-llama/llama-3.3-70b-instruct".
      We recommend keeping "allowUnstructuredProviderFallback" disabled for maximum reliability. For more information, please refer to docs/model-capabilities.md.
      If you still wish to proceed without structured output enforcement, set "allowUnstructuredProviderFallback" to true in your configuration (warning: this may reduce reliability).`);
    }

    const requestBody: any = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens
    };

    if (capabilities.supportsStructuredOutput && config.llmStrictJson) {
      let schema: any;
      let name = '';
      if (method === 'plan') {
        schema = TaskContractSchema;
        name = 'TaskContract';
      } else if (method === 'proposePatch') {
        schema = PatchProposalSchema;
        name = 'PatchProposal';
      } else if (method === 'reviewDiff') {
        schema = ReviewResultSchema;
        name = 'ReviewResult';
      } else if (method === 'reviewTestCorrectness') {
        schema = TestCriticResultSchema;
        name = 'TestCriticResult';
      }

      if (schema) {
        requestBody.response_format = {
          type: 'json_schema',
          json_schema: {
            name,
            strict: true,
            schema
          }
        };
      }
    } else if (config.llmStrictJson) {
      requestBody.response_format = { type: 'json_object' };
    }

    const url = 'https://openrouter.ai/api/v1/chat/completions';

    const retryTracker = { count: 0 };
    const data = await postJsonWithRetry(url, {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: requestBody,
      timeoutMs,
      maxRetries,
      sessionPath,
      providerName: 'openrouter',
      methodName: method,
      retryTracker
    });

    const normalized = normalizeResponse(data, 'openrouter', model);
    this.accumulateUsage({
      ...normalized.usage,
      retryCount: retryTracker.count
    });
    return normalized.text;
  }
}
