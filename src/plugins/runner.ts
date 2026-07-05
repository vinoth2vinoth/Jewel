import { execSync } from 'child_process';
import { JewelPluginManifest, PluginContext, PluginResult } from './types';

function parsePluginOutput(raw: string): PluginResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { status: 'WARN', findings: ['Plugin returned empty output.'] };
  }
  try {
    const obj = JSON.parse(trimmed);
    const status = obj.status;
    if (!['PASS', 'WARN', 'BLOCK', 'FAIL'].includes(status)) {
      return { status: 'WARN', findings: [`Invalid plugin status: ${status}`] };
    }
    const findings = Array.isArray(obj.findings)
      ? obj.findings.filter((f: unknown) => typeof f === 'string')
      : [];
    const requiredActions = Array.isArray(obj.requiredActions)
      ? obj.requiredActions.filter((f: unknown) => typeof f === 'string')
      : [];
    return { status, findings, requiredActions };
  } catch {
    return { status: 'WARN', findings: [`Plugin returned non-JSON output: ${trimmed.slice(0, 200)}`] };
  }
}

export function runPlugin(
  plugin: JewelPluginManifest,
  context: PluginContext
): PluginResult {
  const timeoutMs = plugin.timeoutMs ?? 30_000;
  try {
    const output = execSync(plugin.command, {
      cwd: context.cwd,
      input: JSON.stringify(context),
      encoding: 'utf8',
      timeout: timeoutMs,
      env: { ...process.env, JEWEL_PLUGIN: plugin.name, JEWEL_PLUGIN_TYPE: plugin.type },
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return parsePluginOutput(output);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      status: plugin.blockOnFail ? 'BLOCK' : 'WARN',
      findings: [`Plugin "${plugin.name}" execution failed: ${msg}`]
    };
  }
}

export function runPlugins(
  plugins: JewelPluginManifest[],
  context: PluginContext
): Array<{ plugin: JewelPluginManifest; result: PluginResult }> {
  return plugins.map(plugin => ({
    plugin,
    result: runPlugin(plugin, context)
  }));
}
