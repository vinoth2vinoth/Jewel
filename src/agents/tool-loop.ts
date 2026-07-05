import * as fs from 'fs';
import * as path from 'path';
import { JewelConfig } from '../core/config';
import { AgentAdapter } from './adapter';
import { extractJsonObject } from './json-response';
import { buildToolLoopPrompt } from './tool-loop-prompt';
import { executeAgentTool, isAllowedTool } from './tools/registry';
import { ToolLoopDecision, ToolLoopInput, ToolLoopResult, ToolStepRecord } from './tools/types';
import { extractTaskKeywords } from '../exploration/repo-explorer';

export function validateToolLoopDecision(input: unknown): ToolLoopDecision {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Invalid ToolLoopDecision: must be an object.');
  }
  const obj = input as Record<string, unknown>;

  if (obj.action !== 'tool' && obj.action !== 'done') {
    throw new Error('Invalid ToolLoopDecision: "action" must be "tool" or "done".');
  }
  if (typeof obj.reason !== 'string' || obj.reason.trim() === '') {
    throw new Error('Invalid ToolLoopDecision: "reason" is required.');
  }

  if (obj.action === 'tool') {
    if (typeof obj.tool !== 'string' || !isAllowedTool(obj.tool)) {
      throw new Error('Invalid ToolLoopDecision: "tool" must be list_dir, glob, grep, or read_file when action is tool.');
    }
    if (obj.args !== undefined && (typeof obj.args !== 'object' || Array.isArray(obj.args) || obj.args === null)) {
      throw new Error('Invalid ToolLoopDecision: "args" must be an object.');
    }
  }

  if (obj.action === 'done') {
    if (typeof obj.summary !== 'string' || obj.summary.trim() === '') {
      throw new Error('Invalid ToolLoopDecision: "summary" is required when action is done.');
    }
  }

  return obj as unknown as ToolLoopDecision;
}

function truncateContext(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + '\n[... exploration context truncated ...]';
}

function mergeDiscoveredFiles(existing: string[], found: string[]): string[] {
  const set = new Set(existing.map(f => f.replace(/\\/g, '/')));
  for (const f of found) {
    set.add(f.replace(/\\/g, '/'));
  }
  return Array.from(set);
}

function buildContextFromSteps(steps: ToolStepRecord[]): string {
  return steps.map(s => {
    const header = s.decision.action === 'tool'
      ? `=== Tool: ${s.decision.tool} (step ${s.step}) ===`
      : `=== Exploration complete (step ${s.step}) ===`;
    return `${header}\nReason: ${s.decision.reason}\n${s.result}`;
  }).join('\n\n');
}

/** Deterministic exploration when LLM tool selection is unavailable. */
export function heuristicToolDecision(input: ToolLoopInput): ToolLoopDecision {
  const step = input.step;
  const keywords = extractTaskKeywords(input.task);

  if (step === 1) {
    return { action: 'tool', tool: 'list_dir', args: { dir: 'src', maxDepth: 3 }, reason: 'Survey source tree' };
  }
  if (step === 2 && keywords.length > 0) {
    return { action: 'tool', tool: 'grep', args: { query: keywords[0], filePattern: 'src/**/*.ts' }, reason: `Search for keyword "${keywords[0]}"` };
  }
  const readCandidates = input.initialFiles.filter(f => !f.includes('.test.'));
  const unread = readCandidates.find(f => !input.priorSteps.some(s => s.result.includes(`=== File: ${f}`) || s.decision.args?.path === f));
  if (step <= 5 && unread) {
    return { action: 'tool', tool: 'read_file', args: { path: unread }, reason: `Read implementation file ${unread}` };
  }
  return {
    action: 'done',
    reason: 'Heuristic exploration complete',
    summary: `Explored ${input.priorSteps.length} steps. Initial files: ${input.initialFiles.join(', ')}`
  };
}

export async function requestToolLoopDecision(
  adapter: AgentAdapter,
  input: ToolLoopInput
): Promise<ToolLoopDecision> {
  if (adapter.decideToolStep) {
    return adapter.decideToolStep(input);
  }
  return heuristicToolDecision(input);
}

export interface RunAgentToolLoopOptions {
  task: string;
  cwd: string;
  config: JewelConfig;
  adapter: AgentAdapter | null;
  sessionPath: string;
  initialFiles: string[];
  onStep?: (record: ToolStepRecord) => void;
}

export async function runAgentToolLoop(options: RunAgentToolLoopOptions): Promise<ToolLoopResult> {
  const { task, cwd, config, adapter, sessionPath, initialFiles, onStep } = options;

  if (config.agentToolLoopEnabled === false) {
    return {
      context: '',
      discoveredFiles: initialFiles,
      steps: [],
      summary: 'Tool loop disabled by configuration.',
      stoppedReason: 'disabled'
    };
  }

  const maxSteps = config.agentToolLoopMaxSteps ?? 8;
  const maxContextChars = config.agentToolLoopMaxContextChars ?? 80_000;
  const steps: ToolStepRecord[] = [];
  let discoveredFiles = [...initialFiles];
  let summary = '';
  let stoppedReason: ToolLoopResult['stoppedReason'] = 'max_steps';

  console.log(`\n[Tool Loop] Starting exploration (max ${maxSteps} steps)...`);

  for (let step = 1; step <= maxSteps; step++) {
    const input: ToolLoopInput = {
      task,
      cwd,
      config,
      sessionPath,
      step,
      maxSteps,
      priorSteps: steps,
      initialFiles: discoveredFiles
    };

    let decision: ToolLoopDecision;
    try {
      decision = adapter
        ? await requestToolLoopDecision(adapter, input)
        : heuristicToolDecision(input);
      decision = validateToolLoopDecision(decision);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('[Jewel Budget Guard]')) {
        stoppedReason = 'budget';
        break;
      }
      decision = heuristicToolDecision(input);
    }

    if (decision.action === 'done') {
      summary = decision.summary || decision.reason;
      steps.push({
        step,
        decision,
        result: summary,
        success: true,
        durationMs: 0
      });
      onStep?.(steps[steps.length - 1]);
      console.log(`[Tool Loop] Step ${step}: done — ${decision.reason}`);
      stoppedReason = 'done';
      break;
    }

    const start = Date.now();
    const tool = decision.tool!;
    const { output, discoveredFiles: found } = executeAgentTool(tool, decision.args as Record<string, string | number | boolean>, cwd);
    discoveredFiles = mergeDiscoveredFiles(discoveredFiles, found);

    const record: ToolStepRecord = {
      step,
      decision,
      result: output,
      success: !output.startsWith('Error:'),
      durationMs: Date.now() - start
    };
    steps.push(record);
    onStep?.(record);
    console.log(`[Tool Loop] Step ${step}: ${tool} — ${decision.reason} (${record.durationMs}ms)`);
  }

  const context = truncateContext(buildContextFromSteps(steps), maxContextChars);

  const memory = {
    task,
    stoppedReason,
    summary: summary || `Completed ${steps.length} exploration step(s).`,
    discoveredFiles,
    steps: steps.map(s => ({
      step: s.step,
      action: s.decision.action,
      tool: s.decision.tool,
      args: s.decision.args,
      reason: s.decision.reason,
      success: s.success,
      durationMs: s.durationMs,
      resultPreview: s.result.slice(0, 500)
    })),
    date: new Date().toISOString()
  };

  try {
    fs.writeFileSync(path.join(sessionPath, 'exploration-log.json'), JSON.stringify(memory, null, 2), 'utf8');
    const md = [
      `# Exploration Log`,
      ``,
      `**Task:** ${task}`,
      `**Stopped:** ${stoppedReason}`,
      `**Summary:** ${memory.summary}`,
      ``,
      `## Discovered Files`,
      ...discoveredFiles.map(f => `- ${f}`),
      ``,
      `## Steps`,
      ...steps.map(s => `### Step ${s.step}: ${s.decision.tool || 'done'}\n${s.decision.reason}\n\`\`\`\n${s.result.slice(0, 1500)}\n\`\`\``)
    ].join('\n');
    fs.writeFileSync(path.join(sessionPath, 'exploration-log.md'), md, 'utf8');
  } catch {}

  console.log(`[Tool Loop] Finished (${stoppedReason}). ${discoveredFiles.length} file(s) in scope.`);

  return {
    context,
    discoveredFiles,
    steps,
    summary: memory.summary,
    stoppedReason
  };
}
