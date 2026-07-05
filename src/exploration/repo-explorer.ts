import * as fs from 'fs';
import * as path from 'path';
import { minimatch } from 'minimatch';

const DEFAULT_SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  '.jewel',
  'coverage',
  '.next',
  'build',
  '__pycache__',
  '.turbo'
]);

const DEFAULT_TEXT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.json', '.md', '.yaml', '.yml', '.toml',
  '.py', '.go', '.rs', '.java', '.cs', '.cpp', '.c', '.h',
  '.css', '.scss', '.html', '.vue', '.svelte',
  '.sql', '.sh', '.ps1', '.bat'
]);

export interface GrepMatch {
  file: string;
  line: number;
  text: string;
}

export interface RepoExplorerOptions {
  maxDepth?: number;
  maxFileSizeBytes?: number;
  skipDirs?: Set<string>;
}

function normalizeRelPath(cwd: string, absolutePath: string): string {
  return path.relative(cwd, absolutePath).replace(/\\/g, '/');
}

function isTextFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return DEFAULT_TEXT_EXTENSIONS.has(ext) || path.basename(filePath) === 'Dockerfile';
}

export function listDir(
  cwd: string,
  relativeDir = '.',
  options: RepoExplorerOptions = {}
): string[] {
  const maxDepth = options.maxDepth ?? 4;
  const skipDirs = options.skipDirs ?? DEFAULT_SKIP_DIRS;
  const results: string[] = [];

  const walk = (dir: string, depth: number) => {
    if (depth > maxDepth) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (skipDirs.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      const rel = normalizeRelPath(cwd, full);
      if (entry.isDirectory()) {
        results.push(rel + '/');
        walk(full, depth + 1);
      } else if (entry.isFile()) {
        results.push(rel);
      }
    }
  };

  const start = path.resolve(cwd, relativeDir);
  if (!fs.existsSync(start)) return results;
  walk(start, 0);
  return results.sort();
}

export function globFiles(
  cwd: string,
  pattern: string,
  options: RepoExplorerOptions = {}
): string[] {
  const allFiles = listDir(cwd, '.', options).filter(f => !f.endsWith('/'));
  return allFiles.filter(f => minimatch(f, pattern, { dot: true, nocase: true }));
}

export function grep(
  cwd: string,
  query: string,
  options: RepoExplorerOptions & { filePattern?: string; maxMatches?: number; caseInsensitive?: boolean } = {}
): GrepMatch[] {
  const maxMatches = options.maxMatches ?? 50;
  const caseInsensitive = options.caseInsensitive ?? true;
  const filePattern = options.filePattern;
  const maxFileSize = options.maxFileSizeBytes ?? 512_000;
  const matches: GrepMatch[] = [];

  let files = listDir(cwd, '.', options).filter(f => !f.endsWith('/') && isTextFile(f));
  if (filePattern) {
    files = files.filter(f => minimatch(f, filePattern, { dot: true, nocase: true }));
  }

  const needle = caseInsensitive ? query.toLowerCase() : query;

  for (const file of files) {
    if (matches.length >= maxMatches) break;
    const fullPath = path.resolve(cwd, file);
    let content: string;
    try {
      const stat = fs.statSync(fullPath);
      if (stat.size > maxFileSize) continue;
      content = fs.readFileSync(fullPath, 'utf8');
    } catch {
      continue;
    }

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (matches.length >= maxMatches) break;
      const line = lines[i];
      const haystack = caseInsensitive ? line.toLowerCase() : line;
      if (haystack.includes(needle)) {
        matches.push({ file, line: i + 1, text: line.trim().slice(0, 200) });
      }
    }
  }

  return matches;
}

export function readFile(
  cwd: string,
  relativePath: string,
  options: { maxBytes?: number } = {}
): { content: string; truncated: boolean } | null {
  const maxBytes = options.maxBytes ?? 100_000;
  const fullPath = path.resolve(cwd, relativePath);
  if (!fs.existsSync(fullPath)) return null;
  try {
    const stat = fs.statSync(fullPath);
    if (!stat.isFile()) return null;
    const raw = fs.readFileSync(fullPath);
    const truncated = raw.length > maxBytes;
    const slice = truncated ? raw.subarray(0, maxBytes) : raw;
    return { content: slice.toString('utf8'), truncated };
  } catch {
    return null;
  }
}

export function extractTaskKeywords(task: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
    'fix', 'add', 'update', 'change', 'implement', 'create', 'remove', 'delete',
    'make', 'run', 'test', 'tests', 'file', 'files', 'code', 'please', 'this', 'that'
  ]);

  return task
    .toLowerCase()
    .replace(/[^a-z0-9_\-\.\/\\ ]+/g, ' ')
    .split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length >= 3 && !stopWords.has(w));
}

export function scoreFileRelevance(
  file: string,
  task: string,
  keywords: string[],
  grepHits: GrepMatch[]
): number {
  let score = 0;
  const lowerFile = file.toLowerCase();
  const lowerTask = task.toLowerCase();

  for (const kw of keywords) {
    if (lowerFile.includes(kw)) score += 3;
  }

  if (lowerTask.includes(path.basename(lowerFile, path.extname(lowerFile)))) {
    score += 5;
  }

  const hitsForFile = grepHits.filter(h => h.file === file);
  score += hitsForFile.length * 2;

  if (file.includes('/test/') || file.includes('/tests/') || file.endsWith('.test.ts') || file.endsWith('.test.js')) {
    score += 1;
  }

  if (file.startsWith('src/') || file.startsWith('lib/')) {
    score += 1;
  }

  return score;
}

export function discoverRelevantFiles(
  cwd: string,
  task: string,
  maxFiles = 8,
  options: RepoExplorerOptions = {}
): string[] {
  const keywords = extractTaskKeywords(task);
  const candidateSet = new Set<string>();

  const sourcePatterns = ['src/**/*.ts', 'src/**/*.js', 'lib/**/*.ts', 'lib/**/*.js', '**/*.ts', '**/*.js'];
  for (const pattern of sourcePatterns) {
    for (const f of globFiles(cwd, pattern, options)) {
      candidateSet.add(f);
    }
  }

  const grepHits: GrepMatch[] = [];
  for (const kw of keywords.slice(0, 6)) {
    for (const hit of grep(cwd, kw, { ...options, maxMatches: 20 })) {
      candidateSet.add(hit.file);
      grepHits.push(hit);
    }
  }

  const scored = Array.from(candidateSet)
    .filter(f => isTextFile(f))
    .map(file => ({ file, score: scoreFileRelevance(file, task, keywords, grepHits) }))
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return [
      ...globFiles(cwd, 'src/**/*.ts', options),
      ...globFiles(cwd, 'src/**/*.js', options)
    ].slice(0, maxFiles);
  }

  return scored.slice(0, maxFiles).map(s => s.file);
}
