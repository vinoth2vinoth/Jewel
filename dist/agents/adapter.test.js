"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const node_assert_1 = __importDefault(require("node:assert"));
const adapter_1 = require("./adapter");
const config_1 = require("../core/config");
(0, node_test_1.default)('agent adapter - mock adapter runs plan and proposePatch', async () => {
    const adapter = new adapter_1.MockAgentAdapter();
    const contract = await adapter.plan({
        task: 'Add hello world endpoint',
        repoSummary: 'Test repo',
        config: config_1.DEFAULT_CONFIG,
        skills: []
    });
    node_assert_1.default.strictEqual(contract.task, 'Add hello world endpoint');
    node_assert_1.default.ok(contract.understanding.includes('Mock understanding'));
    const patch = await adapter.proposePatch({
        taskContract: contract,
        allowedFiles: contract.filesLikelyNeeded,
        repoContext: 'File contents...',
        verificationResult: null
    });
    node_assert_1.default.strictEqual(patch.files.length, 1);
    node_assert_1.default.ok(patch.files[0].content.includes('Task executed successfully'));
    const review = await adapter.reviewDiff({
        diff: 'diff content',
        verificationResult: null,
        taskContract: contract
    });
    node_assert_1.default.strictEqual(review.status, 'PASS');
});
