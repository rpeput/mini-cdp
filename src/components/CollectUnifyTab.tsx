import { ArrowRight, Database, FileText, MessageSquare, Plus, ScanLine, Search, Share2 } from 'lucide-react';
import { useState } from 'react';
import type { DataSourceType, RawSourceRecord, UnifiedProfile } from '../types/cdp.ts';
import { useTableState } from '../hooks/useTableState.ts';
import { formatDateShort, SOURCE_META } from '../utils/cdpHelpers.ts';
import { querySources, SOURCE_SORT_KEYS, type SourceQuery } from '../utils/listViews.ts';
import { paginate } from '../utils/tableQuery.ts';
import { ClearFiltersButton, Highlight, SearchBox, type SortOption, SortControl, TablePagination } from './TableControls.tsx';

interface CollectUnifyTabProps {
  profiles: UnifiedProfile[];
  records: RawSourceRecord[];
  busy: boolean;
  isStitching: boolean;
  confidenceThreshold: number;
  onThresholdChange: (threshold: number) => void;
  onRunStitching: () => void;
  onAddSignal: (id: string, source: DataSourceType, text: string) => void;
  onInspectProfile: (id: string) => void;
  onGoToCampaign: () => void;
}

const sortOptions: readonly SortOption[] = [
  { key: 'time', label: 'เวลา', asc: 'เก่า → ใหม่', desc: 'ใหม่ → เก่า' },
  { key: 'friend', label: 'เพื่อน', asc: 'ก → ฮ', desc: 'ฮ → ก' },
  { key: 'source', label: 'แหล่งข้อมูล', asc: 'A → Z', desc: 'Z → A' },
  { key: 'status', label: 'สถานะ', asc: 'รอก่อน', desc: 'เสร็จก่อน' },
];
const recordFilters = { source: 'all', status: 'all' };
const statusLabels = { pending: 'รอประมวลผล', processed: 'ประมวลผลแล้ว' };

const sources = [
  { id: 'LINE_CHAT', icon: MessageSquare },
  { id: 'FACEBOOK_POST', icon: Share2 },
  { id: 'DEPT_ROSTER', icon: FileText },
] as const;

export function CollectUnifyTab({ profiles, records, busy, isStitching, confidenceThreshold, onThresholdChange, onRunStitching, onAddSignal, onInspectProfile, onGoToCampaign }: CollectUnifyTabProps) {
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
      <div className="notice">
        <ScanLine size={20} aria-hidden="true" />
        <p role="status">{isStitching ? 'กำลังจับคู่ข้อมูลและอ่านข้อความต้นทาง…' : pending.length ? <><strong>{pending.length} โปรไฟล์รอประมวลผล</strong> ระบบจะจับคู่ด้วยรหัสโปรไฟล์ในชุดตัวอย่าง แล้วบันทึกความสนใจพร้อมข้อความอ้างอิง</> : <><strong>รวมข้อมูลครบแล้ว</strong> เปิดโปรไฟล์เพื่อตรวจหลักฐาน หรือนำข้อมูลไปสร้างแคมเปญ</>}</p>
        {!pending.length && <button className="button button-light" onClick={onGoToCampaign}>สร้างแคมเปญ <ArrowRight size={16} aria-hidden="true" /></button>}
      </div>
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
            <div><h2>ข้อมูลต้นทาง</h2><p aria-live="polite">{matched.length === records.length ? `${records.length} รายการ` : `พบ ${matched.length} จาก ${records.length} รายการ`}</p></div>
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
              {view.rows.map(({ record, profile, status }) => (
                <li key={record.id}>
                  <div className="source-row-top">
                    <span className="chip-list"><span className="chip" lang="en">{SOURCE_META[record.source].shortLabel}</span><span className={`chip ${status === 'pending' ? 'chip-waiting' : 'chip-positive'}`}>{statusLabels[status]}</span></span>
                    {profile && <button className="text-button" onClick={() => onInspectProfile(profile.id)}>ดูโปรไฟล์ {profile.nickname} <ArrowRight size={14} aria-hidden="true" /></button>}
                  </div>
                  <p><Highlight text={record.rawText} query={state.query} /></p>
                  <small className="muted">{record.handle} · {formatDateShort(record.timestamp)}</small>
                </li>
              ))}
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
