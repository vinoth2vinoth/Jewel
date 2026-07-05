export interface RunTaskOptions {
  /** Parent session when continuing from prior run */
  parentSessionId?: string;
  /** User follow-up feedback appended to planning context */
  continuationFeedback?: string;
  /** Stop after plan is generated (no checkpoint/patch) */
  planOnly?: boolean;
  /** Skip interactive plan approval gate */
  approvePlan?: boolean;
  /**
   * Return/throw instead of process.exit so callers (e.g. the build
   * orchestrator) can run multiple tasks in one process.
   */
  returnOutcome?: boolean;
}

export interface ContinuationContext {
  parentSessionId: string;
  originalTask: string;
  priorStatus?: string;
  priorFindings: string[];
  feedback: string;
}
