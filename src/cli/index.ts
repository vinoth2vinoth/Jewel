import { runInit } from './commands/init';
import { runVerify } from './commands/verify';
import { runStatus } from './commands/status';
import { runRollback } from './commands/rollback';
import { runDoctor } from './commands/doctor';
import { runAudit } from './commands/audit';
import { runTask } from './commands/run';
import { runVersion } from './commands/version';

function printHelp(): void {
  console.log(`
Jewel CLI - AI Coding Safety Harness (Karpathy-inspired)

Usage:
  jewel <command> [arguments] [options]

Commands:
  init                       Initialize Jewel configuration, AGENTS.md, and skills in the current folder.
  run "<task>"               Execute a task protected by Jewel rules and verification checks.
  verify                     Run all configured verification commands.
  status                     Display the current session, checkpoint, and repository status.
  rollback [session-id]      Roll back the workspace to a session checkpoint state.
  diff [session-id]          Show proposed changes and diff preview for a session.
  audit                      Perform a safety and repository quality check.
  doctor                     Run local environment health and configuration checks.
  version                    Print the version info.

Options:
  -f, --files <file1,file2>  Declare files likely needed for the task contract (used with 'run').
  -m, --mock                 Use the mock agent adapter to automatically apply deterministic patches (used with 'run').
  --yes                      Bypass interactive human diff approval review.
  --no-review                Disable diff approval review (ignored if config requires it).
  --keep-failed              Do not roll back changes if verification or review fails.
  --provider <provider>      Override provider (none, openai, gemini, anthropic, openrouter).
  --model <model>            Override model name.
  --temperature <temp>       Override temperature.
  --max-output-tokens <n>    Override max output tokens.
  --dry-run                  Preview the task contract and files scope without creating a session or applying changes.
  -h, --help                 Print this help menu.
`);
}

export async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    printHelp();
    process.exit(0);
  }

  const command = args[0];

  switch (command) {
    case 'init': {
      runInit();
      break;
    }

    case 'version': {
      runVersion();
      break;
    }

    case 'verify': {
      runVerify();
      break;
    }

    case 'status': {
      runStatus();
      break;
    }

    case 'rollback': {
      const targetSession = args[1] && !args[1].startsWith('-') ? args[1] : undefined;
      runRollback(targetSession);
      break;
    }

    case 'diff': {
      const targetSession = args[1] && !args[1].startsWith('-') ? args[1] : undefined;
      const { runDiff } = require('./commands/diff');
      runDiff(targetSession);
      break;
    }

    case 'doctor': {
      runDoctor();
      break;
    }

    case 'audit': {
      runAudit();
      break;
    }

    case 'run': {
      const taskText = args[1];
      if (!taskText || taskText.startsWith('-')) {
        console.error('Error: You must provide a task description. Example: jewel run "Fix styling bug"');
        process.exit(1);
      }

      // Parse options
      let filesNeeded: string[] = [];
      let useMock = false;
      let yesFlag = false;
      let noReview = false;
      let keepFailed = false;
      let providerOverride: string | undefined;
      let modelOverride: string | undefined;
      let temperatureOverride: number | undefined;
      let maxOutputTokensOverride: number | undefined;
      let dryRun = false;

      const remainingArgs = args.slice(2);
      for (let i = 0; i < remainingArgs.length; i++) {
        const arg = remainingArgs[i];
        if (arg === '-f' || arg === '--files') {
          const fileVal = remainingArgs[i + 1];
          if (fileVal && !fileVal.startsWith('-')) {
            filesNeeded = fileVal.split(',').map(s => s.trim()).filter(Boolean);
            i++;
          }
        } else if (arg === '-m' || arg === '--mock') {
          useMock = true;
        } else if (arg === '--yes') {
          yesFlag = true;
        } else if (arg === '--no-review') {
          noReview = true;
        } else if (arg === '--keep-failed') {
          keepFailed = true;
        } else if (arg === '--provider') {
          const val = remainingArgs[i + 1];
          if (val && !val.startsWith('-')) {
            providerOverride = val;
            i++;
          }
        } else if (arg === '--model') {
          const val = remainingArgs[i + 1];
          if (val && !val.startsWith('-')) {
            modelOverride = val;
            i++;
          }
        } else if (arg === '--temperature') {
          const val = remainingArgs[i + 1];
          if (val && !val.startsWith('-')) {
            temperatureOverride = parseFloat(val);
            i++;
          }
        } else if (arg === '--max-output-tokens') {
          const val = remainingArgs[i + 1];
          if (val && !val.startsWith('-')) {
            maxOutputTokensOverride = parseInt(val, 10);
            i++;
          }
        } else if (arg === '--dry-run') {
          dryRun = true;
        }
      }

      const overrides = {
        provider: providerOverride,
        model: modelOverride,
        temperature: temperatureOverride,
        maxOutputTokens: maxOutputTokensOverride
      };

      await runTask(taskText, filesNeeded, useMock, process.cwd(), yesFlag, noReview, keepFailed, overrides, dryRun);
      break;
    }

    default: {
      console.error(`Error: Unknown command "${command}".`);
      printHelp();
      process.exit(1);
    }
  }
}

// Execute main if called directly
if (require.main === module) {
  main().catch(err => {
    console.error('Unhandled CLI error:', err);
    process.exit(1);
  });
}
