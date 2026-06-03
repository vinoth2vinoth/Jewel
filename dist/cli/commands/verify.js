"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runVerify = runVerify;
const config_1 = require("../../core/config");
const runner_1 = require("../../verification/runner");
function runVerify(cwd = process.cwd()) {
    console.log('Running Jewel Verification...');
    try {
        const config = (0, config_1.loadConfig)(cwd);
        const report = (0, runner_1.runVerification)(config, cwd);
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
        }
        else {
            console.error(`\nVerification FAILED or BLOCKED. Status: ${report.overallStatus}`);
            process.exit(1);
        }
    }
    catch (err) {
        console.error('Error running verification:', err.message);
        process.exit(1);
    }
}
