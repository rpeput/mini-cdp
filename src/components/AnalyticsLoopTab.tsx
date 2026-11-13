import { ArrowRight, Clock3, MessageSquare, Send, ThumbsDown, ThumbsUp } from 'lucide-react';
import { motion } from 'motion/react';
import type { CampaignRecord, UnifiedProfile } from '../types/cdp.ts';
import type { PastedReply } from '../utils/aiActions.ts';
import { CampaignInsights } from './CampaignInsights.tsx';
import { ReplyReader } from './ReplyReader.tsx';
import { summarizeCampaign } from '../utils/campaignFlow.ts';

interface AnalyticsLoopTabProps {
  campaigns: CampaignRecord[];
  activeCampaignId: string | null;
  onSelectCampaign: (id: string) => void;
  profiles: UnifiedProfile[];
  busy: boolean;
  isSimulating: boolean;
  onSimulateReplies: (id: string) => void;
  onGoToSegmentation: () => void;
  onInspectProfile: (id: string) => void;
  onSaveReply: (campaignId: string, reply: PastedReply) => void;
}

const dateFormat = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
const statuses = {
  accepted: { label: 'ตอบรับ', className: 'chip-positive' },
  declined: { label: 'ปฏิเสธ', className: 'chip-negative' },
  pending: { label: 'ยังไม่ตอบ', className: 'chip-waiting' },
};

export function AnalyticsLoopTab({ campaigns, activeCampaignId, onSelectCampaign, profiles, busy, isSimulating, onSimulateReplies, onGoToSegmentation, onInspectProfile, onSaveReply }: AnalyticsLoopTabProps) {
  const campaign = campaigns.find((item) => item.id === activeCampaignId) ?? campaigns[0];
  const recipients = campaign?.matches.filter((match) => match.selected) ?? [];
  const { accepted, declined, pending } = summarizeCampaign(campaign);

  return (
    <section aria-labelledby="analytics-title">
      <header className="page-heading">
        <div><h1 id="analytics-title">ผลแคมเปญ</h1><p>ติดตามคำเชิญที่ส่งและคำตอบของเพื่อนแต่ละคน</p></div>
        <button className="button button-light" onClick={onGoToSegmentation}>สร้างแคมเปญ <ArrowRight size={17} aria-hidden="true" /></button>
      </header>
      {campaign ? (
        <>
          <div className="surface table-toolbar analytics-toolbar">
            <div><h2>{campaign.name}</h2><p>ส่งจำลองผ่าน LINE · {dateFormat.format(new Date(campaign.createdAt))}</p></div>
            <label className="field">เลือกแคมเปญ<select value={campaign.id} onChange={(event) => onSelectCampaign(event.target.value)}>
              {campaigns.map((item) => <option value={item.id} key={item.id}>{item.name} · {dateFormat.format(new Date(item.createdAt))}</option>)}
            </select></label>
          </div>
          <dl className="metric-grid metric-grid-four">
            <div className="metric"><dt><Send size={17} aria-hidden="true" /> ส่งแล้ว</dt><dd>{recipients.length}</dd></div>
            <div className="metric"><dt><ThumbsUp size={17} aria-hidden="true" /> ตอบรับ</dt><dd>{accepted}</dd></div>
            <div className="metric"><dt><ThumbsDown size={17} aria-hidden="true" /> ปฏิเสธ</dt><dd>{declined}</dd></div>
            <div className="metric"><dt><Clock3 size={17} aria-hidden="true" /> ยังไม่ตอบ</dt><dd>{pending}</dd></div>
          </dl>
          <div className="surface panel response-panel">
            <div className="response-heading">
              <div><h2>คำตอบของเพื่อน</h2><p role="status">{isSimulating ? 'กำลังจำลองคำตอบ…' : campaign.simulated ? `บันทึกคำตอบกลับเข้า ${campaign.closedLoopUpdatesCount} โปรไฟล์แล้ว` : 'ทุกคำเชิญอยู่ในสถานะรอตอบกลับ'}</p></div>
              <button className="button button-primary" disabled={busy || campaign.simulated} onClick={() => onSimulateReplies(campaign.id)}><MessageSquare size={17} aria-hidden="true" /> {isSimulating ? 'กำลังจำลอง…' : campaign.simulated ? 'จำลองคำตอบแล้ว' : 'จำลองคำตอบ'}</button>
            </div>
            <div className="response-bar" aria-hidden="true">
              {[{ key: 'accepted', count: accepted }, { key: 'declined', count: declined }, { key: 'pending', count: pending }].filter((item) => item.count).map(({ key, count }) => (
                <motion.span layout key={key} className={`response-${key}`} style={{ flexGrow: count }} transition={{ duration: 0.28 }} />
              ))}
            </div>
            <ul className="response-list">{recipients.map((match) => {
              const profile = profiles.find((item) => item.id === match.profileId);
              const reply = campaign.replies.find((item) => item.profileId === match.profileId);
              const status = statuses[reply?.status ?? 'pending'];
              return (
                <li key={match.profileId}>
                  <div className="response-person">
                    <button className="profile-link" onClick={() => onInspectProfile(match.profileId)}>
                      <span className="person-avatar" aria-hidden="true">{profile?.avatarInitials}</span>
                      <span><strong>{profile?.nickname ?? match.profileId}</strong><small>{profile?.fullName}</small></span>
                      <ArrowRight size={16} aria-hidden="true" />
                    </button>
                    <span className="chip-list">{reply?.origin === 'pasted' && <span className="chip">คำตอบจริง</span>}<span className={`chip ${status.className}`}>{status.label}</span></span>
                  </div>
                  <details className="response-message"><summary>คำเชิญที่ส่ง <span className="sr-only">ถึง {profile?.nickname}</span></summary><p>{match.personalizedInvite}</p></details>
                  {reply?.replyText && <p className="reply-text">“{reply.replyText}”</p>}
                  {reply?.note && <p className="reply-note">เงื่อนไข: {reply.note}</p>}
                  {reply?.feedbackTag && <span className="chip">{reply.feedbackTag}</span>}
                  {profile && <ReplyReader profile={profile} invite={match.personalizedInvite} busy={busy} onSave={(reply) => onSaveReply(campaign.id, reply)} />}
                </li>
              );
            })}</ul>
          </div>
          <CampaignInsights campaign={campaign} profiles={profiles} onInspectProfile={onInspectProfile} />
        </>
      ) : (
        <div className="surface empty"><Send aria-hidden="true" /><h2>ยังไม่มีแคมเปญที่ส่ง</h2><p>สร้างแคมเปญแรกเพื่อดูคำเชิญและทดลองติดตามคำตอบ</p><button className="button button-primary" onClick={onGoToSegmentation}>ไปสร้างแคมเปญ <ArrowRight size={17} aria-hidden="true" /></button></div>
      )}
    </section>
  );
}
