import { Quote, ShieldCheck, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { explainRecommendation } from '../services/recommendationEvidence.ts';
import type { CampaignMatch, RawSourceRecord, UnifiedProfile } from '../types/cdp.ts';
import { formatDateShort, SOURCE_META } from '../utils/cdpHelpers.ts';
import { DrawerShell } from './DrawerShell.tsx';

interface RecommendationEvidenceDrawerProps {
  profile: UnifiedProfile | null;
  match: CampaignMatch | null;
  campaignPrompt: string;
  records: readonly RawSourceRecord[];
  confidenceThreshold: number;
  manuallyApprovedIds: ReadonlySet<string>;
  onClose: () => void;
  onOpenProfile: (profileId: string) => void;
}

const statusLabels = { verified: 'ยืนยันแล้ว', needs_review: 'รอตรวจสอบ', rejected: 'ปฏิเสธแล้ว' };

function highlight(text: string, term: string): ReactNode {
  const index = text.toLowerCase().indexOf(term.toLowerCase());
  if (index < 0) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark>{text.slice(index, index + term.length)}</mark>
      {text.slice(index + term.length)}
    </>
  );
}

export function RecommendationEvidenceDrawer({ profile, match, campaignPrompt, records, confidenceThreshold, manuallyApprovedIds, onClose, onOpenProfile }: RecommendationEvidenceDrawerProps) {
  const open = profile !== null && match !== null;
  const explanation = profile && match
    ? explainRecommendation(profile, match, campaignPrompt, records, confidenceThreshold, manuallyApprovedIds)
    : null;
  const isDirect = match?.tier === 'direct';

  return (
    <DrawerShell open={open} onClose={onClose} title={profile ? `ทำไมแนะนำ${profile.nickname}` : 'ทำไมแนะนำคนนี้'}
      subtitle={match ? `${isDirect ? 'ตรงความสนใจ' : 'ความสนใจใกล้เคียง'} · ความเหมาะสม ${match.matchScore}%` : undefined}>
      {profile && match && explanation && (
        <div className="drawer-content">
          <div className="notice"><ShieldCheck size={19} aria-hidden="true" /><p><strong>{profile.consentPdpa ? 'ยินยอมรับคำเชิญ' : 'ยังไม่ยินยอมรับคำเชิญ'}</strong> · กิจกรรม “{campaignPrompt}”</p></div>
          <section aria-labelledby="why-reason">
            <h3 id="why-reason">เหตุผลที่ระบบให้</h3>
            <p>{match.aiReasoning}</p>
            <p className="muted">{isDirect
              ? 'ตรงความสนใจ หมายถึงมีข้อความของเพื่อนที่พูดถึงกิจกรรมนี้หรือสิ่งที่เกี่ยวข้องโดยตรง'
              : 'ความสนใจใกล้เคียง หมายถึงยังไม่มีข้อความที่พูดถึงกิจกรรมนี้ตรง ๆ แต่มีความสนใจที่ไปในทางเดียวกัน ควรอ่านหลักฐานก่อนเลือกส่ง'}</p>
          </section>
          <section aria-labelledby="why-evidence">
            <h3 id="why-evidence">หลักฐานในโปรไฟล์</h3>
            {explanation.evidence.length ? (
              <ul className="evidence-list">{explanation.evidence.map(({ attribute, record, relation, matchedTerm, status }) => (
                <li key={attribute.id}>
                  <div className="evidence-heading">
                    <strong>{attribute.value}</strong>
                    <span className={`chip ${relation === 'direct' ? 'chip-positive' : ''}`}>{relation === 'direct' ? 'ตรงความสนใจ' : 'ใกล้เคียง'}</span>
                  </div>
                  <blockquote><Quote size={15} aria-hidden="true" /> {highlight(attribute.evidenceQuote, matchedTerm)}</blockquote>
                  <small><span data-source={attribute.source} lang="en">{SOURCE_META[attribute.source].label}</span> · ความมั่นใจ {attribute.confidence}% · {statusLabels[status]} · คำที่ตรง “{matchedTerm}”</small>
                  {record ? (
                    <details className="source-message">
                      <summary>ดูข้อความต้นทางทั้งหมด</summary>
                      <p>{record.rawText}</p>
                      <small><span data-source={record.source} lang="en">{SOURCE_META[record.source].label}</span> · {formatDateShort(record.timestamp)}</small>
                    </details>
                  ) : (
                    <p className="muted">ไม่มีข้อความต้นทางที่ตรงกัน หลักฐานนี้อาจมาจากคำตอบกลับที่จำลองไว้ในโปรไฟล์</p>
                  )}
                </li>
              ))}</ul>
            ) : (
              <p className="muted" role="status">ไม่พบหลักฐานในโปรไฟล์ที่ตรงกับกิจกรรมนี้ ควรเปิดโปรไฟล์ตรวจเองก่อนเลือกส่งให้{profile.nickname}</p>
            )}
          </section>
          <button className="button button-light" onClick={() => onOpenProfile(profile.id)}><UserRound size={17} aria-hidden="true" /> เปิดโปรไฟล์ของ{profile.nickname}</button>
        </div>
      )}
    </DrawerShell>
  );
}
