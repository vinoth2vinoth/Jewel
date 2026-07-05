import * as fs from 'fs';
import * as path from 'path';
import { JewelPluginManifest, PluginType } from './types';

function validateManifest(parsed: unknown, pluginDir: string): JewelPluginManifest | null {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.name !== 'string' || obj.name.trim() === '') return null;
  if (typeof obj.version !== 'string') return null;
  if (obj.type !== 'verifier' && obj.type !== 'critic') return null;
  if (typeof obj.command !== 'string' || obj.command.trim() === '') return null;

  return {
    name: obj.name,
    version: obj.version,
    type: obj.type as PluginType,
    command: obj.command,
    description: typeof obj.description === 'string' ? obj.description : undefined,
    blockOnFail: obj.blockOnFail === true,
    timeoutMs: typeof obj.timeoutMs === 'number' ? obj.timeoutMs : 30_000
  };
}

export function loadPlugins(cwd: string = process.cwd()): JewelPluginManifest[] {
  const pluginsDir = path.join(cwd, '.jewel', 'plugins');
  if (!fs.existsSync(pluginsDir)) return [];

  const plugins: JewelPluginManifest[] = [];
  for (const entry of fs.readdirSync(pluginsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(pluginsDir, entry.name, 'plugin.json');
    if (!fs.existsSync(manifestPath)) continue;
    try {
      const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const manifest = validateManifest(parsed, entry.name);
      if (manifest) plugins.push(manifest);
    } catch {}
  }
  return plugins;
}

export function loadPluginsByType(cwd: string, type: PluginType): JewelPluginManifest[] {
  return loadPlugins(cwd).filter(p => p.type === type);
}
