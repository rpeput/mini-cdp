import { AlertTriangle, ArrowRight, Check, ChevronDown, Quote, Radio, Send, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { CAMPAIGN_PRESETS } from '../data/seedData.ts';
import { parseBriefWithRules } from '../services/ai/brief.ts';
import { checkInvites, type InviteCheck } from '../services/ai/inviteCheck.ts';
import type { CampaignBrief, CampaignMatch, RawSourceRecord, UnifiedProfile } from '../types/cdp.ts';
import { staggerDelay } from '../utils/motionSequence.ts';
import { BriefPanel } from './BriefPanel.tsx';
import { ScoreMeter, Tick } from './MotionBits.tsx';
import { RecommendationEvidenceDrawer } from './RecommendationEvidenceDrawer.tsx';

interface CampaignSegmentTabProps {
  profiles: UnifiedProfile[];
  records: RawSourceRecord[];
  confidenceThreshold: number;
  manuallyApprovedIds: ReadonlySet<string>;
  segmentSource: 'model' | 'local' | null;
  onInspectProfile: (id: string) => void;
  brief: CampaignBrief | null;
  onBriefChange: (brief: CampaignBrief | null) => void;
  campaignPrompt: string;
  onPromptChange: (prompt: string) => void;
  matches: CampaignMatch[];
  onMatchesChange: (matches: CampaignMatch[]) => void;
  busy: boolean;
  isSegmenting: boolean;
  didSegment: boolean;
  onRunSegment: (prompt: string) => void;
  onLaunchCampaign: (name: string, matches: CampaignMatch[]) => void;
  onGoToSources: () => void;
  /** Changes each time recommendations were produced. */
  runId: number;
}

const presetNames = ['หมูกระทะ', 'เดินป่า', 'เที่ยวทะเล', 'แฮงเอาท์'];

export function CampaignSegmentTab({ profiles, records, confidenceThreshold, manuallyApprovedIds, segmentSource, onInspectProfile, brief, onBriefChange, campaignPrompt, onPromptChange, matches, onMatchesChange, busy, isSegmenting, didSegment, onRunSegment, onLaunchCampaign, onGoToSources, runId }: CampaignSegmentTabProps) {
  const reduced = useReducedMotion();
  // Rows play in only for a run that finished while this page was open; coming back shows the list as it is.
  const [mountedRun] = useState(runId);
  const playIn = runId !== mountedRun && !reduced;
  const [tier, setTier] = useState('all');
  const [whyProfileId, setWhyProfileId] = useState<string | null>(null);
  // A check belongs to the exact invitation text it read, so editing an invitation discards its result.
  const [checks, setChecks] = useState<Record<string, { text: string; check: InviteCheck }>>({});
  const [checkSource, setCheckSource] = useState<'model' | 'rules' | null>(null);
  const [checking, setChecking] = useState(false);
  const ready = profiles.filter((profile) => profile.isStitched && profile.consentPdpa).length;
  const pending = profiles.filter((profile) => !profile.isStitched).length;
  const selected = matches.filter((match) => match.selected);
  const visible = matches.filter((match) => tier === 'all' || match.tier === tier);
  const hasBlankInvite = selected.some((match) => !match.personalizedInvite.trim());
  const sourceLabel = segmentSource === 'model' ? 'ค้นหาด้วยโมเดล' : 'ค้นหาด้วยโหมดพื้นฐาน';
  const whyMatch = matches.find((match) => match.profileId === whyProfileId) ?? null;
  const whyProfile = profiles.find((profile) => profile.id === whyProfileId) ?? null;
  const checkFor = (match: CampaignMatch) => (checks[match.profileId]?.text === match.personalizedInvite ? checks[match.profileId].check : null);
  const checked = selected.map(checkFor).filter((item): item is InviteCheck => item !== null);
  const flagged = checked.filter((item) => !item.ok).length;

  async function runCheck() {
    if (checking || !selected.length || hasBlankInvite) return;
    setChecking(true);
    try {
      const activeBrief = brief && brief.prompt === campaignPrompt.trim() ? brief : parseBriefWithRules(campaignPrompt.trim());
      const result = await checkInvites(selected.map((match) => ({ profileId: match.profileId, nickname: profiles.find((item) => item.id === match.profileId)?.nickname ?? '', text: match.personalizedInvite })), activeBrief);
      setChecks(Object.fromEntries(result.checks.map((check) => [check.profileId, { text: selected.find((match) => match.profileId === check.profileId)?.personalizedInvite ?? '', check }])));
      setCheckSource(result.source);
    } finally {
      setChecking(false);
    }
  }
  const updateMatch = (id: string, update: Partial<CampaignMatch>) => {
    onMatchesChange(matches.map((match) => match.profileId === id ? { ...match, ...update } : match));
  };

  return (
    <section aria-labelledby="campaign-title">
      <header className="page-heading">
        <div><h1 id="campaign-title">สร้างแคมเปญ</h1><p>บอกว่าคุณอยากชวนเพื่อนไปทำอะไร แล้วเลือกผู้รับและข้อความก่อนส่ง</p></div>
      </header>
      {pending > 0 && (
        <div className="notice">
          <ShieldCheck size={19} aria-hidden="true" />
          <p><strong>{ready} คนพร้อมรับคำเชิญ</strong> รวมข้อมูลอีก {pending} โปรไฟล์เพื่อให้ระบบค้นหาจากเพื่อนได้มากขึ้น</p>
          <button className="button button-light" onClick={onGoToSources}>ไปที่แหล่งข้อมูล <ArrowRight size={16} aria-hidden="true" /></button>
        </div>
      )}
      <div className="campaign-layout">
        <div>
          <form className="surface panel campaign-form" onSubmit={(event) => {
            event.preventDefault();
            if (!campaignPrompt.trim() || busy || !ready) return;
            setTier('all');
            onRunSegment(campaignPrompt.trim());
          }}>
            <h2><Radio size={20} aria-hidden="true" /> กิจกรรมที่อยากชวน</h2>
            <label className="field" htmlFor="campaign-prompt">คำอธิบายกิจกรรม</label>
            <textarea id="campaign-prompt" rows={3} maxLength={240} value={campaignPrompt} disabled={busy} onChange={(event) => onPromptChange(event.target.value)} placeholder="เช่น ชวนกินหมูกระทะวันศุกร์ งบไม่เกิน 300 บาท" />
            <div className="preset-list" aria-label="กิจกรรมตัวอย่าง" role="group">
              {CAMPAIGN_PRESETS.map((preset, index) => (
                <button key={preset} type="button" className="button button-light preset" aria-pressed={campaignPrompt === preset} disabled={busy} onClick={() => onPromptChange(preset)}>{presetNames[index]}</button>
              ))}
            </div>
            <BriefPanel prompt={campaignPrompt} brief={brief} disabled={busy} onBriefChange={onBriefChange} />
            <button className="button button-primary" type="submit" disabled={busy || !campaignPrompt.trim() || !ready}><Sparkles size={17} aria-hidden="true" /> {isSegmenting ? 'กำลังค้นหาเพื่อน…' : 'แนะนำผู้รับคำเชิญ'}</button>
          </form>
          <div className="surface">
            <div className="table-toolbar">
              <div><h2>เพื่อนที่ระบบแนะนำ</h2><p role="status">{isSegmenting ? 'กำลังเทียบกิจกรรมกับความสนใจ…' : matches.length ? <>พบ {matches.length} คน · เลือกแล้ว <Tick value={selected.length} /> คน · {sourceLabel}</> : didSegment ? `ไม่พบผู้รับ · ${sourceLabel}` : 'แนะนำจากโปรไฟล์ที่รวมข้อมูลแล้วและยินยอมรับคำเชิญ'}</p></div>
              {matches.length > 0 && <label><span className="sr-only">กรองประเภทผู้รับ</span><select value={tier} onChange={(event) => setTier(event.target.value)}><option value="all">ทุกประเภท</option><option value="direct">ตรงความสนใจ</option><option value="lookalike">ความสนใจใกล้เคียง</option></select></label>}
            </div>
            {visible.length ? (
              <ul className="match-list">{visible.map((match, index) => {
                const profile = profiles.find((item) => item.id === match.profileId);
                if (!profile) return null;
                return (
                  <motion.li key={match.profileId} layout="position" initial={playIn ? { opacity: 0, y: 6 } : false} animate={{ opacity: 1, y: 0 }}
                    transition={{ default: { duration: 0.27, delay: playIn ? staggerDelay(index) / 1000 : 0, ease: 'easeOut' }, layout: { duration: 0.29, ease: 'easeOut' } }}>
                    <div className="match-heading">
                      <label className="recipient-choice">
                        <input type="checkbox" checked={match.selected} disabled={busy} onChange={(event) => updateMatch(match.profileId, { selected: event.target.checked })} />
                        <span className="person-avatar" aria-hidden="true">{profile.avatarInitials}</span>
                        <span><strong>{profile.nickname}</strong><small>{profile.fullName}</small></span>
                      </label>
                      <div className="chip-list"><span className={`chip ${match.tier === 'direct' ? 'chip-positive' : ''}`}>{match.tier === 'direct' ? 'ตรงความสนใจ' : 'ความสนใจใกล้เคียง'}</span><ScoreMeter score={match.matchScore} animateIn={playIn} delay={playIn ? staggerDelay(index) / 1000 + 0.07 : 0} /></div>
                    </div>
                    <p>{match.aiReasoning}</p>
                    <button type="button" className="text-button" aria-haspopup="dialog" onClick={() => setWhyProfileId(match.profileId)}><Quote size={15} aria-hidden="true" /> ทำไมแนะนำคนนี้ <span className="sr-only">ของ {profile.nickname}</span></button>
                    <details className="invite-details">
                      <summary><ChevronDown size={16} aria-hidden="true" /> ดูหรือแก้คำเชิญ <span className="sr-only">ของ {profile.nickname}</span></summary>
                      <label className="field">ข้อความถึง {profile.nickname}<textarea rows={2} maxLength={500} disabled={busy} value={match.personalizedInvite} onChange={(event) => updateMatch(match.profileId, { personalizedInvite: event.target.value })} /></label>
                    </details>
                    {match.selected && checkFor(match) && (
                      checkFor(match)?.ok
                        ? <p className="invite-ok"><Check size={14} aria-hidden="true" /> คำเชิญผ่านการตรวจ</p>
                        : <ul className="invite-problems">{checkFor(match)?.problems.map((problem, index) => (
                            <li key={index}><AlertTriangle size={14} aria-hidden="true" /> {problem.explanation}{problem.quote && !problem.explanation.includes(problem.quote) && <> · “<mark>{problem.quote}</mark>”</>}</li>
                          ))}</ul>
                    )}
                  </motion.li>
                );
              })}</ul>
            ) : (
              <div className="empty">
                <Users aria-hidden="true" />
                <h3>{isSegmenting ? 'กำลังค้นหาผู้รับ' : didSegment || matches.length ? (segmentSource === 'model' ? 'ไม่พบผู้รับที่เหมาะกับกิจกรรมนี้' : 'ไม่พบเพื่อนที่ตรงกับเงื่อนไข') : 'ยังไม่มีรายชื่อผู้รับ'}</h3>
                <p>{matches.length ? 'ลองเลือกประเภทผู้รับอื่น' : didSegment ? 'ตรวจโปรไฟล์ที่ยินยอมแล้วทุกคนแล้ว แต่ไม่มีใครมีหลักฐานที่เข้ากับกิจกรรมนี้ ลองปรับคำอธิบายหรือรวมข้อมูลเพื่อนเพิ่มเติม' : 'ระบุกิจกรรม แล้วกดแนะนำผู้รับคำเชิญ'}</p>
              </div>
            )}
          </div>
        </div>
        <aside className="surface panel campaign-summary" aria-label="สรุปคำเชิญ">
          <span className="summary-icon"><Send size={20} aria-hidden="true" /></span>
          <h2>สรุปคำเชิญ</h2>
          <p>ส่งข้อความจำลองผ่าน LINE ให้เฉพาะเพื่อนที่คุณเลือก</p>
          <dl><div><dt>ช่องทาง</dt><dd lang="en">LINE · Demo</dd></div><div><dt>ผู้รับที่เลือก</dt><dd><Tick value={selected.length} /> คน</dd></div></dl>
          <button className="button button-light" disabled={busy || checking || !selected.length || hasBlankInvite} onClick={runCheck}><Sparkles size={16} aria-hidden="true" /> {checking ? 'กำลังตรวจคำเชิญ…' : 'ตรวจคำเชิญ'}</button>
          {checked.length > 0 && (
            <p className="summary-hint" role="status">
              {checkSource === 'model' ? 'ตรวจโดยโมเดล' : 'ตรวจด้วยโหมดพื้นฐาน'}: ผ่าน {checked.length - flagged} · มีข้อสังเกต {flagged}{flagged > 0 ? ' ดูใต้คำเชิญของแต่ละคน ส่งต่อได้หากเห็นว่าไม่เป็นปัญหา' : ''}
            </p>
          )}
          <button className="button button-primary" disabled={busy || !selected.length || hasBlankInvite} onClick={() => onLaunchCampaign(campaignPrompt.trim(), matches)}>ส่งคำเชิญจำลอง <ArrowRight size={17} aria-hidden="true" /></button>
          <p className="summary-hint">{hasBlankInvite ? 'กรอกข้อความให้ครบสำหรับผู้รับที่เลือก' : 'หลังส่งแล้ว ดูสถานะของแต่ละคนได้ที่ผลแคมเปญ'}</p>
        </aside>
      </div>
      <RecommendationEvidenceDrawer profile={whyMatch ? whyProfile : null} match={whyMatch} campaignPrompt={campaignPrompt} records={records}
        confidenceThreshold={confidenceThreshold} manuallyApprovedIds={manuallyApprovedIds} onClose={() => setWhyProfileId(null)}
        onOpenProfile={onInspectProfile} />
    </section>
  );
}
