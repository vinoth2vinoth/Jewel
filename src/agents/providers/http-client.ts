import { redactSecrets } from '../../safety/secret-redactor';
import * as fs from 'fs';
import * as path from 'path';

export interface ProviderUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  estimatedCostUsd?: number;
  retryCount?: number;
}

export interface HttpClientResponse {
  content: string;
  usage?: ProviderUsage;
}

export class NonRetryableError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'NonRetryableError';
    this.status = status;
  }
}

export class RetryableError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'RetryableError';
    this.status = status;
  }
}

export function createAbortTimeout(timeoutMs: number): { controller: AbortController; timeoutId: NodeJS.Timeout } {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  return { controller, timeoutId };
}

export function redactProviderError(err: Error): Error {
  const redactedMessage = redactSecrets(err.message);
  const newErr = new Error(redactedMessage);
  newErr.name = err.name;
  newErr.stack = err.stack ? redactSecrets(err.stack) : undefined;
  return newErr;
}

export function parseProviderResponseText(responseBody: any, provider: string): HttpClientResponse {
  let content = '';
  let usage: ProviderUsage | undefined;

  const p = provider.toLowerCase();
  if (p === 'openai' || p === 'openrouter') {
    content = responseBody.choices?.[0]?.message?.content || '';
    if (responseBody.usage) {
      usage = {
        inputTokens: responseBody.usage.prompt_tokens,
        outputTokens: responseBody.usage.completion_tokens,
        totalTokens: responseBody.usage.total_tokens
      };
    }
  } else if (p === 'gemini') {
    content = responseBody.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (responseBody.usageMetadata) {
      usage = {
        inputTokens: responseBody.usageMetadata.promptTokenCount,
        outputTokens: responseBody.usageMetadata.candidatesTokenCount,
        totalTokens: responseBody.usageMetadata.totalTokenCount
      };
    }
  } else if (p === 'anthropic') {
    content = responseBody.content?.[0]?.text || '';
    if (responseBody.usage) {
      const input = responseBody.usage.input_tokens;
      const output = responseBody.usage.output_tokens;
      usage = {
        inputTokens: input,
        outputTokens: output,
        totalTokens: (input !== undefined && output !== undefined) ? (input + output) : undefined
      };
    }
  }

  return { content, usage };
}

export async function postJsonWithRetry(
  url: string,
  options: {
    headers: Record<string, string>;
    body: any;
    timeoutMs: number;
    maxRetries: number;
    sessionPath?: string;
    providerName: string;
    methodName: string;
    retryTracker?: { count: number };
  }
): Promise<any> {
  const { headers, body, timeoutMs, maxRetries, sessionPath, providerName, methodName, retryTracker } = options;

  let attempt = 0;
  let lastError: any = null;

  while (attempt <= maxRetries) {
    const { controller, timeoutId } = createAbortTimeout(timeoutMs);

    if (retryTracker) {
      retryTracker.count = attempt;
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const text = await res.text();
        const status = res.status;
        const isRetryable = status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
        const errMsg = `HTTP Error ${status}: ${text}`;

        if (!isRetryable) {
          throw new NonRetryableError(errMsg, status);
        } else {
          throw new RetryableError(errMsg, status);
        }
      }

      const data = await res.json() as any;

      // Save raw response debug log
      saveDebugLog(sessionPath, providerName, methodName, body, data);

      return data;
    } catch (err: any) {
      clearTimeout(timeoutId);

      let errorToReport = err;
      if (err.name === 'AbortError') {
        errorToReport = new RetryableError(`LLM request timed out after ${timeoutMs}ms.`);
      } else if (!(err instanceof NonRetryableError) && !(err instanceof RetryableError)) {
        // Network error, typically retryable
        errorToReport = new RetryableError(err.message || 'Network error');
      }

      lastError = redactProviderError(errorToReport);

      // Save debug log for error
      saveDebugLog(sessionPath, providerName, methodName, body, { error: lastError.message });

      if (err instanceof NonRetryableError) {
        throw new Error(`FAIL: LLM request failed. Non-retryable error: ${lastError.message}`);
      }

      if (attempt < maxRetries) {
        // Exponential backoff with jitter
        const delay = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 1000, 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      attempt++;
    }
  }

  throw new Error(`FAIL: LLM request failed after ${attempt} attempts. Last error: ${lastError.message}`);
}

function saveDebugLog(
  sessionPath: string | undefined,
  providerName: string,
  methodName: string,
  requestBody: any,
  responseBody: any
) {
  if (!sessionPath) return;
  try {
    const debugDir = path.join(sessionPath, 'debug');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }
    const logPath = path.join(debugDir, `${providerName}-${methodName}-${Date.now()}.json`);
    const payload = {
      timestamp: new Date().toISOString(),
      provider: providerName,
      method: methodName,
      request: requestBody,
      response: responseBody
    };
    const redactedPayload = redactSecrets(JSON.stringify(payload, null, 2));
    fs.writeFileSync(logPath, redactedPayload, 'utf8');
  } catch (err) {
    // Ignore logging errors to prevent breaking execution
  }
}
