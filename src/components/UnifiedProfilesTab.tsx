import { ArrowRight, ArrowUpRight, Database, Search, ShieldCheck, Users } from 'lucide-react';
import { useState } from 'react';
import type { UnifiedProfile } from '../types/cdp.ts';
import { getEffectiveAttributeStatus } from '../utils/cdpHelpers.ts';

interface UnifiedProfilesTabProps {
  profiles: UnifiedProfile[];
  confidenceThreshold: number;
  manuallyApprovedIds: Set<string>;
  onSelectProfile: (id: string) => void;
  onGoToSources: () => void;
  onGoToCampaign: () => void;
}

export function UnifiedProfilesTab({ profiles, confidenceThreshold, manuallyApprovedIds, onSelectProfile, onGoToSources, onGoToCampaign }: UnifiedProfilesTabProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const unified = profiles.filter((profile) => profile.isStitched);
  const canInvite = unified.filter((profile) => profile.consentPdpa);
  const needle = query.trim().toLocaleLowerCase('th');
  const filtered = profiles.filter((profile) => {
    const searchable = [profile.nickname, profile.fullName, profile.studentId];
    if (!searchable.some((value) => value.toLocaleLowerCase('th').includes(needle))) return false;
    if (filter === 'ready') return profile.isStitched && profile.consentPdpa;
    if (filter === 'pending') return !profile.isStitched;
    if (filter === 'no-consent') return !profile.consentPdpa;
    return true;
  });

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
          <div><h2>เพื่อนในภาควิชา</h2><p aria-live="polite">แสดง {filtered.length} จาก {profiles.length} คน</p></div>
          <div className="table-filters">
            <label className="search-field"><Search size={17} aria-hidden="true" /><span className="sr-only">ค้นหาเพื่อน</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ชื่อหรือรหัสนักศึกษา…" /></label>
            <label><span className="sr-only">กรองตามสถานะ</span><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">ทุกสถานะ</option><option value="ready">พร้อมรับคำเชิญ</option><option value="pending">รอรวมข้อมูล</option><option value="no-consent">ยังไม่ยินยอม</option></select></label>
          </div>
        </div>
        {filtered.length ? (
          <table className="profile-table">
            <thead><tr><th scope="col">ชื่อเพื่อน</th><th scope="col">ความสนใจ</th><th scope="col">สถานะ</th></tr></thead>
            <tbody>{filtered.map((profile) => {
              const traits = profile.attributes.filter((attribute) => getEffectiveAttributeStatus(attribute, confidenceThreshold, manuallyApprovedIds) === 'verified').slice(0, 2);
              const status = !profile.consentPdpa ? 'ยังไม่ยินยอม' : profile.isStitched ? 'พร้อมรับคำเชิญ' : 'รอรวมข้อมูล';
              return (
                <tr key={profile.id}>
                  <td>
                    <button className="profile-link" onClick={() => onSelectProfile(profile.id)}>
                      <span className="person-avatar" aria-hidden="true">{profile.avatarInitials}</span>
                      <span><strong>{profile.nickname}</strong><small>{profile.fullName}</small></span>
                      <ArrowUpRight size={16} aria-hidden="true" />
                    </button>
                  </td>
                  <td>{traits.length ? <div className="chip-list">{traits.map((trait) => <span key={trait.id} className="chip">{trait.value}</span>)}</div> : <span className="muted">—</span>}</td>
                  <td><span className={`chip ${!profile.consentPdpa ? 'chip-neutral' : profile.isStitched ? 'chip-positive' : 'chip-waiting'}`}>{status}</span></td>
                </tr>
              );
            })}</tbody>
          </table>
        ) : <div className="empty"><Search aria-hidden="true" /><h3>ไม่พบเพื่อนที่ตรงกับการค้นหา</h3><button className="button button-light" onClick={() => { setQuery(''); setFilter('all'); }}>ล้างการค้นหา</button></div>}
      </div>
    </section>
  );
}
