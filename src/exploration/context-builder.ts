import { discoverRelevantFiles, grep, listDir, readFile } from './repo-explorer';

export function buildRepoSummary(cwd: string, maxDepth = 3): string {
  const entries = listDir(cwd, '.', { maxDepth });
  const files = entries.filter(e => !e.endsWith('/'));
  const dirs = entries.filter(e => e.endsWith('/'));
  return [
    'Project Structure:',
    ...dirs.slice(0, 40).map(d => `- ${d}`),
    ...files.slice(0, 80).map(f => `- ${f}`)
  ].join('\n');
}

export function buildEnrichedRepoSummary(cwd: string, task: string): string {
  const base = buildRepoSummary(cwd, 3);
  const discovered = discoverRelevantFiles(cwd, task, 8);
  if (discovered.length === 0) {
    return base;
  }

  const keywordLines: string[] = [];
  const keywords = task.toLowerCase().split(/\s+/).filter(w => w.length >= 4).slice(0, 3);
  for (const kw of keywords) {
    const hits = grep(cwd, kw, { maxMatches: 5, filePattern: '**/*.{ts,js,tsx,jsx}' });
    for (const hit of hits) {
      keywordLines.push(`  ${hit.file}:${hit.line}  ${hit.text}`);
    }
  }

  return [
    base,
    '',
    'Auto-discovered relevant files (task-based):',
    ...discovered.map(f => `- ${f}`),
    keywordLines.length > 0 ? '\nKeyword matches:' : '',
    ...keywordLines
  ].filter(Boolean).join('\n');
}

export function resolveFilesForTask(
  cwd: string,
  task: string,
  userFiles: string[]
): string[] {
  const normalized = userFiles.map(f => f.replace(/\\/g, '/')).filter(Boolean);
  if (normalized.length > 0) {
    return normalized;
  }
  return discoverRelevantFiles(cwd, task, 8);
}

export function buildContextForFiles(cwd: string, filePaths: string[], maxBytesPerFile = 50_000): string {
  const sections: string[] = [];
  for (const filePath of filePaths) {
    const result = readFile(cwd, filePath, { maxBytes: maxBytesPerFile });
    if (result) {
      const suffix = result.truncated ? '\n[... truncated ...]' : '';
      sections.push(`=== File: ${filePath} ===\n${result.content}${suffix}\n`);
    } else {
      sections.push(`=== File: ${filePath} ===\n(File does not exist yet)\n`);
    }
  }
  return sections.join('\n');
}
