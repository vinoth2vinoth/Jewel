import { PlanInput, PatchInput, ReviewInput } from './adapter';
import { VerificationReport } from '../verification/runner';
export declare function formatVerificationResult(report: VerificationReport | null, fallback?: string): string;
export declare function buildPlanningPrompt(input: PlanInput): string;
export declare function buildPatchProposalPrompt(input: PatchInput): string;
export declare function buildDiffReviewPrompt(input: ReviewInput): string;
export declare function buildTestCriticPrompt(input: ReviewInput): string;
