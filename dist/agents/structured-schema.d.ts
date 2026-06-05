export declare const TaskContractSchema: {
    $schema: string;
    title: string;
    type: string;
    properties: {
        task: {
            type: string;
            description: string;
        };
        understanding: {
            type: string;
            description: string;
        };
        assumptions: {
            type: string;
            items: {
                type: string;
            };
            description: string;
        };
        filesLikelyNeeded: {
            type: string;
            items: {
                type: string;
            };
            description: string;
        };
        forbiddenActions: {
            type: string;
            items: {
                type: string;
            };
            description: string;
        };
        successCriteria: {
            type: string;
            items: {
                type: string;
            };
            minItems: number;
            description: string;
        };
        riskLevel: {
            type: string;
            enum: string[];
            description: string;
        };
        requiresApproval: {
            type: string;
            description: string;
        };
        createdAt: {
            type: string;
            description: string;
        };
        mode: {
            type: string;
            enum: string[];
            description: string;
        };
        estimatedFilesChangedCount: {
            type: string;
            description: string;
        };
        estimatedLinesChangedCount: {
            type: string;
            description: string;
        };
        preserveExistingTests: {
            type: string;
            description: string;
        };
    };
    required: string[];
    additionalProperties: boolean;
};
export declare const PatchProposalSchema: {
    $schema: string;
    title: string;
    type: string;
    properties: {
        summary: {
            type: string;
            description: string;
        };
        files: {
            type: string;
            items: {
                type: string;
                properties: {
                    filePath: {
                        type: string;
                        description: string;
                    };
                    content: {
                        type: string;
                        description: string;
                    };
                    reason: {
                        type: string;
                        description: string;
                    };
                };
                required: string[];
                additionalProperties: boolean;
            };
            description: string;
        };
        notes: {
            type: string;
            items: {
                type: string;
            };
            description: string;
        };
        riskLevel: {
            type: string;
            enum: string[];
            description: string;
        };
        noChangeNeeded: {
            type: string;
            description: string;
        };
        noChangeReason: {
            type: string;
            description: string;
        };
        usage: {
            type: string;
            properties: {
                inputTokens: {
                    type: string;
                };
                outputTokens: {
                    type: string;
                };
                totalTokens: {
                    type: string;
                };
            };
            additionalProperties: boolean;
        };
    };
    required: string[];
    additionalProperties: boolean;
};
export declare const ReviewResultSchema: {
    $schema: string;
    title: string;
    type: string;
    properties: {
        status: {
            type: string;
            enum: string[];
            description: string;
        };
        findings: {
            type: string;
            items: {
                type: string;
            };
            description: string;
        };
    };
    required: string[];
    additionalProperties: boolean;
};
export declare const TestCriticResultSchema: {
    $schema: string;
    title: string;
    type: string;
    properties: {
        verdict: {
            type: string;
            enum: string[];
            description: string;
        };
        confidence: {
            type: string;
            enum: string[];
            description: string;
        };
        explanation: {
            type: string;
            description: string;
        };
        suspectedRootCause: {
            type: string;
            description: string;
        };
        suggestedFix: {
            type: string;
            description: string;
        };
        canAutoRetry: {
            type: string;
            description: string;
        };
        requiresHumanReview: {
            type: string;
            description: string;
        };
    };
    required: string[];
    additionalProperties: boolean;
};
