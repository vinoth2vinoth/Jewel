import { JewelConfig } from '../core/config';
import { TaskContract } from '../core/session';
import { Skill } from '../skills/loader';
import { VerificationReport } from '../verification/runner';
export interface PlanInput {
    task: string;
    repoSummary: string;
    config: JewelConfig;
    skills: Skill[];
}
export interface PatchInput {
    taskContract: TaskContract;
    allowedFiles: string[];
    repoContext: string;
    verificationResult: VerificationReport | null;
}
export interface PatchProposal {
    files: {
        filePath: string;
        content: string;
    }[];
    explanation: string;
}
export interface ReviewInput {
    diff: string;
    verificationResult: VerificationReport | null;
    taskContract: TaskContract;
}
export interface ReviewResult {
    status: 'PASS' | 'WARN' | 'BLOCK';
    findings: string[];
}
export interface AgentAdapter {
    name: string;
    plan(input: PlanInput): Promise<TaskContract>;
    proposePatch(input: PatchInput): Promise<PatchProposal>;
    reviewDiff(input: ReviewInput): Promise<ReviewResult>;
}
export declare class MockAgentAdapter implements AgentAdapter {
    name: string;
    plan(input: PlanInput): Promise<TaskContract>;
    proposePatch(input: PatchInput): Promise<PatchProposal>;
    reviewDiff(input: ReviewInput): Promise<ReviewResult>;
}
