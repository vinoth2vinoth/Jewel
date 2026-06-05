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
exports.runVersion = runVersion;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function runVersion(cwd = process.cwd()) {
    let pkgVersion = '0.5.0-dev';
    try {
        const pkgPath = path.join(__dirname, '../../../package.json');
        if (fs.existsSync(pkgPath)) {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
            pkgVersion = pkg.version || pkgVersion;
        }
        else {
            // Try adjacent path if running in dev typescript directly
            const devPkgPath = path.join(__dirname, '../../package.json');
            if (fs.existsSync(devPkgPath)) {
                const pkg = JSON.parse(fs.readFileSync(devPkgPath, 'utf8'));
                pkgVersion = pkg.version || pkgVersion;
            }
        }
    }
    catch { }
    console.log(`Jewel version: ${pkgVersion}`);
    console.log(`Node.js version: ${process.version}`);
    console.log(`Platform: ${process.platform} (${process.arch})`);
    console.log(`Default configuration: Looks for jewel.config.json in the current working directory, falling back to built-in defaults.`);
    let activeConfigText = 'Active configuration: none (using defaults)';
    try {
        const configPath = path.join(cwd, 'jewel.config.json');
        if (fs.existsSync(configPath)) {
            const configContent = fs.readFileSync(configPath, 'utf8');
            const config = JSON.parse(configContent);
            const projectName = config && typeof config.projectName === 'string' ? config.projectName : '';
            activeConfigText = `Active configuration: found (project: "${projectName}")`;
        }
    }
    catch { }
    console.log(activeConfigText);
}
