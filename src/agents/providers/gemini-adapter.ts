import { AgentAdapter, PlanInput, PatchInput, ReviewInput, PatchProposal, ReviewResult, TestCriticResult, LLMMessage } from '../adapter';
import { TaskContract } from '../../core/session';
import { extractJsonObject, validateTaskContractJson, validatePatchProposalJson, validateReviewResultJson, validateTestCriticResultJson } from '../json-response';
import { buildPlanningPrompt, buildPatchProposalPrompt, buildDiffReviewPrompt, buildTestCriticPrompt } from '../prompt-builder';
import { postJsonWithRetry } from './http-client';
import { TaskContractSchema, PatchProposalSchema, ReviewResultSchema, TestCriticResultSchema } from '../structured-schema';
import { getModelCapabilities } from '../model-capabilities';
import { normalizeResponse } from './response-normalizer';

export class GeminiAdapter implements AgentAdapter {
  name = 'gemini';
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
      model: 'gemini-1.5-flash',
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
      model: 'gemini-1.5-flash',
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
      model: 'gemini-1.5-flash',
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
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not set in the environment.');
    }

    const model = config.model || 'gemini-1.5-flash';
    const temperature = typeof config.temperature === 'number' ? config.temperature : 0;
    const maxTokens = typeof config.maxOutputTokens === 'number' ? config.maxOutputTokens : 4000;
    const timeoutMs = typeof config.llmTimeoutMs === 'number' ? config.llmTimeoutMs : 60000;
    const maxRetries = typeof config.llmMaxRetries === 'number' ? config.llmMaxRetries : 2;

    const { capabilities, isKnown, warning } = getModelCapabilities('gemini', model);
    if (warning) {
      console.warn(`[Warning] ${warning}`);
    }

    if (!capabilities.supportsStructuredOutput && !config.allowUnstructuredProviderFallback) {
      throw new Error(`FAIL: Model "${model}" does not support structured output, and allowUnstructuredProviderFallback is false.`);
    }

    const requestBody: any = {
      contents: []
    };

    let systemText = '';
    for (const msg of messages) {
      if (msg.role === 'system') {
        systemText = msg.content;
      } else {
        requestBody.contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        });
      }
    }

    if (systemText) {
      requestBody.systemInstruction = {
        parts: [{ text: systemText }]
      };
    }

    requestBody.generationConfig = {
      temperature,
      maxOutputTokens: maxTokens
    };

    if (capabilities.supportsStructuredOutput && config.llmStrictJson) {
      let schema: any;
      if (method === 'plan') {
        schema = TaskContractSchema;
      } else if (method === 'proposePatch') {
        schema = PatchProposalSchema;
      } else if (method === 'reviewDiff') {
        schema = ReviewResultSchema;
      } else if (method === 'reviewTestCorrectness') {
        schema = TestCriticResultSchema;
      }

      requestBody.generationConfig.responseMimeType = 'application/json';
      if (schema) {
        const cleanSchema = (s: any): any => {
          if (s === null || typeof s !== 'object') return s;
          if (Array.isArray(s)) return s.map(cleanSchema);
          const cleaned: any = {};
          for (const [k, v] of Object.entries(s)) {
            if (k === '$schema' || k === 'additionalProperties') continue;
            cleaned[k] = cleanSchema(v);
          }
          return cleaned;
        };
        requestBody.generationConfig.responseSchema = cleanSchema(schema);
      }
    } else if (config.llmStrictJson) {
      requestBody.generationConfig.responseMimeType = 'application/json';
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const retryTracker = { count: 0 };
    const data = await postJsonWithRetry(url, {
      headers: {
        'x-goog-api-key': apiKey
      },
      body: requestBody,
      timeoutMs,
      maxRetries,
      sessionPath,
      providerName: 'gemini',
      methodName: method,
      retryTracker
    });

    const normalized = normalizeResponse(data, 'gemini', model);
    this.accumulateUsage({
      ...normalized.usage,
      retryCount: retryTracker.count
    });
    return normalized.text;
  }
}
