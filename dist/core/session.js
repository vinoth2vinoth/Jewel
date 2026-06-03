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
exports.validateContract = validateContract;
exports.assessRiskLevel = assessRiskLevel;
exports.generateLocalContract = generateLocalContract;
exports.createSession = createSession;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function validateContract(contract) {
    const errors = [];
    if (!contract.task || typeof contract.task !== 'string' || contract.task.trim() === '') {
        errors.push('Task description is required and cannot be empty.');
    }
    if (!contract.successCriteria || !Array.isArray(contract.successCriteria) || contract.successCriteria.length === 0) {
        errors.push('Success criteria are required and cannot be empty.');
    }
    if (!contract.riskLevel || !['low', 'medium', 'high'].includes(contract.riskLevel)) {
        errors.push('Risk level is required and must be "low", "medium", or "high".');
    }
    return errors;
}
function assessRiskLevel(task, filesNeeded, config) {
    const normalizedTask = task.toLowerCase();
    // High risk keywords: auth, billing, payment, security, migration
    const highRiskKeywords = ['auth', 'login', 'password', 'session', 'security', 'token', 'jwt', 'billing', 'payment', 'stripe', 'checkout', 'invoice', 'migrate', 'migration', 'encrypt', 'decrypt'];
    for (const kw of highRiskKeywords) {
        if (normalizedTask.includes(kw)) {
            return 'high';
        }
    }
    // Check files likely needed against config.protectedFiles glob patterns or direct paths
    // Simple check for now: if any file is in protectedFiles list or starts with src/auth, src/payments, src/billing, src/security, .env
    const highRiskFilePrefixes = ['src/auth', 'src/payments', 'src/billing', 'src/security', '.env'];
    for (const file of filesNeeded) {
        const normFile = file.replace(/\\/g, '/');
        if (highRiskFilePrefixes.some(p => normFile.startsWith(p)) || normFile.endsWith('.env') || normFile.includes('.env.')) {
            return 'high';
        }
        // Direct match with config.protectedFiles
        for (const pattern of config.protectedFiles) {
            // Basic glob matching fallback
            const regexPattern = pattern
                .replace(/\./g, '\\.')
                .replace(/\*\*/g, '.*')
                .replace(/\*/g, '[^/]*');
            const regex = new RegExp(`^${regexPattern}$`);
            if (regex.test(normFile)) {
                return 'high';
            }
        }
    }
    // Dependency changes make risk medium or high
    const dependencyKeywords = ['dependency', 'dependencies', 'install', 'package', 'npm', 'yarn', 'pnpm', 'bun', 'add', 'package.json'];
    if (dependencyKeywords.some(kw => normalizedTask.includes(kw)) || filesNeeded.some(f => f.endsWith('package.json'))) {
        return 'medium';
    }
    return 'low';
}
function generateLocalContract(task, config, filesNeeded = []) {
    const risk = assessRiskLevel(task, filesNeeded, config);
    // Heuristic assumptions and criteria
    const assumptions = [
        'The repository is initialized and building locally.',
        'No remote actions (git push, deployment) are required unless explicitly specified.'
    ];
    const successCriteria = [
        `The task "${task}" is implemented fully.`,
        'All configured verification commands run successfully with zero errors.',
        'Code changes are surgical and restricted to the declared file scope.'
    ];
    const forbiddenActions = [
        'Do not make broad unrelated formatting or code changes.',
        'Do not bypass the command safety policy.',
        'Do not install new packages unless approved by configuration.'
    ];
    return {
        task,
        understanding: `Implement the requested task: ${task}`,
        assumptions,
        filesLikelyNeeded: filesNeeded.length > 0 ? filesNeeded : ['src/index.ts'],
        forbiddenActions,
        successCriteria,
        riskLevel: risk,
        requiresApproval: risk === 'high',
        createdAt: new Date().toISOString(),
        mode: config.mode
    };
}
function createSession(task, config, filesNeeded = [], cwd = process.cwd()) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const sessionId = `session-${timestamp}`;
    const sessionPath = path.join(cwd, '.jewel', 'sessions', sessionId);
    if (!fs.existsSync(sessionPath)) {
        fs.mkdirSync(sessionPath, { recursive: true });
    }
    const contract = generateLocalContract(task, config, filesNeeded);
    const contractPath = path.join(sessionPath, 'task-contract.json');
    fs.writeFileSync(contractPath, JSON.stringify(contract, null, 2), 'utf8');
    return { sessionId, sessionPath, contractPath };
}
