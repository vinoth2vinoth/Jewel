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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const node_assert_1 = __importDefault(require("node:assert"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const session_1 = require("./session");
const config_1 = require("./config");
const sandboxDir = path.join(__dirname, '../../sandbox-test-session');
function cleanupSandbox() {
    if (fs.existsSync(sandboxDir)) {
        fs.rmSync(sandboxDir, { recursive: true, force: true });
    }
}
(0, node_test_1.default)('session - validate contract schema', () => {
    const valid = {
        task: 'Fix a typo',
        successCriteria: ['Typo is fixed'],
        riskLevel: 'low'
    };
    node_assert_1.default.strictEqual((0, session_1.validateContract)(valid).length, 0);
    const invalidEmpty = {
        task: '',
        successCriteria: [],
        riskLevel: 'unknown'
    };
    const errors = (0, session_1.validateContract)(invalidEmpty);
    node_assert_1.default.ok(errors.length >= 3);
    node_assert_1.default.ok(errors.some(e => e.includes('Task description')));
    node_assert_1.default.ok(errors.some(e => e.includes('Success criteria')));
    node_assert_1.default.ok(errors.some(e => e.includes('Risk level')));
});
(0, node_test_1.default)('session - risk assessment', () => {
    // Low risk
    node_assert_1.default.strictEqual((0, session_1.assessRiskLevel)('Fix typo in docs', [], config_1.DEFAULT_CONFIG), 'low');
    // Medium risk (dependencies)
    node_assert_1.default.strictEqual((0, session_1.assessRiskLevel)('install axios library', [], config_1.DEFAULT_CONFIG), 'medium');
    node_assert_1.default.strictEqual((0, session_1.assessRiskLevel)('update dependencies', [], config_1.DEFAULT_CONFIG), 'medium');
    // High risk (auth/payments keywords)
    node_assert_1.default.strictEqual((0, session_1.assessRiskLevel)('fix login session expiry issue', [], config_1.DEFAULT_CONFIG), 'high');
    node_assert_1.default.strictEqual((0, session_1.assessRiskLevel)('setup Stripe checkout billing', [], config_1.DEFAULT_CONFIG), 'high');
    node_assert_1.default.strictEqual((0, session_1.assessRiskLevel)('generate database migration', [], config_1.DEFAULT_CONFIG), 'high');
    // High risk (protected files)
    node_assert_1.default.strictEqual((0, session_1.assessRiskLevel)('update config', ['.env'], config_1.DEFAULT_CONFIG), 'high');
    node_assert_1.default.strictEqual((0, session_1.assessRiskLevel)('update authentication', ['src/auth/helper.ts'], config_1.DEFAULT_CONFIG), 'high');
    node_assert_1.default.strictEqual((0, session_1.assessRiskLevel)('modify schema file', ['schema.prisma'], config_1.DEFAULT_CONFIG), 'high');
});
(0, node_test_1.default)('session - create session and save contract', () => {
    cleanupSandbox();
    fs.mkdirSync(sandboxDir, { recursive: true });
    const { sessionId, sessionPath, contractPath } = (0, session_1.createSession)('Configure payment flow', config_1.DEFAULT_CONFIG, ['src/payments/stripe.ts'], sandboxDir);
    node_assert_1.default.ok(sessionId.startsWith('session-'));
    node_assert_1.default.ok(fs.existsSync(sessionPath));
    node_assert_1.default.ok(fs.existsSync(contractPath));
    const contractData = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
    node_assert_1.default.strictEqual(contractData.task, 'Configure payment flow');
    node_assert_1.default.strictEqual(contractData.riskLevel, 'high'); // since it matches payments/billing context
    node_assert_1.default.strictEqual(contractData.requiresApproval, true);
    node_assert_1.default.deepStrictEqual(contractData.filesLikelyNeeded, ['src/payments/stripe.ts']);
    cleanupSandbox();
});
