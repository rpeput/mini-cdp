import { ArrowRight, Database, FileText, MessageSquare, Plus, ScanLine, Search, Share2, Sparkles } from 'lucide-react';
import { motion, useInView, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import type { DataSourceType, RawSourceRecord, UnifiedProfile, UnlinkedRecord } from '../types/cdp.ts';
import { IdentityInbox } from './IdentityInbox.tsx';
import { ReviewQueue, type ReviewNotice } from './ReviewQueue.tsx';
import type { ReviewTarget } from '../utils/reviewQueue.ts';
import { useTableState } from '../hooks/useTableState.ts';
import { formatDateShort, SOURCE_META } from '../utils/cdpHelpers.ts';
import { querySources, SOURCE_SORT_KEYS, type SourceQuery, type SourceRow as SourceRowData } from '../utils/listViews.ts';
import { staggerDelay, type StitchFx } from '../utils/motionSequence.ts';
import { paginate } from '../utils/tableQuery.ts';
import { AnimatedNumber } from './MotionBits.tsx';
import { ClearFiltersButton, Highlight, SearchBox, type SortOption, SortControl, TablePagination } from './TableControls.tsx';

interface CollectUnifyTabProps {
  profiles: UnifiedProfile[];
  records: RawSourceRecord[];
  busy: boolean;
  isStitching: boolean;
  /** What the last run changed; null when there is nothing to show. */
  stitchFx: StitchFx | null;
  confidenceThreshold: number;
  onThresholdChange: (threshold: number) => void;
  onRunStitching: () => void;
  onAddSignal: (id: string, source: DataSourceType, text: string) => void;
  onInspectProfile: (id: string) => void;
  onGoToCampaign: () => void;
  inbox: UnlinkedRecord[];
  onLoadSampleInbox: () => void;
  onConfirmLink: (recordId: string, profileId: string) => void;
  onDismissInbox: (recordId: string) => void;
  manuallyApprovedIds: ReadonlySet<string>;
  reviewNotice: ReviewNotice | null;
  reviewError: string | null;
  onReviewDecide: (targets: ReviewTarget[], decision: 'verified' | 'rejected') => void;
  onReviewUndo: () => void;
  onReviewClear: () => void;
}

const sortOptions: readonly SortOption[] = [
  { key: 'time', label: 'เวลา', asc: 'เก่า → ใหม่', desc: 'ใหม่ → เก่า' },
  { key: 'friend', label: 'เพื่อน', asc: 'ก → ฮ', desc: 'ฮ → ก' },
  { key: 'source', label: 'แหล่งข้อมูล', asc: 'A → Z', desc: 'Z → A' },
  { key: 'status', label: 'สถานะ', asc: 'รอก่อน', desc: 'เสร็จก่อน' },
];
const recordFilters = { source: 'all', status: 'all' };
const statusLabels = { pending: 'รอประมวลผล', processed: 'ประมวลผลแล้ว' };

const ROW_STEP_MS = 70;

/** A row nobody is looking at still ends up in its final state after this long. */
const OFFSCREEN_FALLBACK_MS = 3500;

/**
 * True once `delayMs` has passed since the run `token` began *and the row is on screen*; true at once when there
 * is no run to play. It is derived from the token, so the render in which a run starts already shows "waiting"
 * (no flash of the final state), and a row below the fold flips when it is scrolled to instead of animating unseen.
 */
function useRunDelay(token: number | null, delayMs: number | null, visible: boolean): boolean {
  const [doneToken, setDoneToken] = useState<number | null>(null);
  useEffect(() => {
    if (token === null || delayMs === null || !visible) return;
    const id = window.setTimeout(() => setDoneToken(token), delayMs);
    return () => window.clearTimeout(id);
  }, [token, delayMs, visible]);
  useEffect(() => {
    if (token === null) return;
    const id = window.setTimeout(() => setDoneToken(token), OFFSCREEN_FALLBACK_MS);
    return () => window.clearTimeout(id);
  }, [token]);
  return token === null || delayMs === null || doneToken === token;
}

interface SourceRowProps {
  row: SourceRowData;
  query: string;
  /** When set, the row shows "waiting" until this many ms have passed, then turns to "processed". */
  delayMs: number | null;
  /** The run being played; changes with every run. */
  runId: number | null;
  /** Interests this message is the evidence for, from the last run. */
  evidence: string[] | undefined;
  onInspectProfile: (id: string) => void;
}

function SourceRow({ row: { record, profile, status }, query, delayMs, runId, evidence, onInspectProfile }: SourceRowProps) {
  const ref = useRef<HTMLLIElement>(null);
  const done = useRunDelay(runId, delayMs, useInView(ref, { amount: 0.5 }));
  const shown = status === 'processed' && !done ? 'pending' : status;
  const playing = delayMs !== null;
  return (
    <li ref={ref}>
      <div className="source-row-top">
        <span className="chip-list"><span className="chip" lang="en">{SOURCE_META[record.source].shortLabel}</span>
          <motion.span key={shown} className={`chip ${shown === 'pending' ? 'chip-waiting' : 'chip-positive'}`}
            initial={playing && shown === 'processed' ? { opacity: 0, scale: 0.9 } : false} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.2, ease: 'easeOut' }}>{statusLabels[shown]}</motion.span></span>
        {profile && <button className="text-button" onClick={() => onInspectProfile(profile.id)}>ดูโปรไฟล์ {profile.nickname} <ArrowRight size={14} aria-hidden="true" /></button>}
      </div>
      <p><Highlight text={record.rawText} query={query} /></p>
      <small className="muted">{record.handle} · {formatDateShort(record.timestamp)}</small>
      {evidence && (
        // The slot is part of the row from the start, so the chip appearing later does not move anything below it.
        <div className="evidence-slot">
          {done && (
            <>
              <motion.span className="evidence-bar" aria-hidden="true" style={{ originY: 0 }} initial={playing ? { scaleY: 0 } : false} animate={{ scaleY: 1 }} transition={{ duration: 0.25, ease: 'easeOut' }} />
              <motion.span className="chip chip-fresh" initial={playing ? { opacity: 0, y: 4 } : false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: playing ? 0.08 : 0, ease: 'easeOut' }}>
                <Sparkles size={12} aria-hidden="true" /> เป็นหลักฐานของ: {evidence.join(', ')}
              </motion.span>
            </>
          )}
        </div>
      )}
    </li>
  );
}

const sources = [
  { id: 'LINE_CHAT', icon: MessageSquare },
  { id: 'FACEBOOK_POST', icon: Share2 },
  { id: 'DEPT_ROSTER', icon: FileText },
] as const;

export function CollectUnifyTab({ profiles, records, busy, isStitching, stitchFx, confidenceThreshold, onThresholdChange, onRunStitching, onAddSignal, onInspectProfile, onGoToCampaign, inbox, onLoadSampleInbox, onConfirmLink, onDismissInbox, manuallyApprovedIds, reviewNotice, reviewError, onReviewDecide, onReviewUndo, onReviewClear }: CollectUnifyTabProps) {
  const table = useTableState({ storageKey: 'gather-table-sources', filters: recordFilters, sortKey: 'time', direction: 'desc', sortKeys: SOURCE_SORT_KEYS });
  const { state } = table;
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? '');
  const [source, setSource] = useState<DataSourceType>('LINE_CHAT');
  const [text, setText] = useState('');
  const pending = profiles.filter((profile) => !profile.isStitched);
  const matched = querySources(records, profiles, {
    query: state.query,
    source: state.filters.source as SourceQuery['source'],
    status: state.filters.status as SourceQuery['status'],
    sortKey: state.sortKey,
    direction: state.direction,
  });
  const view = paginate(matched, state.page, state.pageSize);
  const reduced = useReducedMotion();
  // A run is played only if it finished while this page was open; coming back to the page shows the result as it is.
  const [mountedFxId] = useState(stitchFx?.id);
  const playFx = stitchFx !== null && stitchFx.id !== mountedFxId && !reduced ? stitchFx : null;
  const processedNow = new Set(playFx?.recordIds);
  const rankByRecord = new Map(view.rows.filter(({ record }) => processedNow.has(record.id)).map(({ record }, rank) => [record.id, rank]));

  return (
    <section aria-labelledby="sources-title">
      <header className="page-heading">
        <div><h1 id="sources-title">แหล่งข้อมูล</h1><p>ดูว่าระบบจับคู่ข้อมูลกับใคร และสกัดความสนใจจากข้อความไหน</p></div>
        <button className="button button-primary" disabled={!pending.length || busy} onClick={onRunStitching}>
          <ScanLine size={18} aria-hidden="true" /> {isStitching ? 'กำลังรวมข้อมูล…' : 'รวมและสกัดข้อมูล'}
        </button>
      </header>
      <dl className="metric-grid">
        {sources.map(({ id, icon: Icon }) => (
          <div className="metric" key={id}><dt><Icon size={18} aria-hidden="true" /> <span lang="en">{SOURCE_META[id].label}</span></dt><dd>{records.filter((record) => record.source === id).length}</dd></div>
        ))}
      </dl>
      <div className="notice notice-pipeline">
        <ScanLine size={20} aria-hidden="true" />
        <p role="status">{isStitching ? 'กำลังจับคู่ข้อมูลและอ่านข้อความต้นทาง…' : pending.length ? <><strong>{pending.length} โปรไฟล์รอประมวลผล</strong> ระบบจะจับคู่ด้วยรหัสโปรไฟล์ในชุดตัวอย่าง แล้วบันทึกความสนใจพร้อมข้อความอ้างอิง</> : <><strong>รวมข้อมูลครบแล้ว</strong> เปิดโปรไฟล์เพื่อตรวจหลักฐาน หรือนำข้อมูลไปสร้างแคมเปญ</>}</p>
        <dl className="pipeline-counts" aria-label="สถานะการประมวลผล">
          <div><dt>รอประมวลผล</dt><dd><AnimatedNumber className="count-num" value={pending.length} /> <span>โปรไฟล์</span></dd></div>
          <div><dt>รวมข้อมูลแล้ว</dt><dd><AnimatedNumber className="count-num" value={profiles.length - pending.length} /> <span>โปรไฟล์</span></dd></div>
        </dl>
        {stitchFx && stitchFx.recordIds.length > 0 && (
          <button className="button button-light" onClick={() => {
            const target = document.getElementById('source-records');
            target?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
            target?.focus({ preventScroll: true });
          }}>ดูข้อความที่ประมวลผล</button>
        )}
        {!pending.length && <button className="button button-light" onClick={onGoToCampaign}>สร้างแคมเปญ <ArrowRight size={16} aria-hidden="true" /></button>}
      </div>
      <IdentityInbox inbox={inbox} profiles={profiles} records={records} busy={busy} onLoadSamples={onLoadSampleInbox} onConfirm={onConfirmLink} onDismiss={onDismissInbox} />
      <ReviewQueue profiles={profiles} confidenceThreshold={confidenceThreshold} manuallyApprovedIds={manuallyApprovedIds} busy={busy} loading={isStitching}
        error={reviewError} notice={reviewNotice} onDecide={onReviewDecide} onUndo={onReviewUndo} onClearNotice={onReviewClear} onInspectProfile={onInspectProfile} />
      <div className="source-layout">
        <div className="source-tools">
          <form className="surface panel" onSubmit={(event) => {
            event.preventDefault();
            if (!text.trim() || busy) return;
            onAddSignal(profileId, source, text.trim());
            table.clearFilters();
            table.setSortKey('time');
            table.setDirection('desc');
            setText('');
          }}>
            <h2>เพิ่มข้อความทดลอง</h2>
            <p>ใช้ข้อความสมมติ แล้วเลือกเพื่อนที่ข้อความนี้กล่าวถึง</p>
            <label className="field">เพื่อน<select value={profileId} onChange={(event) => setProfileId(event.target.value)}>
              {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.nickname} · {profile.fullName}</option>)}
            </select></label>
            <label className="field">แหล่งข้อมูล<select value={source} onChange={(event) => setSource(event.target.value as DataSourceType)}>
              {sources.map(({ id }) => <option key={id} value={id}>{SOURCE_META[id].label}</option>)}
            </select></label>
            <label className="field">ข้อความ<textarea rows={3} value={text} maxLength={800} onChange={(event) => setText(event.target.value)} placeholder="เช่น ศุกร์นี้อยากกินหมูกระทะหลังมอ" /></label>
            <button className="button button-light" disabled={!text.trim() || busy} type="submit"><Plus size={18} aria-hidden="true" /> เพิ่มเข้าคิว</button>
          </form>
          <div className="surface panel">
            <h2><Database size={17} aria-hidden="true" /> เกณฑ์ตรวจสอบ</h2>
            <p>ความสนใจที่ต่ำกว่าเกณฑ์จะรอให้คุณยืนยันก่อนใช้แนะนำผู้รับ</p>
            <label className="field">ความมั่นใจขั้นต่ำ {confidenceThreshold}%<input type="range" min={50} max={95} step={5} value={confidenceThreshold} disabled={busy} onChange={(event) => onThresholdChange(Number(event.target.value))} /></label>
          </div>
        </div>
        <div className="surface">
          <div className="table-toolbar">
            <div><h2 id="source-records" tabIndex={-1}>ข้อมูลต้นทาง</h2><p aria-live="polite">{matched.length === records.length ? `${records.length} รายการ` : `พบ ${matched.length} จาก ${records.length} รายการ`}</p></div>
          </div>
          <div className="list-controls">
            <SearchBox label="ค้นหาข้อมูลต้นทาง" placeholder="ข้อความ ชื่อ หรือรหัสนักศึกษา…" value={state.query} onChange={table.setQuery} />
            <label><span className="sr-only">กรองแหล่งข้อมูล</span><select value={state.filters.source} onChange={(event) => table.setFilter('source', event.target.value)}>
              <option value="all">ทุกแหล่งข้อมูล</option>
              {sources.map(({ id }) => <option key={id} value={id}>{SOURCE_META[id].label}</option>)}
            </select></label>
            <label><span className="sr-only">กรองตามสถานะประมวลผล</span><select value={state.filters.status} onChange={(event) => table.setFilter('status', event.target.value)}>
              <option value="all">ทุกสถานะ</option>
              <option value="pending">{statusLabels.pending}</option>
              <option value="processed">{statusLabels.processed}</option>
            </select></label>
            <SortControl options={sortOptions} sortKey={state.sortKey} direction={state.direction} onSortKeyChange={table.setSortKey} onDirectionChange={table.setDirection} />
            {table.hasActiveFilters && <ClearFiltersButton onClear={table.clearFilters} />}
          </div>
          {view.rows.length ? (
            <ul className="source-list" aria-label="รายการข้อมูลต้นทาง">
              {view.rows.map((row) => {
                const rank = rankByRecord.get(row.record.id);
                return <SourceRow key={row.record.id} row={row} query={state.query} onInspectProfile={onInspectProfile}
                  delayMs={rank === undefined ? null : staggerDelay(rank, ROW_STEP_MS, 10) + 120} runId={playFx?.id ?? null} evidence={stitchFx?.evidenceByRecord[row.record.id]} />;
              })}
            </ul>
          ) : (
            <div className="empty"><Search aria-hidden="true" /><h3>ไม่พบข้อมูลที่ตรงกับตัวกรอง</h3><p>ลองเปลี่ยนคำค้นหาหรือล้างตัวกรอง</p><button className="button button-light" onClick={table.clearFilters}>ล้างตัวกรอง</button></div>
          )}
          <TablePagination total={view.total} page={view.page} pageSize={view.pageSize} from={view.from} to={view.to} label="ข้อมูลต้นทาง"
            onPageChange={table.setPage} onPageSizeChange={table.setPageSize} />
        </div>
      </div>
    </section>
  );
}
