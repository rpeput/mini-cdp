import type { AiAction } from '../types/cdp.ts';

/** model: a valid model answer was used. unavailable: no answer, local rules ran. invalid: an answer failed our checks, local rules ran. */
export type AiOutcome = 'model' | 'unavailable' | 'invalid';

export interface AiCallRecord {
  id: string;
  action: AiAction;
  at: string;
  latencyMs: number;
  outcome: AiOutcome;
  model?: string;
  inputTokens: number;
  outputTokens: number;
  /** True when the provider sent no usage numbers and the counts are a size-based estimate. */
  estimated: boolean;
}

export interface AiPrices {
  /** Price in your currency per 1M input tokens; null when not entered. */
  input: number | null;
  output: number | null;
}

export interface AiActionSummary {
  action: AiAction;
  calls: number;
  model: number;
  unavailable: number;
  invalid: number;
  /** Share of calls that ended on the local rules, 0..1. */
  fallbackRate: number;
  p50: number | null;
  p95: number | null;
  inputTokens: number;
  outputTokens: number;
  /** null until both prices are known. */
  cost: number | null;
}

const STORAGE_KEY = 'gather-ai-calls';
const MAX_RECORDS = 200;

let calls: readonly AiCallRecord[] = load();
const listeners = new Set<() => void>();
let counter = 0;

function load(): AiCallRecord[] {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '[]') as unknown;
    return Array.isArray(saved) ? (saved as AiCallRecord[]).filter((item) => item && typeof item.id === 'string').slice(-MAX_RECORDS) : [];
  } catch {
    return [];
  }
}

function commit(next: readonly AiCallRecord[]): void {
  calls = next.slice(-MAX_RECORDS);
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(calls));
  } catch {
    // Metrics stay in memory when storage is unavailable.
  }
  listeners.forEach((listener) => listener());
}

export function recordAiCall(record: Omit<AiCallRecord, 'id' | 'at'>): string {
  counter += 1;
  const id = `ai_${Date.now()}_${counter}`;
  commit([...calls, { ...record, id, at: new Date().toISOString() }]);
  return id;
}

/** A model answer that failed validation counts as a fallback, not as a model success. */
export function markAiInvalid(id: string): void {
  commit(calls.map((item) => (item.id === id ? { ...item, outcome: 'invalid' as const } : item)));
}

export function getAiCalls(): readonly AiCallRecord[] {
  return calls;
}

export function subscribeAiCalls(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function clearAiCalls(): void {
  commit([]);
}

export function percentile(values: readonly number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

/** (input × input price + output × output price) ÷ 1,000,000, counting every call that reached the provider. */
export function costOf(inputTokens: number, outputTokens: number, prices: AiPrices): number | null {
  if (prices.input === null || prices.output === null) return null;
  return (inputTokens * prices.input + outputTokens * prices.output) / 1_000_000;
}

export function summarizeAiCalls(records: readonly AiCallRecord[], prices: AiPrices): AiActionSummary[] {
  const actions = [...new Set(records.map((record) => record.action))];
  return actions.map((action) => {
    const own = records.filter((record) => record.action === action);
    const count = (outcome: AiOutcome) => own.filter((record) => record.outcome === outcome).length;
    const inputTokens = own.reduce((sum, record) => sum + record.inputTokens, 0);
    const outputTokens = own.reduce((sum, record) => sum + record.outputTokens, 0);
    return {
      action,
      calls: own.length,
      model: count('model'),
      unavailable: count('unavailable'),
      invalid: count('invalid'),
      fallbackRate: (count('unavailable') + count('invalid')) / own.length,
      p50: percentile(own.map((record) => record.latencyMs), 50),
      p95: percentile(own.map((record) => record.latencyMs), 95),
      inputTokens,
      outputTokens,
      cost: costOf(inputTokens, outputTokens, prices),
    };
  });
}

/** Rough size-based estimate for providers that return no usage: about 3 characters per token for Thai. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3);
}
