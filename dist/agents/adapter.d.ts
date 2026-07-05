import { JewelConfig } from '../core/config';
import { TaskContract } from '../core/session';
import { Skill } from '../skills/loader';
import { VerificationReport } from '../verification/runner';
import type { CriticResult } from '../safety/critic';
import type { ToolLoopDecision, ToolLoopInput } from './tools/types';
export interface PlanInput {
    task: string;
    repoSummary: string;
    config: JewelConfig;
    skills: Skill[];
    sessionPath?: string;
    filesNeeded?: string[];
}
export interface PatchInput {
    taskContract: TaskContract;
    allowedFiles: string[];
    repoContext: string;
    verificationResult: VerificationReport | null;
    testCriticResult?: TestCriticResult;
    config?: JewelConfig;
    sessionPath?: string;
    customHint?: string;
    criticResult?: CriticResult;
    failedDiff?: string;
}
export interface PatchFileEdit {
    search: string;
    replace: string;
}
export interface PatchFile {
    filePath: string;
    content?: string;
    edits?: PatchFileEdit[];
    reason: string;
}
export interface PatchProposal {
    summary: string;
    files: PatchFile[];
    notes: string[];
    riskLevel: 'low' | 'medium' | 'high';
    noChangeNeeded?: boolean;
    noChangeReason?: string;
}
export interface ReviewInput {
    diff: string;
    verificationResult: VerificationReport | null;
    taskContract: TaskContract;
    config?: JewelConfig;
    sessionPath?: string;
    criticType?: 'security' | 'linter' | 'architect';
}
export interface ReviewResult {
    status: 'PASS' | 'WARN' | 'BLOCK';
    findings: string[];
}
export interface TestCriticResult {
    verdict: 'BAD_GENERATED_TEST' | 'BAD_IMPLEMENTATION' | 'FLAKY_TEST_SUSPECT' | 'ENVIRONMENT_FAILURE' | 'INSUFFICIENT_CONTEXT' | 'UNKNOWN';
    confidence: 'high' | 'medium' | 'low';
    explanation: string;
    suspectedRootCause: string;
    suggestedFix: string;
    canAutoRetry: boolean;
    requiresHumanReview: boolean;
}
export interface LLMMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}
export interface LLMRequest {
    messages: LLMMessage[];
    temperature?: number;
    maxTokens?: number;
    responseFormat?: {
        type: 'json_object';
    };
}
export interface LLMResponse {
    content: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}
export interface AgentAdapter {
    name: string;
    plan(input: PlanInput): Promise<TaskContract>;
    proposePatch(input: PatchInput): Promise<PatchProposal>;
    reviewDiff(input: ReviewInput): Promise<ReviewResult>;
    reviewTestCorrectness?(input: ReviewInput): Promise<TestCriticResult>;
    decideToolStep?(input: ToolLoopInput): Promise<ToolLoopDecision>;
    usage?: {
        inputTokens?: number;
        outputTokens?: number;
        totalTokens?: number;
        estimatedCostUsd?: number;
        retryCount?: number;
    };
}
export declare class MockAgentAdapter implements AgentAdapter {
    name: string;
    usage?: {
        inputTokens?: number;
        outputTokens?: number;
        totalTokens?: number;
        estimatedCostUsd?: number;
        retryCount?: number;
    };
    private accumulateMockUsage;
    private checkBudget;
    plan(input: PlanInput): Promise<TaskContract>;
    decideToolStep(input: ToolLoopInput): Promise<ToolLoopDecision>;
    proposePatch(input: PatchInput): Promise<PatchProposal>;
    reviewDiff(input: ReviewInput): Promise<ReviewResult>;
    reviewTestCorrectness(input: ReviewInput): Promise<TestCriticResult>;
}
