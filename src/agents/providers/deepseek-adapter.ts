import { AgentAdapter, PlanInput, PatchInput, ReviewInput, PatchProposal, ReviewResult, TestCriticResult, LLMMessage, MilestoneGenerationInput } from '../adapter';
import { TaskContract } from '../../core/session';
import { extractJsonObject, validateTaskContractJson, validatePatchProposalJson, validateReviewResultJson, validateTestCriticResultJson } from '../json-response';
import { buildPlanningPrompt, buildPatchProposalPrompt, buildDiffReviewPrompt, buildTestCriticPrompt } from '../prompt-builder';
import { postJsonWithRetry } from './http-client';
import { getModelCapabilities } from '../model-capabilities';
import { normalizeResponse } from './response-normalizer';
import { decideToolStepViaLlm } from '../tool-loop-adapter-helper';
import { ToolLoopDecision, ToolLoopInput } from '../tools/types';

/**
 * DeepSeek Chat Completions adapter.
 * OpenAI-compatible API at https://api.deepseek.com. DeepSeek supports JSON
 * output mode (response_format: json_object) but not strict json_schema, so
 * every response is validated against Jewel's schemas after parsing.
 */
export class DeepSeekAdapter implements AgentAdapter {
  name = 'deepseek-chat-completions';
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    estimatedCostUsd?: number;
    retryCount?: number;
  };

  private accumulateUsage(usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number; estimatedCostUsd?: number; retryCount?: number }) {
    if (!usage) return;
    if (!this.usage) {
      this.usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUsd: 0.0, retryCount: 0 };
    }
    this.usage.inputTokens = (this.usage.inputTokens || 0) + (usage.inputTokens || 0);
    this.usage.outputTokens = (this.usage.outputTokens || 0) + (usage.outputTokens || 0);
    this.usage.totalTokens = (this.usage.totalTokens || 0) + (usage.totalTokens || 0);
    this.usage.estimatedCostUsd = (this.usage.estimatedCostUsd || 0) + (usage.estimatedCostUsd || 0);
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
      model: 'deepseek-v4-flash',
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
    const criticType = input.criticType || 'security';
    const criticSystemPrompts = {
      security: "You are a security critic. You must return only a valid JSON object adhering to the ReviewResult schema.",
      linter: "You are a code quality and linting auditor. You must return only a valid JSON object adhering to the ReviewResult schema.",
      architect: "You are a software architect. You must return only a valid JSON object adhering to the ReviewResult schema."
    };
    const systemPrompt = criticSystemPrompts[criticType];

    const config = input.config || {
      model: 'deepseek-v4-flash',
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
      model: 'deepseek-v4-flash',
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

  async decideToolStep(input: ToolLoopInput): Promise<ToolLoopDecision> {
    return decideToolStepViaLlm(
      (messages, config, method, sessionPath) => this.callLLM(messages, config, method, sessionPath),
      input
    );
  }

  async generateMilestones(input: MilestoneGenerationInput): Promise<unknown> {
    const systemPrompt = 'You are a project planner. Return only a valid JSON object: {"milestones": ["milestone title", ...]}. Each milestone must be a small, independently verifiable coding task.';
    const userPrompt = `Decompose this project goal into at most ${input.maxMilestones} ordered milestones (json array of strings under key "milestones"). Each milestone should be completable and testable on its own, building on the previous ones.\n\nProject goal: ${input.goal}`;

    const config = {
      model: 'deepseek-v4-flash',
      temperature: 0,
      maxOutputTokens: 2000,
      llmTimeoutMs: 60000,
      llmMaxRetries: 2,
      llmStrictJson: true,
      allowUnstructuredProviderFallback: false
    } as any;

    const response = await this.callLLM([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], config, 'generateMilestones');

    const parsed = extractJsonObject(response) as { milestones?: unknown };
    return parsed.milestones;
  }

  private async callLLM(messages: LLMMessage[], config: any, method: string, sessionPath?: string): Promise<string> {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error('DEEPSEEK_API_KEY is not set in the environment.');
    }

    const model = config.model || 'deepseek-v4-flash';
    const temperature = typeof config.temperature === 'number' ? config.temperature : 0;
    const maxTokens = typeof config.maxOutputTokens === 'number' ? config.maxOutputTokens : 4000;
    const timeoutMs = typeof config.llmTimeoutMs === 'number' ? config.llmTimeoutMs : 60000;
    const maxRetries = typeof config.llmMaxRetries === 'number' ? config.llmMaxRetries : 2;

    const { capabilities, warning } = getModelCapabilities('deepseek', model);
    if (warning) {
      console.warn(`[Warning] ${warning}`);
    }

    const requestBody: any = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens
    };

    // DeepSeek supports JSON object mode but not strict json_schema.
    // Jewel validates every parsed response against its schemas, so
    // json_object mode plus post-validation keeps the harness strict.
    if (config.llmStrictJson) {
      requestBody.response_format = { type: 'json_object' };
    }

    const retryTracker = { count: 0 };
    const data = await postJsonWithRetry('https://api.deepseek.com/chat/completions', {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: requestBody,
      timeoutMs,
      maxRetries,
      sessionPath,
      providerName: 'deepseek',
      methodName: method,
      retryTracker
    });

    const normalized = normalizeResponse(data, 'deepseek', model);
    const inputCost = (normalized.usage?.inputTokens || 0) * (capabilities.inputCostPerMillionToken || 0) / 1000000;
    const outputCost = (normalized.usage?.outputTokens || 0) * (capabilities.outputCostPerMillionToken || 0) / 1000000;
    const callCost = inputCost + outputCost;

    this.accumulateUsage({
      ...normalized.usage,
      retryCount: retryTracker.count,
      estimatedCostUsd: callCost
    });

    const maxSessionCost = config?.maxSessionCost;
    if (maxSessionCost !== undefined && maxSessionCost > 0) {
      const currentCost = this.usage?.estimatedCostUsd || 0;
      if (currentCost > maxSessionCost) {
        throw new Error(`[Jewel Budget Guard] Session cost limit exceeded: Current cost $${currentCost.toFixed(4)} exceeds maximum allowed budget of $${maxSessionCost.toFixed(2)}.`);
      }
    }

    return normalized.text;
  }
}
