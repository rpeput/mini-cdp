import { ClipboardPaste, Sparkles } from 'lucide-react';
import { useId, useState } from 'react';
import { readReply, type ReplyReading } from '../services/ai/replyReading.ts';
import type { CampaignInteractionStatus, UnifiedProfile } from '../types/cdp.ts';
import type { PastedReply } from '../utils/aiActions.ts';

interface ReplyReaderProps {
  profile: Pick<UnifiedProfile, 'id' | 'nickname' | 'attributes'>;
  invite: string;
  busy: boolean;
  onSave: (reply: PastedReply) => void;
}

const statusLabels: Record<CampaignInteractionStatus, string> = { accepted: 'ตอบรับ', declined: 'ปฏิเสธ', pending: 'ยังไม่ตัดสินใจ' };

export function ReplyReader({ profile, invite, busy, onSave }: ReplyReaderProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [reading, setReading] = useState<ReplyReading | null>(null);
  const [status, setStatus] = useState<CampaignInteractionStatus>('pending');
  const [loading, setLoading] = useState(false);
  const fieldId = useId();

  async function read() {
    const reply = text.trim();
    if (!reply || loading) return;
    setLoading(true);
    try {
      const result = await readReply(invite, reply, profile);
      setReading(result);
      setStatus(result.status);
    } finally {
      setLoading(false);
    }
  }

  function close() {
    setOpen(false);
    setText('');
    setReading(null);
  }

  if (!open) {
    return <button type="button" className="text-button" disabled={busy} onClick={() => setOpen(true)}><ClipboardPaste size={15} aria-hidden="true" /> วางคำตอบจริง <span className="sr-only">ของ {profile.nickname}</span></button>;
  }

  return (
    <div className="reply-reader">
      <label className="field" htmlFor={fieldId}>คำตอบของ {profile.nickname} จาก LINE</label>
      <textarea id={fieldId} rows={2} maxLength={500} value={text} disabled={loading}
        onChange={(event) => { setText(event.target.value); setReading(null); }} placeholder="วางข้อความที่เพื่อนตอบกลับ เช่น ไปได้แต่ขอเลื่อนเป็นสัปดาห์หน้านะ" />
      <div className="reply-actions">
        <button type="button" className="button button-light" disabled={!text.trim() || loading || busy} onClick={read}><Sparkles size={16} aria-hidden="true" /> {loading ? 'กำลังอ่านคำตอบ…' : 'อ่านคำตอบ'}</button>
        <button type="button" className="button button-light" onClick={close}>ยกเลิก</button>
      </div>
      {reading && (
        <div className="reply-result" role="status">
          <p><strong>{reading.source === 'model' ? 'AI' : 'โหมดพื้นฐาน'} อ่านว่า: {statusLabels[reading.status]}</strong>{reading.confidence ? ` · ความมั่นใจ ${reading.confidence}%` : ''}</p>
          {reading.condition && <p>เงื่อนไข: {reading.condition}</p>}
          <p className="muted">{reading.reason}</p>
          {reading.newPreference && <p>ข้อมูลใหม่ที่จะบันทึกเข้าโปรไฟล์: <strong>{reading.newPreference.value}</strong> จากคำว่า “<mark>{reading.newPreference.evidenceQuote}</mark>”</p>}
          {reading.followUp && <p>ควรทำต่อ: {reading.followUp}</p>}
          {reading.source === 'rules' && <p className="muted">โหมดพื้นฐานอ่านได้เฉพาะคำตอบตรง ๆ หากมีเงื่อนไขหรือขอเลื่อนนัด ให้ตรวจและแก้ผลก่อนบันทึก</p>}
          <label className="field">บันทึกเป็น
            <select value={status} onChange={(event) => setStatus(event.target.value as CampaignInteractionStatus)}>
              {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <button type="button" className="button button-primary" disabled={busy}
            onClick={() => { onSave({ profileId: profile.id, replyText: text.trim(), status, note: reading.condition, preference: reading.newPreference, confidence: reading.confidence }); close(); }}>
            บันทึกคำตอบนี้
          </button>
        </div>
      )}
    </div>
  );
}
