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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const node_assert_1 = __importDefault(require("node:assert"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const report_redaction_audit_1 = require("./report-redaction-audit");
function createTempReportsDir() {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jewel-audit-test-'));
    const reportsDir = path.join(tempDir, '.jewel', 'reports');
    fs.mkdirSync(reportsDir, { recursive: true });
    return { tempDir, reportsDir };
}
function cleanupTempDir(dir) {
    try {
        fs.rmSync(dir, { recursive: true, force: true });
    }
    catch { }
}
(0, node_test_1.default)('report redaction audit - clean reports pass', () => {
    const { tempDir, reportsDir } = createTempReportsDir();
    try {
        fs.writeFileSync(path.join(reportsDir, 'report1.json'), JSON.stringify({ status: 'PASS', info: 'all good' }), 'utf8');
        fs.writeFileSync(path.join(reportsDir, 'report2.md'), '# Run summary\nNo leaks here.', 'utf8');
        const result = (0, report_redaction_audit_1.auditReports)(tempDir);
        node_assert_1.default.strictEqual(result.success, true);
        node_assert_1.default.strictEqual(result.leakedFiles.length, 0);
    }
    finally {
        cleanupTempDir(tempDir);
    }
});
(0, node_test_1.default)('report redaction audit - flags OpenAI sk- style keys', () => {
    const { tempDir, reportsDir } = createTempReportsDir();
    try {
        fs.writeFileSync(path.join(reportsDir, 'leak.json'), JSON.stringify({ status: 'FAIL', keyUsed: 'sk-proj-123456789012345678901234567890' }), 'utf8');
        const result = (0, report_redaction_audit_1.auditReports)(tempDir);
        node_assert_1.default.strictEqual(result.success, false);
        node_assert_1.default.strictEqual(result.leakedFiles.length, 1);
        node_assert_1.default.strictEqual(result.leakedFiles[0].filePath, '.jewel/reports/leak.json');
    }
    finally {
        cleanupTempDir(tempDir);
    }
});
(0, node_test_1.default)('report redaction audit - flags GitHub PATs', () => {
    const { tempDir, reportsDir } = createTempReportsDir();
    try {
        fs.writeFileSync(path.join(reportsDir, 'leak.md'), '# Leak\ngithub_pat_123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890', 'utf8');
        const result = (0, report_redaction_audit_1.auditReports)(tempDir);
        node_assert_1.default.strictEqual(result.success, false);
        node_assert_1.default.strictEqual(result.leakedFiles.length, 1);
        node_assert_1.default.strictEqual(result.leakedFiles[0].filePath, '.jewel/reports/leak.md');
    }
    finally {
        cleanupTempDir(tempDir);
    }
});
