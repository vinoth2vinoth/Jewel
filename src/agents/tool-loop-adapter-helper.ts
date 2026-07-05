import { extractJsonObject } from './json-response';
import { buildToolLoopPrompt } from './tool-loop-prompt';
import { validateToolLoopDecision } from './tool-loop';
import { ToolLoopDecision, ToolLoopInput } from './tools/types';
import { LLMMessage } from './adapter';
import { JewelConfig } from '../core/config';

export type LlmCaller = (
  messages: LLMMessage[],
  config: JewelConfig,
  method: string,
  sessionPath?: string
) => Promise<string>;

export async function decideToolStepViaLlm(
  callLlm: LlmCaller,
  input: ToolLoopInput
): Promise<ToolLoopDecision> {
  const prompt = buildToolLoopPrompt(input);
  const response = await callLlm(
    [
      { role: 'system', content: 'You are a read-only codebase exploration agent. Return strict JSON only.' },
      { role: 'user', content: prompt }
    ],
    input.config,
    'decideToolStep',
    input.sessionPath
  );
  const parsed = extractJsonObject(response);
  return validateToolLoopDecision(parsed);
}
