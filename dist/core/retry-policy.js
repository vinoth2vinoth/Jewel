"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRetryState = createRetryState;
exports.getFailureSignature = getFailureSignature;
exports.shouldStopRetry = shouldStopRetry;
exports.recordRetryAttempt = recordRetryAttempt;
const crypto = __importStar(require("crypto"));
function createRetryState(maxRetries) {
    return {
        attempt: 0,
        maxRetries,
        seenFailures: new Set(),
        seenVerdicts: new Set(),
    };
}
function getFailureSignature(log) {
    // Normalize whitespace, paths, and platform-specific line endings to identify the same crash
    const normalized = log
        .replace(/\r\n/g, '\n')
        .replace(/\s+/g, ' ')
        .replace(/\\/g, '/')
        .trim();
    return crypto.createHash('md5').update(normalized).digest('hex');
}
function shouldStopRetry(state, failureLog, verdict, confidence, existingTestModified) {
    if (existingTestModified) {
        return {
            stop: true,
            reason: 'Existing tests were modified, which violates the preserveExistingTests policy.',
            status: 'EXISTING_TEST_MODIFIED'
        };
    }
    if (confidence === 'low' || confidence === 'medium') {
        return {
            stop: true,
            reason: `Critic confidence is ${confidence}. Stop and request human review.`,
            status: 'NEEDS_HUMAN_REVIEW'
        };
    }
    if (verdict === 'UNKNOWN') {
        return {
            stop: true,
            reason: 'Critic verdict is UNKNOWN. Stop and request human review.',
            status: 'NEEDS_HUMAN_REVIEW'
        };
    }
    const signature = getFailureSignature(failureLog);
    if (state.seenFailures.has(signature)) {
        return {
            stop: true,
            reason: 'The same verification failure repeated twice. Stopping loop.',
            status: 'RETRY_LIMIT_REACHED'
        };
    }
    if (state.attempt >= state.maxRetries) {
        return {
            stop: true,
            reason: `Maximum retry limit (${state.maxRetries}) reached.`,
            status: 'RETRY_LIMIT_REACHED'
        };
    }
    return { stop: false };
}
function recordRetryAttempt(state, failureLog, verdict) {
    state.attempt++;
    const signature = getFailureSignature(failureLog);
    state.seenFailures.add(signature);
    state.lastVerdict = verdict;
}
