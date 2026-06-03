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
exports.runInit = runInit;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const templates_1 = require("../../core/templates");
function runInit(cwd = process.cwd()) {
    console.log('Initializing Jewel in', cwd);
    const stats = {
        created: [],
        skipped: [],
        backedUp: []
    };
    // 1. jewel.config.json
    const configPath = path.join(cwd, 'jewel.config.json');
    if (fs.existsSync(configPath)) {
        // If it exists, skip
        stats.skipped.push('jewel.config.json (already exists)');
    }
    else {
        fs.writeFileSync(configPath, templates_1.DEFAULT_CONFIG_CONTENT, 'utf8');
        stats.created.push('jewel.config.json');
    }
    // 2. AGENTS.md
    const agentsMdPath = path.join(cwd, 'AGENTS.md');
    if (fs.existsSync(agentsMdPath)) {
        stats.skipped.push('AGENTS.md (already exists)');
    }
    else {
        fs.writeFileSync(agentsMdPath, templates_1.AGENTS_MD_CONTENT, 'utf8');
        stats.created.push('AGENTS.md');
    }
    // 3. Create .jewel structure
    const dotJewelDir = path.join(cwd, '.jewel');
    const folders = [
        '',
        'skills',
        'reports',
        'sessions'
    ];
    for (const f of folders) {
        const dir = path.join(dotJewelDir, f);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            if (f)
                stats.created.push(`.jewel/${f} directory`);
        }
        else {
            if (f)
                stats.skipped.push(`.jewel/${f} directory (already exists)`);
        }
    }
    // 4. Create default skills
    const skillsDir = path.join(dotJewelDir, 'skills');
    for (const skill of templates_1.DEFAULT_SKILLS) {
        const skillFolder = path.join(skillsDir, skill.folder);
        const skillFilePath = path.join(skillFolder, 'SKILL.md');
        if (!fs.existsSync(skillFolder)) {
            fs.mkdirSync(skillFolder, { recursive: true });
        }
        if (fs.existsSync(skillFilePath)) {
            stats.skipped.push(`.jewel/skills/${skill.folder}/SKILL.md (already exists)`);
        }
        else {
            fs.writeFileSync(skillFilePath, skill.content, 'utf8');
            stats.created.push(`.jewel/skills/${skill.folder}/SKILL.md`);
        }
    }
    // Print results
    console.log('\n--- Initialization Report ---');
    if (stats.created.length > 0) {
        console.log('\nCreated:');
        stats.created.forEach(item => console.log(`  [+] ${item}`));
    }
    if (stats.skipped.length > 0) {
        console.log('\nSkipped:');
        stats.skipped.forEach(item => console.log(`  [-] ${item}`));
    }
    if (stats.backedUp.length > 0) {
        console.log('\nBacked Up:');
        stats.backedUp.forEach(item => console.log(`  [~] ${item}`));
    }
    console.log('\nJewel initialized successfully.');
}
