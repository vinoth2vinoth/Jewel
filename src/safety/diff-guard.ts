import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { JewelConfig } from '../core/config';
import { CheckpointMetadata } from '../storage/git';
import { isProtectedPath, isDependencyPath, isLockfilePath } from './path-policy';

export interface ASTDiffItem {
  type: 'added' | 'deleted';
  signature: string;
}

export interface ASTFileDiff {
  file: string;
  items: ASTDiffItem[];
}

export interface DiffAnalysis {
  status: 'PASS' | 'WARN' | 'BLOCK';
  changedFilesCount: number;
  addedLinesCount: number;
  removedLinesCount: number;
  changedFiles: string[];
  protectedFilesChanged: string[];
  dependenciesChanged: boolean;
  lockfilesChanged: string[];
  findings: string[];
  astDiffs?: ASTFileDiff[];
}


export function runDiffGuard(
  checkpoint: CheckpointMetadata,
  config: JewelConfig,
  cwd: string = process.cwd(),
  allowedSymbolChanges: string[] = []
): DiffAnalysis {
  const findings: string[] = [];
  let status: DiffAnalysis['status'] = 'PASS';

  let changedFiles: { file: string; added: number; removed: number }[] = [];

  if (checkpoint.isGit && checkpoint.gitCheckpointSha) {
    // Git diff implementation
    try {
      const diffStat = execSync(`git diff --numstat ${checkpoint.gitCheckpointSha}`, {
        cwd,
        encoding: 'utf8'
      }).trim();

      let gitRoot = cwd;
      try {
        gitRoot = execSync('git rev-parse --show-toplevel', { cwd, encoding: 'utf8' }).trim();
      } catch {}

      if (diffStat) {
        changedFiles = diffStat.split('\n').map(line => {
          const [addedStr, removedStr, file] = line.split(/\s+/);
          const added = addedStr === '-' ? 0 : Number(addedStr || 0);
          const removed = removedStr === '-' ? 0 : Number(removedStr || 0);
          
          // Convert git-root relative path to cwd-relative path
          const absolutePath = path.resolve(gitRoot, file);
          const relativeToCwd = path.relative(cwd, absolutePath).replace(/\\/g, '/');
          
          return { file: relativeToCwd, added, removed };
        });
      }
    } catch (err: any) {
      findings.push(`Failed to perform git diff: ${err.message}`);
      status = 'BLOCK';
    }
  } else if (checkpoint.backupPath && fs.existsSync(checkpoint.backupPath)) {
    // Non-Git diff implementation (Backup comparison)
    const { backupPath } = checkpoint;
    
    // Find all files in current directory and backup directory
    const getFilesRecursive = (dir: string, baseDir: string = dir): string[] => {
      let results: string[] = [];
      const ignore = ['.git', 'node_modules', '.jewel'];
      if (!fs.existsSync(dir)) return [];
      const list = fs.readdirSync(dir);
      for (const file of list) {
        if (ignore.includes(file)) continue;
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          results = results.concat(getFilesRecursive(filePath, baseDir));
        } else {
          results.push(path.relative(baseDir, filePath).replace(/\\/g, '/'));
        }
      }
      return results;
    };

    const currentFiles = getFilesRecursive(cwd);
    const backupFiles = getFilesRecursive(backupPath);
    const allFiles = Array.from(new Set([...currentFiles, ...backupFiles]));

    for (const file of allFiles) {
      const currentFilePath = path.join(cwd, file);
      const backupFilePath = path.join(backupPath, file);

      const existsNow = fs.existsSync(currentFilePath);
      const existedBefore = fs.existsSync(backupFilePath);

      if (!existedBefore && existsNow) {
        // File added
        const content = fs.readFileSync(currentFilePath, 'utf8');
        const lines = content.split('\n').length;
        changedFiles.push({ file, added: lines, removed: 0 });
      } else if (existedBefore && !existsNow) {
        // File deleted
        const content = fs.readFileSync(backupFilePath, 'utf8');
        const lines = content.split('\n').length;
        changedFiles.push({ file, added: 0, removed: lines });
      } else {
        // Modified - check line diff
        const currentContent = fs.readFileSync(currentFilePath, 'utf8');
        const backupContent = fs.readFileSync(backupFilePath, 'utf8');
        if (currentContent !== backupContent) {
          // Simple rough line-by-line diff or length diff
          const currentLines = currentContent.split('\n');
          const backupLines = backupContent.split('\n');
          // For simplicity, let's treat it as max changes
          const added = Math.max(0, currentLines.length - backupLines.length);
          const removed = Math.max(0, backupLines.length - currentLines.length);
          // ensure at least 1 change line is recorded if they are different
          changedFiles.push({ file, added: added || 1, removed: removed || 1 });
        }
      }
    }
  }

  // Count totals
  let totalAdded = 0;
  let totalRemoved = 0;
  const changedFileNames: string[] = [];

  for (const item of changedFiles) {
    totalAdded += item.added;
    totalRemoved += item.removed;
    changedFileNames.push(item.file);
  }

  const totalChangedLines = totalAdded + totalRemoved;

  // 1. Check maxFilesChanged
  if (changedFiles.length > config.maxFilesChanged) {
    findings.push(`Too many files changed: ${changedFiles.length} (limit: ${config.maxFilesChanged})`);
    status = 'BLOCK';
  }

  // 2. Check maxLinesChanged
  if (totalChangedLines > config.maxLinesChanged) {
    findings.push(`Too many lines changed: ${totalChangedLines} (limit: ${config.maxLinesChanged})`);
    status = 'BLOCK';
  }

  // 3. Detect protected files changed
  const protectedFilesChanged: string[] = [];
  for (const file of changedFileNames) {
    if (isProtectedPath(file, config)) {
      protectedFilesChanged.push(file);
    }
  }

  if (protectedFilesChanged.length > 0) {
    findings.push(`Protected files modified: ${protectedFilesChanged.join(', ')}`);
    if (!config.allowProtectedFileChanges) {
      status = 'BLOCK';
    } else {
      status = 'WARN';
    }
  }

  // 4. Detect dependency changes in package.json
  let dependenciesChanged = false;
  if (changedFileNames.some(f => isDependencyPath(f))) {
    try {
      let oldPkg: any = {};
      const currentPkgPath = path.join(cwd, 'package.json');
      const currentPkg = fs.existsSync(currentPkgPath) ? JSON.parse(fs.readFileSync(currentPkgPath, 'utf8')) : {};

      if (checkpoint.isGit && checkpoint.gitCheckpointSha) {
        try {
          const oldContent = execSync(`git show ${checkpoint.gitCheckpointSha}:package.json`, { cwd, encoding: 'utf8' });
          oldPkg = JSON.parse(oldContent);
        } catch {
          // Fallback if git show fails
        }
      } else if (checkpoint.backupPath) {
        const oldPkgPath = path.join(checkpoint.backupPath, 'package.json');
        if (fs.existsSync(oldPkgPath)) {
          oldPkg = JSON.parse(fs.readFileSync(oldPkgPath, 'utf8'));
        }
      }

      const checkDepsEqual = (d1: any = {}, d2: any = {}) => {
        const keys1 = Object.keys(d1);
        const keys2 = Object.keys(d2);
        if (keys1.length !== keys2.length) return false;
        for (const k of keys1) {
          if (d1[k] !== d2[k]) return false;
        }
        return true;
      };

      if (!checkDepsEqual(oldPkg.dependencies, currentPkg.dependencies) ||
          !checkDepsEqual(oldPkg.devDependencies, currentPkg.devDependencies) ||
          !checkDepsEqual(oldPkg.peerDependencies, currentPkg.peerDependencies)) {
        dependenciesChanged = true;
      }
    } catch {
      // If parsing fails, flag it conservatively
      dependenciesChanged = true;
    }
  }

  if (dependenciesChanged) {
    findings.push(`Dependencies in package.json modified.`);
    if (!config.allowNewDependencies) {
      status = 'BLOCK';
    } else if (status !== 'BLOCK') {
      status = 'WARN';
    }
  }

  // 5. Lockfiles changed
  const lockfilesChanged = changedFileNames.filter(f => isLockfilePath(f));
  
  if (lockfilesChanged.length > 0) {
    findings.push(`Lockfile(s) modified: ${lockfilesChanged.join(', ')}`);
    if (!config.allowNewDependencies && !config.allowProtectedFileChanges) {
      status = 'BLOCK';
    } else if (status !== 'BLOCK') {
      status = 'WARN';
    }
  }

  // 6. Deletion of folders / critical paths
  // If files count deleted is very high, warning or blocking
  const deletedFilesCount = changedFiles.filter(item => item.added === 0 && item.removed > 0).length;
  if (deletedFilesCount > 5) {
    findings.push(`Multiple files deleted (${deletedFilesCount} files). Potential dangerous directory deletion.`);
    status = 'BLOCK';
  }

  const mergedAllowedSymbols = [
    ...(config.allowedSymbolChanges || []),
    ...(allowedSymbolChanges || [])
  ]
    .map(s => s.trim())
    .filter(s => s.length > 0);

  const astResult = runASTDiffAnalysis(checkpoint, config, changedFiles, cwd, mergedAllowedSymbols);
  const astDiffs = astResult.astDiffs;

  if (config.useASTDiffGuard) {
    findings.push(...astResult.findings);
    if (astResult.status === 'BLOCK') {
      status = 'BLOCK';
    } else if (astResult.status === 'WARN' && status !== 'BLOCK') {
      status = 'WARN';
    }
  } else {
    // If not enabled, we still log findings as info for visual display in the UI
    findings.push(...astResult.findings.map(f => `[INFO] ${f}`));
  }

  return {
    status,
    changedFilesCount: changedFiles.length,
    addedLinesCount: totalAdded,
    removedLinesCount: totalRemoved,
    changedFiles: changedFileNames,
    protectedFilesChanged,
    dependenciesChanged,
    lockfilesChanged,
    findings,
    astDiffs
  };
}

let ts: any = null;
try {
  ts = require('typescript');
} catch {}

function extractASTSignatures(fileName: string, content: string): Set<string> {
  const signatures = new Set<string>();
  if (!ts) return signatures;

  let sourceFile;
  try {
    sourceFile = ts.createSourceFile(fileName, content, ts.ScriptTarget.Latest, true);
  } catch (err: any) {
    throw new Error(`Parsing failed: ${err.message}`);
  }

  for (const node of sourceFile.statements) {
    if (ts.isClassDeclaration(node) && node.name) {
      const className = node.name.text;
      signatures.add(`class ${className}`);
      if (node.members) {
        for (const member of node.members) {
          if (ts.isMethodDeclaration(member) && member.name) {
            const methodName = member.name.text;
            const params = member.parameters
              .map((p: any) => {
                if (p.name && ts.isIdentifier(p.name)) {
                  return p.name.text;
                }
                return '_';
              })
              .join(',');
            signatures.add(`method ${className}.${methodName}(${params})`);
          } else if (ts.isPropertyDeclaration(member) && member.name) {
            const propName = (member.name as any).text || '';
            if (propName) {
              signatures.add(`property ${className}.${propName}`);
            }
          }
        }
      }
    } else if (ts.isFunctionDeclaration(node) && node.name) {
      const funcName = node.name.text;
      const params = node.parameters
        .map((p: any) => {
          if (p.name && ts.isIdentifier(p.name)) {
            return p.name.text;
          }
          return '_';
        })
        .join(',');
      signatures.add(`function ${funcName}(${params})`);
    } else if (ts.isInterfaceDeclaration(node) && node.name) {
      signatures.add(`interface ${node.name.text}`);
    } else if (ts.isTypeAliasDeclaration(node) && node.name) {
      signatures.add(`type ${node.name.text}`);
    } else if (ts.isEnumDeclaration(node) && node.name) {
      signatures.add(`enum ${node.name.text}`);
    } else if (ts.isVariableStatement(node)) {
      if (node.declarationList && node.declarationList.declarations) {
        for (const decl of node.declarationList.declarations) {
          if (decl.name && ts.isIdentifier(decl.name)) {
            const varName = decl.name.text;
            let kind = 'var';
            if (node.declarationList.flags & ts.NodeFlags.Const) {
              kind = 'const';
            } else if (node.declarationList.flags & ts.NodeFlags.Let) {
              kind = 'let';
            }
            signatures.add(`${kind} ${varName}`);
          }
        }
      }
    }
  }

  return signatures;
}

function runASTDiffAnalysis(
  checkpoint: CheckpointMetadata,
  config: JewelConfig,
  changedFiles: { file: string; added: number; removed: number }[],
  cwd: string,
  allowedSymbolChanges: string[] = []
): { status: 'PASS' | 'WARN' | 'BLOCK'; findings: string[]; astDiffs: ASTFileDiff[] } {
  const findings: string[] = [];
  let status: 'PASS' | 'WARN' | 'BLOCK' = 'PASS';
  const astDiffs: ASTFileDiff[] = [];

  if (!ts) {
    findings.push("AST Diff Guard: TypeScript module not found. Falling back to line-by-line checks.");
    return { status: 'WARN', findings, astDiffs };
  }

  // 1. AST comparison for each changed JS/TS file
  for (const item of changedFiles) {
    const file = item.file;
    const ext = path.extname(file).toLowerCase();
    if (!['.js', '.ts', '.jsx', '.tsx'].includes(ext)) {
      continue;
    }

    const newPath = path.resolve(cwd, file);
    if (!fs.existsSync(newPath)) {
      continue;
    }
    const newContent = fs.readFileSync(newPath, 'utf8');

    let oldContent = '';
    if (checkpoint.isGit && checkpoint.gitCheckpointSha) {
      try {
        oldContent = execSync(`git show ${checkpoint.gitCheckpointSha}:${file}`, {
          cwd,
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'ignore']
        });
      } catch {
        continue;
      }
    } else if (checkpoint.backupPath) {
      const backupFilePath = path.join(checkpoint.backupPath, file);
      if (fs.existsSync(backupFilePath)) {
        oldContent = fs.readFileSync(backupFilePath, 'utf8');
      } else {
        continue;
      }
    } else {
      continue;
    }

    try {
      const oldSignatures = extractASTSignatures(file, oldContent);
      const newSignatures = extractASTSignatures(file, newContent);
      const items: ASTDiffItem[] = [];

      for (const sig of oldSignatures) {
        if (!newSignatures.has(sig)) {
          const isAllowed = allowedSymbolChanges.some(allowed => {
            if (sig === allowed || sig.includes(allowed)) {
              return true;
            }
            const words = sig.split(/[\s.()=,]+/);
            return words.includes(allowed);
          });

          if (!isAllowed) {
            findings.push(`AST Diff Guard: Deleted or modified signature of '${sig}' in '${file}'.`);
            status = 'BLOCK';
          }
          items.push({ type: 'deleted', signature: sig });
        }
      }

      for (const sig of newSignatures) {
        if (!oldSignatures.has(sig)) {
          items.push({ type: 'added', signature: sig });
        }
      }

      if (items.length > 0) {
        astDiffs.push({ file, items });
      }
    } catch (err: any) {
      findings.push(`AST Diff Guard: Failed to parse AST for '${file}': ${err.message}. Falling back to line-by-line checks.`);
      if (status !== 'BLOCK') {
        status = 'WARN';
      }
    }
  }


  // 2. Semantic Dependency mapping
  const changedJSFiles = changedFiles
    .map(item => item.file)
    .filter(file => ['.js', '.ts', '.jsx', '.tsx'].includes(path.extname(file).toLowerCase()));

  if (changedJSFiles.length > 0) {
    const allFiles: string[] = [];
    const collectFiles = (dir: string) => {
      const ignore = ['.git', 'node_modules', '.jewel', 'dist'];
      if (!fs.existsSync(dir)) return;
      let entries;
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (ignore.includes(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          collectFiles(full);
        } else {
          allFiles.push(path.relative(cwd, full).replace(/\\/g, '/'));
        }
      }
    };
    collectFiles(cwd);

    const protectedFiles = allFiles.filter(file => isProtectedPath(file, config));

    for (const changedFile of changedJSFiles) {
      const changedFileAbs = path.resolve(cwd, changedFile);

      for (const protFile of protectedFiles) {
        const protFileAbs = path.resolve(cwd, protFile);
        if (changedFileAbs === protFileAbs) {
          continue;
        }

        let protContent = '';
        try {
          protContent = fs.readFileSync(protFileAbs, 'utf8');
        } catch {
          continue;
        }

        const rel = path.relative(path.dirname(protFileAbs), changedFileAbs);
        let relNorm = rel.replace(/\\/g, '/');
        relNorm = relNorm.replace(/\.[jt]sx?$/, '');
        const relativeImport = relNorm.startsWith('.') ? relNorm : './' + relNorm;

        const importPatterns = [
          `'${relativeImport}'`,
          `"${relativeImport}"`,
          `\`${relativeImport}\``
        ];
        const isReferenced = importPatterns.some(pat => protContent.includes(pat));

        if (isReferenced) {
          findings.push(`AST Diff Guard: Modified file '${changedFile}' is referenced by protected module '${protFile}'.`);
          if (status !== 'BLOCK') {
            status = 'WARN';
          }
        }
      }
    }
  }

  return { status, findings, astDiffs };
}
