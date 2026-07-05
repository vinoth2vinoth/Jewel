import * as fs from 'fs';
import * as path from 'path';
import { loadConfig } from '../../core/config';
import { createAgentAdapter } from '../../agents/provider-factory';
import { MockAgentAdapter, AgentAdapter } from '../../agents/adapter';
import { planMilestones, Milestone } from '../../orchestrator/milestones';
import {
  BuildState,
  MilestoneRunOutcome,
  createBuildState,
  loadBuildState,
  nextMilestone,
  orchestrateBuild
} from '../../orchestrator/build-runner';
import { runTask } from './run';

export interface BuildOptions {
  goal?: string;
  resume?: boolean;
  useMock?: boolean;
  yes?: boolean;
  maxMilestones?: number;
  provider?: string;
  model?: string;
  cwd?: string;
}

function readLatestRunReport(cwd: string): { sessionId?: string; status?: string; usage?: { totalTokens?: number; estimatedCostUsd?: number } } {
  const reportPath = path.join(cwd, '.jewel', 'reports', 'latest-run.json');
  if (!fs.existsSync(reportPath)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    const usage = parsed.usage && typeof parsed.usage === 'object'
      ? { totalTokens: parsed.usage.totalTokens, estimatedCostUsd: parsed.usage.estimatedCostUsd }
      : undefined;
    return { sessionId: parsed.sessionId, status: parsed.status, usage };
  } catch {
    return {};
  }
}

export async function runBuild(options: BuildOptions): Promise<void> {
  const cwd = options.cwd || process.cwd();

  try {
    loadConfig(cwd);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Error: ${msg}`);
    console.error('Tip: create a project first with "jewel create" or initialize with "jewel init".');
    process.exit(1);
  }

  let state: BuildState | null = null;

  if (options.resume) {
    state = loadBuildState(cwd);
    if (!state) {
      console.error('Error: No build state found at .jewel/build/state.json. Start a build first: jewel build "your project goal"');
      process.exit(1);
    }
    if (!nextMilestone(state)) {
      console.log('[+] Nothing to resume — all milestones are already completed.');
      return;
    }
    state.status = 'in_progress';
    console.log(`[+] Resuming build: "${state.goal || '(blueprint milestones)'}"`);
  } else {
    const existing = loadBuildState(cwd);
    if (existing && existing.status !== 'completed' && nextMilestone(existing)) {
      console.warn('[!] An unfinished build exists (.jewel/build/state.json). Use "jewel build --resume" to continue it, or delete the file to start over.');
      process.exit(1);
    }

    let adapter: AgentAdapter | null = null;
    if (options.useMock) {
      adapter = new MockAgentAdapter();
    } else {
      try {
        const cfg = loadConfig(cwd);
        if (options.provider) cfg.provider = options.provider as typeof cfg.provider;
        if (cfg.provider !== 'none') adapter = createAgentAdapter(cfg);
      } catch {
        adapter = null;
      }
    }

    const plan = await planMilestones(cwd, options.goal, adapter, options.maxMilestones);
    for (const w of plan.warnings) console.warn(`[!] ${w}`);

    console.log(`\n[+] Build plan (${plan.source}):`);
    plan.milestones.forEach(m => console.log(`  ${m.id}. ${m.title}`));
    console.log('');

    state = createBuildState(options.goal || '', plan.milestones, plan.source);
  }

  const executor = async (milestone: Milestone, currentState: BuildState): Promise<MilestoneRunOutcome> => {
    console.log(`\n=== Milestone ${milestone.id}/${currentState.milestones.length}: ${milestone.title} ===\n`);

    // If this milestone failed before, feed the failure context into the retry
    const retryOptions = milestone.error && milestone.sessionId
      ? { parentSessionId: milestone.sessionId, continuationFeedback: `Previous attempt failed with: ${milestone.error}. Fix the cause and complete the milestone.` }
      : {};

    try {
      await runTask(
        milestone.title,
        [],
        !!options.useMock,
        cwd,
        true, // yes: no interactive review inside an autonomous build
        false,
        false,
        options.provider || options.model
          ? { provider: options.provider, model: options.model }
          : undefined,
        false,
        false,
        { ...retryOptions, approvePlan: true, returnOutcome: true }
      );
      const report = readLatestRunReport(cwd);
      return { ok: true, sessionId: report.sessionId, status: report.status, usage: report.usage };
    } catch (err: unknown) {
      const report = readLatestRunReport(cwd);
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, sessionId: report.sessionId, status: report.status, error: msg, usage: report.usage };
    }
  };

  const result = await orchestrateBuild(cwd, state, executor);

  console.log('\n======================================');
  if (result.state.status === 'completed') {
    console.log('[+] Build completed! All milestones verified.');
  } else {
    const failed = result.state.milestones.find(m => m.status === 'failed');
    console.log(`[!] Build paused at milestone ${failed?.id}: ${failed?.title}`);
    console.log(`    Reason: ${failed?.error}`);
    console.log('    Continue with: jewel build --resume');
  }
  console.log(`Report: ${result.reportPath}`);
  console.log('======================================\n');

  if (result.state.status !== 'completed') {
    process.exit(1);
  }
}
