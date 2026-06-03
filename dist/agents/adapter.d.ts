import { JewelConfig } from '../core/config';
import { TaskContract } from '../core/session';
import { Skill } from '../skills/loader';
import { VerificationReport } from '../verification/runner';
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
    config?: JewelConfig;
    sessionPath?: string;
}
export interface PatchProposal {
    summary: string;
    files: {
        filePath: string;
        content: string;
        reason: string;
    }[];
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
}
export interface ReviewResult {
    status: 'PASS' | 'WARN' | 'BLOCK';
    findings: string[];
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
    usage?: {
        inputTokens?: number;
        outputTokens?: number;
        totalTokens?: number;
        estimatedCostUsd?: number;
    };
}
export declare class MockAgentAdapter implements AgentAdapter {
    name: string;
    usage?: {
        inputTokens?: number;
        outputTokens?: number;
        totalTokens?: number;
        estimatedCostUsd?: number;
    };
    private accumulateMockUsage;
    plan(input: PlanInput): Promise<TaskContract>;
    proposePatch(input: PatchInput): Promise<PatchProposal>;
    reviewDiff(input: ReviewInput): Promise<ReviewResult>;
}
