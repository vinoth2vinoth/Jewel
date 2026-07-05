import { AgentAdapter, MockAgentAdapter } from './adapter';
import { OpenAIAdapter } from './providers/openai-adapter';
import { GeminiAdapter } from './providers/gemini-adapter';
import { AnthropicAdapter } from './providers/anthropic-adapter';
import { OpenRouterAdapter } from './providers/openrouter-adapter';
import { DeepSeekAdapter } from './providers/deepseek-adapter';
import { FallbackAgentAdapter, FallbackChainEntry } from './fallback-adapter';
import { JewelConfig } from '../core/config';

function createSingleAdapter(provider: string): AgentAdapter {
  switch (provider) {
    case 'none':
      return new MockAgentAdapter();
    case 'openai':
      return new OpenAIAdapter();
    case 'gemini':
      return new GeminiAdapter();
    case 'anthropic':
      return new AnthropicAdapter();
    case 'openrouter':
      return new OpenRouterAdapter();
    case 'deepseek':
      return new DeepSeekAdapter();
    default:
      throw new Error(`Unknown or invalid provider configured: "${provider}".`);
  }
}

export function createAgentAdapter(config: JewelConfig): AgentAdapter {
  const provider = config.provider || 'none';

  // Opt-in provider fallback chain: primary provider first, then each
  // additional preferred provider, tried only on connection failures.
  const preferred = (config.preferredProviders || []).filter(
    p => p !== provider && p !== 'none' && ['openai', 'gemini', 'anthropic', 'openrouter', 'deepseek'].includes(p)
  );

  if (provider !== 'none' && preferred.length > 0) {
    const chain: FallbackChainEntry[] = [
      { provider, create: () => createSingleAdapter(provider) },
      ...preferred.map(p => ({ provider: p, create: () => createSingleAdapter(p) }))
    ];
    return new FallbackAgentAdapter(chain);
  }

  return createSingleAdapter(provider);
}
