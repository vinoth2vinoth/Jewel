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
const doctor_1 = require("./doctor");
const sandboxDir = path.join(__dirname, '../../../sandbox-test-doctor');
(0, node_test_1.default)('doctor checks - execution with mock exit', () => {
    if (fs.existsSync(sandboxDir)) {
        fs.rmSync(sandboxDir, { recursive: true, force: true });
    }
    fs.mkdirSync(sandboxDir, { recursive: true });
    const originalExit = process.exit;
    let exitCode;
    process.exit = (code) => {
        exitCode = code;
    };
    try {
        (0, doctor_1.runDoctor)(sandboxDir);
        node_assert_1.default.ok(exitCode === 0 || exitCode === 1);
    }
    finally {
        process.exit = originalExit;
        if (fs.existsSync(sandboxDir)) {
            fs.rmSync(sandboxDir, { recursive: true, force: true });
        }
    }
});
(0, node_test_1.default)('doctor checks - provider-specific API key warnings', () => {
    if (fs.existsSync(sandboxDir)) {
        fs.rmSync(sandboxDir, { recursive: true, force: true });
    }
    fs.mkdirSync(sandboxDir, { recursive: true });
    const originalExit = process.exit;
    process.exit = (code) => { };
    const originalLog = console.log;
    const originalWarn = console.warn;
    try {
        const runDoctorWithProvider = (provider, envVal, envKey) => {
            const logs = [];
            console.log = (...args) => logs.push(args.join(' '));
            console.warn = (...args) => logs.push(args.join(' '));
            const oldEnv = envKey ? process.env[envKey] : undefined;
            if (envKey) {
                if (envVal !== undefined) {
                    process.env[envKey] = envVal;
                }
                else {
                    delete process.env[envKey];
                }
            }
            const config = { provider };
            fs.writeFileSync(path.join(sandboxDir, 'jewel.config.json'), JSON.stringify(config, null, 2), 'utf8');
            (0, doctor_1.runDoctor)(sandboxDir);
            if (envKey) {
                if (oldEnv !== undefined) {
                    process.env[envKey] = oldEnv;
                }
                else {
                    delete process.env[envKey];
                }
            }
            return logs.join('\n');
        };
        // 1. None provider
        const logNone = runDoctorWithProvider('none');
        node_assert_1.default.ok(logNone.includes('set to "none"'));
        node_assert_1.default.ok(!logNone.includes('missing from environment'));
        // 2. OpenAI provider - missing key
        const logOpenAiMissing = runDoctorWithProvider('openai', undefined, 'OPENAI_API_KEY');
        node_assert_1.default.ok(logOpenAiMissing.includes('OPENAI_API_KEY is missing'));
        // 3. OpenAI provider - present key
        const logOpenAiPresent = runDoctorWithProvider('openai', 'sk-test', 'OPENAI_API_KEY');
        node_assert_1.default.ok(logOpenAiPresent.includes('OPENAI_API_KEY present'));
        // 4. Anthropic provider - missing key
        const logAnthropicMissing = runDoctorWithProvider('anthropic', undefined, 'ANTHROPIC_API_KEY');
        node_assert_1.default.ok(logAnthropicMissing.includes('ANTHROPIC_API_KEY is missing'));
        // 5. Gemini provider - missing key
        const logGeminiMissing = runDoctorWithProvider('gemini', undefined, 'GEMINI_API_KEY');
        node_assert_1.default.ok(logGeminiMissing.includes('GEMINI_API_KEY is missing'));
        // 6. OpenRouter provider - missing key
        const logOpenrouterMissing = runDoctorWithProvider('openrouter', undefined, 'OPENROUTER_API_KEY');
        node_assert_1.default.ok(logOpenrouterMissing.includes('OPENROUTER_API_KEY is missing'));
    }
    finally {
        process.exit = originalExit;
        console.log = originalLog;
        console.warn = originalWarn;
        if (fs.existsSync(sandboxDir)) {
            fs.rmSync(sandboxDir, { recursive: true, force: true });
        }
    }
});
