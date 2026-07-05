"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockAgentAdapter = void 0;
const session_1 = require("../core/session");
class MockAgentAdapter {
    name = 'mock-agent';
    usage;
    accumulateMockUsage() {
        if (!this.usage) {
            this.usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUsd: 0.0 };
        }
        this.usage.inputTokens = (this.usage.inputTokens || 0) + 100;
        this.usage.outputTokens = (this.usage.outputTokens || 0) + 50;
        this.usage.totalTokens = (this.usage.totalTokens || 0) + 150;
        this.usage.estimatedCostUsd = (this.usage.estimatedCostUsd || 0) + 0.05;
    }
    checkBudget(config) {
        const maxSessionCost = config?.maxSessionCost;
        if (maxSessionCost !== undefined && maxSessionCost > 0) {
            const currentCost = this.usage?.estimatedCostUsd || 0;
            if (currentCost > maxSessionCost) {
                throw new Error(`[Jewel Budget Guard] Session cost limit exceeded: Current cost $${currentCost.toFixed(4)} exceeds maximum allowed budget of $${maxSessionCost.toFixed(2)}.`);
            }
        }
    }
    async plan(input) {
        this.accumulateMockUsage();
        this.checkBudget(input.config);
        const files = input.filesNeeded && input.filesNeeded.length > 0 ? input.filesNeeded : ['src/index.ts'];
        const contract = (0, session_1.generateLocalContract)(input.task, input.config, files);
        contract.understanding = `Mock understanding of: ${input.task}`;
        return contract;
    }
    async generateMilestones(input) {
        this.accumulateMockUsage();
        return [
            `Implement the core feature: ${input.goal}`,
            `Add tests covering: ${input.goal}`
        ].slice(0, input.maxMilestones);
    }
    async decideToolStep(input) {
        this.accumulateMockUsage();
        this.checkBudget(input.config);
        if (input.step === 1) {
            return { action: 'tool', tool: 'list_dir', args: { dir: 'src', maxDepth: 2 }, reason: 'List source directory' };
        }
        if (input.step === 2) {
            const query = input.task.toLowerCase().includes('math') ? 'divide' : 'function';
            return { action: 'tool', tool: 'grep', args: { query, filePattern: 'src/**/*.ts' }, reason: `Grep for "${query}"` };
        }
        const implFile = input.initialFiles.find(f => f.includes('src/') && !f.includes('.test.') && (f.endsWith('.ts') || f.endsWith('.js')));
        const alreadyRead = input.priorSteps.some(s => s.decision.tool === 'read_file' && s.decision.args?.path === implFile);
        if (input.step === 3 && implFile && !alreadyRead) {
            return { action: 'tool', tool: 'read_file', args: { path: implFile }, reason: `Read ${implFile}` };
        }
        return {
            action: 'done',
            reason: 'Mock exploration complete',
            summary: `Reviewed source layout and key files for: ${input.task}`
        };
    }
    async proposePatch(input) {
        this.accumulateMockUsage();
        this.checkBudget(input.config);
        const candidates = input.taskContract.filesLikelyNeeded;
        const targetFile = candidates.find(f => f.endsWith('math.ts') || f.endsWith('math.js'))
            || candidates.find(f => f.replace(/\\/g, '/').includes('src/') && !f.includes('.test.'))
            || candidates[0]
            || 'src/index.ts';
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
        }
        else if (targetFile.endsWith('math.js')) {
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
    async reviewDiff(input) {
        this.accumulateMockUsage();
        this.checkBudget(input.config);
        const criticName = input.criticType || 'security';
        return {
            status: 'PASS',
            findings: [`Mock agent review (${criticName}) passed successfully.`]
        };
    }
    async reviewTestCorrectness(input) {
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
exports.MockAgentAdapter = MockAgentAdapter;
