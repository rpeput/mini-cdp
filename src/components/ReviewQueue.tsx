import { AlertTriangle, Check, CheckCheck, ClipboardCheck, Loader2, Search, Undo2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { useTableState } from '../hooks/useTableState.ts';
import type { DataSourceType, UnifiedProfile } from '../types/cdp.ts';
import { SOURCE_META } from '../utils/cdpHelpers.ts';
import { CONFIDENCE_BANDS, listReviewRows, queryReviewRows, REVIEW_SORT_KEYS, type ReviewQuery, type ReviewSnapshot, type ReviewTarget } from '../utils/reviewQueue.ts';
import { paginate } from '../utils/tableQuery.ts';
import { CATEGORY_LABEL_TH } from '../utils/overview.ts';
import { ClearFiltersButton, Highlight, SearchBox, type SortOption, SortControl, TablePagination } from './TableControls.tsx';

export interface ReviewNotice {
  decision: 'verified' | 'rejected';
  snapshot: ReviewSnapshot[];
}

interface ReviewQueueProps {
  profiles: UnifiedProfile[];
  confidenceThreshold: number;
  manuallyApprovedIds: ReadonlySet<string>;
  busy: boolean;
  /** True while the friends' messages are being read into profiles. */
  loading: boolean;
  /** Set when a decision could not be applied. */
  error: string | null;
  notice: ReviewNotice | null;
  onDecide: (targets: ReviewTarget[], decision: 'verified' | 'rejected') => void;
  onUndo: () => void;
  onClearNotice: () => void;
  onInspectProfile: (id: string) => void;
}

const sortOptions: readonly SortOption[] = [
  { key: 'confidence', label: 'ความมั่นใจ', asc: 'ต่ำ → สูง', desc: 'สูง → ต่ำ' },
  { key: 'friend', label: 'เพื่อน', asc: 'ก → ฮ', desc: 'ฮ → ก' },
  { key: 'interest', label: 'ความสนใจ', asc: 'ก → ฮ', desc: 'ฮ → ก' },
  { key: 'source', label: 'แหล่งข้อมูล', asc: 'A → Z', desc: 'Z → A' },
];
const reviewFilters = { friend: 'all', source: 'all', band: 'all' };
const sourceIds = Object.keys(SOURCE_META) as DataSourceType[];

export function ReviewQueue({ profiles, confidenceThreshold, manuallyApprovedIds, busy, loading, error, notice, onDecide, onUndo, onClearNotice, onInspectProfile }: ReviewQueueProps) {
  const table = useTableState({ storageKey: 'gather-table-review', filters: reviewFilters, sortKey: 'confidence', direction: 'asc', sortKeys: REVIEW_SORT_KEYS });
  const { state } = table;
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const all = useMemo(() => listReviewRows(profiles, confidenceThreshold, manuallyApprovedIds), [profiles, confidenceThreshold, manuallyApprovedIds]);
  const matched = queryReviewRows(all, {
    query: state.query,
    friend: state.filters.friend,
    source: state.filters.source as ReviewQuery['source'],
    band: state.filters.band as ReviewQuery['band'],
    sortKey: state.sortKey,
    direction: state.direction,
  });
  const view = paginate(matched, state.page, state.pageSize);
  const friends = useMemo(() => [...new Map(all.map((row) => [row.profile.id, row.profile.nickname])).entries()], [all]);
  const chosen = all.filter((row) => selected.has(row.key));
  const pageKeys = view.rows.map((row) => row.key);
  const pageAllChosen = pageKeys.length > 0 && pageKeys.every((key) => selected.has(key));
  const disabled = busy || loading;

  function decide(rows: typeof all, decision: 'verified' | 'rejected') {
    if (disabled || !rows.length) return;
    onDecide(rows.map((row) => ({ profileId: row.profile.id, attributeId: row.attribute.id })), decision);
    setSelected((current) => {
      const next = new Set(current);
      rows.forEach((row) => next.delete(row.key));
      return next;
    });
  }

  function toggle(key: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function togglePage() {
    setSelected((current) => {
      const next = new Set(current);
      pageKeys.forEach((key) => (pageAllChosen ? next.delete(key) : next.add(key)));
      return next;
    });
  }

  const verb = notice?.decision === 'verified' ? 'ยืนยัน' : 'ปฏิเสธ';

  return (
    <section id="review-queue" className="surface review-queue" aria-labelledby="review-title" tabIndex={-1}>
      <div className="table-toolbar">
        <div>
          <h2 id="review-title"><ClipboardCheck size={18} aria-hidden="true" /> ตรวจความสนใจ</h2>
          <p aria-live="polite">
            {loading ? 'กำลังรวมข้อมูล รอสักครู่…' : all.length ? `รอตรวจ ${all.length} รายการ · ระบบมั่นใจต่ำกว่า ${confidenceThreshold}% เรียงจากมั่นใจน้อยสุดก่อน` : 'ไม่มีรายการรอตรวจ'}
          </p>
        </div>
        <span className="chip chip-neutral">ข้อมูลสมมติ</span>
      </div>

      <div className="review-status" role="status" aria-live="polite">
        {notice && (
          <div className="notice review-notice">
            <Check size={19} aria-hidden="true" />
            <p><strong>{verb}แล้ว {notice.snapshot.length} รายการ</strong> ข้อมูลยังอยู่ในโปรไฟล์ เปลี่ยนใจได้</p>
            <button type="button" className="button button-light" onClick={onUndo} disabled={busy}><Undo2 size={16} aria-hidden="true" /> เลิกทำ</button>
            <button type="button" className="text-button" onClick={onClearNotice}><X size={15} aria-hidden="true" /> ปิด</button>
          </div>
        )}
      </div>

      {error && (
        <div className="notice review-error" role="alert">
          <AlertTriangle size={19} aria-hidden="true" />
          <p><strong>ทำรายการไม่สำเร็จ</strong> {error}</p>
          <button type="button" className="button button-light" onClick={() => { setSelected(new Set()); onClearNotice(); }}>โหลดคิวใหม่</button>
        </div>
      )}

      {loading ? (
        <div className="empty" role="status"><Loader2 className="spin" aria-hidden="true" /><h3>กำลังรวมข้อมูล</h3><p>ระบบกำลังอ่านข้อความเข้าโปรไฟล์ รายการรอตรวจจะแสดงหลังเสร็จ</p></div>
      ) : all.length === 0 ? (
        <div className="empty"><CheckCheck aria-hidden="true" /><h3>ไม่มีอะไรรอตรวจ</h3><p>ความสนใจทั้งหมดผ่านเกณฑ์หรือถูกตัดสินแล้ว ลองปรับ “ความมั่นใจขั้นต่ำ” ด้านล่างถ้าอยากตรวจเพิ่ม</p></div>
      ) : (
        <>
          <div className="list-controls">
            <SearchBox label="ค้นหารายการรอตรวจ" placeholder="ชื่อเพื่อน ความสนใจ หรือข้อความ…" value={state.query} onChange={table.setQuery} />
            <label><span className="sr-only">กรองตามเพื่อน</span><select value={state.filters.friend} onChange={(event) => table.setFilter('friend', event.target.value)}>
              <option value="all">เพื่อนทุกคน</option>
              {friends.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select></label>
            <label><span className="sr-only">กรองตามแหล่งข้อมูล</span><select value={state.filters.source} onChange={(event) => table.setFilter('source', event.target.value)}>
              <option value="all">ทุกแหล่งข้อมูล</option>
              {sourceIds.map((id) => <option key={id} value={id}>{SOURCE_META[id].label}</option>)}
            </select></label>
            <label><span className="sr-only">กรองตามความมั่นใจ</span><select value={state.filters.band} onChange={(event) => table.setFilter('band', event.target.value)}>
              <option value="all">ความมั่นใจทุกช่วง</option>
              {Object.entries(CONFIDENCE_BANDS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select></label>
            <SortControl options={sortOptions} sortKey={state.sortKey} direction={state.direction} onSortKeyChange={table.setSortKey} onDirectionChange={table.setDirection} />
            {table.hasActiveFilters && <ClearFiltersButton onClear={table.clearFilters} />}
          </div>

          <div className="review-bulk">
            <label className="review-check">
              <input type="checkbox" checked={pageAllChosen} disabled={!pageKeys.length || disabled} onChange={togglePage} />
              <span>เลือกทั้งหน้านี้</span>
            </label>
            <span className="review-count" aria-live="polite">เลือกไว้ {chosen.length} รายการ</span>
            <button type="button" className="button button-primary" disabled={!chosen.length || disabled} onClick={() => decide(chosen, 'verified')}><Check size={17} aria-hidden="true" /> ยืนยันที่เลือก</button>
            <button type="button" className="button button-light" disabled={!chosen.length || disabled} onClick={() => decide(chosen, 'rejected')}><X size={17} aria-hidden="true" /> ปฏิเสธที่เลือก</button>
          </div>

          {view.rows.length ? (
            <ul className="review-list" aria-label="รายการความสนใจรอตรวจ">
              <AnimatePresence initial={false}>
                {view.rows.map((row) => (
                  <motion.li key={row.key} exit={{ opacity: 0, x: 28, pointerEvents: 'none' }} transition={{ duration: 0.2, ease: 'easeOut' }}>
                    <label className="review-check review-pick">
                      <input type="checkbox" checked={selected.has(row.key)} disabled={disabled} onChange={() => toggle(row.key)} />
                      <span className="sr-only">เลือก {row.profile.nickname} ความสนใจ {row.attribute.value}</span>
                    </label>
                    <div className="review-body">
                      <div className="review-head">
                        <strong><Highlight text={row.profile.nickname} query={state.query} /></strong>
                        <span className="chip">{CATEGORY_LABEL_TH[row.attribute.category]}: <Highlight text={row.attribute.value} query={state.query} /></span>
                        <span className="chip chip-waiting">มั่นใจ {row.attribute.confidence}%</span>
                        <span className="chip chip-neutral" data-source={row.attribute.source} lang="en">{SOURCE_META[row.attribute.source].shortLabel}</span>
                      </div>
                      <blockquote><Highlight text={row.attribute.evidenceQuote} query={state.query} /></blockquote>
                      <button type="button" className="text-button" onClick={() => onInspectProfile(row.profile.id)}>ดูโปรไฟล์ {row.profile.nickname}</button>
                    </div>
                    <div className="review-actions">
                      <button type="button" className="button button-primary" disabled={disabled} aria-label={`ยืนยัน ${row.profile.nickname} สนใจ ${row.attribute.value}`} onClick={() => decide([row], 'verified')}><Check size={17} aria-hidden="true" /> ยืนยัน</button>
                      <button type="button" className="button button-light" disabled={disabled} aria-label={`ปฏิเสธ ${row.profile.nickname} สนใจ ${row.attribute.value}`} onClick={() => decide([row], 'rejected')}><X size={17} aria-hidden="true" /> ปฏิเสธ</button>
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          ) : (
            <div className="empty"><Search aria-hidden="true" /><h3>ไม่พบรายการที่ตรงกับตัวกรอง</h3><p>ลองเปลี่ยนคำค้นหาหรือล้างตัวกรอง</p>
              <button type="button" className="button button-light" onClick={table.clearFilters}>ล้างตัวกรอง</button></div>
          )}
          <TablePagination total={view.total} page={view.page} pageSize={view.pageSize} from={view.from} to={view.to} label="รายการรอตรวจ"
            onPageChange={table.setPage} onPageSizeChange={table.setPageSize} />
        </>
      )}
    </section>
  );
}
