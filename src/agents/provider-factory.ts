import { AgentAdapter, MockAgentAdapter } from './adapter';
import { OpenAIAdapter } from './providers/openai-adapter';
import { GeminiAdapter } from './providers/gemini-adapter';
import { AnthropicAdapter } from './providers/anthropic-adapter';
import { OpenRouterAdapter } from './providers/openrouter-adapter';
import { JewelConfig } from '../core/config';

export function createAgentAdapter(config: JewelConfig): AgentAdapter {
  const provider = config.provider || 'none';

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
    default:
      throw new Error(`Unknown or invalid provider configured: "${provider}".`);
  }
}
