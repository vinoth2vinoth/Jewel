import { TaskContract } from '../core/session';
import { JewelConfig } from '../core/config';
import { UIServer } from './ui-server';
import { askQuestion } from './commands/run-helpers';

export interface PlanPreviewOptions {
  planOnly?: boolean;
  approvePlan?: boolean;
  yesFlag?: boolean;
  uiServer?: UIServer | null;
}

export function printPlanPreview(contract: TaskContract, files: string[]): void {
  console.log('\n======================================');
  console.log('   JEWEL PLAN PREVIEW                 ');
  console.log('======================================');
  console.log(`Task: ${contract.task}`);
  console.log(`Risk Level: ${contract.riskLevel}`);
  console.log(`Understanding: ${contract.understanding}`);
  console.log(`Files in scope: ${files.join(', ') || '(none)'}`);
  console.log('Success Criteria:');
  contract.successCriteria.forEach(c => console.log(`  - ${c}`));
  if (contract.assumptions.length > 0) {
    console.log('Assumptions:');
    contract.assumptions.forEach(a => console.log(`  - ${a}`));
  }
  console.log('======================================\n');
}

export async function handlePlanApproval(
  contract: TaskContract,
  files: string[],
  config: JewelConfig,
  options: PlanPreviewOptions
): Promise<'proceed' | 'abort' | 'plan-only'> {
  printPlanPreview(contract, files);

  if (options.planOnly) {
    console.log('[Plan-Only] Stopping before checkpoint. No files will be modified.');
    return 'plan-only';
  }

  const needsApproval = config.requirePlanApproval === true;
  if (!needsApproval || options.approvePlan || options.yesFlag) {
    return 'proceed';
  }

  if (options.uiServer) {
    options.uiServer.updateState({ stage: 'review' });
    const res = await options.uiServer.waitForApproval('scope-expansion', {
      message: 'Approve this plan before Jewel creates a checkpoint and applies patches?'
    });
    return res.action === 'approve' ? 'proceed' : 'abort';
  }

  const answer = await askQuestion('Approve this plan and proceed to patch? (y/n): ');
  return answer.toLowerCase().trim() === 'y' ? 'proceed' : 'abort';
}
