import * as crypto from 'crypto';

export interface RetryState {
  attempt: number;
  maxRetries: number;
  seenFailures: Set<string>;
  seenVerdicts: Set<string>;
  lastVerdict?: string;
}

export function createRetryState(maxRetries: number): RetryState {
  return {
    attempt: 0,
    maxRetries,
    seenFailures: new Set(),
    seenVerdicts: new Set(),
  };
}

export function getFailureSignature(log: string): string {
  // Normalize whitespace, paths, and platform-specific line endings to identify the same crash
  const normalized = log
    .replace(/\r\n/g, '\n')
    .replace(/\s+/g, ' ')
    .replace(/\\/g, '/')
    .trim();
  return crypto.createHash('md5').update(normalized).digest('hex');
}

export interface StopDecision {
  stop: boolean;
  reason?: string;
  status?: 'NEEDS_HUMAN_REVIEW' | 'EXISTING_TEST_MODIFIED' | 'RETRY_LIMIT_REACHED' | 'GENERATED_TEST_SUSPECT';
}

export function shouldStopRetry(
  state: RetryState,
  failureLog: string,
  verdict: string,
  confidence: string,
  existingTestModified: boolean
): StopDecision {
  if (existingTestModified) {
    return {
      stop: true,
      reason: 'Existing tests were modified, which violates the preserveExistingTests policy.',
      status: 'EXISTING_TEST_MODIFIED'
    };
  }

  if (confidence === 'low' || confidence === 'medium') {
    return {
      stop: true,
      reason: `Critic confidence is ${confidence}. Stop and request human review.`,
      status: 'NEEDS_HUMAN_REVIEW'
    };
  }

  if (verdict === 'UNKNOWN') {
    return {
      stop: true,
      reason: 'Critic verdict is UNKNOWN. Stop and request human review.',
      status: 'NEEDS_HUMAN_REVIEW'
    };
  }

  const signature = getFailureSignature(failureLog);
  if (state.seenFailures.has(signature)) {
    return {
      stop: true,
      reason: 'The same verification failure repeated twice. Stopping loop.',
      status: 'RETRY_LIMIT_REACHED'
    };
  }



  if (state.attempt >= state.maxRetries) {
    return {
      stop: true,
      reason: `Maximum retry limit (${state.maxRetries}) reached.`,
      status: 'RETRY_LIMIT_REACHED'
    };
  }

  return { stop: false };
}

export function recordRetryAttempt(
  state: RetryState,
  failureLog: string,
  verdict: string
): void {
  state.attempt++;
  const signature = getFailureSignature(failureLog);
  state.seenFailures.add(signature);
  state.lastVerdict = verdict;
}
