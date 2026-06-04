import { AgentAdapter, PlanInput, PatchInput, ReviewInput, PatchProposal, ReviewResult, TestCriticResult, LLMMessage } from '../adapter';
import { TaskContract } from '../../core/session';
import { extractJsonObject, validateTaskContractJson, validatePatchProposalJson, validateReviewResultJson, validateTestCriticResultJson } from '../json-response';
import { buildPlanningPrompt, buildPatchProposalPrompt, buildDiffReviewPrompt, buildTestCriticPrompt } from '../prompt-builder';
import { postJsonWithRetry } from './http-client';
import { TaskContractSchema, PatchProposalSchema, ReviewResultSchema, TestCriticResultSchema } from '../structured-schema';
import { getModelCapabilities } from '../model-capabilities';
import { normalizeResponse } from './response-normalizer';

export class AnthropicAdapter implements AgentAdapter {
  name = 'anthropic';
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
      model: 'claude-3-5-sonnet-20241022',
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
      model: 'claude-3-5-sonnet-20241022',
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
      model: 'claude-3-5-sonnet-20241022',
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
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set in the environment.');
    }

    const model = config.model || 'claude-3-5-sonnet-20241022';
    const temperature = typeof config.temperature === 'number' ? config.temperature : 0;
    const maxTokens = typeof config.maxOutputTokens === 'number' ? config.maxOutputTokens : 4000;
    const timeoutMs = typeof config.llmTimeoutMs === 'number' ? config.llmTimeoutMs : 60000;
    const maxRetries = typeof config.llmMaxRetries === 'number' ? config.llmMaxRetries : 2;

    const { capabilities, isKnown, warning } = getModelCapabilities('anthropic', model);
    if (warning) {
      console.warn(`[Warning] ${warning}`);
    }

    if (!capabilities.supportsStructuredOutput && !config.allowUnstructuredProviderFallback) {
      throw new Error(`FAIL: Model "${model}" does not support structured output, and allowUnstructuredProviderFallback is false.`);
    }

    let systemText = '';
    const anthropicMessages: any[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemText = msg.content;
      } else {
        anthropicMessages.push({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content
        });
      }
    }

    const requestBody: any = {
      model,
      messages: anthropicMessages,
      max_tokens: maxTokens,
      temperature
    };

    if (systemText) {
      requestBody.system = systemText;
    }

    if (capabilities.supportsStructuredOutput && config.llmStrictJson) {
      let schema: any;
      let name = '';
      let description = '';
      if (method === 'plan') {
        schema = TaskContractSchema;
        name = 'submit_task_contract';
        description = 'Submit the TaskContract JSON object';
      } else if (method === 'proposePatch') {
        schema = PatchProposalSchema;
        name = 'submit_patch_proposal';
        description = 'Submit the PatchProposal JSON object';
      } else if (method === 'reviewDiff') {
        schema = ReviewResultSchema;
        name = 'submit_review_result';
        description = 'Submit the ReviewResult JSON object';
      } else if (method === 'reviewTestCorrectness') {
        schema = TestCriticResultSchema;
        name = 'submit_test_critic_result';
        description = 'Submit the TestCriticResult JSON object';
      }

      if (schema) {
        const { $schema, ...strippedSchema } = schema;
        requestBody.tools = [{
          name,
          description,
          input_schema: strippedSchema
        }];
        requestBody.tool_choice = {
          type: 'tool',
          name
        };
      }
    }

    const url = 'https://api.anthropic.com/v1/messages';

    const retryTracker = { count: 0 };
    const data = await postJsonWithRetry(url, {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: requestBody,
      timeoutMs,
      maxRetries,
      sessionPath,
      providerName: 'anthropic',
      methodName: method,
      retryTracker
    });

    const normalized = normalizeResponse(data, 'anthropic', model);
    this.accumulateUsage({
      ...normalized.usage,
      retryCount: retryTracker.count
    });
    return normalized.text;
  }
}
