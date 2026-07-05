import { JewelConfig } from '../core/config';
import { TaskContract } from '../core/session';
export interface BlockedFile {
    filePath: string;
    reason: string;
}
export interface SafePatchResult {
    success: boolean;
    appliedFiles: string[];
    blockedFiles: BlockedFile[];
}
export declare function applySearchReplaceEdits(originalContent: string, edits: Array<{
    search: string;
    replace: string;
}>): {
    content: string;
    error?: string;
};
export declare function applyPatchProposalSafely(patchProposal: any, taskContract: TaskContract, config: JewelConfig, cwd?: string, sessionPath?: string): SafePatchResult;
