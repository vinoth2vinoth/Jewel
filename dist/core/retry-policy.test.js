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
const node_test_1 = __importStar(require("node:test"));
const assert = __importStar(require("assert"));
const retry_policy_1 = require("./retry-policy");
(0, node_test_1.describe)('Retry Policy and Bounded Loops', () => {
    (0, node_test_1.default)('maxRetries is respected', () => {
        const state = (0, retry_policy_1.createRetryState)(3);
        // Attempt 0
        let decision = (0, retry_policy_1.shouldStopRetry)(state, 'error 1', 'BAD_IMPLEMENTATION', 'high', false);
        assert.strictEqual(decision.stop, false);
        (0, retry_policy_1.recordRetryAttempt)(state, 'error 1', 'BAD_IMPLEMENTATION');
        // Attempt 1
        decision = (0, retry_policy_1.shouldStopRetry)(state, 'error 2', 'BAD_IMPLEMENTATION', 'high', false);
        assert.strictEqual(decision.stop, false);
        (0, retry_policy_1.recordRetryAttempt)(state, 'error 2', 'BAD_IMPLEMENTATION');
        // Attempt 2
        decision = (0, retry_policy_1.shouldStopRetry)(state, 'error 3', 'BAD_IMPLEMENTATION', 'high', false);
        assert.strictEqual(decision.stop, false);
        (0, retry_policy_1.recordRetryAttempt)(state, 'error 3', 'BAD_IMPLEMENTATION');
        // Attempt 3 - limit reached
        decision = (0, retry_policy_1.shouldStopRetry)(state, 'error 4', 'BAD_IMPLEMENTATION', 'high', false);
        assert.strictEqual(decision.stop, true);
        assert.strictEqual(decision.status, 'RETRY_LIMIT_REACHED');
    });
    (0, node_test_1.default)('same failure repeated twice stops', () => {
        const state = (0, retry_policy_1.createRetryState)(3);
        // Attempt 0
        let decision = (0, retry_policy_1.shouldStopRetry)(state, 'assertion failed: 4 === 3', 'BAD_IMPLEMENTATION', 'high', false);
        assert.strictEqual(decision.stop, false);
        (0, retry_policy_1.recordRetryAttempt)(state, 'assertion failed: 4 === 3', 'BAD_IMPLEMENTATION');
        // Attempt 1 with same error log
        decision = (0, retry_policy_1.shouldStopRetry)(state, 'assertion failed: 4 === 3', 'BAD_IMPLEMENTATION', 'high', false);
        assert.strictEqual(decision.stop, true);
        assert.strictEqual(decision.status, 'RETRY_LIMIT_REACHED');
    });
    (0, node_test_1.default)('low confidence critic verdict stops immediately', () => {
        const state = (0, retry_policy_1.createRetryState)(3);
        const decision = (0, retry_policy_1.shouldStopRetry)(state, 'some error', 'BAD_GENERATED_TEST', 'low', false);
        assert.strictEqual(decision.stop, true);
        assert.strictEqual(decision.status, 'NEEDS_HUMAN_REVIEW');
    });
    (0, node_test_1.default)('UNKNOWN verdict stops immediately', () => {
        const state = (0, retry_policy_1.createRetryState)(3);
        const decision = (0, retry_policy_1.shouldStopRetry)(state, 'some error', 'UNKNOWN', 'high', false);
        assert.strictEqual(decision.stop, true);
        assert.strictEqual(decision.status, 'NEEDS_HUMAN_REVIEW');
    });
    (0, node_test_1.default)('existing test modification blocks immediately', () => {
        const state = (0, retry_policy_1.createRetryState)(3);
        const decision = (0, retry_policy_1.shouldStopRetry)(state, 'some error', 'BAD_GENERATED_TEST', 'high', true);
        assert.strictEqual(decision.stop, true);
        assert.strictEqual(decision.status, 'EXISTING_TEST_MODIFIED');
    });
});
