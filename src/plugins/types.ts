export type PluginType = 'verifier' | 'critic';

export interface JewelPluginManifest {
  name: string;
  version: string;
  type: PluginType;
  command: string;
  description?: string;
  blockOnFail?: boolean;
  timeoutMs?: number;
}

export interface PluginContext {
  cwd: string;
  task?: string;
  contract?: unknown;
  verification?: unknown;
  diffAnalysis?: unknown;
  diffContent?: string;
}

export interface PluginResult {
  status: 'PASS' | 'WARN' | 'BLOCK' | 'FAIL';
  findings: string[];
  requiredActions?: string[];
}
