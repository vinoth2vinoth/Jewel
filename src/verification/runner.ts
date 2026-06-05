import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { JewelConfig } from '../core/config';
import { checkCommandPolicy } from '../safety/policy';

export interface CommandResult {
  commandKey: string;
  commandLine: string;
  status: 'PASS' | 'FAIL' | 'BLOCKED' | 'SKIPPED';
  exitCode?: number;
  stdout: string;
  stderr: string;
  errorMsg?: string;
}

export interface VerificationReport {
  projectName: string;
  date: string;
  mode: 'strict' | 'lax';
  overallStatus: 'PASS' | 'FAIL' | 'BLOCKED' | 'SKIPPED' | 'COVERAGE_THRESHOLD_VIOLATION';
  stats: {
    passed: number;
    failed: number;
    skipped: number;
    blocked: number;
  };
  results: CommandResult[];
}

export const dockerUtils = {
  isDockerAvailable(): boolean {
    try {
      cp.execSync('docker info', { stdio: 'ignore', timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  },
  executeDocker(
    args: string[],
    cwd: string,
    env: Record<string, string | undefined>,
    onChunk?: (chunk: string, type: 'stdout' | 'stderr') => void
  ): Promise<{ status: number | null; signal: string | null; stdout: string; stderr: string; error?: Error }> {
    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let error: Error | undefined;
      let completed = false;

      const child = cp.spawn('docker', args, { cwd, env });

      child.stdout.on('data', (data) => {
        const str = data.toString();
        stdout += str;
        if (onChunk) onChunk(str, 'stdout');
      });

      child.stderr.on('data', (data) => {
        const str = data.toString();
        stderr += str;
        if (onChunk) onChunk(str, 'stderr');
      });

      child.on('error', (err) => {
        error = err;
        if (!completed) {
          completed = true;
          resolve({ status: null, signal: null, stdout, stderr, error });
        }
      });

      child.on('close', (status, signal) => {
        if (!completed) {
          completed = true;
          resolve({ status, signal, stdout, stderr, error });
        }
      });
    });
  }
};

function executeHost(
  cmdLine: string,
  cwd: string,
  env: Record<string, string | undefined>,
  onChunk?: (chunk: string, type: 'stdout' | 'stderr') => void
): Promise<{ status: number | null; signal: string | null; stdout: string; stderr: string; error?: Error }> {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let error: Error | undefined;
    let completed = false;

    const child = cp.spawn(cmdLine, [], { cwd, env, shell: true });

    child.stdout.on('data', (data) => {
      const str = data.toString();
      stdout += str;
      if (onChunk) onChunk(str, 'stdout');
    });

    child.stderr.on('data', (data) => {
      const str = data.toString();
      stderr += str;
      if (onChunk) onChunk(str, 'stderr');
    });

    child.on('error', (err) => {
      error = err;
      if (!completed) {
        completed = true;
        resolve({ status: null, signal: null, stdout, stderr, error });
      }
    });

    child.on('close', (status, signal) => {
      if (!completed) {
        completed = true;
        resolve({ status, signal, stdout, stderr, error });
      }
    });
  });
}

export async function runVerification(
  config: JewelConfig,
  cwd: string = process.cwd(),
  onProgress?: (progress: { key: string, stdout: string, stderr: string, status: 'RUNNING' | 'PASS' | 'FAIL' | 'BLOCKED' | 'SKIPPED' }) => void
): Promise<VerificationReport> {
  // Validate and pre-create write paths if sandbox is enabled
  if (config.useSandbox && config.sandboxReadOnlyRoot && config.sandboxWritePaths) {
    const realCwd = fs.realpathSync(cwd);
    for (const wp of config.sandboxWritePaths) {
      const absWritePath = path.resolve(cwd, wp);
      
      // Verify type if host path exists
      if (fs.existsSync(absWritePath)) {
        if (!fs.statSync(absWritePath).isDirectory()) {
          throw new Error(`Invalid sandboxWritePath: "${wp}" exists on host but is a file, not a directory.`);
        }
      } else {
        // Host pre-creation of writable directory
        try {
          fs.mkdirSync(absWritePath, { recursive: true });
        } catch {}
      }

      // Resolve realpath with user-friendly error wrapping
      let realWritePath: string;
      try {
        realWritePath = fs.realpathSync(absWritePath);
      } catch (err: any) {
        throw new Error(`Invalid sandboxWritePath: "${wp}" could not be resolved or created on the host. Error: ${err.message}`);
      }

      // Symlink escape validation via path.relative checks
      const relative = path.relative(realCwd, realWritePath);
      const normalizedRelative = relative.replace(/\\/g, '/');
      const isOutsideOrSame = normalizedRelative === '' || normalizedRelative === '..' || normalizedRelative.startsWith('../') || path.isAbsolute(relative);

      if (isOutsideOrSame) {
        throw new Error(`Security Violation: sandboxWritePath "${wp}" resolves outside the workspace root.`);
      }
    }
  }

  const results: CommandResult[] = [];
  const commands = config.commands;

  const orderKeys: (keyof typeof commands)[] = ['lint', 'typecheck', 'test', 'build', 'e2e'];

  const dockerAvailable = config.useSandbox ? dockerUtils.isDockerAvailable() : false;
  const fallbackWarning = (config.useSandbox && !dockerAvailable)
    ? "Sandbox verification: Docker not available or daemon is not running. Falling back to host execution.\n"
    : "";

  for (const key of orderKeys) {
    const cmdLine = commands[key]?.trim() || '';

    if (!cmdLine) {
      results.push({
        commandKey: key,
        commandLine: '',
        status: 'SKIPPED',
        stdout: '',
        stderr: ''
      });
      if (onProgress) {
        onProgress({ key, stdout: '', stderr: '', status: 'SKIPPED' });
      }
      continue;
    }

    // Check policy
    const policyResult = checkCommandPolicy(cmdLine, config);
    if (!policyResult.allowed) {
      const errorMsg = policyResult.reason || 'Command blocked by policy.';
      results.push({
        commandKey: key,
        commandLine: cmdLine,
        status: 'BLOCKED',
        stdout: '',
        stderr: '',
        errorMsg
      });
      if (onProgress) {
        onProgress({ key, stdout: '', stderr: errorMsg, status: 'BLOCKED' });
      }
      continue;
    }

    if (onProgress) {
      onProgress({ key, stdout: '', stderr: '', status: 'RUNNING' });
    }

    // Execute command
    try {
      let stdout = '';
      let stderr = '';
      let exitCode = 0;

      const handleChunk = (chunk: string, type: 'stdout' | 'stderr') => {
        if (type === 'stdout') {
          stdout += chunk;
        } else {
          stderr += chunk;
        }
        if (onProgress) {
          onProgress({ key, stdout, stderr, status: 'RUNNING' });
        }
      };

      if (config.useSandbox) {
        if (!dockerAvailable) {
          if (config.sandboxFallbackToHost) {
            // Fallback to host execution
            const execEnv = { ...process.env };
            if (config.auditSpawnedProcesses) {
              const auditConfig = {
                allowGitPush: config.allowGitPush,
                allowNewDependencies: config.allowNewDependencies,
                dangerousCommandPolicy: config.dangerousCommandPolicy,
                protectedFiles: config.protectedFiles
              };
              const preloadPath = path.resolve(__dirname, 'preload.js');
              execEnv.JEWEL_AUDIT_CONFIG = JSON.stringify(auditConfig);
              
              const normalizedPreloadPath = preloadPath.replace(/\\/g, '/');
              const requireOption = `--require "${normalizedPreloadPath}"`;
              execEnv.NODE_OPTIONS = execEnv.NODE_OPTIONS
                ? `${requireOption} ${execEnv.NODE_OPTIONS}`
                : requireOption;
            }

            const res = await executeHost(cmdLine, cwd, execEnv, handleChunk);
            if (res.error) {
              exitCode = 99;
              stderr += (stderr ? '\n' : '') + `Execution error: ${res.error.message}`;
            } else {
              exitCode = res.status !== null ? res.status : 1;
            }
            stderr = fallbackWarning + stderr;
          } else {
            // sandbox fallback is false -> FAIL immediately
            exitCode = 1;
            stderr = "Sandbox verification failed: Docker is not available or daemon is not running, and sandboxFallbackToHost is disabled.";
            if (onProgress) {
              onProgress({ key, stdout: '', stderr, status: 'FAIL' });
            }
          }
        } else {
          // Docker is available
          const dockerArgs = [
            'run',
            '--rm',
            '-i'
          ];

          // Mount workspace based on read-only setting
          const resolvedCwd = path.resolve(cwd).replace(/\\/g, '/');

          if (config.sandboxReadOnlyRoot) {
            dockerArgs.push('-v', `${resolvedCwd}:/workspace:ro`);
            
            // Add read-write mounts
            if (config.sandboxWritePaths) {
              for (const wp of config.sandboxWritePaths) {
                const absWritePath = path.resolve(cwd, wp);
                const resolvedWritePath = absWritePath.replace(/\\/g, '/');
                const containerWritePath = wp.replace(/\\/g, '/');
                dockerArgs.push('-v', `${resolvedWritePath}:/workspace/${containerWritePath}:rw`);
              }
            }
          } else {
            dockerArgs.push('-v', `${resolvedCwd}:/workspace`);
          }

          dockerArgs.push('-w', '/workspace');

          // Network restriction configuration
          const net = config.sandboxNetwork || 'none';
          dockerArgs.push('--network', net);

          if (process.getuid && process.getgid) {
            dockerArgs.push('--user', `${process.getuid()}:${process.getgid()}`);
          }

          dockerArgs.push('-e', 'HOME');
          const execEnv: Record<string, string | undefined> = { ...process.env, HOME: '/tmp' };

          // Mount Jewel's dist
          dockerArgs.push('-v', `${path.resolve(__dirname, '..').replace(/\\/g, '/')}:/opt/jewel/dist`);

          if (config.auditSpawnedProcesses) {
            const auditConfig = {
              allowGitPush: config.allowGitPush,
              allowNewDependencies: config.allowNewDependencies,
              dangerousCommandPolicy: config.dangerousCommandPolicy,
              protectedFiles: config.protectedFiles
            };
            execEnv.JEWEL_AUDIT_CONFIG = JSON.stringify(auditConfig);
            execEnv.NODE_OPTIONS = '--require /opt/jewel/dist/verification/preload.js';
            dockerArgs.push('-e', 'JEWEL_AUDIT_CONFIG', '-e', 'NODE_OPTIONS');
          }

          if (config.sandboxVolumes) {
            for (const [host, container] of Object.entries(config.sandboxVolumes)) {
              const absHost = path.resolve(cwd, host).replace(/\\/g, '/');
              dockerArgs.push('-v', `${absHost}:${container}`);
            }
          }

          if (config.sandboxEnv) {
            for (const [key, val] of Object.entries(config.sandboxEnv)) {
              let resolvedVal = val;
              if (val.startsWith('$')) {
                const hostEnvName = val.slice(1);
                resolvedVal = process.env[hostEnvName] || '';
              }
              execEnv[key] = resolvedVal;
              dockerArgs.push('-e', key);
            }
          }

          const image = config.sandboxImage || 'node:18-slim';
          dockerArgs.push(image);
          dockerArgs.push('sh', '-c', cmdLine);

          const spawnResult = await dockerUtils.executeDocker(dockerArgs, cwd, execEnv, handleChunk);
          if (spawnResult.error) {
            exitCode = 1;
            stderr += (stderr ? '\n' : '') + `Docker execution error: ${spawnResult.error.message}`;
          } else if (spawnResult.status === null || spawnResult.status === undefined) {
            exitCode = 1;
            let errMsg = '';
            if (spawnResult.signal) {
              errMsg = `Docker process terminated by signal: ${spawnResult.signal}`;
            } else {
              errMsg = 'Unknown failure starting docker.';
            }
            stderr += (stderr ? '\n' : '') + `Docker execution error: ${errMsg}`;
          } else {
            exitCode = spawnResult.status;
          }
        }
      } else {
        // Normal host execution
        const execEnv = { ...process.env };
        if (config.auditSpawnedProcesses) {
          const auditConfig = {
            allowGitPush: config.allowGitPush,
            allowNewDependencies: config.allowNewDependencies,
            dangerousCommandPolicy: config.dangerousCommandPolicy,
            protectedFiles: config.protectedFiles
          };
          const preloadPath = path.resolve(__dirname, 'preload.js');
          execEnv.JEWEL_AUDIT_CONFIG = JSON.stringify(auditConfig);
          
          const normalizedPreloadPath = preloadPath.replace(/\\/g, '/');
          const requireOption = `--require "${normalizedPreloadPath}"`;
          execEnv.NODE_OPTIONS = execEnv.NODE_OPTIONS
            ? `${requireOption} ${execEnv.NODE_OPTIONS}`
            : requireOption;
        }

        const res = await executeHost(cmdLine, cwd, execEnv, handleChunk);
        if (res.error) {
          exitCode = 99;
          stderr += (stderr ? '\n' : '') + `Execution error: ${res.error.message}`;
        } else {
          exitCode = res.status !== null ? res.status : 1;
        }
      }

      const status = exitCode === 0 ? 'PASS' : 'FAIL';
      results.push({
        commandKey: key,
        commandLine: cmdLine,
        status,
        exitCode,
        stdout: redactSecrets(stdout),
        stderr: redactSecrets(stderr)
      });
      if (onProgress) {
        onProgress({ key, stdout, stderr, status });
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Execution error.';
      results.push({
        commandKey: key,
        commandLine: cmdLine,
        status: 'FAIL',
        exitCode: 99,
        stdout: '',
        stderr: redactSecrets(errorMsg)
      });
      if (onProgress) {
        onProgress({ key, stdout: '', stderr: errorMsg, status: 'FAIL' });
      }
    }
  }

  // Check if everything else passed first before running coverage check
  const initialFail = results.some(r => r.status === 'FAIL');
  const initialBlocked = results.some(r => r.status === 'BLOCKED');

  if (!initialFail && !initialBlocked && config.minCoverage) {
    const covResult = checkCoverage(config, cwd);
    if (!covResult.success) {
      results.push({
        commandKey: 'coverage',
        commandLine: 'Check code coverage',
        status: 'FAIL',
        stdout: '',
        stderr: covResult.findings.join('\n')
      });
    } else {
      results.push({
        commandKey: 'coverage',
        commandLine: 'Check code coverage',
        status: 'PASS',
        stdout: 'All configured coverage thresholds satisfied.',
        stderr: ''
      });
    }
  }

  // Calculate stats
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  let blocked = 0;

  for (const r of results) {
    if (r.status === 'PASS') passed++;
    else if (r.status === 'FAIL') failed++;
    else if (r.status === 'SKIPPED') skipped++;
    else if (r.status === 'BLOCKED') blocked++;
  }

  // Determine overall status
  let overallStatus: VerificationReport['overallStatus'] = 'PASS';
  const hasCoverageFail = results.some(r => r.commandKey === 'coverage' && r.status === 'FAIL');

  if (failed > 0) {
    overallStatus = hasCoverageFail ? 'COVERAGE_THRESHOLD_VIOLATION' : 'FAIL';
  } else if (blocked > 0) {
    overallStatus = 'BLOCKED';
  } else if (passed === 0 && skipped > 0) {
    overallStatus = 'SKIPPED';
  }

  const report: VerificationReport = {
    projectName: config.projectName || path.basename(cwd),
    date: new Date().toISOString(),
    mode: config.mode,
    overallStatus,
    stats: { passed, failed, skipped, blocked },
    results
  };

  saveVerificationReports(report, cwd, config.reportFormat);

  return report;
}

interface CoverageSummary {
  total?: {
    [key: string]: {
      pct?: number | string;
    };
  };
}

function checkCoverage(config: JewelConfig, cwd: string): { success: boolean; findings: string[] } {
  const findings: string[] = [];
  if (!config.minCoverage) {
    return { success: true, findings };
  }

  const reportPath = config.coverageReportPath 
    ? path.resolve(cwd, config.coverageReportPath)
    : path.resolve(cwd, 'coverage/coverage-summary.json');

  if (!fs.existsSync(reportPath)) {
    findings.push(`Coverage report file not found at: ${reportPath}`);
    return { success: false, findings };
  }

  try {
    const content = fs.readFileSync(reportPath, 'utf8');
    const data = JSON.parse(content) as CoverageSummary;
    const total = data.total;
    if (!total) {
      findings.push('Invalid coverage report: "total" field missing.');
      return { success: false, findings };
    }

    const metrics = ['lines', 'statements', 'functions', 'branches'] as const;
    let failed = false;

    for (const metric of metrics) {
      const threshold = config.minCoverage[metric];
      if (threshold === undefined) continue;

      const metricData = total[metric];
      if (!metricData) {
        findings.push(`Coverage metric "${metric}" missing from report.`);
        failed = true;
        continue;
      }

      const pctVal = metricData.pct;
      const pct = typeof pctVal === 'number' ? pctVal : parseFloat(pctVal as string);

      if (isNaN(pct)) {
        findings.push(`Coverage metric "${metric}" has invalid percentage: ${pctVal}`);
        failed = true;
      } else if (pct < threshold) {
        findings.push(`Coverage for "${metric}" (${pct}%) is below the configured threshold (${threshold}%).`);
        failed = true;
      }
    }

    return { success: !failed, findings };
  } catch (err: any) {
    findings.push(`Failed to parse coverage report: ${err.message}`);
    return { success: false, findings };
  }
}

import { redactSecrets } from '../safety/secret-redactor';

export function saveVerificationReports(report: VerificationReport, cwd: string, formats: ('markdown' | 'json')[]) {
  const reportsDir = path.join(cwd, '.jewel', 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  if (formats.includes('json')) {
    const jsonPath = path.join(reportsDir, 'latest.json');
    fs.writeFileSync(jsonPath, redactSecrets(JSON.stringify(report, null, 2)), 'utf8');
  }

  if (formats.includes('markdown')) {
    const mdPath = path.join(reportsDir, 'latest.md');
    fs.writeFileSync(mdPath, redactSecrets(generateMarkdownReport(report)), 'utf8');
  }
}

function generateMarkdownReport(report: VerificationReport): string {
  let md = `# Jewel Verification Report\n\n`;
  md += `**Project:** ${report.projectName}\n`;
  md += `**Date:** ${report.date}\n`;
  md += `**Mode:** ${report.mode}\n\n`;

  md += `## Commands\n\n`;
  md += `| Command Key | Command | Status | Exit Code |\n`;
  md += `|---|---|---|---|\n`;
  for (const r of report.results) {
    const cmdStr = r.commandLine ? `\`${r.commandLine}\`` : '*Skipped*';
    const exitCodeStr = r.exitCode !== undefined ? r.exitCode.toString() : '-';
    md += `| ${r.commandKey} | ${cmdStr} | **${r.status}** | ${exitCodeStr} |\n`;
  }
  md += `\n`;

  md += `## Summary\n\n`;
  md += `**Overall status:** **${report.overallStatus}**\n`;
  md += `- Passed: ${report.stats.passed}\n`;
  md += `- Failed: ${report.stats.failed}\n`;
  md += `- Skipped: ${report.stats.skipped}\n`;
  md += `- Blocked: ${report.stats.blocked}\n\n`;

  md += `## Evidence\n\n`;
  for (const r of report.results) {
    if (r.status === 'SKIPPED') continue;
    md += `### Command: \`${r.commandKey}\` (${r.status})\n`;
    if (r.errorMsg) {
      md += `*Reason:* ${r.errorMsg}\n`;
    }
    if (r.stdout) {
      md += `**stdout:**\n\`\`\`\n${r.stdout.trim()}\n\`\`\`\n`;
    }
    if (r.stderr) {
      md += `**stderr:**\n\`\`\`\n${r.stderr.trim()}\n\`\`\`\n`;
    }
    if (!r.stdout && !r.stderr && !r.errorMsg) {
      md += `*No output recorded.*\n`;
    }
    md += `\n`;
  }

  return md;
}
