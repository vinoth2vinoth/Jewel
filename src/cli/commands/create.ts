import { execSync } from 'child_process';
import { BLUEPRINTS, getBlueprint, matchBlueprint, ProjectBlueprint } from '../../scaffold/blueprints';
import { scaffoldProject } from '../../scaffold/scaffolder';
import { askQuestion } from './run-helpers';

export interface CreateOptions {
  type?: string;
  name?: string;
  provider?: string;
  model?: string;
  yes?: boolean;
  cwd?: string;
}

const VALID_PROVIDERS = ['none', 'openai', 'anthropic', 'gemini', 'openrouter', 'deepseek'] as const;

function printBlueprintMenu(): void {
  console.log('\nWhat kind of project do you want to build?\n');
  BLUEPRINTS.forEach((bp, i) => {
    console.log(`  [${i + 1}] ${bp.name}`);
    console.log(`      ${bp.description}`);
  });
  console.log('');
}

async function pickBlueprintInteractive(): Promise<ProjectBlueprint> {
  printBlueprintMenu();
  const answer = await askQuestion('Pick a number, or describe it in your own words: ');
  const trimmed = answer.trim();

  const num = parseInt(trimmed, 10);
  if (!Number.isNaN(num) && num >= 1 && num <= BLUEPRINTS.length) {
    return BLUEPRINTS[num - 1];
  }

  if (trimmed.length > 0) {
    const matched = matchBlueprint(trimmed);
    console.log(`\n[+] Sounds like a "${matched.name}" project.`);
    return matched;
  }

  return BLUEPRINTS[2];
}

async function pickProviderInteractive(): Promise<{ provider: string; model: string }> {
  console.log('\nWhich AI provider should Jewel use for coding tasks?');
  console.log('  [1] DeepSeek (recommended — low cost, needs DEEPSEEK_API_KEY)');
  console.log('  [2] Gemini (free tier, needs GEMINI_API_KEY)');
  console.log('  [3] None for now (you can still use --mock and set a provider later)');
  const answer = await askQuestion('Pick a number [3]: ');
  const choice = answer.trim() || '3';
  if (choice === '1') return { provider: 'deepseek', model: 'deepseek-chat' };
  if (choice === '2') return { provider: 'gemini', model: 'gemini-2.0-flash' };
  return { provider: 'none', model: '' };
}

export async function runCreate(options: CreateOptions = {}): Promise<void> {
  const cwd = options.cwd || process.cwd();

  console.log('\n=== Jewel Project Creator ===');

  let blueprint: ProjectBlueprint | null = null;
  if (options.type) {
    blueprint = getBlueprint(options.type);
    if (!blueprint) {
      console.error(`Error: Unknown project type "${options.type}". Valid types: ${BLUEPRINTS.map(b => b.id).join(', ')}`);
      process.exit(1);
    }
  } else {
    blueprint = await pickBlueprintInteractive();
  }

  let name = options.name;
  if (!name) {
    const answer = await askQuestion('What should the project be called? [my-project]: ');
    name = answer.trim() || 'my-project';
  }

  let provider = options.provider;
  let model = options.model || '';
  if (provider !== undefined) {
    if (!VALID_PROVIDERS.includes(provider as typeof VALID_PROVIDERS[number])) {
      console.error(`Error: Invalid provider "${provider}". Valid: ${VALID_PROVIDERS.join(', ')}`);
      process.exit(1);
    }
  } else if (!options.yes) {
    const picked = await pickProviderInteractive();
    provider = picked.provider;
    model = model || picked.model;
  } else {
    provider = 'none';
  }

  console.log(`\n[+] Creating "${name}" from the ${blueprint.name} blueprint...`);

  let result;
  try {
    result = scaffoldProject(blueprint, {
      projectName: name,
      targetDir: cwd,
      provider: provider as typeof VALID_PROVIDERS[number],
      model
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Error: ${msg}`);
    process.exit(1);
  }

  console.log(`[+] Created ${result.filesCreated.length} files in ${result.projectDir}`);
  console.log(`[+] Git: ${result.gitInitialized ? 'initialized with first commit' : 'not initialized'}`);
  for (const w of result.warnings) {
    console.warn(`[!] ${w}`);
  }

  // First verification run so the user starts green
  if (blueprint.commands.test) {
    console.log('\n[+] Running the first test to make sure everything works...');
    try {
      execSync(blueprint.commands.test, { cwd: result.projectDir, stdio: 'pipe', timeout: 120_000 });
      console.log('[+] All starter tests pass. You are ready to build!');
    } catch {
      console.warn('[!] Starter tests did not pass on this machine. Check Node.js version (18+ required).');
    }
  }

  console.log(`\nNext steps:`);
  console.log(`  cd ${name}`);
  console.log(`  jewel run "your first change" --yes    (or add --mock to try without an API key)`);
  console.log(`  jewel build "describe the whole project you want"   (multi-step autonomous build)`);
  console.log('');
}
