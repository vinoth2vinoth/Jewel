import * as path from 'path';
import { loadConfig } from '../core/config';
import { runVerification } from '../verification/runner';
import { listRecentSessions } from '../core/session-history';
import { grep, readFile } from '../exploration/repo-explorer';
import { generateLocalContract } from '../core/session';

export async function handleToolCall(name: string, args: Record<string, unknown>, cwd: string): Promise<unknown> {
  switch (name) {
    case 'jewel_verify': {
      const config = loadConfig(cwd);
      const report = await runVerification(config, cwd);
      return {
        overallStatus: report.overallStatus,
        stats: report.stats,
        results: report.results.map(r => ({ key: r.commandKey, status: r.status, command: r.commandLine }))
      };
    }
    case 'jewel_status': {
      const limit = typeof args.limit === 'number' ? args.limit : 5;
      return listRecentSessions(cwd, limit);
    }
    case 'jewel_grep': {
      const query = String(args.query || '');
      const filePattern = typeof args.filePattern === 'string' ? args.filePattern : undefined;
      return grep(cwd, query, { filePattern, maxMatches: 25 });
    }
    case 'jewel_read_file': {
      const filePath = String(args.path || '');
      const result = readFile(cwd, filePath, { maxBytes: 50_000 });
      if (!result) return { error: `File not found: ${filePath}` };
      return { path: filePath, content: result.content, truncated: result.truncated };
    }
    case 'jewel_run_preview': {
      const config = loadConfig(cwd);
      const task = String(args.task || '');
      const files = Array.isArray(args.files) ? args.files.map(String) : [];
      return { preview: true, contract: generateLocalContract(task, config, files) };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export function resolvePackageRoot(): string {
  return path.resolve(__dirname, '../..');
}
