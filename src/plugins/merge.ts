import { CriticResult } from '../safety/critic';
import { PluginResult } from './types';

export function mergePluginResultsIntoCritic(
  base: CriticResult,
  pluginResults: Array<{ name: string; result: PluginResult }>
): CriticResult {
  let status = base.status;
  const findings = [...base.findings];
  const requiredActions = [...base.requiredActions];
  let confidence = base.confidence;

  for (const { name, result } of pluginResults) {
    for (const f of result.findings) {
      findings.push(`[Plugin: ${name}] ${f}`);
    }
    if (result.requiredActions) {
      requiredActions.push(...result.requiredActions.map(a => `[Plugin: ${name}] ${a}`));
    }
    if (result.status === 'BLOCK' || result.status === 'FAIL') {
      status = 'BLOCK';
      confidence = 'low';
      requiredActions.push(`Address blocking findings from plugin "${name}".`);
    } else if (result.status === 'WARN' && status !== 'BLOCK') {
      status = 'WARN';
    }
  }

  return { status, findings, requiredActions, confidence };
}
