import { HelpCircle, Sparkles, X } from 'lucide-react';
import { useState } from 'react';
import { missingConstraints, readBrief } from '../services/ai/brief.ts';
import type { BriefConstraintKind, CampaignBrief } from '../types/cdp.ts';

interface BriefPanelProps {
  prompt: string;
  brief: CampaignBrief | null;
  disabled: boolean;
  onBriefChange: (brief: CampaignBrief | null) => void;
}

const kindLabels: Record<BriefConstraintKind, string> = {
  activity: 'กิจกรรม',
  day: 'วัน',
  time: 'เวลา',
  place: 'สถานที่',
  budgetMax: 'งบไม่เกิน',
  groupSize: 'จำนวนคน',
};

function display(kind: BriefConstraintKind, value: string | number): string {
  if (kind === 'budgetMax') return `${value} บาท`;
  if (kind === 'groupSize') return `${value} คน`;
  return String(value);
}

export function BriefPanel({ prompt, brief, disabled, onBriefChange }: BriefPanelProps) {
  const [loading, setLoading] = useState(false);
  const current = brief && brief.prompt === prompt.trim() ? brief : null;

  async function read() {
    const text = prompt.trim();
    if (!text || loading) return;
    setLoading(true);
    try {
      onBriefChange(await readBrief(text));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="brief-panel">
      <button type="button" className="button button-light" disabled={disabled || loading || !prompt.trim()} onClick={read}>
        <Sparkles size={16} aria-hidden="true" /> {loading ? 'กำลังอ่านโจทย์…' : current ? 'อ่านโจทย์ใหม่' : 'ให้ AI อ่านโจทย์'}
      </button>
      {current && (
        <div className="brief-result" role="status">
          <p className="muted">{current.source === 'model' ? 'AI อ่านได้ดังนี้ (แต่ละข้อคัดจากโจทย์ของคุณ)' : 'กฎในเครื่องอ่านได้ดังนี้ (อ่านตัวเลขและคำบอกวันที่พบบ่อยเท่านั้น)'}</p>
          {current.constraints.length ? (
            <ul className="chip-list" aria-label="เงื่อนไขที่อ่านได้">
              {current.constraints.map((item) => (
                <li key={item.kind} className="brief-chip">
                  <span className="chip" title={`จากคำว่า “${item.quote}”`}>{kindLabels[item.kind]}: {display(item.kind, item.value)}</span>
                  <button type="button" className="chip-remove" disabled={disabled} aria-label={`ลบเงื่อนไข ${kindLabels[item.kind]} ${display(item.kind, item.value)}`}
                    onClick={() => onBriefChange({ ...current, constraints: current.constraints.filter((other) => other.kind !== item.kind) })}><X size={13} aria-hidden="true" /></button>
                </li>
              ))}
            </ul>
          ) : <p>ไม่พบวัน งบ หรือจำนวนคนในโจทย์</p>}
          {missingConstraints(current.constraints).length > 0 && current.clarifyingQuestion && (
            <p className="brief-question"><HelpCircle size={15} aria-hidden="true" /> {current.clarifyingQuestion} เพิ่มในโจทย์แล้วกดอ่านใหม่ได้</p>
          )}
        </div>
      )}
    </div>
  );
}
