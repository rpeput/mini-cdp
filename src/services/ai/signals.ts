import { EXTRACTION_RULES, extractRuleSignals } from '../aiEngine.ts';
import { callAi } from '../aiClient.ts';
import { isObject, isString, isVerbatim } from './guards.ts';

export type Polarity = 'likes' | 'dislikes';

export interface SignalReading {
  /** An id from the extraction taxonomy. */
  id: string;
  polarity: Polarity;
  evidenceQuote: string;
  reason: string;
}

export interface SignalResult {
  signals: SignalReading[];
  source: 'model' | 'rules';
}

/** The closed list of interests the extractor may use, taken from the rule set. */
export const SIGNAL_TAXONOMY = EXTRACTION_RULES.map((rule) => ({ id: rule.idSuffix, label: rule.value, category: rule.category }));
const TAXONOMY_IDS = new Set(SIGNAL_TAXONOMY.map((item) => item.id));

/** Keyword baseline: everything it finds is a "like", because it cannot read negation or tense. */
export function readSignalsWithRules(text: string): SignalReading[] {
  return extractRuleSignals(text).map((signal) => ({ id: signal.ruleId, polarity: 'likes', evidenceQuote: signal.evidenceQuote, reason: 'พบคำที่ตรงกับกฎ' }));
}

export function parseSignalReading(raw: unknown, text: string): SignalReading[] | null {
  if (!isObject(raw) || !Array.isArray(raw.interests)) return null;
  const readings: SignalReading[] = [];
  const seen = new Set<string>();
  for (const item of raw.interests) {
    if (!isObject(item) || !isString(item.id) || !TAXONOMY_IDS.has(item.id)) return null;
    if (item.polarity !== 'likes' && item.polarity !== 'dislikes') return null;
    if (!isString(item.evidenceQuote)) return null;
    // An interest whose quote is not in the message is an invention, so the whole answer is refused.
    if (!isVerbatim(item.evidenceQuote, text)) return null;
    const key = `${item.id}:${item.polarity}`;
    if (seen.has(key)) continue;
    seen.add(key);
    readings.push({ id: item.id, polarity: item.polarity, evidenceQuote: item.evidenceQuote.trim(), reason: isString(item.reason) ? item.reason.slice(0, 160) : '' });
  }
  return readings;
}

export async function readSignals(text: string): Promise<SignalResult> {
  const result = await callAi('extract_signal', { text, taxonomy: SIGNAL_TAXONOMY.map(({ id, label }) => ({ id, label })) }, (raw) => parseSignalReading(raw, text));
  return result.data ? { signals: result.data, source: 'model' } : { signals: readSignalsWithRules(text), source: 'rules' };
}
