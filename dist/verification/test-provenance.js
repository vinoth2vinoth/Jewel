"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeTestProvenanceReport = writeTestProvenanceReport;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function writeTestProvenanceReport(records, cwd) {
    const reportsDir = path.join(cwd, '.jewel', 'reports');
    if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
    }
    // 1. JSON Report
    fs.writeFileSync(path.join(reportsDir, 'test-provenance.json'), JSON.stringify(records, null, 2), 'utf8');
    // 2. MD Report
    let md = `# Jewel Test Provenance Report\n\n`;
    md += `This report tracks the origin, modifications, and preservation policies of unit tests during Jewel runs.\n\n`;
    if (records.length === 0) {
        md += `*No test files were modified or created in this session.*\n`;
    }
    else {
        md += `| Test File | Appended Tests | Modified Tests | Type | Provider | Critic Verdict | Verification | Preserved? |\n`;
        md += `|---|---|---|---|---|---|---|---|\n`;
        for (const r of records) {
            const typeStr = r.isInvasive ? 'Invasive' : 'Append-Only';
            md += `| \`${r.testFile}\` | ${r.addedTestNames.map(t => `\`${t}\``).join(', ') || 'None'} | ${r.modifiedTestNames.map(t => `\`${t}\``).join(', ') || 'None'} | ${typeStr} | ${r.provider} | ${r.criticVerdict} | ${r.verificationStatus} | ${r.existingTestsPreserved ? 'Yes' : 'No'} |\n`;
        }
    }
    fs.writeFileSync(path.join(reportsDir, 'test-provenance.md'), md, 'utf8');
}
