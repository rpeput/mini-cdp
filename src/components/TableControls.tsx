import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search, X } from 'lucide-react';
import { Fragment, useId } from 'react';
import { PAGE_SIZES, pageCountFor, pageWindow, type SortDirection } from '../utils/tableQuery.ts';

export interface SortOption {
  key: string;
  label: string;
  /** Wording for each direction, for example ก → ฮ / ฮ → ก. */
  asc: string;
  desc: string;
}

interface SearchBoxProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}

export function SearchBox({ label, placeholder, value, onChange }: SearchBoxProps) {
  return (
    <label className="search-field">
      <Search size={17} aria-hidden="true" />
      <span className="sr-only">{label}</span>
      <input type="search" value={value} maxLength={120} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

interface SortControlProps {
  options: readonly SortOption[];
  sortKey: string;
  direction: SortDirection;
  onSortKeyChange: (key: string) => void;
  onDirectionChange: (direction: SortDirection) => void;
}

export function SortControl({ options, sortKey, direction, onSortKeyChange, onDirectionChange }: SortControlProps) {
  const current = options.find((option) => option.key === sortKey) ?? options[0];
  const wording = direction === 'asc' ? current.asc : current.desc;
  return (
    <div className="sort-control">
      <label>
        <span className="sr-only">เรียงตาม</span>
        <select value={current.key} onChange={(event) => onSortKeyChange(event.target.value)}>
          {options.map((option) => <option key={option.key} value={option.key}>เรียงตาม: {option.label}</option>)}
        </select>
      </label>
      <button type="button" className="button button-light sort-direction" aria-label={`ทิศทางการเรียง ${wording} กดเพื่อสลับ`}
        onClick={() => onDirectionChange(direction === 'asc' ? 'desc' : 'asc')}>
        {direction === 'asc' ? <ArrowUp size={16} aria-hidden="true" /> : <ArrowDown size={16} aria-hidden="true" />}
        <span>{wording}</span>
      </button>
    </div>
  );
}

interface SortHeaderProps {
  columnKey: string;
  sortKey: string;
  direction: SortDirection;
  onSort: (key: string) => void;
  children: string;
}

/** A column header that sorts the table; the sorted column announces its direction. */
export function SortHeader({ columnKey, sortKey, direction, onSort, children }: SortHeaderProps) {
  const active = sortKey === columnKey;
  return (
    <th scope="col" aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="sort-header" onClick={() => onSort(columnKey)}>
        {children}
        {active ? (direction === 'asc' ? <ArrowUp size={14} aria-hidden="true" /> : <ArrowDown size={14} aria-hidden="true" />) : <ArrowUpDown size={14} aria-hidden="true" className="sort-idle" />}
      </button>
    </th>
  );
}

interface ClearFiltersProps {
  onClear: () => void;
}

export function ClearFiltersButton({ onClear }: ClearFiltersProps) {
  return <button type="button" className="text-button" onClick={onClear}><X size={15} aria-hidden="true" /> ล้างตัวกรอง</button>;
}

interface PaginationProps {
  total: number;
  page: number;
  pageSize: number;
  from: number;
  to: number;
  /** Names the list for assistive technology, for example “ข้อมูลต้นทาง”. */
  label: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export function TablePagination({ total, page, pageSize, from, to, label, onPageChange, onPageSizeChange }: PaginationProps) {
  const sizeId = useId();
  const pageCount = pageCountFor(total, pageSize);
  if (total === 0) return null;
  return (
    <nav className="pagination" aria-label={`แบ่งหน้า${label}`}>
      <p className="pagination-range">แสดง {from}–{to} จาก {total} รายการ</p>
      <div className="pagination-size">
        <label htmlFor={sizeId}>แสดงต่อหน้า</label>
        <select id={sizeId} value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))}>
          {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
        </select>
      </div>
      <div className="pagination-pages">
        <button type="button" className="button button-light page-button" aria-label="หน้าแรก" disabled={page <= 1} onClick={() => onPageChange(1)}><ChevronsLeft size={17} aria-hidden="true" /></button>
        <button type="button" className="button button-light page-button" aria-label="หน้าก่อนหน้า" disabled={page <= 1} onClick={() => onPageChange(page - 1)}><ChevronLeft size={17} aria-hidden="true" /></button>
        <span className="page-compact">หน้า {page} จาก {pageCount}</span>
        <ol className="page-numbers">
          {pageWindow(page, pageCount).map((value, index) => value === null
            ? <li key={`gap-${index}`} aria-hidden="true" className="page-gap">…</li>
            : <li key={value}><button type="button" className="button button-light page-button" aria-label={`หน้า ${value}`} aria-current={value === page ? 'page' : undefined} onClick={() => onPageChange(value)}>{value}</button></li>)}
        </ol>
        <button type="button" className="button button-light page-button" aria-label="หน้าถัดไป" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}><ChevronRight size={17} aria-hidden="true" /></button>
        <button type="button" className="button button-light page-button" aria-label="หน้าสุดท้าย" disabled={page >= pageCount} onClick={() => onPageChange(pageCount)}><ChevronsRight size={17} aria-hidden="true" /></button>
      </div>
    </nav>
  );
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Wraps the searched terms in <mark> so a match is visible in long text. */
export function Highlight({ text, query }: { text: string; query: string }) {
  const terms = query.trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return <>{text}</>;
  const pattern = new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'giu');
  return (
    <>
      {text.split(pattern).map((part, index) => (index % 2 === 1 ? <mark key={index}>{part}</mark> : <Fragment key={index}>{part}</Fragment>))}
    </>
  );
}
