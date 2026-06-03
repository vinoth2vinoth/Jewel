import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { auditReports } from '../../safety/report-redaction-audit';

export function runReleaseCheck(cwd: string = process.cwd()): void {
  console.log('Running Jewel Public Release Readiness Checklist...\n');

  let failCount = 0;
  let warnCount = 0;

  function report(status: 'PASS' | 'WARN' | 'FAIL', title: string, details?: string) {
    const symbol = status === 'PASS' ? '[PASS]' : status === 'WARN' ? '[WARN]' : '[FAIL]';
    console.log(`${symbol} ${title}`);
    if (details) {
      console.log(`       -> ${details}`);
    }
    if (status === 'FAIL') failCount++;
    if (status === 'WARN') warnCount++;
  }

  // 1. package.json exists and version format is valid
  const pkgPath = path.join(cwd, 'package.json');
  let pkg: any = null;
  if (fs.existsSync(pkgPath)) {
    try {
      pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.version) {
        report('PASS', `Package version exists: ${pkg.version}`);
        
        // 12. warn if version is below release target (0.7.0)
        const parts = pkg.version.split('.').map((p: string) => parseInt(p, 10));
        if (parts[0] < 0 || (parts[0] === 0 && parts[1] < 7)) {
          report('WARN', `Package version ${pkg.version} is below current target 0.7.0.`);
        }
      } else {
        report('FAIL', 'package.json does not contain a "version" field.');
      }
      
      // 11. Print name
      if (pkg.name) {
        console.log(`Package Name: ${pkg.name}`);
      }
    } catch (err: any) {
      report('FAIL', 'Failed to parse package.json.', err.message);
    }
  } else {
    report('FAIL', 'package.json is missing in current working directory.');
  }

  // 2. bin/jewel.js exists
  const binPath = path.join(cwd, 'bin', 'jewel.js');
  if (fs.existsSync(binPath)) {
    report('PASS', 'bin/jewel.js exists.');
  } else {
    report('FAIL', 'bin/jewel.js is missing.');
  }

  // 3. dist folder exists
  const distPath = path.join(cwd, 'dist');
  if (fs.existsSync(distPath) && fs.statSync(distPath).isDirectory()) {
    report('PASS', 'dist/ directory exists.');
  } else {
    report('FAIL', 'dist/ directory is missing. Please run "npm run build".');
  }

  // 4. README exists
  const readmePath = path.join(cwd, 'README.md');
  const readmePath2 = path.join(cwd, 'README');
  if (fs.existsSync(readmePath) || fs.existsSync(readmePath2)) {
    report('PASS', 'README file exists.');
  } else {
    report('FAIL', 'README file (README.md) is missing.');
  }

  // 5. docs exist
  const docsPath = path.join(cwd, 'docs');
  let docsExist = false;
  if (fs.existsSync(docsPath) && fs.statSync(docsPath).isDirectory()) {
    const files = fs.readdirSync(docsPath);
    const mdFiles = files.filter(f => f.endsWith('.md'));
    if (mdFiles.length > 0) {
      report('PASS', `docs/ directory exists and contains ${mdFiles.length} Markdown files.`);
      docsExist = true;
    } else {
      report('WARN', 'docs/ directory is empty or does not contain Markdown files.');
    }
  } else {
    report('WARN', 'docs/ directory is missing.');
  }

  // 6. package files list includes bin and dist (and docs)
  if (pkg) {
    const files = pkg.files || [];
    const hasBin = files.includes('bin');
    const hasDist = files.includes('dist');
    const hasDocs = files.includes('docs');

    if (hasBin && hasDist) {
      report('PASS', 'package.json "files" array includes "bin" and "dist".');
    } else {
      report('FAIL', 'package.json "files" array is missing "bin" or "dist".');
    }

    if (hasDocs) {
      report('PASS', 'package.json "files" array includes "docs".');
    } else {
      report('WARN', 'package.json "files" array is missing "docs". Documentation won\'t be packaged.');
    }
  }

  // 7 & 8. npm pack --dry-run succeeds and contains no test files
  let packFilesList: string[] = [];
  try {
    const output = execSync('npm pack --dry-run 2>&1', { cwd, encoding: 'utf8' });
    report('PASS', 'npm pack --dry-run command executed successfully.');
    
    // Parse pack files list
    const lines = output.split('\n');
    let isListing = false;
    for (const line of lines) {
      if (line.includes('Tarball Contents')) {
        isListing = true;
        continue;
      }
      if (line.includes('Tarball Details')) {
        isListing = false;
        continue;
      }
      if (isListing && line.trim() !== '') {
        const match = line.match(/npm\s+notice\s+(?:\d+(?:\.\d+)?[a-zA-Z]+\s+)?(.*)/);
        if (match) {
          const filename = match[1].trim();
          if (filename) {
            packFilesList.push(filename);
          }
        }
      }
    }

    const testFiles = packFilesList.filter(f => f.includes('.test.') || f.includes('.spec.'));
    if (testFiles.length === 0) {
      report('PASS', 'npm pack contains no test files.');
    } else {
      report('FAIL', `npm pack includes test files: ${testFiles.join(', ')}`);
    }

    // Verify docs are in packed list if they exist
    if (docsExist) {
      const hasWindowsSmoke = packFilesList.some(f => f.includes('docs/windows-smoke-test.md'));
      const hasRealProvider = packFilesList.some(f => f.includes('docs/real-provider-dogfood.md'));
      if (hasWindowsSmoke && hasRealProvider) {
        report('PASS', 'Packed tarball contents include docs/ folder files.');
      } else {
        report('WARN', 'Packed tarball contents did not match expected docs list.');
      }
    }
  } catch (err: any) {
    report('FAIL', 'npm pack --dry-run failed to run.', err.message);
  }

  // 9. jewel version works
  try {
    const versionOutput = execSync(`node "${path.join(distPath, 'cli', 'index.js')}" version`, { cwd, encoding: 'utf8' }).trim();
    if (versionOutput.includes('Jewel version:')) {
      report('PASS', 'jewel version command runs and outputs version information.');
    } else {
      report('FAIL', 'jewel version command returned unexpected output.', versionOutput);
    }
  } catch (err: any) {
    report('FAIL', 'jewel version command failed to execute.', err.message);
  }

  // 10. jewel --help works
  try {
    const helpOutput = execSync(`node "${path.join(distPath, 'cli', 'index.js')}" --help`, { cwd, encoding: 'utf8' }).trim();
    if (helpOutput.includes('AI Coding Safety Harness')) {
      report('PASS', 'jewel --help command runs and outputs help information.');
    } else {
      report('FAIL', 'jewel --help command returned unexpected output.', helpOutput);
    }
  } catch (err: any) {
    report('FAIL', 'jewel --help command failed to execute.', err.message);
  }

  // 13. audit reports for leaked secrets
  const auditResult = auditReports(cwd);
  if (auditResult.success) {
    report('PASS', 'Report redaction audit passed. No leaked secrets detected.');
  } else {
    const fileList = auditResult.leakedFiles.map(f => f.filePath).join(', ');
    report('WARN', `Report redaction audit flagged potential leaked secrets in files: ${fileList}`);
  }

  console.log(`\nRelease Readiness Checklist finished with ${failCount} Failures and ${warnCount} Warnings.`);

  if (failCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}
