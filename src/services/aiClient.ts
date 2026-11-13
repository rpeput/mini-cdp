import type { AiAction, AiProxyResponse } from '../types/cdp.ts';
import { estimateTokens, markAiInvalid, type AiOutcome, recordAiCall } from './aiMetrics.ts';

export const AI_PROXY_TIMEOUT_MS = 18_000;
let sessionId: string | undefined;

export interface AiRawResult {
  data: unknown;
  model?: string;
  metricId: string;
}

export interface AiCallResult<T> {
  /** The validated model answer, or null when the caller must use its local rules. */
  data: T | null;
  outcome: AiOutcome;
  model?: string;
  latencyMs: number;
}

/**
 * Calls the AI proxy once and records the call. Returns null when the proxy is unreachable, answers
 * with an error, or tells us to fall back. The call is recorded as a model success until the caller
 * reports that the answer failed validation with `markAiInvalid(result.metricId)`.
 */
export async function callAiRaw(action: AiAction, payload: unknown, timeoutMs = AI_PROXY_TIMEOUT_MS): Promise<AiRawResult | null> {
  const startedAt = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const body = JSON.stringify({ action, payload });
  try {
    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-gather-ai-session': sessionId ??= crypto.randomUUID(),
      },
      body,
      signal: controller.signal,
    });
    const parsed = response.ok ? ((await response.json()) as AiProxyResponse) : null;
    const latencyMs = Math.round(performance.now() - startedAt);
    if (!parsed || parsed.fallback || !parsed.data) {
      recordAiCall({ action, latencyMs, outcome: 'unavailable', inputTokens: 0, outputTokens: 0, estimated: false });
      return null;
    }
    const usage = parsed.usage;
    const metricId = recordAiCall({
      action,
      latencyMs,
      outcome: 'model',
      model: parsed.model,
      inputTokens: usage?.inputTokens ?? estimateTokens(body),
      outputTokens: usage?.outputTokens ?? estimateTokens(JSON.stringify(parsed.data)),
      estimated: !usage,
    });
    return { data: parsed.data, model: parsed.model, metricId };
  } catch {
    recordAiCall({ action, latencyMs: Math.round(performance.now() - startedAt), outcome: 'unavailable', inputTokens: 0, outputTokens: 0, estimated: false });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Calls the proxy and validates the answer; `data` is null whenever the local rules must take over. */
export async function callAi<T>(action: AiAction, payload: unknown, validate: (raw: unknown) => T | null, timeoutMs?: number): Promise<AiCallResult<T>> {
  const startedAt = performance.now();
  const raw = await callAiRaw(action, payload, timeoutMs);
  if (!raw) {
    return { data: null, outcome: 'unavailable', latencyMs: Math.round(performance.now() - startedAt) };
  }
  let valid: T | null = null;
  try {
    valid = validate(raw.data);
  } catch {
    valid = null;
  }
  if (valid === null) {
    markAiInvalid(raw.metricId);
    return { data: null, outcome: 'invalid', model: raw.model, latencyMs: Math.round(performance.now() - startedAt) };
  }
  return { data: valid, outcome: 'model', model: raw.model, latencyMs: Math.round(performance.now() - startedAt) };
}
