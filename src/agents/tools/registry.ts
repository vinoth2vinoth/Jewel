import { globFiles, grep, listDir, readFile } from '../../exploration/repo-explorer';
import { AgentToolName } from './types';

const ALLOWED_TOOLS = new Set<AgentToolName>(['list_dir', 'glob', 'grep', 'read_file']);

export function isAllowedTool(name: string): name is AgentToolName {
  return ALLOWED_TOOLS.has(name as AgentToolName);
}

export function executeAgentTool(
  tool: AgentToolName,
  args: Record<string, string | number | boolean> | undefined,
  cwd: string
): { output: string; discoveredFiles: string[] } {
  switch (tool) {
    case 'list_dir': {
      const dir = typeof args?.dir === 'string' ? args.dir : '.';
      const maxDepth = typeof args?.maxDepth === 'number' ? args.maxDepth : 3;
      const entries = listDir(cwd, dir, { maxDepth });
      return { output: entries.join('\n'), discoveredFiles: entries.filter(e => !e.endsWith('/')) };
    }
    case 'glob': {
      const pattern = typeof args?.pattern === 'string' ? args.pattern : 'src/**/*.ts';
      const files = globFiles(cwd, pattern);
      return { output: files.join('\n'), discoveredFiles: files };
    }
    case 'grep': {
      const query = typeof args?.query === 'string' ? args.query : '';
      if (!query) {
        return { output: 'Error: grep requires a "query" argument.', discoveredFiles: [] };
      }
      const filePattern = typeof args?.filePattern === 'string' ? args.filePattern : undefined;
      const maxMatches = typeof args?.maxMatches === 'number' ? args.maxMatches : 20;
      const hits = grep(cwd, query, { filePattern, maxMatches });
      const lines = hits.map(h => `${h.file}:${h.line}  ${h.text}`);
      return { output: lines.join('\n') || '(no matches)', discoveredFiles: [...new Set(hits.map(h => h.file))] };
    }
    case 'read_file': {
      const filePath = typeof args?.path === 'string' ? args.path : '';
      if (!filePath) {
        return { output: 'Error: read_file requires a "path" argument.', discoveredFiles: [] };
      }
      const maxBytes = typeof args?.maxBytes === 'number' ? args.maxBytes : 50_000;
      const result = readFile(cwd, filePath, { maxBytes });
      if (!result) {
        return { output: `Error: file not found or unreadable: ${filePath}`, discoveredFiles: [] };
      }
      const suffix = result.truncated ? '\n[... truncated ...]' : '';
      return { output: result.content + suffix, discoveredFiles: [filePath.replace(/\\/g, '/')] };
    }
    default:
      return { output: `Error: unknown tool "${tool}"`, discoveredFiles: [] };
  }
}

export function formatToolCatalog(): string {
  return [
    '- list_dir(dir=". ", maxDepth=3): list files and directories',
    '- glob(pattern="src/**/*.ts"): find files matching glob pattern',
    '- grep(query, filePattern?, maxMatches=20): search file contents',
    '- read_file(path, maxBytes=50000): read a repo-relative file'
  ].join('\n');
}
