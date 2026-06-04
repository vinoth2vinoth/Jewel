import * as fs from 'fs';
import * as path from 'path';

export interface TestProvenanceRecord {
  testFile: string;
  addedTestNames: string[];
  modifiedTestNames: string[];
  removedTestNames: string[];
  isAppended: boolean;
  isInvasive: boolean;
  provider: string;
  criticVerdict: string;
  verificationStatus: string;
  existingTestsPreserved: boolean;
}

export function writeTestProvenanceReport(
  records: TestProvenanceRecord[],
  cwd: string
): void {
  const reportsDir = path.join(cwd, '.jewel', 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  // 1. JSON Report
  fs.writeFileSync(
    path.join(reportsDir, 'test-provenance.json'),
    JSON.stringify(records, null, 2),
    'utf8'
  );

  // 2. MD Report
  let md = `# Jewel Test Provenance Report\n\n`;
  md += `This report tracks the origin, modifications, and preservation policies of unit tests during Jewel runs.\n\n`;

  if (records.length === 0) {
    md += `*No test files were modified or created in this session.*\n`;
  } else {
    md += `| Test File | Appended Tests | Modified Tests | Type | Provider | Critic Verdict | Verification | Preserved? |\n`;
    md += `|---|---|---|---|---|---|---|---|\n`;
    for (const r of records) {
      const typeStr = r.isInvasive ? 'Invasive' : 'Append-Only';
      md += `| \`${r.testFile}\` | ${r.addedTestNames.map(t => `\`${t}\``).join(', ') || 'None'} | ${r.modifiedTestNames.map(t => `\`${t}\``).join(', ') || 'None'} | ${typeStr} | ${r.provider} | ${r.criticVerdict} | ${r.verificationStatus} | ${r.existingTestsPreserved ? 'Yes' : 'No'} |\n`;
    }
  }

  fs.writeFileSync(
    path.join(reportsDir, 'test-provenance.md'),
    md,
    'utf8'
  );
}
