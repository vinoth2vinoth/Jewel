import * as fs from 'fs';
import * as path from 'path';
import { JewelConfig } from './config';
import { isProtectedPath, isDependencyPath } from '../safety/path-policy';

export interface TaskContract {
  task: string;
  understanding: string;
  assumptions: string[];
  filesLikelyNeeded: string[];
  forbiddenActions: string[];
  successCriteria: string[];
  riskLevel: 'low' | 'medium' | 'high';
  requiresApproval: boolean;
  createdAt: string;
  mode: 'strict' | 'lax';
}

export function validateContract(contract: any): string[] {
  const errors: string[] = [];

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

export function assessRiskLevel(task: string, filesNeeded: string[], config: JewelConfig): 'low' | 'medium' | 'high' {
  const normalizedTask = task.toLowerCase();

  // High risk keywords: auth, billing, payment, security, migration
  const highRiskKeywords = ['auth', 'login', 'password', 'session', 'security', 'token', 'jwt', 'billing', 'payment', 'stripe', 'checkout', 'invoice', 'migrate', 'migration', 'encrypt', 'decrypt'];
  for (const kw of highRiskKeywords) {
    if (normalizedTask.includes(kw)) {
      return 'high';
    }
  }

  // Check files likely needed against config.protectedFiles glob patterns
  for (const file of filesNeeded) {
    if (isProtectedPath(file, config)) {
      return 'high';
    }
  }

  // Dependency changes make risk medium or high
  const dependencyKeywords = ['dependency', 'dependencies', 'install', 'package', 'npm', 'yarn', 'pnpm', 'bun', 'add', 'package.json'];
  if (dependencyKeywords.some(kw => normalizedTask.includes(kw)) || filesNeeded.some(f => isDependencyPath(f))) {
    return 'medium';
  }

  return 'low';
}

export function generateLocalContract(task: string, config: JewelConfig, filesNeeded: string[] = []): TaskContract {
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

export function createSession(task: string, config: JewelConfig, filesNeeded: string[] = [], cwd: string = process.cwd()): { sessionId: string; sessionPath: string; contractPath: string } {
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
