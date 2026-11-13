import { Check, Quote, ShieldCheck, X } from 'lucide-react';
import type { RawSourceRecord, UnifiedProfile } from '../types/cdp.ts';
import { getEffectiveAttributeStatus, SOURCE_META } from '../utils/cdpHelpers.ts';
import { DrawerShell } from './DrawerShell.tsx';

interface ProfileInspectorDrawerProps {
  profile: UnifiedProfile | null;
  records: RawSourceRecord[];
  onClose: () => void;
  confidenceThreshold: number;
  manuallyApprovedIds: ReadonlySet<string>;
  onAttributeDecision: (profileId: string, attributeId: string, decision: 'verified' | 'rejected') => void;
  busy: boolean;
}

const statusLabels = { verified: 'ยืนยันแล้ว', needs_review: 'รอตรวจสอบ', rejected: 'ปฏิเสธแล้ว' };
const replyLabels = { accepted: 'ตอบรับ', declined: 'ปฏิเสธ', pending: 'ยังไม่ตอบ' };

export function ProfileInspectorDrawer({ profile, records, onClose, confidenceThreshold, manuallyApprovedIds, onAttributeDecision, busy }: ProfileInspectorDrawerProps) {
  return (
    <DrawerShell open={profile !== null} onClose={onClose} title={profile ? `โปรไฟล์ของ ${profile.nickname}` : 'โปรไฟล์เพื่อน'} subtitle={profile?.fullName}>
      {profile && (
        <div className="drawer-content">
          <div className="notice"><ShieldCheck size={19} aria-hidden="true" /><p><strong>{profile.consentPdpa ? 'ยินยอมรับคำเชิญ' : 'ยังไม่ยินยอมรับคำเชิญ'}</strong> · รหัสนักศึกษา {profile.studentId}</p></div>
          <section aria-labelledby="profile-interests">
            <h3 id="profile-interests">ความสนใจและหลักฐาน</h3>
            {profile.attributes.length ? (
              <ul className="evidence-list">{profile.attributes.map((attribute) => {
                const status = getEffectiveAttributeStatus(attribute, confidenceThreshold, manuallyApprovedIds);
                return (
                  <li key={attribute.id}>
                    <div className="evidence-heading"><strong>{attribute.value}</strong><span className={`chip ${status === 'verified' ? 'chip-positive' : status === 'rejected' ? 'chip-negative' : 'chip-waiting'}`}>{statusLabels[status]}</span></div>
                    <blockquote><Quote size={15} aria-hidden="true" /> {attribute.evidenceQuote}</blockquote>
                    <small><span data-source={attribute.source} lang="en">{SOURCE_META[attribute.source].label}</span> · ความมั่นใจ {attribute.confidence}%</small>
                    {status !== 'rejected' && <div className="evidence-actions">
                      {status === 'needs_review' && <button className="button button-light" disabled={busy} onClick={() => onAttributeDecision(profile.id, attribute.id, 'verified')}><Check size={16} aria-hidden="true" /> ยืนยัน <span className="sr-only">{attribute.value}</span></button>}
                      <button className="button button-light" disabled={busy} onClick={() => onAttributeDecision(profile.id, attribute.id, 'rejected')}><X size={16} aria-hidden="true" /> ปฏิเสธ <span className="sr-only">{attribute.value}</span></button>
                    </div>}
                  </li>
                );
              })}</ul>
            ) : <p className="muted">{profile.isStitched ? 'ยังไม่พบความสนใจจากข้อความที่มี' : 'รอรวมและสกัดข้อมูลจากข้อความต้นทาง'}</p>}
          </section>
          <section aria-labelledby="profile-sources">
            <h3 id="profile-sources">ข้อความต้นทาง</h3>
            <ul className="evidence-list">{records.filter((record) => record.linkedProfileId === profile.id).map((record) => (
              <li key={record.id}><span className="chip" data-source={record.source} lang="en">{SOURCE_META[record.source].label}</span><p>{record.rawText}</p></li>
            ))}</ul>
          </section>
          <section aria-labelledby="profile-campaigns">
            <h3 id="profile-campaigns">ประวัติคำเชิญ</h3>
            {profile.campaignHistory.length ? <ul className="evidence-list">{profile.campaignHistory.map((item) => (
              <li key={item.campaignId}><div className="evidence-heading"><strong>{item.campaignName}</strong><span className="chip">{replyLabels[item.status]}</span></div><p><small>ข้อความที่ส่ง</small> {item.sentMessage}</p>{item.replyText && <p><small>คำตอบที่บันทึกกลับ</small> {item.replyText}</p>}</li>
            ))}</ul> : <p className="muted">ยังไม่มีคำเชิญ</p>}
          </section>
        </div>
      )}
    </DrawerShell>
  );
}
