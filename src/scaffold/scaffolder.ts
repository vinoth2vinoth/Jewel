import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { ProjectBlueprint } from './blueprints';
import { DEFAULT_CONFIG } from '../core/config';

export interface ScaffoldOptions {
  projectName: string;
  targetDir: string;
  provider?: 'none' | 'openai' | 'anthropic' | 'gemini' | 'openrouter' | 'deepseek';
  model?: string;
  gitInit?: boolean;
}

export interface ScaffoldResult {
  projectDir: string;
  filesCreated: string[];
  gitInitialized: boolean;
  warnings: string[];
}

function sanitizeProjectName(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9-_ ]+/g, '')
    .trim()
    .replace(/\s+/g, '-');
  return cleaned || 'my-project';
}

export function buildJewelConfigForBlueprint(
  blueprint: ProjectBlueprint,
  projectName: string,
  provider?: ScaffoldOptions['provider'],
  model?: string
): string {
  const config = {
    projectName,
    mode: 'strict',
    maxRetries: DEFAULT_CONFIG.maxRetries,
    maxFilesChanged: DEFAULT_CONFIG.maxFilesChanged,
    maxLinesChanged: DEFAULT_CONFIG.maxLinesChanged,
    requirePlanBeforeEdit: true,
    requireVerificationBeforeDone: true,
    allowNewDependencies: false,
    allowProtectedFileChanges: false,
    allowGitPush: false,
    requireHumanDiffApproval: false,
    provider: provider || 'none',
    model: model || '',
    temperature: 0,
    maxOutputTokens: 4000,
    commands: blueprint.commands,
    protectedFiles: [
      '.env',
      '.env.local',
      '.env.*',
      'package-lock.json',
      'jewel.config.json'
    ],
    dangerousCommandPolicy: 'block',
    reportFormat: ['markdown', 'json']
  };
  return JSON.stringify(config, null, 2) + '\n';
}

export function scaffoldProject(
  blueprint: ProjectBlueprint,
  options: ScaffoldOptions
): ScaffoldResult {
  const projectName = sanitizeProjectName(options.projectName);
  const projectDir = path.resolve(options.targetDir, projectName);
  const warnings: string[] = [];

  if (fs.existsSync(projectDir) && fs.readdirSync(projectDir).length > 0) {
    throw new Error(`Directory "${projectDir}" already exists and is not empty. Choose a different name.`);
  }
  fs.mkdirSync(projectDir, { recursive: true });

  const filesCreated: string[] = [];

  for (const file of blueprint.files) {
    const filePath = path.join(projectDir, file.path);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, file.content.replace(/PROJECT_NAME/g, projectName), 'utf8');
    filesCreated.push(file.path);
  }

  fs.writeFileSync(
    path.join(projectDir, 'jewel.config.json'),
    buildJewelConfigForBlueprint(blueprint, projectName, options.provider, options.model),
    'utf8'
  );
  filesCreated.push('jewel.config.json');

  const jewelDir = path.join(projectDir, '.jewel');
  fs.mkdirSync(jewelDir, { recursive: true });
  fs.writeFileSync(
    path.join(jewelDir, 'blueprint.json'),
    JSON.stringify({ blueprintId: blueprint.id, createdAt: new Date().toISOString() }, null, 2) + '\n',
    'utf8'
  );
  filesCreated.push('.jewel/blueprint.json');

  fs.writeFileSync(
    path.join(projectDir, '.gitignore'),
    'node_modules/\n.jewel/backups/\n.env\n.env.local\n',
    'utf8'
  );
  filesCreated.push('.gitignore');

  let gitInitialized = false;
  if (options.gitInit !== false) {
    try {
      execSync('git init', { cwd: projectDir, stdio: 'pipe' });
      execSync('git add -A', { cwd: projectDir, stdio: 'pipe' });
      try {
        execSync('git commit -m "Initial scaffold by Jewel"', { cwd: projectDir, stdio: 'pipe' });
      } catch {
        warnings.push('Git repository initialized but initial commit failed (configure git user.name/user.email).');
      }
      gitInitialized = true;
    } catch {
      warnings.push('Git not available — project created without version control. Jewel will use backup-copy checkpoints.');
    }
  }

  return { projectDir, filesCreated, gitInitialized, warnings };
}
