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
exports.loadSkills = loadSkills;
exports.parseSkillContent = parseSkillContent;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function loadSkills(cwd = process.cwd()) {
    const skillsDir = path.join(cwd, '.jewel', 'skills');
    if (!fs.existsSync(skillsDir)) {
        return [];
    }
    const skills = [];
    const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.isDirectory()) {
            const skillFile = path.join(skillsDir, entry.name, 'SKILL.md');
            if (fs.existsSync(skillFile)) {
                try {
                    const content = fs.readFileSync(skillFile, 'utf8');
                    const skill = parseSkillContent(content);
                    skills.push(skill);
                }
                catch {
                    // Skip malformed skill files
                }
            }
        }
    }
    return skills;
}
function parseSkillContent(content) {
    const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    let name = '';
    let description = '';
    let rules = [];
    if (frontmatterMatch) {
        const lines = frontmatterMatch[1].split('\n');
        for (const line of lines) {
            const colonIdx = line.indexOf(':');
            if (colonIdx !== -1) {
                const key = line.substring(0, colonIdx).trim();
                const val = line.substring(colonIdx + 1).trim();
                if (key === 'name') {
                    name = val;
                }
                else if (key === 'description') {
                    description = val;
                }
            }
        }
    }
    // Parse rules (typically lines starting with numbers or list markers after the frontmatter)
    const remainingContent = frontmatterMatch ? content.substring(frontmatterMatch[0].length) : content;
    const lines = remainingContent.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('-') || /^\d+\./.test(trimmed)) {
            rules.push(trimmed.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, ''));
        }
    }
    return {
        name: name || 'unnamed',
        description: description || '',
        rules,
        rawContent: content
    };
}
