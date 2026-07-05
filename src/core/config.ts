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
  allowUnstructuredProviderFallback: boolean;
  preferredProviders?: string[];
  minCoverage?: {
    lines?: number;
    statements?: number;
    functions?: number;
    branches?: number;
  };
  coverageReportPath?: string;
  auditSpawnedProcesses?: boolean;
  interactiveRetryMode?: boolean;
  maxSessionCost?: number;
  critics?: ('security' | 'linter' | 'architect')[];
  useASTDiffGuard?: boolean;
  useSandbox?: boolean;
  sandboxFallbackToHost?: boolean;
  sandboxImage?: string;
  sandboxVolumes?: Record<string, string>;
  sandboxEnv?: Record<string, string>;
  allowedSymbolChanges?: string[];
  sandboxNetwork?: 'none' | 'host' | 'bridge';
  sandboxReadOnlyRoot?: boolean;
  sandboxWritePaths?: string[];
  agentToolLoopEnabled?: boolean;
  agentToolLoopMaxSteps?: number;
  agentToolLoopMaxContextChars?: number;
  pluginsEnabled?: boolean;
  semanticIndexEnabled?: boolean;
  requirePlanApproval?: boolean;
  fastPathEnabled?: boolean;
  fastPathMaxFiles?: number;
  fastPathMaxRisk?: 'low' | 'medium' | 'high';
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
  reportFormat: ['markdown', 'json'],
  allowUnstructuredProviderFallback: false,
  preferredProviders: [],
  minCoverage: undefined,
  coverageReportPath: '',
  auditSpawnedProcesses: true,
  interactiveRetryMode: true,
  maxSessionCost: 0.0,
  critics: ['security'],
  useASTDiffGuard: false,
  useSandbox: false,
  sandboxFallbackToHost: false,
  sandboxImage: 'node:18-slim',
  sandboxVolumes: {},
  sandboxEnv: {},
  allowedSymbolChanges: [],
  sandboxNetwork: 'none',
  sandboxReadOnlyRoot: true,
  sandboxWritePaths: [],
  agentToolLoopEnabled: true,
  agentToolLoopMaxSteps: 8,
  agentToolLoopMaxContextChars: 80_000,
  pluginsEnabled: true,
  semanticIndexEnabled: true,
  requirePlanApproval: false,
  fastPathEnabled: true,
  fastPathMaxFiles: 1,
  fastPathMaxRisk: 'low'
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

  const numericFields: (keyof JewelConfig)[] = ['maxRetries', 'maxFilesChanged', 'maxLinesChanged', 'llmTimeoutMs', 'llmMaxRetries', 'maxSessionCost', 'agentToolLoopMaxSteps', 'agentToolLoopMaxContextChars', 'fastPathMaxFiles'];
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
    'llmStrictJson',
    'allowUnstructuredProviderFallback',
    'auditSpawnedProcesses',
    'interactiveRetryMode',
    'useASTDiffGuard',
    'useSandbox',
    'sandboxFallbackToHost',
    'agentToolLoopEnabled',
    'pluginsEnabled',
    'semanticIndexEnabled',
    'requirePlanApproval',
    'fastPathEnabled'
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

  if (parsed.preferredProviders !== undefined) {
    if (!Array.isArray(parsed.preferredProviders)) {
      throw new Error('Invalid config: "preferredProviders" must be an array of strings.');
    }
    config.preferredProviders = parsed.preferredProviders.map((item: any, i: number) => {
      if (typeof item !== 'string') {
        throw new Error(`Invalid config: "preferredProviders[${i}]" must be a string.`);
      }
      return item;
    });
  }

  if (parsed.minCoverage !== undefined) {
    if (typeof parsed.minCoverage !== 'object' || parsed.minCoverage === null) {
      throw new Error('Invalid config: "minCoverage" must be an object.');
    }
    config.minCoverage = {};
    const coverageKeys = ['lines', 'statements', 'functions', 'branches'] as const;
    for (const key of coverageKeys) {
      if (parsed.minCoverage[key] !== undefined) {
        const val = Number(parsed.minCoverage[key]);
        if (isNaN(val) || val < 0 || val > 100) {
          throw new Error(`Invalid config: "minCoverage.${key}" must be a number between 0 and 100.`);
        }
        config.minCoverage[key] = val;
      }
    }
  }

  if (parsed.coverageReportPath !== undefined) {
    if (typeof parsed.coverageReportPath !== 'string') {
      throw new Error('Invalid config: "coverageReportPath" must be a string.');
    }
    config.coverageReportPath = parsed.coverageReportPath;
  }

  if (parsed.critics !== undefined) {
    if (!Array.isArray(parsed.critics)) {
      throw new Error('Invalid config: "critics" must be an array.');
    }
    config.critics = parsed.critics.map((item: any, i: number) => {
      if (typeof item !== 'string' || !['security', 'linter', 'architect'].includes(item)) {
        throw new Error(`Invalid config: "critics[${i}]" must be one of "security", "linter", or "architect".`);
      }
      return item as 'security' | 'linter' | 'architect';
    });
  }

  if (parsed.allowedSymbolChanges !== undefined) {
    if (!Array.isArray(parsed.allowedSymbolChanges)) {
      throw new Error('Invalid config: "allowedSymbolChanges" must be an array.');
    }
    config.allowedSymbolChanges = parsed.allowedSymbolChanges.map((item: any, i: number) => {
      if (typeof item !== 'string') {
        throw new Error(`Invalid config: "allowedSymbolChanges[${i}]" must be a string.`);
      }
      return item;
    });
  }

  if (parsed.sandboxImage !== undefined) {
    if (typeof parsed.sandboxImage !== 'string') {
      throw new Error('Invalid config: "sandboxImage" must be a string.');
    }
    config.sandboxImage = parsed.sandboxImage;
  }

  const isPlainObject = (val: any) => typeof val === 'object' && val !== null && !Array.isArray(val);

  if (parsed.sandboxVolumes !== undefined) {
    if (!isPlainObject(parsed.sandboxVolumes)) {
      throw new Error('Invalid config: "sandboxVolumes" must be an object.');
    }
    config.sandboxVolumes = {};
    for (const [key, val] of Object.entries(parsed.sandboxVolumes)) {
      if (typeof key !== 'string' || typeof val !== 'string') {
        throw new Error('Invalid config: "sandboxVolumes" keys and values must be strings.');
      }
      if (!val.startsWith('/')) {
        throw new Error(`Invalid config: "sandboxVolumes" destination path "${val}" must be absolute (start with "/").`);
      }
      config.sandboxVolumes[key] = val;
    }
  }

  if (parsed.sandboxEnv !== undefined) {
    if (!isPlainObject(parsed.sandboxEnv)) {
      throw new Error('Invalid config: "sandboxEnv" must be an object.');
    }
    config.sandboxEnv = {};
    for (const [key, val] of Object.entries(parsed.sandboxEnv)) {
      if (typeof key !== 'string' || typeof val !== 'string') {
        throw new Error('Invalid config: "sandboxEnv" keys and values must be strings.');
      }
      config.sandboxEnv[key] = val;
    }
  }

  if (parsed.sandboxNetwork !== undefined) {
    if (!['none', 'host', 'bridge'].includes(parsed.sandboxNetwork)) {
      throw new Error('Invalid config: "sandboxNetwork" must be one of "none", "host", or "bridge".');
    }
    config.sandboxNetwork = parsed.sandboxNetwork;
  }

  if (parsed.sandboxReadOnlyRoot !== undefined) {
    if (typeof parsed.sandboxReadOnlyRoot !== 'boolean') {
      throw new Error('Invalid config: "sandboxReadOnlyRoot" must be a boolean.');
    }
    config.sandboxReadOnlyRoot = parsed.sandboxReadOnlyRoot;
  }

  if (parsed.sandboxWritePaths !== undefined) {
    if (!Array.isArray(parsed.sandboxWritePaths)) {
      throw new Error('Invalid config: "sandboxWritePaths" must be an array of strings.');
    }
    const normalizedList = parsed.sandboxWritePaths.map((item: any, i: number) => {
      if (typeof item !== 'string') {
        throw new Error(`Invalid config: "sandboxWritePaths[${i}]" must be a string.`);
      }
      
      // Block colons to prevent drive-relative escapes (e.g., C:foo) and NTFS Alternate Data Streams (ADS)
      if (item.includes(':')) {
        throw new Error(`Invalid config: "sandboxWritePaths[${i}]" contains a colon (":") which is not allowed.`);
      }

      // Convert backslashes to forward slashes before normalizing to ensure cross-platform consistency
      const posixPath = item.replace(/\\/g, '/');
      const isAbsolute = path.isAbsolute(item) || posixPath.startsWith('/');
      let normalized = path.normalize(posixPath).replace(/\\/g, '/');

      // Strip trailing slashes unless path is exactly /
      if (normalized.endsWith('/') && normalized !== '/') {
        normalized = normalized.slice(0, -1);
      }

      // Block root reference escapes, empty paths, and parent traversals
      const isRoot = normalized === '.' || normalized === './' || normalized === '';
      const isTraversal = normalized === '..' || normalized.startsWith('../');

      if (isAbsolute || isRoot || isTraversal) {
        throw new Error(`Invalid config: "sandboxWritePaths[${i}]" must be a relative path inside the workspace root and cannot escape it.`);
      }
      return normalized; // Return canonical normalized path
    });

    config.sandboxWritePaths = Array.from(new Set(normalizedList));
  }

  if (parsed.fastPathMaxRisk !== undefined) {
    if (!['low', 'medium', 'high'].includes(parsed.fastPathMaxRisk)) {
      throw new Error('Invalid config: "fastPathMaxRisk" must be "low", "medium", or "high".');
    }
    config.fastPathMaxRisk = parsed.fastPathMaxRisk;
  }

  return config;
}
