import * as path from 'path';
import { VerificationReport } from '../verification/runner';

export interface LspDiagnostic {
  range: { start: { line: number; character: number }; end: { line: number; character: number } };
  message: string;
  severity: 1 | 2 | 3 | 4;
  source: string;
  code?: string;
}

export interface LspDiagnosticMap {
  [fileUri: string]: LspDiagnostic[];
}

const LOCATION_PATTERNS = [
  /^\s*at .+ \((.+):(\d+):(\d+)\)\s*$/m,
  /^\s*at (.+):(\d+):(\d+)\s*$/m,
  /([A-Za-z]:\\[^\s:]+|[^\s:]+\.[a-zA-Z]+):(\d+):(\d+)/g,
  /→ (.+):(\d+)/,
  /^\s*✖ .+\((.+):(\d+):(\d+)\)/m
];

function toFileUri(cwd: string, filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const rel = path.isAbsolute(normalized)
    ? path.relative(cwd, normalized).replace(/\\/g, '/')
    : normalized.replace(/^\.\//, '');
  const abs = path.resolve(cwd, rel);
  return `file:///${abs.replace(/\\/g, '/').replace(/^\/+/, '')}`;
}

function lineToRange(line: number, message: string): LspDiagnostic['range'] {
  const l = Math.max(0, line - 1);
  return {
    start: { line: l, character: 0 },
    end: { line: l, character: Math.min(message.length, 120) }
  };
}

function extractLocations(text: string, cwd: string): Array<{ file: string; line: number; message: string }> {
  const found: Array<{ file: string; line: number; message: string }> = [];
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of LOCATION_PATTERNS) {
      pattern.lastIndex = 0;
      const m = pattern.exec(line);
      if (!m) continue;
      const file = m[1].replace(/\\/g, '/');
      const lineNum = parseInt(m[2], 10);
      if (!file || Number.isNaN(lineNum)) continue;
      if (file.includes('node_modules')) continue;
      found.push({ file, line: lineNum, message: line.trim().slice(0, 300) });
      break;
    }
  }

  if (found.length === 0 && text.trim()) {
    found.push({ file: 'jewel.config.json', line: 1, message: text.trim().slice(0, 300) });
  }

  return found.map(f => ({
    ...f,
    file: path.isAbsolute(f.file) ? path.relative(cwd, f.file).replace(/\\/g, '/') : f.file
  }));
}

export function diagnosticsFromVerificationReport(
  report: VerificationReport,
  cwd: string
): LspDiagnosticMap {
  const map: LspDiagnosticMap = {};

  const add = (relFile: string, diag: LspDiagnostic) => {
    const uri = toFileUri(cwd, relFile);
    if (!map[uri]) map[uri] = [];
    map[uri].push(diag);
  };

  for (const result of report.results) {
    if (result.status !== 'FAIL' && result.status !== 'BLOCKED') continue;

    const combined = [result.stderr, result.stdout, result.errorMsg].filter(Boolean).join('\n');
    const locations = extractLocations(combined, cwd);

    if (locations.length === 0) {
      add('jewel.config.json', {
        range: lineToRange(1, result.commandKey),
        message: `[${result.commandKey}] ${result.status}: ${(result.errorMsg || combined).slice(0, 200)}`,
        severity: result.status === 'BLOCKED' ? 1 : 2,
        source: 'jewel',
        code: result.commandKey
      });
      continue;
    }

    for (const loc of locations) {
      add(loc.file, {
        range: lineToRange(loc.line, loc.message),
        message: `[${result.commandKey}] ${loc.message}`,
        severity: result.status === 'BLOCKED' ? 1 : 2,
        source: 'jewel',
        code: result.commandKey
      });
    }
  }

  if (report.overallStatus === 'PASS' && Object.keys(map).length === 0) {
    return map;
  }

  if (report.overallStatus !== 'PASS' && Object.keys(map).length === 0) {
    add('jewel.config.json', {
      range: lineToRange(1, report.overallStatus),
      message: `Verification ${report.overallStatus}: ${report.stats.failed} failed, ${report.stats.blocked} blocked`,
      severity: 2,
      source: 'jewel',
      code: 'verification'
    });
  }

  return map;
}
