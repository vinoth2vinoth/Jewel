"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockAgentAdapter = void 0;
const session_1 = require("../core/session");
class MockAgentAdapter {
    name = 'mock-agent';
    usage;
    accumulateMockUsage() {
        if (!this.usage) {
            this.usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
        }
        this.usage.inputTokens = (this.usage.inputTokens || 0) + 100;
        this.usage.outputTokens = (this.usage.outputTokens || 0) + 50;
        this.usage.totalTokens = (this.usage.totalTokens || 0) + 150;
    }
    async plan(input) {
        this.accumulateMockUsage();
        const files = input.filesNeeded && input.filesNeeded.length > 0 ? input.filesNeeded : ['src/index.ts'];
        const contract = (0, session_1.generateLocalContract)(input.task, input.config, files);
        contract.understanding = `Mock understanding of: ${input.task}`;
        return contract;
    }
    async proposePatch(input) {
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
        return {
            status: 'PASS',
            findings: ['Mock agent review passed successfully.']
        };
    }
    async reviewTestCorrectness(input) {
        this.accumulateMockUsage();
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
