export const PAGE_SIZES = [10, 20, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 20;

export type SortDirection = 'asc' | 'desc';
export type SortValue = string | number | null;

export interface PageResult<T> {
  rows: T[];
  total: number;
  /** 1-based, always within 1..pageCount. */
  page: number;
  pageCount: number;
  pageSize: number;
  /** 1-based range of the rows shown, both 0 when the list is empty. */
  from: number;
  to: number;
}

const collator = new Intl.Collator('th', { numeric: true, sensitivity: 'base' });

export function normalizeText(value: string): string {
  return value.normalize('NFC').toLocaleLowerCase('th').trim();
}

/** Every whitespace-separated term of the query must appear in at least one of the fields. */
export function matchesSearch(fields: readonly string[], query: string): boolean {
  const terms = normalizeText(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const haystacks = fields.map(normalizeText);
  return terms.every((term) => haystacks.some((field) => field.includes(term)));
}

/**
 * Stable sort by one key. Thai text uses Thai collation and numbers compare numerically.
 * Rows with no value (null) always go last, whichever direction is chosen.
 */
export function sortItems<T>(
  items: readonly T[],
  getKey: (item: T) => SortValue,
  direction: SortDirection,
  tieBreak?: (a: T, b: T) => number,
): T[] {
  const sign = direction === 'asc' ? 1 : -1;
  return items
    .map((item, index) => ({ item, index, key: getKey(item) }))
    .sort((a, b) => {
      if (a.key === null || b.key === null) {
        if (a.key === b.key) return a.index - b.index;
        return a.key === null ? 1 : -1;
      }
      const result =
        typeof a.key === 'number' && typeof b.key === 'number'
          ? a.key - b.key
          : collator.compare(String(a.key), String(b.key));
      if (result !== 0) return result * sign;
      return (tieBreak ? tieBreak(a.item, b.item) : 0) || a.index - b.index;
    })
    .map(({ item }) => item);
}

export function pageCountFor(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/** Slices one page. An out-of-range page (for example after filtering) is clamped, not emptied. */
export function paginate<T>(items: readonly T[], page: number, pageSize: number): PageResult<T> {
  const total = items.length;
  const pageCount = pageCountFor(total, pageSize);
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pageCount);
  const start = (current - 1) * pageSize;
  const rows = items.slice(start, start + pageSize);
  return {
    rows,
    total,
    page: current,
    pageCount,
    pageSize,
    from: rows.length ? start + 1 : 0,
    to: start + rows.length,
  };
}

/** Page numbers to show as buttons, with null marking a gap: 1 … 4 5 6 … 12. */
export function pageWindow(page: number, pageCount: number): Array<number | null> {
  const wanted = new Set([1, pageCount, page - 1, page, page + 1]);
  const pages = [...wanted].filter((value) => value >= 1 && value <= pageCount).sort((a, b) => a - b);
  const result: Array<number | null> = [];
  pages.forEach((value, index) => {
    if (index > 0) {
      const gap = value - pages[index - 1];
      if (gap === 2) result.push(value - 1);
      else if (gap > 2) result.push(null);
    }
    result.push(value);
  });
  return result;
}
