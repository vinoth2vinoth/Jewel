import { JewelConfig } from '../core/config';
export interface PolicyResult {
    allowed: boolean;
    reason?: string;
}
export declare function checkCommandPolicy(commandLine: string, config: JewelConfig): PolicyResult;
export declare function redactSecrets(text: string): string;
