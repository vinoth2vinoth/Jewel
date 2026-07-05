import * as fs from 'fs';
import * as path from 'path';
import { globFiles, isTextFile } from './repo-explorer';

const INDEX_DIR = '.jewel/index';
const INDEX_FILE = 'semantic.json';

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'this', 'that', 'from', 'into', 'your', 'have', 'has',
  'are', 'was', 'were', 'not', 'but', 'can', 'will', 'function', 'const', 'let', 'var',
  'import', 'export', 'return', 'class', 'interface', 'type', 'async', 'await'
]);

export interface SemanticIndexEntry {
  file: string;
  terms: Record<string, number>;
  mtimeMs: number;
}

export interface SemanticIndex {
  version: 1;
  builtAt: string;
  cwd: string;
  entries: SemanticIndexEntry[];
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_\-\.\/\\ ]+/g, ' ')
    .split(/\s+/)
    .map(t => t.trim())
    .filter(t => t.length >= 3 && !STOP_WORDS.has(t));
}

function indexPath(cwd: string): string {
  return path.join(cwd, INDEX_DIR, INDEX_FILE);
}

function buildEntry(cwd: string, file: string): SemanticIndexEntry | null {
  const full = path.resolve(cwd, file);
  if (!fs.existsSync(full)) return null;
  try {
    const stat = fs.statSync(full);
    if (stat.size > 512_000) return null;
    const content = fs.readFileSync(full, 'utf8');
    const terms: Record<string, number> = {};
    for (const term of tokenize(content)) {
      terms[term] = (terms[term] || 0) + 1;
    }
    for (const part of file.toLowerCase().split(/[/\\._-]/)) {
      if (part.length >= 3 && !STOP_WORDS.has(part)) {
        terms[part] = (terms[part] || 0) + 5;
      }
    }
    return { file, terms, mtimeMs: stat.mtimeMs };
  } catch {
    return null;
  }
}

export function buildSemanticIndex(cwd: string): SemanticIndex {
  const candidates = new Set<string>();
  for (const pattern of ['src/**/*.ts', 'src/**/*.js', 'lib/**/*.ts', 'lib/**/*.js']) {
    for (const f of globFiles(cwd, pattern)) {
      if (isTextFile(f)) candidates.add(f);
    }
  }

  const entries: SemanticIndexEntry[] = [];
  for (const file of candidates) {
    const entry = buildEntry(cwd, file);
    if (entry) entries.push(entry);
  }

  return {
    version: 1,
    builtAt: new Date().toISOString(),
    cwd,
    entries
  };
}

export function saveSemanticIndex(cwd: string, index: SemanticIndex): void {
  const dir = path.join(cwd, INDEX_DIR);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(indexPath(cwd), JSON.stringify(index), 'utf8');
}

export function loadSemanticIndex(cwd: string): SemanticIndex | null {
  const p = indexPath(cwd);
  if (!fs.existsSync(p)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(p, 'utf8')) as SemanticIndex;
    if (parsed.version !== 1 || !Array.isArray(parsed.entries)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function ensureSemanticIndex(cwd: string, maxAgeMs = 86_400_000): SemanticIndex {
  const existing = loadSemanticIndex(cwd);
  if (existing) {
    const age = Date.now() - new Date(existing.builtAt).getTime();
    if (age < maxAgeMs && existing.entries.length > 0) {
      return existing;
    }
  }
  const built = buildSemanticIndex(cwd);
  saveSemanticIndex(cwd, built);
  return built;
}

export function scoreFilesBySemanticIndex(
  index: SemanticIndex,
  task: string
): Map<string, number> {
  const queryTerms = tokenize(task);
  const scores = new Map<string, number>();

  for (const entry of index.entries) {
    let score = 0;
    for (const term of queryTerms) {
      if (entry.terms[term]) {
        score += entry.terms[term];
      }
      for (const [fileTerm, weight] of Object.entries(entry.terms)) {
        if (fileTerm.includes(term) || term.includes(fileTerm)) {
          score += Math.min(weight, 3);
        }
      }
    }
    if (score > 0) scores.set(entry.file, score);
  }

  return scores;
}

export function semanticBoostForFile(file: string, task: string, cwd: string): number {
  const index = ensureSemanticIndex(cwd);
  const scores = scoreFilesBySemanticIndex(index, task);
  return scores.get(file) || 0;
}
