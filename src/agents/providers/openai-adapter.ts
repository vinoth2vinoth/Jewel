import { AgentAdapter, PlanInput, PatchInput, ReviewInput, PatchProposal, ReviewResult, LLMMessage } from '../adapter';
import { TaskContract } from '../../core/session';
import { extractJsonObject, validateTaskContractJson, validatePatchProposalJson, validateReviewResultJson } from '../json-response';
import { buildPlanningPrompt, buildPatchProposalPrompt, buildDiffReviewPrompt } from '../prompt-builder';
import { postJsonWithRetry } from './http-client';
import { TaskContractSchema, PatchProposalSchema, ReviewResultSchema } from '../structured-schema';
import { getModelCapabilities } from '../model-capabilities';
import { normalizeResponse } from './response-normalizer';

/**
 * OpenAI Chat Completions adapter.
 * Currently uses the /v1/chat/completions endpoint. Support for the new Responses API is planned for a later release.
 */
export class OpenAIAdapter implements AgentAdapter {
  name = 'openai-chat-completions';
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
    
    // Default config if not provided
    const config = input.config || {
      model: 'gpt-4o-mini',
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
    
    // Default config if not provided
    const config = input.config || {
      model: 'gpt-4o-mini',
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

  private async callLLM(messages: LLMMessage[], config: any, method: string, sessionPath?: string): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not set in the environment.');
    }

    const model = config.model || 'gpt-4o-mini';
    const temperature = typeof config.temperature === 'number' ? config.temperature : 0;
    const maxTokens = typeof config.maxOutputTokens === 'number' ? config.maxOutputTokens : 4000;
    const timeoutMs = typeof config.llmTimeoutMs === 'number' ? config.llmTimeoutMs : 60000;
    const maxRetries = typeof config.llmMaxRetries === 'number' ? config.llmMaxRetries : 2;

    const { capabilities, isKnown, warning } = getModelCapabilities('openai', model);
    if (warning) {
      console.warn(`[Warning] ${warning}`);
    }

    if (!capabilities.supportsStructuredOutput && !config.allowUnstructuredProviderFallback) {
      throw new Error(`FAIL: Model "${model}" does not support structured output, and allowUnstructuredProviderFallback is false.`);
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

    const retryTracker = { count: 0 };
    const data = await postJsonWithRetry('https://api.openai.com/v1/chat/completions', {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: requestBody,
      timeoutMs,
      maxRetries,
      sessionPath,
      providerName: 'openai',
      methodName: method,
      retryTracker
    });

    const normalized = normalizeResponse(data, 'openai', model);
    this.accumulateUsage({
      ...normalized.usage,
      retryCount: retryTracker.count
    });
    return normalized.text;
  }
}
