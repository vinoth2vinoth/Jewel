export interface ModelCapabilities {
    supportsStructuredOutput: boolean;
    supportsUsage: boolean;
    supportsSystemPrompt: boolean;
    supportsTemperature: boolean;
    supportsMaxTokens: boolean;
    knownLimitations: string[];
    inputCostPerMillionToken?: number;
    outputCostPerMillionToken?: number;
}
export interface ProviderCapabilityRegistry {
    defaultModel: string;
    recommendedModels: string[];
    models: Record<string, ModelCapabilities>;
}
export declare const CAPABILITY_REGISTRY: Record<string, ProviderCapabilityRegistry>;
export declare function getModelCapabilities(provider: string, model: string): {
    capabilities: ModelCapabilities;
    isKnown: boolean;
    warning?: string;
};
