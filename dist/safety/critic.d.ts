import { JewelConfig } from '../core/config';
import { TaskContract } from '../core/session';
import { DiffAnalysis } from './diff-guard';
import { VerificationReport } from '../verification/runner';
export interface CriticResult {
    status: 'PASS' | 'WARN' | 'BLOCK';
    findings: string[];
    requiredActions: string[];
    confidence: 'low' | 'medium' | 'high';
}
export declare function runCriticReview(contract: TaskContract, diffAnalysis: DiffAnalysis, verification: VerificationReport | null, config: JewelConfig): CriticResult;
