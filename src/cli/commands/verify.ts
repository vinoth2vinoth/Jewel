import { loadConfig } from '../../core/config';
import { runVerification } from '../../verification/runner';

export function runVerify(cwd: string = process.cwd()): void {
  console.log('Running Jewel Verification...');
  try {
    const config = loadConfig(cwd);
    const report = runVerification(config, cwd);

    console.log('\n--- Verification Report ---');
    console.log(`Project: ${report.projectName}`);
    console.log(`Overall Status: ${report.overallStatus}`);
    console.log(`Passed: ${report.stats.passed}`);
    console.log(`Failed: ${report.stats.failed}`);
    console.log(`Blocked: ${report.stats.blocked}`);
    console.log(`Skipped: ${report.stats.skipped}`);

    console.log('\nCommand Details:');
    for (const r of report.results) {
      const lineStr = r.commandLine ? `(\`${r.commandLine}\`)` : '';
      console.log(`  - [${r.status}] ${r.commandKey} ${lineStr}`);
      if (r.errorMsg) {
        console.log(`    Reason: ${r.errorMsg}`);
      }
    }

    if (report.overallStatus === 'PASS' || report.overallStatus === 'SKIPPED') {
      console.log(`\nVerification finished. Status: ${report.overallStatus}`);
      process.exit(0);
    } else {
      console.error(`\nVerification FAILED or BLOCKED. Status: ${report.overallStatus}`);
      process.exit(1);
    }
  } catch (err: any) {
    console.error('Error running verification:', err.message);
    process.exit(1);
  }
}
