import { ArrowRight, ArrowUpRight, Database, Search, ShieldCheck, Users } from 'lucide-react';
import { useTableState } from '../hooks/useTableState.ts';
import type { UnifiedProfile } from '../types/cdp.ts';
import { type ProfileQuery, type ProfileRow, PROFILE_SORT_KEYS, queryProfiles } from '../utils/listViews.ts';
import { paginate } from '../utils/tableQuery.ts';
import { ClearFiltersButton, Highlight, SearchBox, type SortOption, SortControl, SortHeader, TablePagination } from './TableControls.tsx';

interface UnifiedProfilesTabProps {
  profiles: UnifiedProfile[];
  confidenceThreshold: number;
  manuallyApprovedIds: Set<string>;
  onSelectProfile: (id: string) => void;
  onGoToSources: () => void;
  onGoToCampaign: () => void;
}

const sortOptions: readonly SortOption[] = [
  { key: 'name', label: 'ชื่อเล่น', asc: 'ก → ฮ', desc: 'ฮ → ก' },
  { key: 'fullName', label: 'ชื่อจริง', asc: 'ก → ฮ', desc: 'ฮ → ก' },
  { key: 'studentId', label: 'รหัสนักศึกษา', asc: 'น้อย → มาก', desc: 'มาก → น้อย' },
  { key: 'interests', label: 'จำนวนความสนใจ', asc: 'น้อย → มาก', desc: 'มาก → น้อย' },
  { key: 'status', label: 'สถานะ', asc: 'พร้อมก่อน', desc: 'ยังไม่ยินยอมก่อน' },
  { key: 'acceptance', label: 'อัตราตอบรับ', asc: 'น้อย → มาก', desc: 'มาก → น้อย' },
];
const profileFilters = { status: 'all', interest: 'all', reply: 'all' };
const statusText = { 'no-consent': 'ยังไม่ยินยอม', ready: 'พร้อมรับคำเชิญ', pending: 'รอรวมข้อมูล' };

function inviteSummary({ accepted, declined, pending }: ProfileRow): string {
  const parts = [accepted && `ตอบรับ ${accepted}`, declined && `ปฏิเสธ ${declined}`, pending && `ยังไม่ตอบ ${pending}`].filter(Boolean);
  return parts.join(' · ');
}

export function UnifiedProfilesTab({ profiles, confidenceThreshold, manuallyApprovedIds, onSelectProfile, onGoToSources, onGoToCampaign }: UnifiedProfilesTabProps) {
  const table = useTableState({ storageKey: 'gather-table-profiles', filters: profileFilters, sortKey: 'name', direction: 'asc', sortKeys: PROFILE_SORT_KEYS });
  const { state } = table;
  const unified = profiles.filter((profile) => profile.isStitched);
  const canInvite = unified.filter((profile) => profile.consentPdpa);
  const matched = queryProfiles(profiles, confidenceThreshold, manuallyApprovedIds, {
    query: state.query,
    status: state.filters.status as ProfileQuery['status'],
    interest: state.filters.interest as ProfileQuery['interest'],
    reply: state.filters.reply as ProfileQuery['reply'],
    sortKey: state.sortKey,
    direction: state.direction,
  });
  const view = paginate(matched, state.page, state.pageSize);

  return (
    <section aria-labelledby="profiles-title">
      <header className="page-heading">
        <div><h1 id="profiles-title">รายชื่อเพื่อน</h1><p>ดูว่าเพื่อนแต่ละคนสนใจอะไร และใครพร้อมรับคำเชิญ</p></div>
        <button className="button button-primary" onClick={onGoToCampaign}>สร้างแคมเปญ <ArrowRight size={17} aria-hidden="true" /></button>
      </header>
      <dl className="metric-grid">
        <div className="metric"><dt><Users size={17} aria-hidden="true" /> เพื่อนทั้งหมด</dt><dd>{profiles.length}</dd></div>
        <div className="metric"><dt><Database size={17} aria-hidden="true" /> รวมข้อมูลแล้ว</dt><dd>{unified.length}</dd></div>
        <div className="metric"><dt><ShieldCheck size={17} aria-hidden="true" /> พร้อมรับคำเชิญ</dt><dd>{canInvite.length}</dd></div>
      </dl>
      {unified.length < profiles.length && (
        <div className="notice">
          <Database size={19} aria-hidden="true" />
          <p>มีเพื่อนอีก <strong>{profiles.length - unified.length} คน</strong> ที่รอรวมข้อมูลจากแชท โพสต์ และรายชื่อ</p>
          <button className="button button-light" onClick={onGoToSources}>ไปที่แหล่งข้อมูล <ArrowUpRight size={16} aria-hidden="true" /></button>
        </div>
      )}
      <div className="surface">
        <div className="table-toolbar">
          <div><h2>เพื่อนในภาควิชา</h2><p aria-live="polite">{matched.length === profiles.length ? `ทั้งหมด ${profiles.length} คน` : `พบ ${matched.length} จาก ${profiles.length} คน`}</p></div>
        </div>
        <div className="list-controls">
          <SearchBox label="ค้นหาเพื่อน" placeholder="ชื่อ รหัสนักศึกษา หรือความสนใจ…" value={state.query} onChange={table.setQuery} />
          <label><span className="sr-only">กรองตามสถานะ</span><select value={state.filters.status} onChange={(event) => table.setFilter('status', event.target.value)}>
            <option value="all">ทุกสถานะ</option><option value="ready">พร้อมรับคำเชิญ</option><option value="pending">รอรวมข้อมูล</option><option value="no-consent">ยังไม่ยินยอม</option>
          </select></label>
          <label><span className="sr-only">กรองตามหมวดความสนใจ</span><select value={state.filters.interest} onChange={(event) => table.setFilter('interest', event.target.value)}>
            <option value="all">ทุกความสนใจ</option><option value="food">อาหาร</option><option value="activity">กิจกรรม</option><option value="vibe">สไตล์</option><option value="budget">งบประมาณ</option>
          </select></label>
          <label><span className="sr-only">กรองตามคำตอบคำเชิญ</span><select value={state.filters.reply} onChange={(event) => table.setFilter('reply', event.target.value)}>
            <option value="all">ทุกคำตอบ</option><option value="accepted">เคยตอบรับ</option><option value="declined">เคยปฏิเสธ</option><option value="pending">มีคำเชิญที่ยังไม่ตอบ</option><option value="never">ยังไม่เคยได้รับคำเชิญ</option>
          </select></label>
          <SortControl options={sortOptions} sortKey={state.sortKey} direction={state.direction} onSortKeyChange={table.setSortKey} onDirectionChange={table.setDirection} />
          {table.hasActiveFilters && <ClearFiltersButton onClear={table.clearFilters} />}
        </div>
        {view.rows.length ? (
          <table className="profile-table">
            <thead><tr>
              <SortHeader columnKey="name" sortKey={state.sortKey} direction={state.direction} onSort={table.toggleSort}>ชื่อเพื่อน</SortHeader>
              <SortHeader columnKey="interests" sortKey={state.sortKey} direction={state.direction} onSort={(key) => table.toggleSort(key, 'desc')}>ความสนใจ</SortHeader>
              <SortHeader columnKey="acceptance" sortKey={state.sortKey} direction={state.direction} onSort={(key) => table.toggleSort(key, 'desc')}>คำเชิญ</SortHeader>
              <SortHeader columnKey="status" sortKey={state.sortKey} direction={state.direction} onSort={table.toggleSort}>สถานะ</SortHeader>
            </tr></thead>
            <tbody>{view.rows.map((row) => {
              const { profile, status, verifiedTraits } = row;
              const traits = verifiedTraits.slice(0, 2);
              return (
                <tr key={profile.id}>
                  <td>
                    <button className="profile-link" onClick={() => onSelectProfile(profile.id)}>
                      <span className="person-avatar" aria-hidden="true">{profile.avatarInitials}</span>
                      <span><strong><Highlight text={profile.nickname} query={state.query} /></strong><small><Highlight text={profile.fullName} query={state.query} /> · {profile.studentId}</small></span>
                      <ArrowUpRight size={16} aria-hidden="true" />
                    </button>
                  </td>
                  <td>{traits.length ? <div className="chip-list">{traits.map((trait) => <span key={trait.id} className="chip"><Highlight text={trait.value} query={state.query} /></span>)}{verifiedTraits.length > 2 && <span className="muted">+{verifiedTraits.length - 2}</span>}</div> : <span className="muted">—</span>}</td>
                  <td>{inviteSummary(row) || <span className="muted">—</span>}</td>
                  <td><span className={`chip ${status === 'no-consent' ? 'chip-neutral' : status === 'ready' ? 'chip-positive' : 'chip-waiting'}`}>{statusText[status]}</span></td>
                </tr>
              );
            })}</tbody>
          </table>
        ) : <div className="empty"><Search aria-hidden="true" /><h3>ไม่พบเพื่อนที่ตรงกับการค้นหา</h3><p>ลองเปลี่ยนคำค้นหาหรือล้างตัวกรอง</p><button className="button button-light" onClick={table.clearFilters}>ล้างตัวกรอง</button></div>}
        <TablePagination total={view.total} page={view.page} pageSize={view.pageSize} from={view.from} to={view.to} label="รายชื่อเพื่อน"
          onPageChange={table.setPage} onPageSizeChange={table.setPageSize} />
      </div>
    </section>
  );
}
