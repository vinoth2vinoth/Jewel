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
const diff_1 = require("./diff");
(0, node_test_1.default)('diff command - print diff statistics from session', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jewel-test-diff-'));
    // Set up mock session
    const sessionsDir = path.join(tempDir, '.jewel', 'sessions');
    const sessionId = 'session-2026-06-03T15-00-00-000Z';
    const sessionPath = path.join(sessionsDir, sessionId);
    fs.mkdirSync(sessionPath, { recursive: true });
    // Create checkpoint file
    const checkpoint = {
        isGit: false,
        backupPath: path.join(sessionPath, 'backup')
    };
    fs.writeFileSync(path.join(sessionPath, 'checkpoint.json'), JSON.stringify(checkpoint, null, 2), 'utf8');
    // Capture console.log
    const originalLog = console.log;
    const originalWarn = console.warn;
    const logs = [];
    console.log = (...args) => {
        logs.push(args.join(' '));
    };
    console.warn = (...args) => {
        logs.push(args.join(' '));
    };
    try {
        // Run diff
        (0, diff_1.runDiff)(sessionId, tempDir);
        // Restore logs
        console.log = originalLog;
        console.warn = originalWarn;
        const output = logs.join('\n');
        node_assert_1.default.ok(output.includes('Jewel Diff'));
        node_assert_1.default.ok(output.includes(sessionId));
        node_assert_1.default.ok(output.includes('Changed Files'));
    }
    catch (err) {
        console.log = originalLog;
        console.warn = originalWarn;
        throw err;
    }
    finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});
