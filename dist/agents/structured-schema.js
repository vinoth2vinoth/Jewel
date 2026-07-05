"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestCriticResultSchema = exports.ReviewResultSchema = exports.PatchProposalSchema = exports.TaskContractSchema = exports.ToolLoopDecisionSchema = void 0;
const tool_loop_schema_1 = require("./tool-loop-schema");
Object.defineProperty(exports, "ToolLoopDecisionSchema", { enumerable: true, get: function () { return tool_loop_schema_1.ToolLoopDecisionSchema; } });
exports.TaskContractSchema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'TaskContract',
    type: 'object',
    properties: {
        task: { type: 'string', description: 'The original task description' },
        understanding: { type: 'string', description: 'Agent understanding of the task requirements' },
        assumptions: {
            type: 'array',
            items: { type: 'string' },
            description: 'Key assumptions made by the agent'
        },
        filesLikelyNeeded: {
            type: 'array',
            items: { type: 'string' },
            description: 'Files in scope that are likely to be created or edited'
        },
        forbiddenActions: {
            type: 'array',
            items: { type: 'string' },
            description: 'Actions specifically forbidden for this run'
        },
        successCriteria: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            description: 'List of verifiable conditions that indicate success'
        },
        riskLevel: {
            type: 'string',
            enum: ['low', 'medium', 'high'],
            description: 'Calculated risk level of the proposed task'
        },
        requiresApproval: {
            type: 'boolean',
            description: 'Whether human diff approval is mandatory before final verification'
        },
        createdAt: { type: 'string', description: 'Timestamp when contract was generated' },
        mode: {
            type: 'string',
            enum: ['strict', 'lax'],
            description: 'Configuration-enforced mode'
        },
        estimatedFilesChangedCount: {
            type: 'integer',
            description: 'Estimated number of files that will be modified or created by the patch'
        },
        estimatedLinesChangedCount: {
            type: 'integer',
            description: 'Estimated total lines (additions + deletions) that will be modified/added/created by the patch'
        },
        preserveExistingTests: {
            type: 'boolean',
            description: 'Set to true if the user instructs to keep existing tests exactly as they are'
        },
        allowedSymbolChanges: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of specific class/function/type names or signatures allowed to be deleted or modified'
        }
    },
    required: [
        'task',
        'understanding',
        'assumptions',
        'filesLikelyNeeded',
        'forbiddenActions',
        'successCriteria',
        'riskLevel',
        'requiresApproval',
        'createdAt',
        'mode'
    ],
    additionalProperties: false
};
exports.PatchProposalSchema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'PatchProposal',
    type: 'object',
    properties: {
        summary: { type: 'string', description: 'Explanation of the changes applied' },
        files: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    filePath: { type: 'string', description: 'Relative path of the target file' },
                    content: { type: 'string', description: 'Full new contents of the target file' },
                    reason: { type: 'string', description: 'Detailed rationale for editing or creating this file' }
                },
                required: ['filePath', 'content', 'reason'],
                additionalProperties: false
            },
            description: 'List of proposed file modifications'
        },
        notes: {
            type: 'array',
            items: { type: 'string' },
            description: 'Important notes or reminders about the applied changes'
        },
        riskLevel: {
            type: 'string',
            enum: ['low', 'medium', 'high'],
            description: 'Risk assessment of the proposed patch'
        },
        noChangeNeeded: {
            type: 'boolean',
            description: 'Indicates that the task requires no changes to be made to the files'
        },
        noChangeReason: {
            type: 'string',
            description: 'Explanation for why no changes are required'
        },
        usage: {
            type: 'object',
            properties: {
                inputTokens: { type: 'number' },
                outputTokens: { type: 'number' },
                totalTokens: { type: 'number' }
            },
            additionalProperties: true
        }
    },
    required: ['summary', 'files', 'notes', 'riskLevel'],
    additionalProperties: false
};
exports.ReviewResultSchema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'ReviewResult',
    type: 'object',
    properties: {
        status: {
            type: 'string',
            enum: ['PASS', 'WARN', 'BLOCK'],
            description: 'Final status of the review'
        },
        findings: {
            type: 'array',
            items: { type: 'string' },
            description: 'Surgical findings from analyzing proposed changes'
        }
    },
    required: ['status', 'findings'],
    additionalProperties: false
};
exports.TestCriticResultSchema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'TestCriticResult',
    type: 'object',
    properties: {
        verdict: {
            type: 'string',
            enum: ['BAD_GENERATED_TEST', 'BAD_IMPLEMENTATION', 'FLAKY_TEST_SUSPECT', 'ENVIRONMENT_FAILURE', 'INSUFFICIENT_CONTEXT', 'UNKNOWN'],
            description: 'Verdict classifying the failure'
        },
        confidence: {
            type: 'string',
            enum: ['high', 'medium', 'low'],
            description: 'Critic confidence level'
        },
        explanation: {
            type: 'string',
            description: 'Detailed analysis of why the tests failed'
        },
        suspectedRootCause: {
            type: 'string',
            description: 'The suspected root cause of the verification failure'
        },
        suggestedFix: {
            type: 'string',
            description: 'Suggested fix to resolve the problem'
        },
        canAutoRetry: {
            type: 'boolean',
            description: 'Whether it is safe to automatically retry and fix based on this feedback'
        },
        requiresHumanReview: {
            type: 'boolean',
            description: 'Whether human intervention is required to resolve this failure'
        }
    },
    required: ['verdict', 'confidence', 'explanation', 'suspectedRootCause', 'suggestedFix', 'canAutoRetry', 'requiresHumanReview'],
    additionalProperties: false
};
