import { ArrowRight, ChevronDown, Clock3, MessageSquare, Send, ThumbsDown, ThumbsUp, UserCheck } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { useReplyPlayback } from '../hooks/useReplyPlayback.ts';
import type { CampaignRecord, UnifiedProfile } from '../types/cdp.ts';
import type { PastedReply } from '../utils/aiActions.ts';
import { CampaignInsights } from './CampaignInsights.tsx';
import { CoachTarget } from './CoachTarget.tsx';
import { ReplyReader } from './ReplyReader.tsx';
import { summarizeCampaign } from '../utils/campaignFlow.ts';
import { formatCampaignDate } from '../utils/cdpHelpers.ts';
import { playableReplyIds, staggerDelay, visibleReplies } from '../utils/motionSequence.ts';
import { AnimatedNumber } from './MotionBits.tsx';

interface AnalyticsLoopTabProps {
  active: boolean;
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
  /** A campaign that was just sent and has not been shown yet. */
  launchFx: { campaignId: string; played: boolean } | null;
  onLaunchPlayed: () => void;
  /** Changes each time replies were simulated, with the campaign it was for. */
  playbackRun: number;
  playbackCampaignId: string | null;
}

const statuses = {
  accepted: { label: 'ตอบรับ', className: 'chip-positive' },
  declined: { label: 'ปฏิเสธ', className: 'chip-negative' },
  pending: { label: 'ยังไม่ตอบ', className: 'chip-waiting' },
};

/** The note after sending a campaign is shown once per page load. */
let simulateCoachSeen = false;

export function AnalyticsLoopTab({ active, campaigns, activeCampaignId, onSelectCampaign, profiles, busy, isSimulating, onSimulateReplies, onGoToSegmentation, onInspectProfile, onSaveReply, launchFx, onLaunchPlayed, playbackRun, playbackCampaignId }: AnalyticsLoopTabProps) {
  const campaign = campaigns.find((item) => item.id === activeCampaignId) ?? campaigns[0];
  const recipients = campaign?.matches.filter((match) => match.selected) ?? [];
  const reduced = useReducedMotion();
  // A just-sent campaign is shown arriving once; a revisit, or reduced motion, shows it as it is.
  const isNewCampaign = active && launchFx !== null && !launchFx.played && launchFx.campaignId === campaign?.id;
  const playLaunch = isNewCampaign && !reduced;
  const [coachFor, setCoachFor] = useState<string | null>(null);
  useEffect(() => {
    if (!isNewCampaign) return;
    onLaunchPlayed();
    if (!simulateCoachSeen && campaign) setCoachFor(campaign.id);
  }, [isNewCampaign, onLaunchPlayed, campaign]);
  const coachOn = active && !!campaign && coachFor === campaign.id && !campaign.simulated && !busy && !simulateCoachSeen;
  const dismissCoach = () => { simulateCoachSeen = true; setCoachFor(null); };
  // The replies in state are already final. While a run plays, the screen only holds back the ones that have not "arrived".
  const { state: playback, playing, skip } = useReplyPlayback(campaign, playbackRun, playbackCampaignId, active);
  const playable = playableReplyIds(campaign);
  const shownReplies = visibleReplies(campaign?.replies ?? [], playable, playback);
  const { accepted, declined, pending } = summarizeCampaign(campaign && { ...campaign, replies: shownReplies });
  const headingRef = useRef<HTMLHeadingElement>(null);
  const skipHadFocus = useRef(false);
  const wasPlaying = useRef(false);
  useEffect(() => {
    // The skip button is removed when the run ends; keep keyboard focus in the panel instead of losing it.
    if (active && wasPlaying.current && !playing && skipHadFocus.current) headingRef.current?.focus({ preventScroll: true });
    if (!playing) skipHadFocus.current = false;
    wasPlaying.current = playing;
  }, [active, playing]);

  return (
    <section aria-labelledby="analytics-title">
      <header className="page-heading">
        <div><h1 id="analytics-title">ผลแคมเปญ</h1><p>ติดตามคำเชิญที่ส่งและคำตอบของเพื่อนแต่ละคน</p></div>
        <button className="button button-light" onClick={onGoToSegmentation}>สร้างแคมเปญ <ArrowRight size={17} aria-hidden="true" /></button>
      </header>
      {campaign ? (
        <>
          <div className="surface table-toolbar analytics-toolbar">
            <div><h2>{campaign.name}</h2><p>ส่งจำลองผ่าน LINE · {formatCampaignDate(campaign.createdAt)}</p></div>
            <label className="field">
              เลือกแคมเปญ
              <span className="campaign-picker">
                <select value={campaign.id} onChange={(event) => onSelectCampaign(event.target.value)}>
                  {campaigns.map((item) => <option value={item.id} key={item.id}>{item.name} · {formatCampaignDate(item.createdAt)}</option>)}
                </select>
                <span className="campaign-picker-value" aria-hidden="true">
                  <span>{campaign.name} · {formatCampaignDate(campaign.createdAt)}</span>
                  <ChevronDown size={16} />
                </span>
              </span>
            </label>
          </div>
          <dl className="metric-grid metric-grid-four">
            <div className="metric"><dt><Send size={17} aria-hidden="true" /> ส่งแล้ว</dt><dd><AnimatedNumber value={recipients.length} from={playLaunch ? 0 : undefined} /></dd></div>
            <div className="metric"><dt><ThumbsUp size={17} aria-hidden="true" /> ตอบรับ</dt><dd><AnimatedNumber value={accepted} duration={0.29} /></dd></div>
            <div className="metric"><dt><ThumbsDown size={17} aria-hidden="true" /> ปฏิเสธ</dt><dd><AnimatedNumber value={declined} duration={0.29} /></dd></div>
            <div className="metric"><dt><Clock3 size={17} aria-hidden="true" /> ยังไม่ตอบ</dt><dd><AnimatedNumber value={pending} from={playLaunch ? 0 : undefined} duration={0.29} /></dd></div>
          </dl>
          <div className="surface panel response-panel">
            <div className="response-heading">
              <div><h2 ref={headingRef} tabIndex={-1}>คำตอบของเพื่อน</h2><p role="status">{isSimulating || playing ? 'กำลังจำลองคำตอบ…' : campaign.simulated ? `บันทึกคำตอบกลับเข้า ${campaign.closedLoopUpdatesCount} โปรไฟล์แล้ว` : 'ทุกคำเชิญอยู่ในสถานะรอตอบกลับ'}</p></div>
              <div className="response-actions">
                {playing && <button className="button button-light" onFocus={() => { skipHadFocus.current = true; }} onBlur={() => { skipHadFocus.current = false; }} onClick={skip}>ข้าม</button>}
                <CoachTarget active={coachOn} title="ต่อไป: ดูว่าเพื่อนตอบอะไร" onDone={dismissCoach} target={
                  <button className="button button-primary" disabled={busy || campaign.simulated} onClick={() => { dismissCoach(); onSimulateReplies(campaign.id); }}><MessageSquare size={17} aria-hidden="true" /> {isSimulating || playing ? 'กำลังจำลอง…' : campaign.simulated ? 'จำลองคำตอบแล้ว' : 'จำลองคำตอบ'}</button>
                }>
                  ส่งคำเชิญไปแล้ว แต่ยังไม่มีใครตอบ กด <strong>จำลองคำตอบ</strong> เพื่อให้ระบบสร้างคำตอบของเพื่อนแต่ละคน แล้วบันทึกกลับเข้าโปรไฟล์ ถ้ามีคำตอบจริงจากเพื่อน กด <strong>วางคำตอบจริง</strong> ใต้ชื่อคนนั้นได้
                </CoachTarget>
              </div>
            </div>
            <div className="response-bar" aria-hidden="true">
              {[{ key: 'accepted', count: accepted }, { key: 'declined', count: declined }, { key: 'pending', count: pending }].filter((item) => item.count).map(({ key, count }) => (
                <motion.span layout key={key} className={`response-${key}`} style={{ flexGrow: count }} transition={{ duration: 0.37 }} />
              ))}
            </div>
            <ul className="response-list">{recipients.map((match, index) => {
              const profile = profiles.find((item) => item.id === match.profileId);
              const reply = shownReplies.find((item) => item.profileId === match.profileId);
              const saved = campaign.replies.find((item) => item.profileId === match.profileId);
              const status = statuses[reply?.status ?? 'pending'];
              const typing = playback?.typing.includes(match.profileId) ?? false;
              return (
                <motion.li key={`${campaign.id}:${match.profileId}`} layout="position" initial={playLaunch ? { opacity: 0, y: 6 } : false} animate={{ opacity: 1, y: 0 }}
                  transition={{ default: { duration: 0.27, delay: playLaunch ? staggerDelay(index, 67, 10) / 1000 : 0, ease: 'easeOut' }, layout: { duration: 0.29, ease: 'easeOut' } }}>
                  <div className="response-person">
                    <button className="profile-link" onClick={() => onInspectProfile(match.profileId)}>
                      <span className="person-avatar" aria-hidden="true">{profile?.avatarInitials}</span>
                      <span><strong>{profile?.nickname ?? match.profileId}</strong><small>{profile?.fullName}</small></span>
                      <ArrowRight size={16} aria-hidden="true" />
                    </button>
                    <span className="chip-list">{reply?.origin === 'pasted' && <span className="chip">คำตอบจริง</span>}
                      {typing
                        ? <span className="chip chip-typing" data-typing>กำลังพิมพ์<TypingDots /></span>
                        : <motion.span key={reply?.status ?? 'pending'} className={`chip ${status.className}`} initial={playing && reply ? { opacity: 0, scale: 0.9 } : false} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.27, ease: 'easeOut' }}>{status.label}</motion.span>}</span>
                  </div>
                  <details className="response-message"><summary>คำเชิญที่ส่ง <span className="sr-only">ถึง {profile?.nickname}</span></summary><p>{match.personalizedInvite}</p></details>
                  {reply?.replyText && <motion.p className="reply-text" initial={playing ? { opacity: 0 } : false} animate={{ opacity: 1 }} transition={{ duration: 0.27 }}>“{reply.replyText}”</motion.p>}
                  {reply?.note && <p className="reply-note">เงื่อนไข: {reply.note}</p>}
                  {reply?.feedbackTag && <span className="chip">{reply.feedbackTag}</span>}
                  {saved && saved.status !== 'pending' && (
                    // Reserved for every reply that is saved to a profile, so the chip arriving does not push the next row.
                    <div className="loop-slot">
                      {reply && <motion.span className="chip chip-loop" initial={playing ? { opacity: 0, y: 4 } : false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.27, delay: 0.13, ease: 'easeOut' }}>
                        <UserCheck size={13} aria-hidden="true" /> บันทึกเข้าโปรไฟล์ของ {profile?.nickname ?? match.profileId}
                      </motion.span>}
                    </div>
                  )}
                  {profile && <ReplyReader profile={profile} invite={match.personalizedInvite} busy={busy || playing} onSave={(reply) => onSaveReply(campaign.id, reply)} />}
                </motion.li>
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

/** Three dots that pulse while a reply is being written. They exist only for the short time a reply is "typing". */
function TypingDots() {
  return (
    <span className="typing-dots" aria-hidden="true">
      {[0, 1, 2].map((dot) => (
        <motion.span key={dot} animate={{ opacity: [0.25, 1, 0.25] }} transition={{ duration: 1.07, repeat: Infinity, delay: dot * 0.2 }} />
      ))}
    </span>
  );
}
