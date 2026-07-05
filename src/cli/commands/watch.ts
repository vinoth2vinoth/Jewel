import * as fs from 'fs';
import * as path from 'path';
import { loadConfig } from '../../core/config';
import { runVerification, saveVerificationReports } from '../../verification/runner';
import { listDir } from '../../exploration/repo-explorer';

export interface WatchOptions {
  intervalMs?: number;
  debounceMs?: number;
  once?: boolean;
  patterns?: string[];
}

function collectWatchFiles(cwd: string, patterns: string[]): string[] {
  const all = listDir(cwd, '.', { maxDepth: 6 }).filter(f => !f.endsWith('/'));
  if (patterns.length === 0) {
    return all.filter(f =>
      f.startsWith('src/') || f.startsWith('lib/') || f.endsWith('.ts') || f.endsWith('.js')
    );
  }
  const normalized = patterns.map(p => p.replace(/\\/g, '/'));
  return all.filter(f => normalized.some(p => f.includes(p.replace(/\*\*/g, '')) || f.startsWith(p)));
}

function snapshotMtimes(cwd: string, files: string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const file of files) {
    const full = path.join(cwd, file);
    try {
      if (fs.existsSync(full) && fs.statSync(full).isFile()) {
        map.set(file, fs.statSync(full).mtimeMs);
      }
    } catch {}
  }
  return map;
}

function detectChanges(cwd: string, files: string[], previous: Map<string, number>): string[] {
  const changed: string[] = [];
  for (const file of files) {
    const full = path.join(cwd, file);
    try {
      if (!fs.existsSync(full)) continue;
      const mtime = fs.statSync(full).mtimeMs;
      const prev = previous.get(file);
      if (prev === undefined || prev !== mtime) {
        changed.push(file);
        previous.set(file, mtime);
      }
    } catch {}
  }
  return changed;
}

export async function runWatch(
  cwd: string = process.cwd(),
  options: WatchOptions = {}
): Promise<void> {
  const intervalMs = options.intervalMs ?? 2000;
  const debounceMs = options.debounceMs ?? 1000;
  const once = options.once ?? false;
  const patterns = options.patterns ?? [];

  let config;
  try {
    config = loadConfig(cwd);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[-] watch: ${msg}`);
    process.exit(1);
    return;
  }

  const watchFiles = collectWatchFiles(cwd, patterns);
  if (watchFiles.length === 0) {
    console.warn('[watch] No files matched watch scope. Monitoring entire src/ tree when files appear.');
  }

  console.log(`[watch] Jewel continuous verification (${once ? 'single run' : 'watching'})`);
  console.log(`[watch] Interval: ${intervalMs}ms, debounce: ${debounceMs}ms, files tracked: ${watchFiles.length}`);

  const mtimes = snapshotMtimes(cwd, watchFiles);
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let running = false;

  const runVerifyOnce = async (triggerFiles: string[]) => {
    if (running) return;
    running = true;
    console.log(`\n[watch] Change detected (${triggerFiles.slice(0, 5).join(', ')}${triggerFiles.length > 5 ? '...' : ''}). Running verification...`);
    try {
      const report = await runVerification(config, cwd);
      saveVerificationReports(report, cwd, config.reportFormat || ['markdown', 'json']);
      console.log(`[watch] Verification: ${report.overallStatus} (pass=${report.stats.passed}, fail=${report.stats.failed})`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[watch] Verification error: ${msg}`);
    } finally {
      running = false;
    }
  };

  if (once) {
    await runVerifyOnce(['manual']);
    return;
  }

  const poll = () => {
    const currentFiles = collectWatchFiles(cwd, patterns);
    for (const f of currentFiles) {
      if (!mtimes.has(f)) {
        const full = path.join(cwd, f);
        try {
          if (fs.existsSync(full)) mtimes.set(f, fs.statSync(full).mtimeMs);
        } catch {}
      }
    }

    const changed = detectChanges(cwd, currentFiles, mtimes);
    if (changed.length > 0) {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        runVerifyOnce(changed).catch(() => {});
      }, debounceMs);
    }
  };

  console.log('[watch] Press Ctrl+C to stop.\n');
  poll();
  const handle = setInterval(poll, intervalMs);

  await new Promise<void>((resolve) => {
    const cleanup = () => {
      clearInterval(handle);
      if (debounceTimer) clearTimeout(debounceTimer);
      console.log('\n[watch] Stopped.');
      resolve();
    };
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  });
}
