import { JewelConfig } from '../core/config';
import { TaskContract, generateLocalContract } from '../core/session';
import { Skill } from '../skills/loader';
import { VerificationReport } from '../verification/runner';
import type { CriticResult } from '../safety/critic';

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
  testCriticResult?: TestCriticResult;
  config?: JewelConfig;
  sessionPath?: string;
  customHint?: string;
  criticResult?: CriticResult;
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
  criticType?: 'security' | 'linter' | 'architect';
}

export interface ReviewResult {
  status: 'PASS' | 'WARN' | 'BLOCK';
  findings: string[];
}

export interface TestCriticResult {
  verdict: 'BAD_GENERATED_TEST' | 'BAD_IMPLEMENTATION' | 'FLAKY_TEST_SUSPECT' | 'ENVIRONMENT_FAILURE' | 'INSUFFICIENT_CONTEXT' | 'UNKNOWN';
  confidence: 'high' | 'medium' | 'low';
  explanation: string;
  suspectedRootCause: string;
  suggestedFix: string;
  canAutoRetry: boolean;
  requiresHumanReview: boolean;
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
  reviewTestCorrectness?(input: ReviewInput): Promise<TestCriticResult>;
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
      this.usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUsd: 0.0 };
    }
    this.usage.inputTokens = (this.usage.inputTokens || 0) + 100;
    this.usage.outputTokens = (this.usage.outputTokens || 0) + 50;
    this.usage.totalTokens = (this.usage.totalTokens || 0) + 150;
    this.usage.estimatedCostUsd = (this.usage.estimatedCostUsd || 0) + 0.05;
  }

  private checkBudget(config?: any) {
    const maxSessionCost = config?.maxSessionCost;
    if (maxSessionCost !== undefined && maxSessionCost > 0) {
      const currentCost = this.usage?.estimatedCostUsd || 0;
      if (currentCost > maxSessionCost) {
        throw new Error(`[Jewel Budget Guard] Session cost limit exceeded: Current cost $${currentCost.toFixed(4)} exceeds maximum allowed budget of $${maxSessionCost.toFixed(2)}.`);
      }
    }
  }

  async plan(input: PlanInput): Promise<TaskContract> {
    this.accumulateMockUsage();
    this.checkBudget(input.config);
    const files = input.filesNeeded && input.filesNeeded.length > 0 ? input.filesNeeded : ['src/index.ts'];
    const contract = generateLocalContract(input.task, input.config, files);
    contract.understanding = `Mock understanding of: ${input.task}`;
    return contract;
  }

  async proposePatch(input: PatchInput): Promise<PatchProposal> {
    this.accumulateMockUsage();
    this.checkBudget(input.config);
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
    this.checkBudget(input.config);
    const criticName = input.criticType || 'security';
    return {
      status: 'PASS',
      findings: [`Mock agent review (${criticName}) passed successfully.`]
    };
  }

  async reviewTestCorrectness(input: ReviewInput): Promise<TestCriticResult> {
    this.accumulateMockUsage();
    this.checkBudget(input.config);
    return {
      verdict: 'BAD_IMPLEMENTATION',
      confidence: 'high',
      explanation: 'Mock analyzer explanation.',
      suspectedRootCause: 'Mock root cause.',
      suggestedFix: 'Mock suggested fix.',
      canAutoRetry: true,
      requiresHumanReview: false
    };
  }
}
