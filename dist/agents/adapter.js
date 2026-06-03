"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockAgentAdapter = void 0;
const session_1 = require("../core/session");
class MockAgentAdapter {
    name = 'mock-agent';
    async plan(input) {
        const contract = (0, session_1.generateLocalContract)(input.task, input.config, ['src/index.ts']);
        contract.understanding = `Mock understanding of: ${input.task}`;
        return contract;
    }
    async proposePatch(input) {
        // Propose a simple edit to src/index.ts or the first filesLikelyNeeded
        const targetFile = input.taskContract.filesLikelyNeeded[0] || 'src/index.ts';
        let content = `// Mock implementation for: ${input.taskContract.task}\nconsole.log("Task executed successfully");\n`;
        if (targetFile.endsWith('math.js')) {
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
            files: [
                {
                    filePath: targetFile,
                    content
                }
            ],
            explanation: `Successfully proposed patch for file ${targetFile}.`
        };
    }
    async reviewDiff(input) {
        return {
            status: 'PASS',
            findings: ['Mock agent review passed successfully.']
        };
    }
}
exports.MockAgentAdapter = MockAgentAdapter;
