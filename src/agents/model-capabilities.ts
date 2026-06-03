export interface ModelCapabilities {
  supportsStructuredOutput: boolean;
  supportsUsage: boolean;
  supportsSystemPrompt: boolean;
  supportsTemperature: boolean;
  supportsMaxTokens: boolean;
  knownLimitations: string[];
}

export interface ProviderCapabilityRegistry {
  defaultModel: string;
  recommendedModels: string[];
  models: Record<string, ModelCapabilities>;
}

export const CAPABILITY_REGISTRY: Record<string, ProviderCapabilityRegistry> = {
  openai: {
    defaultModel: 'gpt-4o-mini',
    recommendedModels: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo'],
    models: {
      'gpt-4o-mini': {
        supportsStructuredOutput: true,
        supportsUsage: true,
        supportsSystemPrompt: true,
        supportsTemperature: true,
        supportsMaxTokens: true,
        knownLimitations: []
      },
      'gpt-4o': {
        supportsStructuredOutput: true,
        supportsUsage: true,
        supportsSystemPrompt: true,
        supportsTemperature: true,
        supportsMaxTokens: true,
        knownLimitations: []
      },
      'gpt-4-turbo': {
        supportsStructuredOutput: true,
        supportsUsage: true,
        supportsSystemPrompt: true,
        supportsTemperature: true,
        supportsMaxTokens: true,
        knownLimitations: []
      },
      'gpt-3.5-turbo': {
        supportsStructuredOutput: false,
        supportsUsage: true,
        supportsSystemPrompt: true,
        supportsTemperature: true,
        supportsMaxTokens: true,
        knownLimitations: ['Older model, does not support strict json_schema response format']
      },
      'gpt-4-custom': {
        supportsStructuredOutput: true,
        supportsUsage: true,
        supportsSystemPrompt: true,
        supportsTemperature: true,
        supportsMaxTokens: true,
        knownLimitations: []
      }
    }
  },
  gemini: {
    defaultModel: 'gemini-1.5-flash',
    recommendedModels: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash', 'gemini-2.5-flash'],
    models: {
      'gemini-1.5-flash': {
        supportsStructuredOutput: true,
        supportsUsage: true,
        supportsSystemPrompt: true,
        supportsTemperature: true,
        supportsMaxTokens: true,
        knownLimitations: []
      },
      'gemini-1.5-pro': {
        supportsStructuredOutput: true,
        supportsUsage: true,
        supportsSystemPrompt: true,
        supportsTemperature: true,
        supportsMaxTokens: true,
        knownLimitations: []
      },
      'gemini-2.0-flash': {
        supportsStructuredOutput: true,
        supportsUsage: true,
        supportsSystemPrompt: true,
        supportsTemperature: true,
        supportsMaxTokens: true,
        knownLimitations: []
      },
      'gemini-2.5-flash': {
        supportsStructuredOutput: true,
        supportsUsage: true,
        supportsSystemPrompt: true,
        supportsTemperature: true,
        supportsMaxTokens: true,
        knownLimitations: []
      },
      'gemini-test': {
        supportsStructuredOutput: true,
        supportsUsage: true,
        supportsSystemPrompt: true,
        supportsTemperature: true,
        supportsMaxTokens: true,
        knownLimitations: []
      }
    }
  },
  anthropic: {
    defaultModel: 'claude-3-5-haiku-20241022',
    recommendedModels: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],
    models: {
      'claude-3-5-sonnet-20241022': {
        supportsStructuredOutput: true,
        supportsUsage: true,
        supportsSystemPrompt: true,
        supportsTemperature: true,
        supportsMaxTokens: true,
        knownLimitations: []
      },
      'claude-3-5-haiku-20241022': {
        supportsStructuredOutput: true,
        supportsUsage: true,
        supportsSystemPrompt: true,
        supportsTemperature: true,
        supportsMaxTokens: true,
        knownLimitations: []
      },
      'claude-3-opus-20240229': {
        supportsStructuredOutput: true,
        supportsUsage: true,
        supportsSystemPrompt: true,
        supportsTemperature: true,
        supportsMaxTokens: true,
        knownLimitations: []
      },
      'claude-test': {
        supportsStructuredOutput: true,
        supportsUsage: true,
        supportsSystemPrompt: true,
        supportsTemperature: true,
        supportsMaxTokens: true,
        knownLimitations: []
      }
    }
  },
  openrouter: {
    defaultModel: 'openai/gpt-4o-mini',
    recommendedModels: ['openai/gpt-4o-mini', 'anthropic/claude-3.5-sonnet'],
    models: {
      'openai/gpt-4o-mini': {
        supportsStructuredOutput: true,
        supportsUsage: true,
        supportsSystemPrompt: true,
        supportsTemperature: true,
        supportsMaxTokens: true,
        knownLimitations: []
      },
      'anthropic/claude-3.5-sonnet': {
        supportsStructuredOutput: true,
        supportsUsage: true,
        supportsSystemPrompt: true,
        supportsTemperature: true,
        supportsMaxTokens: true,
        knownLimitations: []
      },
      'openrouter-test': {
        supportsStructuredOutput: true,
        supportsUsage: true,
        supportsSystemPrompt: true,
        supportsTemperature: true,
        supportsMaxTokens: true,
        knownLimitations: []
      }
    }
  }
};

export function getModelCapabilities(
  provider: string,
  model: string
): {
  capabilities: ModelCapabilities;
  isKnown: boolean;
  warning?: string;
} {
  const lowerProvider = provider.toLowerCase();
  const reg = CAPABILITY_REGISTRY[lowerProvider];
  if (!reg) {
    return {
      isKnown: false,
      warning: `Unknown provider "${provider}". Defaulting to generic capabilities.`,
      capabilities: {
        supportsStructuredOutput: false,
        supportsUsage: false,
        supportsSystemPrompt: true,
        supportsTemperature: true,
        supportsMaxTokens: true,
        knownLimitations: []
      }
    };
  }

  const modelKey = model || reg.defaultModel;
  const caps = reg.models[modelKey];

  if (!caps) {
    return {
      isKnown: false,
      warning: `Unknown model "${modelKey}" for provider "${provider}". Tooling features may have unexpected behavior.`,
      capabilities: {
        supportsStructuredOutput: false, // Default to false for unknown models for safety
        supportsUsage: true,
        supportsSystemPrompt: true,
        supportsTemperature: true,
        supportsMaxTokens: true,
        knownLimitations: []
      }
    };
  }

  return {
    isKnown: true,
    capabilities: caps
  };
}
