export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function asInt(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/** A quote counts as grounded only when it is copied exactly from one of the given texts. */
export function isVerbatim(quote: string, ...texts: readonly string[]): boolean {
  const needle = quote.trim();
  return needle.length > 0 && texts.some((text) => text.includes(needle));
}

export function stripEmoji(text: string): string {
  return text.replace(/\p{Extended_Pictographic}/gu, '').replace(/\s{2,}/g, ' ').trim();
}
