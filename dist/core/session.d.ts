import { JewelConfig } from './config';
export interface TaskContract {
    task: string;
    understanding: string;
    assumptions: string[];
    filesLikelyNeeded: string[];
    forbiddenActions: string[];
    successCriteria: string[];
    riskLevel: 'low' | 'medium' | 'high';
    requiresApproval: boolean;
    createdAt: string;
    mode: 'strict' | 'lax';
}
export declare function validateContract(contract: any): string[];
export declare function assessRiskLevel(task: string, filesNeeded: string[], config: JewelConfig): 'low' | 'medium' | 'high';
export declare function generateLocalContract(task: string, config: JewelConfig, filesNeeded?: string[]): TaskContract;
export declare function createSession(task: string, config: JewelConfig, filesNeeded?: string[], cwd?: string): {
    sessionId: string;
    sessionPath: string;
    contractPath: string;
};
