import * as fs from 'fs';
import * as path from 'path';
import { Milestone, validateMilestones } from './milestones';

export interface BuildState {
  goal: string;
  source: 'blueprint' | 'llm' | 'heuristic';
  createdAt: string;
  updatedAt: string;
  status: 'in_progress' | 'completed' | 'paused';
  milestones: Milestone[];
  totalCostUsd: number;
  totalTokens: number;
}

export interface MilestoneRunUsage {
  totalTokens?: number;
  estimatedCostUsd?: number;
}

export interface MilestoneRunOutcome {
  ok: boolean;
  sessionId?: string;
  status?: string;
  error?: string;
  usage?: MilestoneRunUsage;
}

function buildDir(cwd: string): string {
  return path.join(cwd, '.jewel', 'build');
}

function statePath(cwd: string): string {
  return path.join(buildDir(cwd), 'state.json');
}

export function loadBuildState(cwd: string): BuildState | null {
  const file = statePath(cwd);
  if (!fs.existsSync(file)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    const validated = validateMilestones(parsed.milestones);
    if (!validated.valid) return null;
    // Preserve persisted statuses/session ids that validation resets
    const byTitle = new Map<string, Milestone>();
    for (const m of Array.isArray(parsed.milestones) ? parsed.milestones : []) {
      if (m && typeof m.title === 'string') byTitle.set(m.title.trim().toLowerCase(), m);
    }
    for (const m of validated.milestones) {
      const orig = byTitle.get(m.title.toLowerCase());
      if (orig) {
        if (orig.status === 'completed' || orig.status === 'failed') m.status = orig.status;
        if (typeof orig.sessionId === 'string') m.sessionId = orig.sessionId;
        if (typeof orig.error === 'string') m.error = orig.error;
      }
    }
    return {
      goal: typeof parsed.goal === 'string' ? parsed.goal : '',
      source: parsed.source === 'blueprint' || parsed.source === 'llm' ? parsed.source : 'heuristic',
      createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : new Date().toISOString(),
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
      status: parsed.status === 'completed' || parsed.status === 'paused' ? parsed.status : 'in_progress',
      milestones: validated.milestones,
      totalCostUsd: typeof parsed.totalCostUsd === 'number' ? parsed.totalCostUsd : 0,
      totalTokens: typeof parsed.totalTokens === 'number' ? parsed.totalTokens : 0
    };
  } catch {
    return null;
  }
}

export function saveBuildState(cwd: string, state: BuildState): void {
  fs.mkdirSync(buildDir(cwd), { recursive: true });
  state.updatedAt = new Date().toISOString();
  fs.writeFileSync(statePath(cwd), JSON.stringify(state, null, 2) + '\n', 'utf8');
}

export function createBuildState(
  goal: string,
  milestones: Milestone[],
  source: BuildState['source']
): BuildState {
  const now = new Date().toISOString();
  return {
    goal,
    source,
    createdAt: now,
    updatedAt: now,
    status: 'in_progress',
    milestones,
    totalCostUsd: 0,
    totalTokens: 0
  };
}

/** First milestone that is not completed (failed milestones are retried). */
export function nextMilestone(state: BuildState): Milestone | null {
  return state.milestones.find(m => m.status !== 'completed') || null;
}

export function writeBuildReport(cwd: string, state: BuildState): string {
  const completed = state.milestones.filter(m => m.status === 'completed').length;
  const lines = [
    `# Jewel Build Report`,
    ``,
    `**Goal:** ${state.goal || '(blueprint starter milestones)'}`,
    `**Milestone source:** ${state.source}`,
    `**Status:** ${state.status}`,
    `**Progress:** ${completed}/${state.milestones.length} milestones completed`,
    `**Total tokens:** ${state.totalTokens || 'n/a'}`,
    `**Estimated cost:** $${(state.totalCostUsd || 0).toFixed(4)}`,
    `**Started:** ${state.createdAt}`,
    `**Updated:** ${state.updatedAt}`,
    ``,
    `## Milestones`,
    ``
  ];
  for (const m of state.milestones) {
    const icon = m.status === 'completed' ? '[x]' : m.status === 'failed' ? '[!]' : '[ ]';
    lines.push(`- ${icon} **${m.id}.** ${m.title} (${m.status})`);
    if (m.sessionId) lines.push(`  - Session: ${m.sessionId}`);
    if (m.error) lines.push(`  - Error: ${m.error}`);
  }
  lines.push('');
  if (state.status === 'paused') {
    lines.push(`## Resume`, ``, 'Fix the issue above (or just retry), then run: `jewel build --resume`', '');
  }
  const reportPath = path.join(buildDir(cwd), 'report.md');
  fs.mkdirSync(buildDir(cwd), { recursive: true });
  fs.writeFileSync(reportPath, lines.join('\n'), 'utf8');
  return reportPath;
}

export type MilestoneExecutor = (milestone: Milestone, state: BuildState) => Promise<MilestoneRunOutcome>;

export interface OrchestrateResult {
  state: BuildState;
  ranMilestones: number;
  reportPath: string;
}

/**
 * Run milestones sequentially until done or a milestone fails.
 * The executor runs one milestone as a full runTask transaction.
 * State is persisted after every milestone so --resume can pick up.
 */
export async function orchestrateBuild(
  cwd: string,
  state: BuildState,
  executor: MilestoneExecutor
): Promise<OrchestrateResult> {
  let ranMilestones = 0;

  for (;;) {
    const milestone = nextMilestone(state);
    if (!milestone) {
      state.status = 'completed';
      break;
    }

    milestone.status = 'in_progress';
    saveBuildState(cwd, state);

    const outcome = await executor(milestone, state);
    ranMilestones++;

    if (outcome.usage) {
      state.totalTokens += outcome.usage.totalTokens || 0;
      state.totalCostUsd += outcome.usage.estimatedCostUsd || 0;
    }

    if (outcome.ok) {
      milestone.status = 'completed';
      milestone.sessionId = outcome.sessionId;
      milestone.error = undefined;
      saveBuildState(cwd, state);
    } else {
      milestone.status = 'failed';
      milestone.sessionId = outcome.sessionId;
      milestone.error = outcome.error || outcome.status || 'Unknown failure';
      state.status = 'paused';
      saveBuildState(cwd, state);
      break;
    }
  }

  saveBuildState(cwd, state);
  const reportPath = writeBuildReport(cwd, state);
  return { state, ranMilestones, reportPath };
}
