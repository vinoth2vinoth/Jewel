export type AgentToolName = 'list_dir' | 'glob' | 'grep' | 'read_file';

export interface ToolLoopDecision {
  action: 'tool' | 'done';
  tool?: AgentToolName;
  args?: Record<string, string | number | boolean>;
  reason: string;
  summary?: string;
}

export interface ToolStepRecord {
  step: number;
  decision: ToolLoopDecision;
  result: string;
  success: boolean;
  durationMs: number;
}

export interface ToolLoopInput {
  task: string;
  cwd: string;
  config: import('../../core/config').JewelConfig;
  sessionPath?: string;
  step: number;
  maxSteps: number;
  priorSteps: ToolStepRecord[];
  initialFiles: string[];
}

export interface ToolLoopResult {
  context: string;
  discoveredFiles: string[];
  steps: ToolStepRecord[];
  summary: string;
  stoppedReason: 'done' | 'max_steps' | 'budget' | 'error' | 'disabled';
}
