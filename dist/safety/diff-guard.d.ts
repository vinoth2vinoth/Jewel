import { JewelConfig } from '../core/config';
import { CheckpointMetadata } from '../storage/git';
export interface DiffAnalysis {
    status: 'PASS' | 'WARN' | 'BLOCK';
    changedFilesCount: number;
    addedLinesCount: number;
    removedLinesCount: number;
    changedFiles: string[];
    protectedFilesChanged: string[];
    dependenciesChanged: boolean;
    lockfilesChanged: string[];
    findings: string[];
}
export declare function runDiffGuard(checkpoint: CheckpointMetadata, config: JewelConfig, cwd?: string, allowedSymbolChanges?: string[]): DiffAnalysis;
