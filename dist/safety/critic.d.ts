import { JewelConfig } from '../core/config';
import { TaskContract } from '../core/session';
import { DiffAnalysis } from './diff-guard';
import { VerificationReport } from '../verification/runner';
import { AgentAdapter } from '../agents/adapter';
export interface CriticResult {
    status: 'PASS' | 'WARN' | 'BLOCK';
    findings: string[];
    requiredActions: string[];
    confidence: 'low' | 'medium' | 'high';
}
export declare function runCriticReview(contract: TaskContract, diffAnalysis: DiffAnalysis, verification: VerificationReport | null, config: JewelConfig): CriticResult;
export declare function runMultiAgentCriticReview(contract: TaskContract, diffAnalysis: DiffAnalysis, verification: VerificationReport | null, config: JewelConfig, adapter: AgentAdapter | null, sessionPath: string, diffContent: string): Promise<CriticResult>;
