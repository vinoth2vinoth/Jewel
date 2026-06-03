import { runInit } from './commands/init';
import { runVerify } from './commands/verify';
import { runStatus } from './commands/status';
import { runRollback } from './commands/rollback';
import { runDoctor } from './commands/doctor';
import { runAudit } from './commands/audit';
import { runTask } from './commands/run';

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
  audit                      Perform a safety and repository quality check.
  doctor                     Run local environment health and configuration checks.

Options:
  -f, --files <file1,file2>  Declare files likely needed for the task contract (used with 'run').
  -m, --mock                 Use the mock agent adapter to automatically apply deterministic patches (used with 'run').
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
        }
      }

      await runTask(taskText, filesNeeded, useMock);
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
