import * as readline from 'readline';
import { runInit } from './init';
import { runStatus } from './status';
import { runVerify } from './verify';
import { runRollback } from './rollback';
import { runDoctor } from './doctor';
import { runAudit } from './audit';
import { runTask } from './run';
import { runVersion } from './version';
import { runDiff } from './diff';
import { runReleaseCheck } from './release-check';
import { runSmokeProvider } from './smoke-provider';
import { runProviderReady } from './provider-ready';
import { formatSessionHistoryTable, getSessionForResume, listRecentSessions } from '../../core/session-history';

export function tokenizeInput(input: string): string[] {
  const tokens: string[] = [];
  const regex = /[^\s"']+|"([^"]*)"|'([^']*)'/g;
  let match;
  while ((match = regex.exec(input)) !== null) {
    if (match[1] !== undefined) {
      tokens.push(match[1]);
    } else if (match[2] !== undefined) {
      tokens.push(match[2]);
    } else {
      tokens.push(match[0]);
    }
  }
  return tokens;
}

export interface TuiOptions {
  provider?: string;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  files?: string[];
  mock?: boolean;
  yes?: boolean;
  noReview?: boolean;
  keepFailed?: boolean;
  dryRun?: boolean;
  ui?: boolean;
  schema?: boolean;
  noWrite?: boolean;
  force?: boolean;
}

export function parseOptions(tokens: string[]): { options: TuiOptions; remaining: string[] } {
  const options: TuiOptions = {};
  const remaining: string[] = [];

  const valuedOptions = new Set(['--provider', '--model', '--temperature', '--max-output-tokens', '-f', '--files']);

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (valuedOptions.has(token)) {
      const nextToken = tokens[i + 1];
      if (nextToken !== undefined && !nextToken.startsWith('-')) {
        const value = nextToken;
        i++;

        if (token === '--provider') {
          options.provider = value;
        } else if (token === '--model') {
          options.model = value;
        } else if (token === '--temperature') {
          options.temperature = parseFloat(value);
        } else if (token === '--max-output-tokens') {
          options.maxOutputTokens = parseInt(value, 10);
        } else if (token === '-f' || token === '--files') {
          options.files = value.split(',').map(s => s.trim()).filter(Boolean);
        }
      } else {
        console.warn(`Warning: Option ${token} is missing a value.`);
      }
    } else {
      // Boolean Flags
      if (token === '--mock' || token === '-m') {
        options.mock = true;
      } else if (token === '--yes') {
        options.yes = true;
      } else if (token === '--no-review') {
        options.noReview = true;
      } else if (token === '--keep-failed') {
        options.keepFailed = true;
      } else if (token === '--dry-run') {
        options.dryRun = true;
      } else if (token === '--ui') {
        options.ui = true;
      } else if (token === '--schema') {
        options.schema = true;
      } else if (token === '--no-write') {
        options.noWrite = true;
      } else if (token === '--force') {
        options.force = true;
      } else {
        remaining.push(token);
      }
    }
  }

  return { options, remaining };
}

export async function runTui(cwd: string = process.cwd()): Promise<void> {
  console.log(`
==================================================
💎 WELCOME TO JEWEL INTERACTIVE TUI SHELL 💎
==================================================
Type your task directly to start a safe coding run,
or type /help to list all available slash commands.
Type /exit or /quit to close the TUI shell.
==================================================
`);

  let rl: readline.Interface | null = null;
  let isCommandActive = false;

  const originalExit = process.exit;
  const originalUncaught = process.listeners('uncaughtException');
  const originalUnhandled = process.listeners('unhandledRejection');

  const setupSIGINT = (readlineInterface: readline.Interface) => {
    const handleSigint = () => {
      if (isCommandActive) {
        console.log('\n[TUI] Interrupting command execution. Performing rollback for the active session...');
        try {
          (process as any).exit = originalExit;
          runRollback(undefined, cwd);
        } catch (err: any) {
          console.error(`[-] Interruption rollback failed: ${err.message}`);
        }
        originalExit(130);
      } else {
        readlineInterface.close();
        process.exit(0);
      }
    };

    process.removeAllListeners('SIGINT');
    process.on('SIGINT', handleSigint);
    readlineInterface.on('SIGINT', handleSigint);
  };

  const executeWithSafetyPatch = async (fn: () => Promise<void> | void): Promise<void> => {
    isCommandActive = true;

    const handleUncaught = (err: any) => {
      if (err && err.message && err.message.startsWith('exit-')) {
        const exitCode = parseInt(err.message.split('-')[1], 10);
        if (exitCode === 0) {
          console.log(`Command completed successfully.`);
        } else {
          console.log(`Command exited with status code ${exitCode}`);
        }
      } else {
        console.error(`Uncaught error during execution:`, err);
        originalExit(1);
      }
    };

    process.removeAllListeners('uncaughtException');
    process.removeAllListeners('unhandledRejection');
    process.on('uncaughtException', handleUncaught);
    process.on('unhandledRejection', handleUncaught);

    try {
      (process as any).exit = (code?: string | number | null | undefined): never => {
        throw new Error(`exit-${code ?? 0}`);
      };
      await fn();
    } catch (err: any) {
      if (err && err.message && err.message.startsWith('exit-')) {
        const exitCode = parseInt(err.message.split('-')[1], 10);
        if (exitCode === 0) {
          console.log(`Command completed successfully.`);
        } else {
          console.log(`Command exited with status code ${exitCode}`);
        }
      } else {
        console.error(`Command failed with error: ${err.message || err}`);
      }
    } finally {
      (process as any).exit = originalExit;
      process.removeAllListeners('uncaughtException');
      process.removeAllListeners('unhandledRejection');
      originalUncaught.forEach(l => process.on('uncaughtException', l as any));
      originalUnhandled.forEach(l => process.on('unhandledRejection', l as any));
      isCommandActive = false;
    }
  };

  const promptLoop = () => {
    rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    setupSIGINT(rl);

    rl.question('jewel 💎 > ', async (line) => {
      if (rl) {
        rl.close();
      }

      const input = line.trim();
      if (!input) {
        promptLoop();
        return;
      }

      const tokens = tokenizeInput(input);
      const command = tokens[0];

      if (command.startsWith('/')) {
        // Slash Commands
        switch (command) {
          case '/exit':
          case '/quit': {
            console.log('Exiting Jewel TUI. Goodbye!');
            process.exit(0);
            return;
          }

          case '/help':
          case '/h': {
            console.log(`
Available TUI Slash Commands:
  /init                      Initialize Jewel in the current directory.
  /status                    Show checkpoint and git status.
  /verify                    Run verification checks.
  /rollback [session-id]     Roll back files to checkpoint. Support flags: --force, --dry-run.
  /diff [session-id]         Show proposed changes preview.
  /doctor                    Run local environment health diagnostics.
  /release-check             Run release checklist validations.
  /audit                     Perform repository safety audit.
  /version                   Print Jewel CLI version info.
  /smoke-provider            Run validation smoke tests. Support flags: --provider, --model, --schema, --no-write.
  /provider-ready            Verify model config. Support flags: --provider, --model.
  /run <task>                Start a safe AI coding task. Support standard flags like --mock.
  /new                       Create a new project with the guided wizard (blueprints).
  /history                   Show recent session task history.
  /resume [session-id]       Re-run a previous session task. Supports --mock, --yes, --ui flags.
  /help, /h                  Show this help menu.
  /exit, /quit               Exit the interactive shell.
`);
            promptLoop();
            break;
          }

          case '/init': {
            await executeWithSafetyPatch(() => runInit(cwd));
            promptLoop();
            break;
          }

          case '/status': {
            await executeWithSafetyPatch(() => runStatus(cwd));
            promptLoop();
            break;
          }

          case '/verify': {
            await executeWithSafetyPatch(() => runVerify(cwd));
            promptLoop();
            break;
          }

          case '/rollback': {
            const { options, remaining } = parseOptions(tokens.slice(1));
            const sessionId = remaining[0];
            await executeWithSafetyPatch(() => runRollback(sessionId, cwd, !!options.dryRun, !!options.force));
            promptLoop();
            break;
          }

          case '/diff': {
            const { remaining } = parseOptions(tokens.slice(1));
            const sessionId = remaining[0];
            await executeWithSafetyPatch(() => runDiff(sessionId, cwd));
            promptLoop();
            break;
          }

          case '/doctor': {
            await executeWithSafetyPatch(() => runDoctor(cwd));
            promptLoop();
            break;
          }

          case '/release-check': {
            await executeWithSafetyPatch(() => runReleaseCheck(cwd));
            promptLoop();
            break;
          }

          case '/audit': {
            await executeWithSafetyPatch(() => runAudit(cwd));
            promptLoop();
            break;
          }

          case '/version': {
            await executeWithSafetyPatch(() => runVersion());
            promptLoop();
            break;
          }

          case '/smoke-provider': {
            const { options } = parseOptions(tokens.slice(1));
            await executeWithSafetyPatch(() => runSmokeProvider(options.provider, options.model, !!options.schema, !!options.noWrite, cwd));
            promptLoop();
            break;
          }

          case '/provider-ready': {
            const { options } = parseOptions(tokens.slice(1));
            await executeWithSafetyPatch(() => runProviderReady(options.provider || '', options.model, cwd));
            promptLoop();
            break;
          }

          case '/new': {
            const { runCreate } = require('./create');
            await executeWithSafetyPatch(() => runCreate({ cwd }));
            promptLoop();
            break;
          }

          case '/history':
          case '/hist': {
            const sessions = listRecentSessions(cwd, 10);
            console.log(formatSessionHistoryTable(sessions));
            promptLoop();
            break;
          }

          case '/resume': {
            const { options, remaining } = parseOptions(tokens.slice(1));
            const sessionId = remaining[0];
            const payload = getSessionForResume(cwd, sessionId);
            if (!payload) {
              console.error('Error: No session found to resume. Use /history to list sessions.');
              promptLoop();
              break;
            }
            console.log(`[+] Resuming session ${payload.sessionId}: "${payload.task}"`);
            const overrides = {
              provider: options.provider,
              model: options.model,
              temperature: options.temperature,
              maxOutputTokens: options.maxOutputTokens
            };
            await executeWithSafetyPatch(() => runTask(
              payload.task,
              payload.files,
              !!options.mock,
              cwd,
              !!options.yes,
              !!options.noReview,
              !!options.keepFailed,
              overrides,
              !!options.dryRun,
              !!options.ui
            ));
            promptLoop();
            break;
          }

          case '/run': {
            const taskText = tokens.slice(1).join(' ');
            if (!taskText) {
              console.error('Error: You must provide a task text description. Example: /run "fix the broken math tests"');
              promptLoop();
              break;
            }
            const taskTokens = tokenizeInput(taskText);
            const { options, remaining } = parseOptions(taskTokens);
            const cleanedTask = remaining.join(' ');
            const overrides = {
              provider: options.provider,
              model: options.model,
              temperature: options.temperature,
              maxOutputTokens: options.maxOutputTokens
            };

            await executeWithSafetyPatch(() => runTask(
              cleanedTask,
              options.files || [],
              !!options.mock,
              cwd,
              !!options.yes,
              !!options.noReview,
              !!options.keepFailed,
              overrides,
              !!options.dryRun,
              !!options.ui
            ));
            promptLoop();
            break;
          }

          default: {
            console.log(`Error: Unknown command "${command}". Type /help or /h for assistance.`);
            promptLoop();
            break;
          }
        }
      } else {
        // Natural language task directly
        const { options, remaining } = parseOptions(tokens);
        const cleanedTask = remaining.join(' ');
        const overrides = {
          provider: options.provider,
          model: options.model,
          temperature: options.temperature,
          maxOutputTokens: options.maxOutputTokens
        };

        await executeWithSafetyPatch(() => runTask(
          cleanedTask,
          options.files || [],
          !!options.mock,
          cwd,
          !!options.yes,
          !!options.noReview,
          !!options.keepFailed,
          overrides,
          !!options.dryRun,
          !!options.ui
        ));
        promptLoop();
      }
    });
  };

  promptLoop();
}
