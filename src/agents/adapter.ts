import { JewelConfig } from '../core/config';
import { TaskContract, generateLocalContract } from '../core/session';
import { Skill } from '../skills/loader';
import { VerificationReport } from '../verification/runner';

export interface PlanInput {
  task: string;
  repoSummary: string;
  config: JewelConfig;
  skills: Skill[];
  sessionPath?: string;
  filesNeeded?: string[];
}

export interface PatchInput {
  taskContract: TaskContract;
  allowedFiles: string[];
  repoContext: string;
  verificationResult: VerificationReport | null;
  config?: JewelConfig;
  sessionPath?: string;
}

export interface PatchProposal {
  summary: string;
  files: {
    filePath: string;
    content: string;
    reason: string;
  }[];
  notes: string[];
  riskLevel: 'low' | 'medium' | 'high';
  noChangeNeeded?: boolean;
  noChangeReason?: string;
}

export interface ReviewInput {
  diff: string;
  verificationResult: VerificationReport | null;
  taskContract: TaskContract;
  config?: JewelConfig;
  sessionPath?: string;
}

export interface ReviewResult {
  status: 'PASS' | 'WARN' | 'BLOCK';
  findings: string[];
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMRequest {
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: { type: 'json_object' };
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface AgentAdapter {
  name: string;
  plan(input: PlanInput): Promise<TaskContract>;
  proposePatch(input: PatchInput): Promise<PatchProposal>;
  reviewDiff(input: ReviewInput): Promise<ReviewResult>;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    estimatedCostUsd?: number;
    retryCount?: number;
  };
}

export class MockAgentAdapter implements AgentAdapter {
  name = 'mock-agent';
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    estimatedCostUsd?: number;
    retryCount?: number;
  };

  private accumulateMockUsage() {
    if (!this.usage) {
      this.usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
    }
    this.usage.inputTokens = (this.usage.inputTokens || 0) + 100;
    this.usage.outputTokens = (this.usage.outputTokens || 0) + 50;
    this.usage.totalTokens = (this.usage.totalTokens || 0) + 150;
  }

  async plan(input: PlanInput): Promise<TaskContract> {
    this.accumulateMockUsage();
    const files = input.filesNeeded && input.filesNeeded.length > 0 ? input.filesNeeded : ['src/index.ts'];
    const contract = generateLocalContract(input.task, input.config, files);
    contract.understanding = `Mock understanding of: ${input.task}`;
    return contract;
  }

  async proposePatch(input: PatchInput): Promise<PatchProposal> {
    this.accumulateMockUsage();
    // Propose a simple edit to src/index.ts or the first filesLikelyNeeded
    const targetFile = input.taskContract.filesLikelyNeeded[0] || 'src/index.ts';
    let content = `// Mock implementation for: ${input.taskContract.task}\nconsole.log("Task executed successfully");\n`;
    
    if (targetFile.endsWith('math.ts')) {
      content = `export function add(a: number, b: number): number {
  return a + b;
}

export function divide(a: number, b: number): number {
  if (b === 0) {
    throw new Error("Cannot divide by zero");
  }
  return a / b;
}
`;
    } else if (targetFile.endsWith('math.js')) {
      content = `// Mock implementation for: ${input.taskContract.task}
function add(a, b) {
  return a + b;
}

function divide(a, b) {
  if (b === 0) {
    throw new Error("Cannot divide by zero");
  }
  return a / b;
}

module.exports = { add, divide };
`;
    }

    return {
      summary: `Successfully proposed patch for file ${targetFile}.`,
      files: [
        {
          filePath: targetFile,
          content,
          reason: 'Required file implementation'
        }
      ],
      notes: ['Mock adapter notes'],
      riskLevel: 'low'
    };
  }

  async reviewDiff(input: ReviewInput): Promise<ReviewResult> {
    this.accumulateMockUsage();
    return {
      status: 'PASS',
      findings: ['Mock agent review passed successfully.']
    };
  }
}
