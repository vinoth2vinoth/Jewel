import { AgentAdapter, PlanInput, PatchInput, ReviewInput, PatchProposal, ReviewResult, LLMMessage } from '../adapter';
import { TaskContract } from '../../core/session';
import { extractJsonObject, validateTaskContractJson, validatePatchProposalJson, validateReviewResultJson } from '../json-response';
import { buildPlanningPrompt, buildPatchProposalPrompt, buildDiffReviewPrompt } from '../prompt-builder';
import { postJsonWithRetry, parseProviderResponseText } from './http-client';

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
  };

  private accumulateUsage(usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number }) {
    if (!usage) return;
    if (!this.usage) {
      this.usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
    }
    this.usage.inputTokens = (this.usage.inputTokens || 0) + (usage.inputTokens || 0);
    this.usage.outputTokens = (this.usage.outputTokens || 0) + (usage.outputTokens || 0);
    this.usage.totalTokens = (this.usage.totalTokens || 0) + (usage.totalTokens || 0);
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
      llmStrictJson: true
    };

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
      llmStrictJson: true
    };

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

    const requestBody: any = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens
    };
    if (config.llmStrictJson) {
      requestBody.response_format = { type: 'json_object' };
    }

    const data = await postJsonWithRetry('https://api.openai.com/v1/chat/completions', {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: requestBody,
      timeoutMs,
      maxRetries,
      sessionPath,
      providerName: 'openai',
      methodName: method
    });

    const parsed = parseProviderResponseText(data, 'openai');
    this.accumulateUsage(parsed.usage);
    return parsed.content;
  }
}
