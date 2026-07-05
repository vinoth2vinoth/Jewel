import { JewelConfig } from './config';
import { TaskContract } from './session';
import { RunTaskOptions } from './run-task-options';

export interface FastPathDecision {
  enabled: boolean;
  reasons: string[];
}

export function shouldUseFastPath(
  config: JewelConfig,
  contract: TaskContract,
  resolvedFiles: string[],
  runOptions?: RunTaskOptions
): FastPathDecision {
  const reasons: string[] = [];

  if (config.fastPathEnabled === false) {
    return { enabled: false, reasons: ['fastPathEnabled is false'] };
  }

  if (runOptions?.continuationFeedback || runOptions?.parentSessionId) {
    return { enabled: false, reasons: ['continuation session'] };
  }

  const maxFiles = config.fastPathMaxFiles ?? 1;
  if (resolvedFiles.length > maxFiles) {
    return { enabled: false, reasons: [`${resolvedFiles.length} files exceed fastPathMaxFiles (${maxFiles})`] };
  }

  const maxRisk = config.fastPathMaxRisk ?? 'low';
  const riskOrder = { low: 0, medium: 1, high: 2 };
  if (riskOrder[contract.riskLevel] > riskOrder[maxRisk]) {
    return { enabled: false, reasons: [`risk level ${contract.riskLevel} exceeds fastPathMaxRisk (${maxRisk})`] };
  }

  if (contract.requiresApproval) {
    return { enabled: false, reasons: ['contract requires approval'] };
  }

  reasons.push(`low-risk (${contract.riskLevel})`, `${resolvedFiles.length} file(s)`);
  return { enabled: true, reasons };
}

export function applyFastPathConfig(config: JewelConfig): JewelConfig {
  const copy = { ...config };
  if (copy.critics && copy.critics.length > 1) {
    copy.critics = ['security'];
  }
  return copy;
}
