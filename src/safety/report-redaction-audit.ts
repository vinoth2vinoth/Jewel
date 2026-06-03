import * as fs from 'fs';
import * as path from 'path';
import { redactSecrets } from './secret-redactor';

export interface AuditLeak {
  filePath: string;
  reason: string;
}

export interface AuditReportResult {
  success: boolean;
  leakedFiles: AuditLeak[];
}

/**
 * Scans the .jewel/reports directory for potential unredacted secret leaks.
 * If running redactSecrets on a report file changes its content, a leak is identified.
 */
export function auditReports(cwd: string = process.cwd()): AuditReportResult {
  const reportsDir = path.join(cwd, '.jewel', 'reports');
  if (!fs.existsSync(reportsDir)) {
    return { success: true, leakedFiles: [] };
  }

  const leakedFiles: AuditLeak[] = [];
  try {
    const files = fs.readdirSync(reportsDir);
    for (const file of files) {
      const filePath = path.join(reportsDir, file);
      const stat = fs.statSync(filePath);
      if (stat.isFile() && (file.endsWith('.json') || file.endsWith('.md'))) {
        const content = fs.readFileSync(filePath, 'utf8');
        const redacted = redactSecrets(content);
        if (redacted !== content) {
          leakedFiles.push({
            filePath: path.relative(cwd, filePath).replace(/\\/g, '/'),
            reason: 'Contains unredacted secrets (e.g. API keys, authorization tokens, or passwords).'
          });
        }
      }
    }
  } catch (err: any) {
    // Return failure if filesystem access fails
    return {
      success: false,
      leakedFiles: [{ filePath: '.jewel/reports', reason: `Failed to audit reports: ${err.message}` }]
    };
  }

  return {
    success: leakedFiles.length === 0,
    leakedFiles
  };
}
