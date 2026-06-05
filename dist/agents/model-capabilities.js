"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CAPABILITY_REGISTRY = void 0;
exports.getModelCapabilities = getModelCapabilities;
exports.CAPABILITY_REGISTRY = {
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
                knownLimitations: [],
                inputCostPerMillionToken: 0.15,
                outputCostPerMillionToken: 0.60
            },
            'gpt-4o': {
                supportsStructuredOutput: true,
                supportsUsage: true,
                supportsSystemPrompt: true,
                supportsTemperature: true,
                supportsMaxTokens: true,
                knownLimitations: [],
                inputCostPerMillionToken: 2.50,
                outputCostPerMillionToken: 10.00
            },
            'gpt-4-turbo': {
                supportsStructuredOutput: true,
                supportsUsage: true,
                supportsSystemPrompt: true,
                supportsTemperature: true,
                supportsMaxTokens: true,
                knownLimitations: [],
                inputCostPerMillionToken: 10.00,
                outputCostPerMillionToken: 30.00
            },
            'gpt-3.5-turbo': {
                supportsStructuredOutput: false,
                supportsUsage: true,
                supportsSystemPrompt: true,
                supportsTemperature: true,
                supportsMaxTokens: true,
                knownLimitations: ['Older model, does not support strict json_schema response format'],
                inputCostPerMillionToken: 0.50,
                outputCostPerMillionToken: 1.50
            },
            'gpt-4-custom': {
                supportsStructuredOutput: true,
                supportsUsage: true,
                supportsSystemPrompt: true,
                supportsTemperature: true,
                supportsMaxTokens: true,
                knownLimitations: [],
                inputCostPerMillionToken: 30.00,
                outputCostPerMillionToken: 60.00
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
                knownLimitations: [],
                inputCostPerMillionToken: 0.075,
                outputCostPerMillionToken: 0.30
            },
            'gemini-1.5-pro': {
                supportsStructuredOutput: true,
                supportsUsage: true,
                supportsSystemPrompt: true,
                supportsTemperature: true,
                supportsMaxTokens: true,
                knownLimitations: [],
                inputCostPerMillionToken: 1.25,
                outputCostPerMillionToken: 5.00
            },
            'gemini-2.0-flash': {
                supportsStructuredOutput: true,
                supportsUsage: true,
                supportsSystemPrompt: true,
                supportsTemperature: true,
                supportsMaxTokens: true,
                knownLimitations: [],
                inputCostPerMillionToken: 0.075,
                outputCostPerMillionToken: 0.30
            },
            'gemini-2.5-flash': {
                supportsStructuredOutput: true,
                supportsUsage: true,
                supportsSystemPrompt: true,
                supportsTemperature: true,
                supportsMaxTokens: true,
                knownLimitations: [],
                inputCostPerMillionToken: 0.075,
                outputCostPerMillionToken: 0.30
            },
            'gemini-test': {
                supportsStructuredOutput: true,
                supportsUsage: true,
                supportsSystemPrompt: true,
                supportsTemperature: true,
                supportsMaxTokens: true,
                knownLimitations: [],
                inputCostPerMillionToken: 0.0,
                outputCostPerMillionToken: 0.0
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
                knownLimitations: [],
                inputCostPerMillionToken: 3.00,
                outputCostPerMillionToken: 15.00
            },
            'claude-3-5-haiku-20241022': {
                supportsStructuredOutput: true,
                supportsUsage: true,
                supportsSystemPrompt: true,
                supportsTemperature: true,
                supportsMaxTokens: true,
                knownLimitations: [],
                inputCostPerMillionToken: 0.80,
                outputCostPerMillionToken: 4.00
            },
            'claude-3-opus-20240229': {
                supportsStructuredOutput: true,
                supportsUsage: true,
                supportsSystemPrompt: true,
                supportsTemperature: true,
                supportsMaxTokens: true,
                knownLimitations: [],
                inputCostPerMillionToken: 15.00,
                outputCostPerMillionToken: 75.00
            },
            'claude-test': {
                supportsStructuredOutput: true,
                supportsUsage: true,
                supportsSystemPrompt: true,
                supportsTemperature: true,
                supportsMaxTokens: true,
                knownLimitations: [],
                inputCostPerMillionToken: 0.0,
                outputCostPerMillionToken: 0.0
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
                knownLimitations: [],
                inputCostPerMillionToken: 0.15,
                outputCostPerMillionToken: 0.60
            },
            'anthropic/claude-3.5-sonnet': {
                supportsStructuredOutput: true,
                supportsUsage: true,
                supportsSystemPrompt: true,
                supportsTemperature: true,
                supportsMaxTokens: true,
                knownLimitations: [],
                inputCostPerMillionToken: 3.00,
                outputCostPerMillionToken: 15.00
            },
            'openrouter-test': {
                supportsStructuredOutput: true,
                supportsUsage: true,
                supportsSystemPrompt: true,
                supportsTemperature: true,
                supportsMaxTokens: true,
                knownLimitations: [],
                inputCostPerMillionToken: 0.0,
                outputCostPerMillionToken: 0.0
            }
        }
    }
};
function getModelCapabilities(provider, model) {
    const lowerProvider = provider.toLowerCase();
    let reg = exports.CAPABILITY_REGISTRY[lowerProvider];
    let modelKey = model;
    // Resolve OpenRouter provider/model prefix fallbacks (e.g. openrouter openai/gpt-4o-mini -> openai gpt-4o-mini)
    if (lowerProvider === 'openrouter' && model && model.includes('/')) {
        const registryKey = model;
        if (reg && reg.models[registryKey]) {
            modelKey = registryKey;
        }
        else {
            const parts = model.split('/');
            const baseProvider = parts[0].toLowerCase();
            const baseModel = parts.slice(1).join('/');
            const baseReg = exports.CAPABILITY_REGISTRY[baseProvider];
            if (baseReg && baseReg.models[baseModel]) {
                reg = baseReg;
                modelKey = baseModel;
            }
        }
    }
    if (!reg) {
        return {
            isKnown: false,
            warning: `Unknown provider "${provider}". Defaulting to generic capabilities with $0.00 pricing.`,
            capabilities: {
                supportsStructuredOutput: false,
                supportsUsage: false,
                supportsSystemPrompt: true,
                supportsTemperature: true,
                supportsMaxTokens: true,
                knownLimitations: [],
                inputCostPerMillionToken: 0.0,
                outputCostPerMillionToken: 0.0
            }
        };
    }
    modelKey = modelKey || reg.defaultModel;
    const caps = reg.models[modelKey];
    if (!caps) {
        return {
            isKnown: false,
            warning: `Unknown model "${modelKey}" for provider "${provider}". Defaulting to generic capabilities with $0.00 pricing.`,
            capabilities: {
                supportsStructuredOutput: false,
                supportsUsage: true,
                supportsSystemPrompt: true,
                supportsTemperature: true,
                supportsMaxTokens: true,
                knownLimitations: [],
                inputCostPerMillionToken: 0.0,
                outputCostPerMillionToken: 0.0
            }
        };
    }
    // Ensure pricing fields default to 0.0 if missing, and warn
    if (caps.inputCostPerMillionToken === undefined || caps.outputCostPerMillionToken === undefined) {
        console.warn(`[Warning] Pricing parameters missing for model "${modelKey}" under provider "${provider}". Cost tracking will be inaccurate.`);
        caps.inputCostPerMillionToken = caps.inputCostPerMillionToken ?? 0.0;
        caps.outputCostPerMillionToken = caps.outputCostPerMillionToken ?? 0.0;
    }
    return {
        isKnown: true,
        capabilities: caps
    };
}
