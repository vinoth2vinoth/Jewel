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
const test_change_policy_1 = require("./test-change-policy");
(0, node_test_1.describe)('Test Modification Policy', () => {
    const originalTest = `
    import { add } from './math';
    test('adds 1 + 2 to equal 3', () => {
      assert.strictEqual(add(1, 2), 3);
    });
  `;
    (0, node_test_1.default)('appending new tests at end of file passes', () => {
        const patchedTest = `
      import { add } from './math';
      test('adds 1 + 2 to equal 3', () => {
        assert.strictEqual(add(1, 2), 3);
      });
      test('adds 2 + 3 to equal 5', () => {
        assert.strictEqual(add(2, 3), 5);
      });
    `;
        const report = (0, test_change_policy_1.checkTestChangePolicy)(originalTest, patchedTest, 'math.test.ts', true);
        assert.strictEqual(report.success, true);
        assert.strictEqual(report.appendOnly, true);
        assert.strictEqual(report.invasive, false);
        assert.deepStrictEqual(report.testProvenance.appendedTestNames, ["adds 2 + 3 to equal 5"]);
    });
    (0, node_test_1.default)('changing an existing assertion fails', () => {
        const patchedTest = `
      import { add } from './math';
      test('adds 1 + 2 to equal 3', () => {
        assert.strictEqual(add(1, 2), 4);
      });
    `;
        const report = (0, test_change_policy_1.checkTestChangePolicy)(originalTest, patchedTest, 'math.test.ts', true);
        assert.strictEqual(report.success, false);
        assert.strictEqual(report.appendOnly, false);
        assert.strictEqual(report.invasive, true);
        assert.deepStrictEqual(report.testProvenance.modifiedTestNames, ["adds 1 + 2 to equal 3"]);
    });
    (0, node_test_1.default)('changing an existing test name fails', () => {
        const patchedTest = `
      import { add } from './math';
      test('adds 1 + 2 equals 3', () => {
        assert.strictEqual(add(1, 2), 3);
      });
    `;
        const report = (0, test_change_policy_1.checkTestChangePolicy)(originalTest, patchedTest, 'math.test.ts', true);
        assert.strictEqual(report.success, false);
        assert.strictEqual(report.appendOnly, false);
        assert.strictEqual(report.invasive, true);
        assert.deepStrictEqual(report.testProvenance.removedTestNames, ["adds 1 + 2 to equal 3"]);
    });
    (0, node_test_1.default)('adding an import for new tests warns, not blocks', () => {
        const patchedTest = `
      import { add } from './math';
      import { multiply } from './math';
      test('adds 1 + 2 to equal 3', () => {
        assert.strictEqual(add(1, 2), 3);
      });
      test('multiplies 2 * 3 to equal 6', () => {
        assert.strictEqual(multiply(2, 3), 6);
      });
    `;
        const report = (0, test_change_policy_1.checkTestChangePolicy)(originalTest, patchedTest, 'math.test.ts', true);
        assert.strictEqual(report.success, true);
        assert.strictEqual(report.invasive, false);
        assert.ok(report.findings.some(f => f.includes('[WARN]')));
    });
    (0, node_test_1.default)('adding an import without appending tests blocks', () => {
        const patchedTest = `
      import { add } from './math';
      import { multiply } from './math';
      test('adds 1 + 2 to equal 3', () => {
        assert.strictEqual(add(1, 2), 3);
      });
    `;
        const report = (0, test_change_policy_1.checkTestChangePolicy)(originalTest, patchedTest, 'math.test.ts', true);
        assert.strictEqual(report.success, false);
        assert.strictEqual(report.invasive, true);
    });
});
