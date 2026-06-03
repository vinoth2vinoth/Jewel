import { JewelConfig } from '../core/config';
import { TaskContract, generateLocalContract } from '../core/session';
import { Skill } from '../skills/loader';
import { VerificationReport } from '../verification/runner';

export interface PlanInput {
  task: string;
  repoSummary: string;
  config: JewelConfig;
  skills: Skill[];
}

export interface PatchInput {
  taskContract: TaskContract;
  allowedFiles: string[];
  repoContext: string;
  verificationResult: VerificationReport | null;
}

export interface PatchProposal {
  files: { filePath: string; content: string }[];
  explanation: string;
}

export interface ReviewInput {
  diff: string;
  verificationResult: VerificationReport | null;
  taskContract: TaskContract;
}

export interface ReviewResult {
  status: 'PASS' | 'WARN' | 'BLOCK';
  findings: string[];
}

export interface AgentAdapter {
  name: string;
  plan(input: PlanInput): Promise<TaskContract>;
  proposePatch(input: PatchInput): Promise<PatchProposal>;
  reviewDiff(input: ReviewInput): Promise<ReviewResult>;
}

export class MockAgentAdapter implements AgentAdapter {
  name = 'mock-agent';

  async plan(input: PlanInput): Promise<TaskContract> {
    const contract = generateLocalContract(input.task, input.config, ['src/index.ts']);
    contract.understanding = `Mock understanding of: ${input.task}`;
    return contract;
  }

  async proposePatch(input: PatchInput): Promise<PatchProposal> {
    // Propose a simple edit to src/index.ts or the first filesLikelyNeeded
    const targetFile = input.taskContract.filesLikelyNeeded[0] || 'src/index.ts';
    return {
      files: [
        {
          filePath: targetFile,
          content: `// Mock implementation for: ${input.taskContract.task}\nconsole.log("Task executed successfully");\n`
        }
      ],
      explanation: `Successfully proposed patch for file ${targetFile}.`
    };
  }

  async reviewDiff(input: ReviewInput): Promise<ReviewResult> {
    return {
      status: 'PASS',
      findings: ['Mock agent review passed successfully.']
    };
  }
}
