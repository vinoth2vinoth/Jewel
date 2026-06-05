export class JewelError extends Error {
  constructor(
    public readonly status: string,
    message: string,
    public readonly nextAction: string,
    public readonly debugDetails?: any
  ) {
    super(message);
    this.name = 'JewelError';
    Object.setPrototypeOf(this, JewelError.prototype);
  }
}

export function isJewelError(error: any): error is JewelError {
  return error instanceof JewelError || (error && error.name === 'JewelError' && typeof error.status === 'string');
}

export function toJewelError(err: any): JewelError {
  if (err instanceof JewelError || (err && err.name === 'JewelError')) {
    return err;
  }

  const msg = err?.message || String(err);

  // 1. Missing API key
  if (
    msg.includes('API_KEY is not set') || 
    msg.includes('key is missing') || 
    msg.includes('missing API key') || 
    msg.includes('ApiKey')
  ) {
    return new JewelError(
      'MISSING_API_KEY',
      msg,
      'Set the appropriate API key environment variable (e.g. export OPENAI_API_KEY="your-key" or set it in .env) and run the command again.',
      err
    );
  }

  // 2. Unsupported structured output model
  if (msg.includes('does not support structured output') || msg.includes('FAIL: Model')) {
    return new JewelError(
      'UNSUPPORTED_STRUCTURED_OUTPUT_MODEL',
      msg,
      'Choose a model that supports structured outputs (e.g., gpt-4o-mini), or set allowUnstructuredProviderFallback: true in jewel.config.json.',
      err
    );
  }

  // 3. Invalid JSON from provider
  if (msg.includes('Invalid JSON in LLM response') || msg.includes('BLOCKED: Invalid JSON')) {
    return new JewelError(
      'INVALID_JSON_FROM_PROVIDER',
      msg,
      'Retry the command. If this happens consistently, check if the model configuration supports JSON mode or structured outputs.',
      err
    );
  }

  // 4. Schema validation failure
  if (msg.includes('validation failed') || msg.includes('validation error') || msg.includes('schema violation') || msg.includes('Task contract validation failed') || msg.includes('Patch proposal validation failed')) {
    return new JewelError(
      'SCHEMA_VALIDATION_FAILURE',
      msg,
      'The LLM provider response did not match the expected schema. Retry the task or check model temperature/prompt settings.',
      err
    );
  }

  // 5. Unsafe path from provider
  if (msg.includes('unsafe path') || msg.includes('outside the allowed scope') || msg.includes('PATCH BLOCKED BY SAFE PATCH WRITER')) {
    return new JewelError(
      'UNSAFE_PATH_FROM_PROVIDER',
      msg,
      'The proposed patch attempted to modify files outside the allowed scope. Adjust the files list in your command (-f/--files) or verify that the model is scoped correctly.',
      err
    );
  }

  // 6. Verification command failed due to coverage threshold
  if (msg.includes('Coverage threshold violation') || msg.includes('coverage check failed') || msg.includes('COVERAGE_THRESHOLD_VIOLATION') || msg.includes('code coverage fell below')) {
    return new JewelError(
      'COVERAGE_THRESHOLD_VIOLATION',
      msg,
      'Increase test coverage for your modifications or adjust minCoverage requirements in jewel.config.json.',
      err
    );
  }

  // 6. Verification command failed
  if (msg.includes('Verification failed') || msg.includes('verification command failed') || msg.includes('Safety or verification check failed')) {
    return new JewelError(
      'VERIFICATION_COMMAND_FAILED',
      msg,
      'Fix the failing tests in your code, or run the verification command manually to diagnose. You can bypass rollback using --keep-failed.',
      err
    );
  }

  // 7. Human review rejected
  if (msg.includes('rejected by human reviewer') || msg.includes('Human review rejected')) {
    return new JewelError(
      'HUMAN_REVIEW_REJECTED',
      msg,
      'Refine your task description or modify the source code to guide the LLM to the desired state.',
      err
    );
  }

  // 8. Rollback completed
  if (msg.includes('Rollback completed') || msg.includes('rolled back successfully')) {
    return new JewelError(
      'ROLLBACK_COMPLETED',
      msg,
      'The workspace was restored to the pre-run checkpoint. Review your changes or task instructions, adjust settings, and try again.',
      err
    );
  }

  // 9. Rollback refused due to new commits
  if (msg.includes('New commits were detected since the Jewel checkpoint') || msg.includes('refused to prevent deleting your work') || msg.includes('Rollback refused')) {
    return new JewelError(
      'ROLLBACK_REFUSED_DUE_TO_NEW_COMMITS',
      msg,
      'Run \'jewel rollback [session-id] --force\' to force the rollback and discard new commits, or resolve the differences manually.',
      err
    );
  }

  // Generic fallback
  return new JewelError(
    'UNKNOWN_FAILURE',
    msg,
    'Review the logs or report files, resolve any configuration errors, and retry.',
    err
  );
}
