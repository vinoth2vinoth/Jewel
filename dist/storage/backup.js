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
exports.backupDirectory = backupDirectory;
exports.restoreDirectory = restoreDirectory;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function backupDirectory(src, dest, ignoreList = ['.git', 'node_modules', '.jewel']) {
    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (ignoreList.includes(entry.name)) {
            continue;
        }
        if (entry.isDirectory()) {
            backupDirectory(srcPath, destPath, ignoreList);
        }
        else if (entry.isFile()) {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}
function restoreDirectory(src, dest, ignoreList = ['.git', 'node_modules', '.jewel']) {
    // First, safely remove existing files in dest that are not in the ignore list
    const entries = fs.readdirSync(dest, { withFileTypes: true });
    for (const entry of entries) {
        if (ignoreList.includes(entry.name)) {
            continue;
        }
        const targetPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            fs.rmSync(targetPath, { recursive: true, force: true });
        }
        else {
            fs.unlinkSync(targetPath);
        }
    }
    // Copy files back from backup
    if (fs.existsSync(src)) {
        const backupEntries = fs.readdirSync(src, { withFileTypes: true });
        for (const entry of backupEntries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);
            if (entry.isDirectory()) {
                backupDirectory(srcPath, destPath, ignoreList);
            }
            else {
                fs.copyFileSync(srcPath, destPath);
            }
        }
    }
}
