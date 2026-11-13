import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_PAGE_SIZE, PAGE_SIZES, type SortDirection } from '../utils/tableQuery.ts';

export interface TableState {
  query: string;
  filters: Record<string, string>;
  sortKey: string;
  direction: SortDirection;
  pageSize: number;
  page: number;
}

interface TableConfig {
  /** Session-storage key, one per table. */
  storageKey: string;
  filters: Record<string, string>;
  sortKey: string;
  direction: SortDirection;
  /** Sort keys the table understands; anything else in storage is ignored. */
  sortKeys: readonly string[];
}

function initialState(config: TableConfig): TableState {
  return {
    query: '',
    filters: { ...config.filters },
    sortKey: config.sortKey,
    direction: config.direction,
    pageSize: DEFAULT_PAGE_SIZE,
    page: 1,
  };
}

function load(config: TableConfig): TableState {
  const base = initialState(config);
  try {
    const saved = JSON.parse(sessionStorage.getItem(config.storageKey) ?? 'null') as Partial<TableState> | null;
    if (!saved || typeof saved !== 'object') return base;
    const filters = { ...base.filters };
    for (const name of Object.keys(filters)) {
      const value = saved.filters?.[name];
      if (typeof value === 'string') filters[name] = value;
    }
    return {
      query: typeof saved.query === 'string' ? saved.query.slice(0, 120) : '',
      filters,
      sortKey: config.sortKeys.includes(saved.sortKey ?? '') ? (saved.sortKey as string) : base.sortKey,
      direction: saved.direction === 'asc' || saved.direction === 'desc' ? saved.direction : base.direction,
      pageSize: (PAGE_SIZES as readonly number[]).includes(saved.pageSize ?? 0) ? (saved.pageSize as number) : base.pageSize,
      page: Number.isInteger(saved.page) && (saved.page as number) > 0 ? (saved.page as number) : 1,
    };
  } catch {
    return base;
  }
}

/**
 * Search, filter, sort and page state for one list. Changing anything except the page returns to
 * page 1, and the state survives a reload of the tab through session storage.
 */
export function useTableState(config: TableConfig) {
  const [state, setState] = useState(() => load(config));

  useEffect(() => {
    try {
      sessionStorage.setItem(config.storageKey, JSON.stringify(state));
    } catch {
      // The list still works without storage.
    }
  }, [config.storageKey, state]);

  const setQuery = useCallback((query: string) => setState((s) => ({ ...s, query, page: 1 })), []);
  const setFilter = useCallback(
    (name: string, value: string) => setState((s) => ({ ...s, filters: { ...s.filters, [name]: value }, page: 1 })),
    [],
  );
  const setSortKey = useCallback((sortKey: string) => setState((s) => ({ ...s, sortKey, page: 1 })), []);
  const setDirection = useCallback((direction: SortDirection) => setState((s) => ({ ...s, direction, page: 1 })), []);
  /** Column-header behaviour: a new column sorts ascending, the same column flips. */
  const toggleSort = useCallback(
    (key: string, firstDirection: SortDirection = 'asc') =>
      setState((s) => ({
        ...s,
        sortKey: key,
        direction: s.sortKey === key ? (s.direction === 'asc' ? 'desc' : 'asc') : firstDirection,
        page: 1,
      })),
    [],
  );
  const setPageSize = useCallback((pageSize: number) => setState((s) => ({ ...s, pageSize, page: 1 })), []);
  const setPage = useCallback((page: number) => setState((s) => ({ ...s, page })), []);
  const clearFilters = useCallback(
    () => setState((s) => ({ ...s, query: '', filters: { ...config.filters }, page: 1 })),
    [config.filters],
  );

  const hasActiveFilters =
    state.query.trim() !== '' || Object.entries(config.filters).some(([name, value]) => state.filters[name] !== value);

  return { state, hasActiveFilters, setQuery, setFilter, setSortKey, setDirection, toggleSort, setPageSize, setPage, clearFilters };
}
