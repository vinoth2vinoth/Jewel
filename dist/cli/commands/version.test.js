"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const node_assert_1 = __importDefault(require("node:assert"));
const version_1 = require("./version");
(0, node_test_1.default)('version command prints package and node version info', () => {
    const originalLog = console.log;
    const logs = [];
    console.log = (...args) => {
        logs.push(args.join(' '));
    };
    try {
        (0, version_1.runVersion)();
        // Assert version outputs something like "Jewel version: ..."
        const hasJewel = logs.some(log => log.includes('Jewel version:'));
        const hasNode = logs.some(log => log.includes('Node.js version:'));
        const hasPlatform = logs.some(log => log.includes('Platform:'));
        const hasConfig = logs.some(log => log.includes('Default configuration:'));
        node_assert_1.default.ok(hasJewel, 'Should print Jewel version');
        node_assert_1.default.ok(hasNode, 'Should print Node.js version');
        node_assert_1.default.ok(hasPlatform, 'Should print Platform');
        node_assert_1.default.ok(hasConfig, 'Should print Config details');
    }
    finally {
        console.log = originalLog;
    }
});
