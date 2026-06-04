import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

export function getOriginalFileContent(
  filePath: string,
  checkpoint: { isGit: boolean; gitCheckpointSha?: string; backupPath?: string },
  cwd: string
): string {
  if (checkpoint.isGit && checkpoint.gitCheckpointSha) {
    try {
      const gitPath = filePath.replace(/\\/g, '/');
      return execSync(`git show ${checkpoint.gitCheckpointSha}:${gitPath}`, {
        cwd,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore']
      });
    } catch {
      return '';
    }
  } else if (checkpoint.backupPath) {
    const backupFilePath = path.join(checkpoint.backupPath, filePath);
    if (fs.existsSync(backupFilePath)) {
      return fs.readFileSync(backupFilePath, 'utf8');
    }
    return '';
  }
  return '';
}

interface TestNodeInfo {
  name: string;
  bodyText: string;
  start: number;
  end: number;
}

export interface PolicyReport {
  success: boolean;
  invasive: boolean;
  appendOnly: boolean;
  findings: string[];
  testProvenance: {
    appendedTestNames: string[];
    modifiedTestNames: string[];
    removedTestNames: string[];
    hasInvasiveChanges: boolean;
  };
}

export function parseTestFile(content: string, filename: string) {
  const sourceFile = ts.createSourceFile(filename, content, ts.ScriptTarget.Latest, true);
  const tests: TestNodeInfo[] = [];
  const imports: string[] = [];

  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node)) {
      imports.push(node.getText());
    }

    if (ts.isCallExpression(node)) {
      const exp = node.expression;
      if (ts.isIdentifier(exp) && (exp.text === 'test' || exp.text === 'it')) {
        const args = node.arguments;
        if (args.length >= 2 && ts.isStringLiteral(args[0]) && (ts.isArrowFunction(args[1]) || ts.isFunctionExpression(args[1]))) {
          tests.push({
            name: args[0].text,
            bodyText: args[1].getText().trim(),
            start: node.getStart(),
            end: node.getEnd()
          });
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return { tests, imports };
}

export function checkTestChangePolicy(
  originalContent: string,
  patchedContent: string,
  filename: string,
  preserveExistingTests: boolean = false
): PolicyReport {
  const original = parseTestFile(originalContent, filename);
  const patched = parseTestFile(patchedContent, filename);

  const findings: string[] = [];
  const appendedTestNames: string[] = [];
  const modifiedTestNames: string[] = [];
  const removedTestNames: string[] = [];
  let invasive = false;
  let appendOnly = true;

  // Rule 2 & 3: Check if original tests were modified or removed
  for (const origTest of original.tests) {
    const patchedTest = patched.tests.find(t => t.name === origTest.name);
    if (!patchedTest) {
      // Test was removed or renamed
      removedTestNames.push(origTest.name);
      invasive = true;
      appendOnly = false;
      findings.push(`Existing test name changed or removed: "${origTest.name}"`);
    } else {
      // Check body content to see if assertions/body changed
      const normOrig = origTest.bodyText.replace(/\s+/g, ' ').trim();
      const normPatched = patchedTest.bodyText.replace(/\s+/g, ' ').trim();
      if (normOrig !== normPatched) {
        modifiedTestNames.push(origTest.name);
        invasive = true;
        appendOnly = false;
        findings.push(`Existing test body or assertions modified for test: "${origTest.name}"`);
      }
    }
  }

  // Check for appended tests
  for (const patchedTest of patched.tests) {
    const origTest = original.tests.find(t => t.name === patchedTest.name);
    if (!origTest) {
      appendedTestNames.push(patchedTest.name);
      // Verify if the test is indeed appended at the end of the file
      // If its start position is before the end position of any original test, it is invasive (inserted in the middle)
      const isInsertedInMiddle = original.tests.some(ot => patchedTest.start < ot.end);
      if (isInsertedInMiddle) {
        appendOnly = false;
        invasive = true;
        findings.push(`New test "${patchedTest.name}" was inserted in the middle of existing tests.`);
      }
    }
  }

  // Check imports
  const originalImportTexts = original.imports.map(i => i.trim());
  const patchedImportTexts = patched.imports.map(i => i.trim());

  const addedImports = patchedImportTexts.filter(pi => !originalImportTexts.includes(pi));
  const removedImports = originalImportTexts.filter(oi => !patchedImportTexts.includes(oi));

  if (removedImports.length > 0) {
    findings.push(`Existing imports were modified or removed: ${removedImports.join(', ')}`);
    invasive = true;
    appendOnly = false;
  }

  if (addedImports.length > 0) {
    if (appendedTestNames.length > 0) {
      findings.push(`[WARN] Added imports for new appended tests: ${addedImports.join(', ')}`);
    } else {
      findings.push(`Added imports without new tests: ${addedImports.join(', ')}`);
      invasive = true;
      appendOnly = false;
    }
  }

  // Rule 6: If preserveExistingTests is true and there are invasive changes, block
  const success = !(preserveExistingTests && invasive);

  return {
    success,
    invasive,
    appendOnly: appendOnly && (removedTestNames.length === 0) && (modifiedTestNames.length === 0),
    findings,
    testProvenance: {
      appendedTestNames,
      modifiedTestNames,
      removedTestNames,
      hasInvasiveChanges: invasive
    }
  };
}
