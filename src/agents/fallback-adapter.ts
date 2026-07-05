import { AgentAdapter, PlanInput, PatchInput, ReviewInput, PatchProposal, ReviewResult, TestCriticResult, MilestoneGenerationInput } from './adapter';
import { TaskContract } from '../core/session';
import { JewelConfig } from '../core/config';
import { CAPABILITY_REGISTRY } from './model-capabilities';
import { ToolLoopDecision, ToolLoopInput } from './tools/types';

export interface FallbackChainEntry {
  provider: string;
  create: () => AgentAdapter;
}

const CONNECTION_ERROR_PATTERNS = [
  /ECONNREFUSED/i,
  /ECONNRESET/i,
  /ETIMEDOUT/i,
  /ENOTFOUND/i,
  /EAI_AGAIN/i,
  /fetch failed/i,
  /network/i,
  /timed? ?out/i,
  /socket hang up/i,
  /HTTP 5\d\d/,
  /status(?: code)? 5\d\d/i,
  /status(?: code)? 429/i,
  /HTTP 429/,
  /rate limit/i,
  /overloaded/i,
  /service unavailable/i
];

/** Only availability problems trigger fallback — never schema or safety blocks. */
export function isConnectionFailure(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.startsWith('BLOCKED:')) return false;
  return CONNECTION_ERROR_PATTERNS.some(p => p.test(msg));
}

/**
 * Wraps a chain of provider adapters. Calls go to the first provider; on a
 * connection failure the next provider in the chain is tried with its own
 * default model. Opt-in via the `preferredProviders` config field.
 */
export class FallbackAgentAdapter implements AgentAdapter {
  name: string;
  private chain: FallbackChainEntry[];
  private instances: (AgentAdapter | null)[];
  private activeIndex = 0;

  constructor(chain: FallbackChainEntry[]) {
    if (chain.length === 0) {
      throw new Error('FallbackAgentAdapter requires at least one provider in the chain.');
    }
    this.chain = chain;
    this.instances = chain.map(() => null);
    this.name = `fallback(${chain.map(c => c.provider).join(' -> ')})`;
  }

  get usage(): AgentAdapter['usage'] {
    const merged = { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUsd: 0, retryCount: 0 };
    let any = false;
    for (const inst of this.instances) {
      const u = inst?.usage;
      if (!u) continue;
      any = true;
      merged.inputTokens += u.inputTokens || 0;
      merged.outputTokens += u.outputTokens || 0;
      merged.totalTokens += u.totalTokens || 0;
      merged.estimatedCostUsd += u.estimatedCostUsd || 0;
      merged.retryCount += u.retryCount || 0;
    }
    return any ? merged : undefined;
  }

  private adapterAt(index: number): AgentAdapter {
    let inst = this.instances[index];
    if (!inst) {
      inst = this.chain[index].create();
      this.instances[index] = inst;
    }
    return inst;
  }

  /** Rewrite config so the fallback provider uses its own default model. */
  private configFor(index: number, config: JewelConfig | undefined): JewelConfig | undefined {
    if (!config) return config;
    if (index === 0) return config;
    const provider = this.chain[index].provider;
    const registry = CAPABILITY_REGISTRY[provider];
    return {
      ...config,
      provider: provider as JewelConfig['provider'],
      model: registry ? registry.defaultModel : ''
    };
  }

  private async withFallback<T>(
    run: (adapter: AgentAdapter, index: number) => Promise<T>
  ): Promise<T> {
    let lastError: unknown = null;
    for (let i = this.activeIndex; i < this.chain.length; i++) {
      try {
        const result = await run(this.adapterAt(i), i);
        this.activeIndex = i;
        return result;
      } catch (err) {
        lastError = err;
        if (i + 1 < this.chain.length && isConnectionFailure(err)) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(`[Provider Fallback] ${this.chain[i].provider} unavailable (${msg.slice(0, 120)}). Trying ${this.chain[i + 1].provider}...`);
          continue;
        }
        throw err;
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  async plan(input: PlanInput): Promise<TaskContract> {
    return this.withFallback((adapter, i) =>
      adapter.plan({ ...input, config: this.configFor(i, input.config) as JewelConfig })
    );
  }

  async proposePatch(input: PatchInput): Promise<PatchProposal> {
    return this.withFallback((adapter, i) =>
      adapter.proposePatch({ ...input, config: this.configFor(i, input.config) })
    );
  }

  async reviewDiff(input: ReviewInput): Promise<ReviewResult> {
    return this.withFallback((adapter, i) =>
      adapter.reviewDiff({ ...input, config: this.configFor(i, input.config) })
    );
  }

  async reviewTestCorrectness(input: ReviewInput): Promise<TestCriticResult> {
    return this.withFallback((adapter, i) => {
      const inner = adapter.reviewTestCorrectness;
      if (!inner) {
        throw new Error(`Provider ${this.chain[i].provider} does not support test correctness review.`);
      }
      return inner.call(adapter, { ...input, config: this.configFor(i, input.config) });
    });
  }

  async decideToolStep(input: ToolLoopInput): Promise<ToolLoopDecision> {
    return this.withFallback((adapter, i) => {
      const inner = adapter.decideToolStep;
      if (!inner) {
        throw new Error(`Provider ${this.chain[i].provider} does not support the agent tool loop.`);
      }
      return inner.call(adapter, { ...input, config: this.configFor(i, (input as { config?: JewelConfig }).config) } as ToolLoopInput);
    });
  }

  async generateMilestones(input: MilestoneGenerationInput): Promise<unknown> {
    return this.withFallback((adapter, i) => {
      const inner = adapter.generateMilestones;
      if (!inner) {
        throw new Error(`Provider ${this.chain[i].provider} does not support milestone generation.`);
      }
      return inner.call(adapter, input);
    });
  }
}
