import * as path from 'path';
import { runBenchmarkSuite, saveBenchmarkReports, formatBenchmarkConsole } from '../../benchmark/runner';
import { resolvePackageRoot } from '../../mcp/tools';

export function runBenchmarkCommand(useMock = true, cwd: string = process.cwd()): void {
  const rootDir = resolvePackageRoot();
  const cliEntry = path.join(rootDir, 'dist', 'cli', 'index.js');

  console.log(`\nJewel Benchmark Harness\n${'='.repeat(50)}`);

  const summary = runBenchmarkSuite(rootDir, { useMock, cliEntry });
  saveBenchmarkReports(rootDir, summary);
  console.log(formatBenchmarkConsole(summary));
  console.log(`Reports: .jewel/benchmarks/latest.json`);

  if (summary.failed > 0) {
    process.exit(1);
  }
}
