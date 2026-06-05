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
const os = __importStar(require("os"));
const version_1 = require("./version");
function createTempSandbox() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'jewel-version-test-'));
}
(0, node_test_1.default)('version command prints package and node version info', () => {
    const originalLog = console.log;
    const logs = [];
    console.log = (...args) => {
        logs.push(args.join(' '));
    };
    const sandboxDir = createTempSandbox();
    try {
        (0, version_1.runVersion)(sandboxDir);
        // Assert version outputs something like "Jewel version: ..."
        const hasJewel = logs.some(log => log.includes('Jewel version:'));
        const hasNode = logs.some(log => log.includes('Node.js version:'));
        const hasPlatform = logs.some(log => log.includes('Platform:'));
        const hasConfig = logs.some(log => log.includes('Default configuration:'));
        const hasActiveConfig = logs.some(log => log.includes('Active configuration: none (using defaults)'));
        node_assert_1.default.ok(hasJewel, 'Should print Jewel version');
        node_assert_1.default.ok(hasNode, 'Should print Node.js version');
        node_assert_1.default.ok(hasPlatform, 'Should print Platform');
        node_assert_1.default.ok(hasConfig, 'Should print Config details');
        node_assert_1.default.ok(hasActiveConfig, 'Should print active configuration');
    }
    finally {
        console.log = originalLog;
        fs.rmSync(sandboxDir, { recursive: true, force: true });
    }
});
(0, node_test_1.default)('version command - prints config status when present', () => {
    const originalLog = console.log;
    const logs = [];
    console.log = (...args) => {
        logs.push(args.join(' '));
    };
    const sandboxDir = createTempSandbox();
    fs.writeFileSync(path.join(sandboxDir, 'jewel.config.json'), JSON.stringify({ projectName: 'my-cool-project' }), 'utf8');
    try {
        (0, version_1.runVersion)(sandboxDir);
        const hasActiveConfig = logs.some(log => log.includes('Active configuration: found (project: "my-cool-project")'));
        node_assert_1.default.ok(hasActiveConfig, 'Should print active configuration project name');
    }
    finally {
        console.log = originalLog;
        fs.rmSync(sandboxDir, { recursive: true, force: true });
    }
});
(0, node_test_1.default)('version command - falls back gracefully on malformed config or missing name', () => {
    const originalLog = console.log;
    const logs = [];
    console.log = (...args) => {
        logs.push(args.join(' '));
    };
    const sandboxDir = createTempSandbox();
    fs.writeFileSync(path.join(sandboxDir, 'jewel.config.json'), '{invalid-json}', 'utf8');
    try {
        (0, version_1.runVersion)(sandboxDir);
        const hasActiveConfig = logs.some(log => log.includes('Active configuration: none (using defaults)'));
        node_assert_1.default.ok(hasActiveConfig, 'Should fall back to none on invalid JSON');
    }
    finally {
        console.log = originalLog;
        fs.rmSync(sandboxDir, { recursive: true, force: true });
    }
});
