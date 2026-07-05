import { AgentAdapter, PlanInput, PatchInput, ReviewInput, PatchProposal, ReviewResult, TestCriticResult } from '../adapter';
import { TaskContract } from '../../core/session';
import { ToolLoopDecision, ToolLoopInput } from '../tools/types';
/**
 * OpenAI Chat Completions adapter.
 * Currently uses the /v1/chat/completions endpoint. Support for the new Responses API is planned for a later release.
 */
export declare class OpenAIAdapter implements AgentAdapter {
    name: string;
    usage?: {
        inputTokens?: number;
        outputTokens?: number;
        totalTokens?: number;
        estimatedCostUsd?: number;
        retryCount?: number;
    };
    private accumulateUsage;
    plan(input: PlanInput): Promise<TaskContract>;
    proposePatch(input: PatchInput): Promise<PatchProposal>;
    reviewDiff(input: ReviewInput): Promise<ReviewResult>;
    decideToolStep(input: ToolLoopInput): Promise<ToolLoopDecision>;
    reviewTestCorrectness(input: ReviewInput): Promise<TestCriticResult>;
    private callLLM;
}
