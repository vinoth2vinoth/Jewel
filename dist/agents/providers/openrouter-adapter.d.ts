import { AgentAdapter, PlanInput, PatchInput, ReviewInput, PatchProposal, ReviewResult, TestCriticResult } from '../adapter';
import { TaskContract } from '../../core/session';
export declare class OpenRouterAdapter implements AgentAdapter {
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
    reviewTestCorrectness(input: ReviewInput): Promise<TestCriticResult>;
    private callLLM;
}
