import * as fs from 'fs';
import * as path from 'path';

export interface JewelConfig {
  projectName: string;
  mode: 'strict' | 'lax';
  maxRetries: number;
  maxFilesChanged: number;
  maxLinesChanged: number;
  requirePlanBeforeEdit: boolean;
  requireVerificationBeforeDone: boolean;
  allowNewDependencies: boolean;
  allowProtectedFileChanges: boolean;
  allowGitPush: boolean;
  requireHumanDiffApproval: boolean;
  provider: 'none' | 'openai' | 'anthropic' | 'gemini' | 'openrouter';
  model: string;
  temperature: number;
  maxOutputTokens: number;
  llmTimeoutMs: number;
  llmMaxRetries: number;
  llmStrictJson: boolean;
  commands: {
    lint: string;
    typecheck: string;
    test: string;
    build: string;
    e2e: string;
  };
  protectedFiles: string[];
  dangerousCommandPolicy: 'block' | 'warn' | 'allow';
  reportFormat: ('markdown' | 'json')[];
}

export const DEFAULT_CONFIG: JewelConfig = {
  projectName: '',
  mode: 'strict',
  maxRetries: 3,
  maxFilesChanged: 8,
  maxLinesChanged: 500,
  requirePlanBeforeEdit: true,
  requireVerificationBeforeDone: true,
  allowNewDependencies: false,
  allowProtectedFileChanges: false,
  allowGitPush: false,
  requireHumanDiffApproval: true,
  provider: 'none',
  model: '',
  temperature: 0,
  maxOutputTokens: 4000,
  llmTimeoutMs: 60000,
  llmMaxRetries: 2,
  llmStrictJson: true,
  commands: {
    lint: '',
    typecheck: '',
    test: '',
    build: '',
    e2e: ''
  },
  protectedFiles: [
    '.env',
    '.env.local',
    '.env.*',
    'package-lock.json',
    'pnpm-lock.yaml',
    'yarn.lock',
    'bun.lockb',
    'schema.prisma',
    'migrations/**',
    'src/auth/**',
    'src/payments/**',
    'src/billing/**',
    'src/security/**'
  ],
  dangerousCommandPolicy: 'block',
  reportFormat: ['markdown', 'json']
};

export function loadConfig(cwd: string = process.cwd()): JewelConfig {
  const configPath = path.join(cwd, 'jewel.config.json');
  if (!fs.existsSync(configPath)) {
    throw new Error(`Configuration file not found. Please run 'jewel init' first.`);
  }

  const content = fs.readFileSync(configPath, 'utf8');
  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch (err: any) {
    throw new Error(`Invalid JSON in jewel.config.json: ${err.message}`);
  }

  return validateAndMergeConfig(parsed);
}

export function validateAndMergeConfig(parsed: any): JewelConfig {
  const config = { ...DEFAULT_CONFIG };

  if (parsed.projectName !== undefined) {
    if (typeof parsed.projectName !== 'string') {
      throw new Error('Invalid config: "projectName" must be a string.');
    }
    config.projectName = parsed.projectName;
  }

  if (parsed.mode !== undefined) {
    if (parsed.mode !== 'strict' && parsed.mode !== 'lax') {
      throw new Error('Invalid config: "mode" must be "strict" or "lax".');
    }
    config.mode = parsed.mode;
  }

  const numericFields: (keyof JewelConfig)[] = ['maxRetries', 'maxFilesChanged', 'maxLinesChanged', 'llmTimeoutMs', 'llmMaxRetries'];
  for (const field of numericFields) {
    if (parsed[field] !== undefined) {
      const val = Number(parsed[field]);
      if (isNaN(val) || val < 0) {
        throw new Error(`Invalid config: "${field}" must be a non-negative number.`);
      }
      (config as any)[field] = val;
    }
  }

  const booleanFields: (keyof JewelConfig)[] = [
    'requirePlanBeforeEdit',
    'requireVerificationBeforeDone',
    'allowNewDependencies',
    'allowProtectedFileChanges',
    'allowGitPush',
    'requireHumanDiffApproval',
    'llmStrictJson'
  ];
  for (const field of booleanFields) {
    if (parsed[field] !== undefined) {
      if (typeof parsed[field] !== 'boolean') {
        throw new Error(`Invalid config: "${field}" must be a boolean.`);
      }
      (config as any)[field] = parsed[field];
    }
  }

  if (parsed.provider !== undefined) {
    if (!['none', 'openai', 'anthropic', 'gemini', 'openrouter'].includes(parsed.provider)) {
      throw new Error('Invalid config: "provider" must be one of "none", "openai", "anthropic", "gemini", or "openrouter".');
    }
    config.provider = parsed.provider;
  }

  if (parsed.model !== undefined) {
    if (typeof parsed.model !== 'string') {
      throw new Error('Invalid config: "model" must be a string.');
    }
    config.model = parsed.model;
  }

  if (parsed.temperature !== undefined) {
    const val = Number(parsed.temperature);
    if (isNaN(val) || val < 0) {
      throw new Error('Invalid config: "temperature" must be a non-negative number.');
    }
    config.temperature = val;
  }

  if (parsed.maxOutputTokens !== undefined) {
    const val = Number(parsed.maxOutputTokens);
    if (isNaN(val) || val < 0) {
      throw new Error('Invalid config: "maxOutputTokens" must be a non-negative number.');
    }
    config.maxOutputTokens = val;
  }

  if (parsed.commands !== undefined) {
    if (typeof parsed.commands !== 'object' || parsed.commands === null) {
      throw new Error('Invalid config: "commands" must be an object.');
    }
    config.commands = { ...DEFAULT_CONFIG.commands };
    const cmdKeys = ['lint', 'typecheck', 'test', 'build', 'e2e'] as const;
    for (const key of cmdKeys) {
      if (parsed.commands[key] !== undefined) {
        if (typeof parsed.commands[key] !== 'string') {
          throw new Error(`Invalid config: "commands.${key}" must be a string.`);
        }
        config.commands[key] = parsed.commands[key];
      }
    }
  }

  if (parsed.protectedFiles !== undefined) {
    if (!Array.isArray(parsed.protectedFiles)) {
      throw new Error('Invalid config: "protectedFiles" must be an array of strings.');
    }
    config.protectedFiles = parsed.protectedFiles.map((item: any, i: number) => {
      if (typeof item !== 'string') {
        throw new Error(`Invalid config: "protectedFiles[${i}]" must be a string.`);
      }
      return item;
    });
  }

  if (parsed.dangerousCommandPolicy !== undefined) {
    if (!['block', 'warn', 'allow'].includes(parsed.dangerousCommandPolicy)) {
      throw new Error('Invalid config: "dangerousCommandPolicy" must be "block", "warn", or "allow".');
    }
    config.dangerousCommandPolicy = parsed.dangerousCommandPolicy;
  }

  if (parsed.reportFormat !== undefined) {
    if (!Array.isArray(parsed.reportFormat)) {
      throw new Error('Invalid config: "reportFormat" must be an array.');
    }
    config.reportFormat = parsed.reportFormat.map((item: any, i: number) => {
      if (item !== 'markdown' && item !== 'json') {
        throw new Error(`Invalid config: "reportFormat[${i}]" must be "markdown" or "json".`);
      }
      return item;
    });
  }

  return config;
}
