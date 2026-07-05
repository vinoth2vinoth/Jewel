import { ToolLoopInput } from './tools/types';
import { formatToolCatalog } from './tools/registry';

export function buildToolLoopPrompt(input: ToolLoopInput): string {
  const prior = input.priorSteps.length === 0
    ? 'No tool calls yet.'
    : input.priorSteps.map(s =>
        `Step ${s.step}: ${s.decision.action === 'tool' ? s.decision.tool : 'done'} — ${s.success ? 'OK' : 'FAIL'}\n${s.result.slice(0, 2000)}`
      ).join('\n\n');

  return `You are an AI coding agent exploring a repository inside Jewel's safety harness.
Your job is to gather context about the codebase BEFORE planning or editing files.

CRITICAL RULES:
- Return strict JSON only.
- You may NOT run shell commands, edit files, or access paths outside the workspace.
- Use read-only exploration tools only.
- Prefer surgical exploration: list_dir → grep → read_file on likely implementation files.
- Stop as soon as you have enough context to implement the task (action: "done").
- Maximum ${input.maxSteps} steps total. Current step: ${input.step}.

Available tools:
${formatToolCatalog()}

Initial file hints: ${input.initialFiles.join(', ') || '(none)'}

Task:
${input.task}

Prior tool results:
${prior}

Respond with JSON:
{
  "action": "tool" | "done",
  "tool": "list_dir" | "glob" | "grep" | "read_file",
  "args": { "key": "value" },
  "reason": "why this tool call or why exploration is complete",
  "summary": "when action is done, concise summary of findings for the planner"
}

When action is "tool", tool and args are required.
When action is "done", summary is required.`;
}
