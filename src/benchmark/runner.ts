import * as fs from 'fs';
import * as path from 'path';
import { execSync, spawnSync } from 'child_process';
import { getBlueprint } from '../scaffold/blueprints';
import { scaffoldProject } from '../scaffold/scaffolder';

export interface BenchmarkTask {
  id: string;
  description: string;
  projectPath: string;
  task: string;
  files?: string[];
  useMock?: boolean;
  preCheck?: string;
  verifyCommand?: string;
  cleanup?: string[];
  resetFixture?: boolean;
  /** Blueprint id to scaffold into projectPath before running the task */
  scaffold?: string;
}

export interface BenchmarkManifest {
  version: string;
  description: string;
  tasks: BenchmarkTask[];
}

export interface BenchmarkResult {
  id: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  reason?: string;
  exitCode?: number | null;
  stderr?: string;
}

export interface BenchmarkSummary {
  date: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  passRate: string;
  results: BenchmarkResult[];
}

const BROKEN_MATH_TS = `export function add(a: number, b: number): number {
  return a + b;
}

export function divide(a: number, b: number): number {
  return a / b;
}
`;

function resetDogfoodFixture(taskDir: string): void {
  fs.writeFileSync(path.join(taskDir, 'src', 'math.ts'), BROKEN_MATH_TS, 'utf8');
  for (const rel of ['dist', '.jewel']) {
    const target = path.join(taskDir, rel);
    if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
  }
}

export function runBenchmarkSuite(
  rootDir: string,
  options: { useMock?: boolean; cliEntry?: string } = {}
): BenchmarkSummary {
  const manifestPath = path.join(rootDir, 'benchmarks', 'manifest.json');
  const manifest: BenchmarkManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const cliEntry = options.cliEntry || path.join(rootDir, 'dist', 'cli', 'index.js');
  const useMock = options.useMock ?? true;

  const results: BenchmarkResult[] = [];
  let passed = 0;
  let failed = 0;

  for (const task of manifest.tasks) {
    const taskDir = path.join(rootDir, task.projectPath);
    const label = task.id;

    if (task.scaffold) {
      const blueprint = getBlueprint(task.scaffold);
      if (!blueprint) {
        results.push({ id: label, status: 'SKIP', reason: `unknown blueprint "${task.scaffold}"` });
        continue;
      }
      try {
        if (fs.existsSync(taskDir)) fs.rmSync(taskDir, { recursive: true, force: true });
        scaffoldProject(blueprint, {
          projectName: path.basename(taskDir),
          targetDir: path.dirname(taskDir),
          gitInit: false
        });
      } catch (err) {
        results.push({ id: label, status: 'SKIP', reason: `scaffold failed: ${err instanceof Error ? err.message : String(err)}` });
        continue;
      }
    }

    if (task.preCheck === 'broken-tests') {
      resetDogfoodFixture(taskDir);
      try {
        execSync('npm test', { cwd: taskDir, stdio: 'ignore' });
        results.push({ id: label, status: 'SKIP', reason: 'fixture not broken' });
        continue;
      } catch {}
    }

    const args = [cliEntry, 'run', task.task, '--yes', '--no-review'];
    if (useMock || task.useMock) args.push('--mock');
    if (task.files && task.files.length > 0) args.push('--files', task.files.join(','));

    const run = spawnSync(process.execPath, args, { cwd: taskDir, encoding: 'utf8' });
    const runOk = run.status === 0;

    let verifyOk = !task.verifyCommand;
    if (runOk && task.verifyCommand) {
      try {
        execSync(task.verifyCommand, { cwd: taskDir, stdio: 'ignore' });
        verifyOk = true;
      } catch {
        verifyOk = false;
      }
    }

    if (runOk && verifyOk) {
      passed++;
      results.push({ id: label, status: 'PASS' });
    } else {
      failed++;
      results.push({
        id: label,
        status: 'FAIL',
        exitCode: run.status,
        stderr: (run.stderr || '').slice(-500)
      });
    }

    if (task.cleanup) {
      for (const rel of task.cleanup) {
        const target = path.join(taskDir, rel);
        if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
      }
    }
    if (task.resetFixture) resetDogfoodFixture(taskDir);
  }

  const skipped = results.filter(r => r.status === 'SKIP').length;
  const attempted = manifest.tasks.length - skipped;
  const passRate = attempted > 0 ? `${((passed / attempted) * 100).toFixed(1)}%` : 'N/A';

  return {
    date: new Date().toISOString(),
    total: manifest.tasks.length,
    passed,
    failed,
    skipped,
    passRate,
    results
  };
}

export function saveBenchmarkReports(rootDir: string, summary: BenchmarkSummary): void {
  const outDir = path.join(rootDir, '.jewel', 'benchmarks');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'latest.json'), JSON.stringify(summary, null, 2));

  let md = `# Jewel Benchmark Report\n\n`;
  md += `**Date:** ${summary.date}\n`;
  md += `**Pass Rate:** ${summary.passRate} (${summary.passed}/${summary.total - summary.skipped} attempted)\n\n`;
  md += `| Task | Status |\n|---|---|\n`;
  for (const r of summary.results) {
    md += `| ${r.id} | ${r.status} |\n`;
  }
  fs.writeFileSync(path.join(outDir, 'latest.md'), md, 'utf8');
}

export function formatBenchmarkConsole(summary: BenchmarkSummary): string {
  const lines = [
    `Benchmark complete: ${summary.passed} passed, ${summary.failed} failed, ${summary.skipped} skipped (${summary.total} total)`,
    `Pass rate: ${summary.passRate}`
  ];
  return lines.join('\n');
}
