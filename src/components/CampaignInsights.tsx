import { Lightbulb, Quote, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { type CampaignSummary, summarizeCampaign } from '../services/ai/campaignSummary.ts';
import type { CampaignRecord, UnifiedProfile } from '../types/cdp.ts';

interface CampaignInsightsProps {
  campaign: CampaignRecord;
  profiles: UnifiedProfile[];
  onInspectProfile: (id: string) => void;
}

const statusText = { accepted: 'ตอบรับ', declined: 'ปฏิเสธ', pending: 'ยังไม่ตอบ' } as const;

export function CampaignInsights({ campaign, profiles, onInspectProfile }: CampaignInsightsProps) {
  const [saved, setSaved] = useState<{ signature: string; summary: CampaignSummary } | null>(null);
  const [loading, setLoading] = useState(false);
  // A summary describes one state of the replies, so it is dropped as soon as they change.
  const signature = `${campaign.id}:${campaign.replies.map((reply) => `${reply.profileId}${reply.status}${reply.replyText}`).join('|')}`;
  const summary = saved?.signature === signature ? saved.summary : null;
  const hasReplies = campaign.replies.length > 0;

  async function run() {
    if (loading || !hasReplies) return;
    setLoading(true);
    try {
      setSaved({ signature, summary: await summarizeCampaign(campaign, profiles) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="surface panel campaign-insights" aria-labelledby="insights-title">
      <div className="response-heading">
        <div><h2 id="insights-title"><Lightbulb size={19} aria-hidden="true" /> สรุปผลพร้อมแหล่งอ้างอิง</h2><p>AI อธิบายว่าทำไมตอบแบบนี้ ยอดตัวเลขนับโดยแอป และทุกข้อสรุปชี้กลับไปที่คำตอบจริง</p></div>
        <button className="button button-light" disabled={!hasReplies || loading} onClick={run}><Sparkles size={16} aria-hidden="true" /> {loading ? 'กำลังสรุป…' : summary ? 'สรุปใหม่' : 'สรุปผลด้วย AI'}</button>
      </div>
      {!hasReplies && <p className="muted">ยังไม่มีคำตอบให้สรุป กดจำลองคำตอบ หรือวางคำตอบจริงของเพื่อนก่อน</p>}
      {summary && (
        <>
          <p className="muted" role="status">{summary.source === 'model' ? 'สรุปโดยโมเดล ตัดข้อที่อ้างคนนอกแคมเปญออกแล้ว' : 'สรุปด้วยกฎในเครื่อง จัดกลุ่มตามเหตุผลที่บันทึกไว้เท่านั้น'}</p>
          {summary.points.length ? (
            <ul className="ai-points">
              {summary.points.map((point, index) => (
                <li key={index}>
                  <p><span className={`chip ${point.kind === 'insight' ? '' : 'chip-positive'}`}>{point.kind === 'insight' ? 'ข้อสังเกต' : 'ครั้งหน้า'}</span> {point.text}</p>
                  <ul className="citations" aria-label="หลักฐานอ้างอิง">
                    {point.citations.map((profileId) => {
                      const profile = profiles.find((item) => item.id === profileId);
                      const reply = campaign.replies.find((item) => item.profileId === profileId);
                      return (
                        <li key={profileId}>
                          <button className="text-button" onClick={() => onInspectProfile(profileId)}>{profile?.nickname ?? profileId}</button>
                          <span className="chip">{statusText[reply?.status ?? 'pending']}</span>
                          {reply?.replyText ? <q><Quote size={12} aria-hidden="true" /> {reply.replyText}</q> : <span className="muted">ยังไม่มีคำตอบ</span>}
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          ) : <p className="muted">ไม่มีข้อสรุปที่ต้องรายงาน</p>}
        </>
      )}
    </section>
  );
}
