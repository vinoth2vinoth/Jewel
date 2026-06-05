import { TaskContract } from '../core/session';
import { PatchProposal, ReviewResult, TestCriticResult } from './adapter';
export declare function assertNoForbiddenExecutionFields(input: unknown): void;
export declare function extractJsonObject(raw: string): unknown;
export declare function validateTaskContractJson(input: unknown): TaskContract;
export declare function validatePatchProposalJson(input: unknown): PatchProposal;
export declare function validateReviewResultJson(input: unknown): ReviewResult;
export declare function validateTestCriticResultJson(input: unknown): TestCriticResult;
