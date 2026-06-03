export const TaskContractSchema = {
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

export const PatchProposalSchema = {
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

export const ReviewResultSchema = {
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
