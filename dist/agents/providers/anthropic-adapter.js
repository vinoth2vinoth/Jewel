"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnthropicAdapter = void 0;
const json_response_1 = require("../json-response");
const prompt_builder_1 = require("../prompt-builder");
const http_client_1 = require("./http-client");
const structured_schema_1 = require("../structured-schema");
const model_capabilities_1 = require("../model-capabilities");
const response_normalizer_1 = require("./response-normalizer");
const tool_loop_adapter_helper_1 = require("../tool-loop-adapter-helper");
class AnthropicAdapter {
    name = 'anthropic';
    usage;
    accumulateUsage(usage) {
        if (!usage)
            return;
        if (!this.usage) {
            this.usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUsd: 0.0, retryCount: 0 };
        }
        this.usage.inputTokens = (this.usage.inputTokens || 0) + (usage.inputTokens || 0);
        this.usage.outputTokens = (this.usage.outputTokens || 0) + (usage.outputTokens || 0);
        this.usage.totalTokens = (this.usage.totalTokens || 0) + (usage.totalTokens || 0);
        this.usage.estimatedCostUsd = (this.usage.estimatedCostUsd || 0) + (usage.estimatedCostUsd || 0);
        this.usage.retryCount = (this.usage.retryCount || 0) + (usage.retryCount || 0);
    }
    async plan(input) {
        const prompt = (0, prompt_builder_1.buildPlanningPrompt)(input);
        const systemPrompt = "You are a planning assistant. You must return only a valid JSON object adhering to the TaskContract schema.";
        const response = await this.callLLM([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
        ], input.config, 'plan', input.sessionPath);
        try {
            const parsed = (0, json_response_1.extractJsonObject)(response);
            return (0, json_response_1.validateTaskContractJson)(parsed);
        }
        catch (err) {
            throw new Error(`BLOCKED: Invalid JSON in LLM response: ${err.message}`);
        }
    }
    async proposePatch(input) {
        const prompt = (0, prompt_builder_1.buildPatchProposalPrompt)(input);
        const systemPrompt = "You are a patch proposer. You must return only a valid JSON object adhering to the PatchProposal schema.";
        const config = input.config || {
            model: 'claude-3-5-sonnet-20241022',
            temperature: 0,
            maxOutputTokens: 4000,
            llmTimeoutMs: 60000,
            llmMaxRetries: 2,
            llmStrictJson: true,
            allowUnstructuredProviderFallback: false
        };
        const response = await this.callLLM([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
        ], config, 'proposePatch', input.sessionPath);
        try {
            const parsed = (0, json_response_1.extractJsonObject)(response);
            return (0, json_response_1.validatePatchProposalJson)(parsed);
        }
        catch (err) {
            throw new Error(`BLOCKED: Invalid JSON in LLM response: ${err.message}`);
        }
    }
    async reviewDiff(input) {
        const prompt = (0, prompt_builder_1.buildDiffReviewPrompt)(input);
        const criticType = input.criticType || 'security';
        const criticSystemPrompts = {
            security: "You are a security critic. You must return only a valid JSON object adhering to the ReviewResult schema.",
            linter: "You are a code quality and linting auditor. You must return only a valid JSON object adhering to the ReviewResult schema.",
            architect: "You are a software architect. You must return only a valid JSON object adhering to the ReviewResult schema."
        };
        const systemPrompt = criticSystemPrompts[criticType];
        const config = input.config || {
            model: 'claude-3-5-sonnet-20241022',
            temperature: 0,
            maxOutputTokens: 4000,
            llmTimeoutMs: 60000,
            llmMaxRetries: 2,
            llmStrictJson: true,
            allowUnstructuredProviderFallback: false
        };
        const response = await this.callLLM([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
        ], config, 'reviewDiff', input.sessionPath);
        try {
            const parsed = (0, json_response_1.extractJsonObject)(response);
            return (0, json_response_1.validateReviewResultJson)(parsed);
        }
        catch (err) {
            throw new Error(`BLOCKED: Invalid JSON in LLM response: ${err.message}`);
        }
    }
    async reviewTestCorrectness(input) {
        const prompt = (0, prompt_builder_1.buildTestCriticPrompt)(input);
        const systemPrompt = "You are a test correctness critic. You must return only a valid JSON object adhering to the TestCriticResult schema.";
        const config = input.config || {
            model: 'claude-3-5-sonnet-20241022',
            temperature: 0,
            maxOutputTokens: 4000,
            llmTimeoutMs: 60000,
            llmMaxRetries: 2,
            llmStrictJson: true,
            allowUnstructuredProviderFallback: false
        };
        const response = await this.callLLM([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
        ], config, 'reviewTestCorrectness', input.sessionPath);
        try {
            const parsed = (0, json_response_1.extractJsonObject)(response);
            return (0, json_response_1.validateTestCriticResultJson)(parsed);
        }
        catch (err) {
            throw new Error(`BLOCKED: Invalid JSON in LLM response: ${err.message}`);
        }
    }
    async decideToolStep(input) {
        return (0, tool_loop_adapter_helper_1.decideToolStepViaLlm)((messages, config, method, sessionPath) => this.callLLM(messages, config, method, sessionPath), input);
    }
    async callLLM(messages, config, method, sessionPath) {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
            throw new Error('ANTHROPIC_API_KEY is not set in the environment.');
        }
        const model = config.model || 'claude-3-5-sonnet-20241022';
        const temperature = typeof config.temperature === 'number' ? config.temperature : 0;
        const maxTokens = typeof config.maxOutputTokens === 'number' ? config.maxOutputTokens : 4000;
        const timeoutMs = typeof config.llmTimeoutMs === 'number' ? config.llmTimeoutMs : 60000;
        const maxRetries = typeof config.llmMaxRetries === 'number' ? config.llmMaxRetries : 2;
        const { capabilities, isKnown, warning } = (0, model_capabilities_1.getModelCapabilities)('anthropic', model);
        if (warning) {
            console.warn(`[Warning] ${warning}`);
        }
        if (!capabilities.supportsStructuredOutput && !config.allowUnstructuredProviderFallback) {
            throw new Error(`FAIL: Model "${model}" does not support structured output, and allowUnstructuredProviderFallback is false.`);
        }
        let systemText = '';
        const anthropicMessages = [];
        for (const msg of messages) {
            if (msg.role === 'system') {
                systemText = msg.content;
            }
            else {
                anthropicMessages.push({
                    role: msg.role === 'assistant' ? 'assistant' : 'user',
                    content: msg.content
                });
            }
        }
        const requestBody = {
            model,
            messages: anthropicMessages,
            max_tokens: maxTokens,
            temperature
        };
        if (systemText) {
            requestBody.system = systemText;
        }
        if (capabilities.supportsStructuredOutput && config.llmStrictJson) {
            let schema;
            let name = '';
            let description = '';
            if (method === 'plan') {
                schema = structured_schema_1.TaskContractSchema;
                name = 'submit_task_contract';
                description = 'Submit the TaskContract JSON object';
            }
            else if (method === 'proposePatch') {
                schema = structured_schema_1.PatchProposalSchema;
                name = 'submit_patch_proposal';
                description = 'Submit the PatchProposal JSON object';
            }
            else if (method === 'reviewDiff') {
                schema = structured_schema_1.ReviewResultSchema;
                name = 'submit_review_result';
                description = 'Submit the ReviewResult JSON object';
            }
            else if (method === 'reviewTestCorrectness') {
                schema = structured_schema_1.TestCriticResultSchema;
                name = 'submit_test_critic_result';
                description = 'Submit the TestCriticResult JSON object';
            }
            else if (method === 'decideToolStep') {
                schema = structured_schema_1.ToolLoopDecisionSchema;
                name = 'submit_tool_loop_decision';
                description = 'Submit the ToolLoopDecision JSON object';
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
        const data = await (0, http_client_1.postJsonWithRetry)(url, {
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
        const normalized = (0, response_normalizer_1.normalizeResponse)(data, 'anthropic', model);
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
exports.AnthropicAdapter = AnthropicAdapter;
