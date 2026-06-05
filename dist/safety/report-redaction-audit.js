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
exports.auditReports = auditReports;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const secret_redactor_1 = require("./secret-redactor");
/**
 * Scans the .jewel/reports directory for potential unredacted secret leaks.
 * If running redactSecrets on a report file changes its content, a leak is identified.
 */
function auditReports(cwd = process.cwd()) {
    const reportsDir = path.join(cwd, '.jewel', 'reports');
    if (!fs.existsSync(reportsDir)) {
        return { success: true, leakedFiles: [] };
    }
    const leakedFiles = [];
    try {
        const files = fs.readdirSync(reportsDir);
        for (const file of files) {
            const filePath = path.join(reportsDir, file);
            const stat = fs.statSync(filePath);
            if (stat.isFile() && (file.endsWith('.json') || file.endsWith('.md'))) {
                const content = fs.readFileSync(filePath, 'utf8');
                const redacted = (0, secret_redactor_1.redactSecrets)(content);
                if (redacted !== content) {
                    leakedFiles.push({
                        filePath: path.relative(cwd, filePath).replace(/\\/g, '/'),
                        reason: 'Contains unredacted secrets (e.g. API keys, authorization tokens, or passwords).'
                    });
                }
            }
        }
    }
    catch (err) {
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
