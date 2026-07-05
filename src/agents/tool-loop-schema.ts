export const ToolLoopDecisionSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'ToolLoopDecision',
  type: 'object',
  properties: {
    action: { type: 'string', enum: ['tool', 'done'] },
    tool: { type: 'string', enum: ['list_dir', 'glob', 'grep', 'read_file'] },
    args: {
      type: 'object',
      additionalProperties: true
    },
    reason: { type: 'string' },
    summary: { type: 'string' }
  },
  required: ['action', 'reason'],
  additionalProperties: false
};
