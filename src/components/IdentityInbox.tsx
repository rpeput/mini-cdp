import { Download, Sparkles, UserCheck, X } from 'lucide-react';
import { useState } from 'react';
import { IDENTITY_CONFIDENCE_FLOOR, type IdentitySuggestion, resolveIdentities } from '../services/ai/identity.ts';
import type { RawSourceRecord, UnifiedProfile, UnlinkedRecord } from '../types/cdp.ts';
import { SOURCE_META } from '../utils/cdpHelpers.ts';

interface IdentityInboxProps {
  inbox: UnlinkedRecord[];
  profiles: UnifiedProfile[];
  records: RawSourceRecord[];
  busy: boolean;
  onLoadSamples: () => void;
  onConfirm: (recordId: string, profileId: string) => void;
  onDismiss: (recordId: string) => void;
}

export function IdentityInbox({ inbox, profiles, records, busy, onLoadSamples, onConfirm, onDismiss }: IdentityInboxProps) {
  const [suggestions, setSuggestions] = useState<Record<string, IdentitySuggestion>>({});
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [source, setSource] = useState<'model' | 'rules' | null>(null);
  const [loading, setLoading] = useState(false);
  const asked = inbox.some((record) => suggestions[record.id]);

  async function propose() {
    if (loading || !inbox.length) return;
    setLoading(true);
    try {
      const result = await resolveIdentities(inbox, profiles, records);
      setSuggestions((current) => ({ ...current, ...Object.fromEntries(result.suggestions.map((item) => [item.recordId, item])) }));
      setChoices((current) => ({
        ...current,
        ...Object.fromEntries(result.suggestions.filter((item) => item.profileId && item.confidence >= IDENTITY_CONFIDENCE_FLOOR).map((item) => [item.recordId, item.profileId as string])),
      }));
      setSource(result.source);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section id="identity-inbox" className="surface panel identity-inbox" aria-labelledby="inbox-title" tabIndex={-1}>
      <div className="table-toolbar inbox-toolbar">
        <div>
          <h2 id="inbox-title">ข้อความที่ยังไม่รู้เจ้าของ{inbox.length ? ` (${inbox.length})` : ''}</h2>
          <p>ชื่อบัญชีที่ไม่ตรงกับเพื่อนคนไหนเป๊ะ ๆ AI เสนอเจ้าของพร้อมหลักฐาน แล้วคุณเป็นคนยืนยัน</p>
        </div>
        <div className="inbox-actions">
          <button className="button button-light" disabled={busy} onClick={onLoadSamples}><Download size={16} aria-hidden="true" /> นำเข้าข้อความกำกวมตัวอย่าง</button>
          <button className="button button-primary" disabled={busy || loading || !inbox.length} onClick={propose}>
            <Sparkles size={16} aria-hidden="true" /> {loading ? 'กำลังอ่านชื่อและข้อความ…' : asked ? 'เสนอเจ้าของใหม่' : 'ให้ AI เสนอเจ้าของ'}
          </button>
        </div>
      </div>
      {source && <p className="muted inbox-source" role="status">{source === 'model' ? 'เสนอโดยโมเดล ตรวจแล้วว่าหลักฐานคัดลอกมาจากข้อความจริง' : 'เสนอโดยกฎในเครื่อง (โมเดลไม่พร้อมหรือคำตอบไม่ผ่านการตรวจ) กฎอ่านได้เฉพาะชื่อไทยและชื่อบัญชีที่เคยพบ'}</p>}
      {inbox.length ? (
        <ul className="inbox-list">
          {inbox.map((record) => {
            const suggestion = suggestions[record.id];
            const chosen = choices[record.id] ?? '';
            const named = suggestion?.profileId ? profiles.find((profile) => profile.id === suggestion.profileId) : undefined;
            const picked = profiles.find((profile) => profile.id === chosen);
            return (
              <li key={record.id}>
                <div className="source-row-top">
                  <span className="chip-list"><span className="chip" data-source={record.source} lang="en">{SOURCE_META[record.source].shortLabel}</span><strong lang="en">{record.handle}</strong></span>
                </div>
                <p>{record.rawText}</p>
                {suggestion && (
                  <div className={`suggestion ${suggestion.profileId && suggestion.confidence >= IDENTITY_CONFIDENCE_FLOOR ? '' : 'suggestion-unsure'}`}>
                    {named && suggestion.confidence >= IDENTITY_CONFIDENCE_FLOOR ? (
                      <p><strong>เสนอ: {named.nickname}</strong> · ความมั่นใจ {suggestion.confidence}% · {suggestion.reason}{suggestion.clue && <> · หลักฐาน “<mark lang="en">{suggestion.clue}</mark>”</>}</p>
                    ) : (
                      <p><strong>ยังไม่เลือกให้</strong> · {suggestion.reason || 'หลักฐานไม่พอจะระบุตัว'}</p>
                    )}
                  </div>
                )}
                <div className="inbox-confirm">
                  <label className="field">เจ้าของข้อความ
                    <select value={chosen} onChange={(event) => setChoices((current) => ({ ...current, [record.id]: event.target.value }))}>
                      <option value="">เลือกเพื่อน…</option>
                      {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.nickname} · {profile.fullName}</option>)}
                    </select>
                  </label>
                  <button className="button button-primary" disabled={busy || !chosen} onClick={() => onConfirm(record.id, chosen)}><UserCheck size={16} aria-hidden="true" /> ยืนยันว่าเป็นของคนนี้</button>
                  <button className="button button-light" onClick={() => onDismiss(record.id)}><X size={16} aria-hidden="true" /> ข้าม</button>
                </div>
                {picked && !picked.consentPdpa && <p className="muted inbox-note">{picked.nickname}ยังไม่ยินยอมรับคำเชิญ การผูกข้อความไม่เปลี่ยนเรื่องนี้ ระบบจะไม่ส่งคำเชิญให้</p>}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="empty"><UserCheck aria-hidden="true" /><h3>ไม่มีข้อความรอยืนยัน</h3><p>กด “นำเข้าข้อความกำกวมตัวอย่าง” เพื่อลองให้ AI จับคู่ชื่อที่สะกดต่างกัน</p></div>
      )}
    </section>
  );
}
