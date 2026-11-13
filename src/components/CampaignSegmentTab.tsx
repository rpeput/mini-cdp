import { ArrowRight, ChevronDown, Quote, Radio, Send, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { CAMPAIGN_PRESETS } from '../data/seedData.ts';
import type { CampaignMatch, RawSourceRecord, UnifiedProfile } from '../types/cdp.ts';
import { RecommendationEvidenceDrawer } from './RecommendationEvidenceDrawer.tsx';

interface CampaignSegmentTabProps {
  profiles: UnifiedProfile[];
  records: RawSourceRecord[];
  confidenceThreshold: number;
  manuallyApprovedIds: ReadonlySet<string>;
  segmentSource: 'model' | 'local' | null;
  onInspectProfile: (id: string) => void;
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
}

const presetNames = ['หมูกระทะ', 'เดินป่า', 'เที่ยวทะเล', 'แฮงเอาท์'];

export function CampaignSegmentTab({ profiles, records, confidenceThreshold, manuallyApprovedIds, segmentSource, onInspectProfile, campaignPrompt, onPromptChange, matches, onMatchesChange, busy, isSegmenting, didSegment, onRunSegment, onLaunchCampaign, onGoToSources }: CampaignSegmentTabProps) {
  const [tier, setTier] = useState('all');
  const [whyProfileId, setWhyProfileId] = useState<string | null>(null);
  const ready = profiles.filter((profile) => profile.isStitched && profile.consentPdpa).length;
  const pending = profiles.filter((profile) => !profile.isStitched).length;
  const selected = matches.filter((match) => match.selected);
  const visible = matches.filter((match) => tier === 'all' || match.tier === tier);
  const hasBlankInvite = selected.some((match) => !match.personalizedInvite.trim());
  const sourceLabel = segmentSource === 'model' ? 'ค้นหาด้วยโมเดล' : 'ค้นหาด้วยกฎในเครื่อง';
  const whyMatch = matches.find((match) => match.profileId === whyProfileId) ?? null;
  const whyProfile = profiles.find((profile) => profile.id === whyProfileId) ?? null;
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
            <button className="button button-primary" type="submit" disabled={busy || !campaignPrompt.trim() || !ready}><Sparkles size={17} aria-hidden="true" /> {isSegmenting ? 'กำลังค้นหาเพื่อน…' : 'แนะนำผู้รับคำเชิญ'}</button>
          </form>
          <div className="surface">
            <div className="table-toolbar">
              <div><h2>เพื่อนที่ระบบแนะนำ</h2><p role="status">{isSegmenting ? 'กำลังเทียบกิจกรรมกับความสนใจ…' : matches.length ? `พบ ${matches.length} คน · เลือกแล้ว ${selected.length} คน · ${sourceLabel}` : didSegment ? `ไม่พบผู้รับ · ${sourceLabel}` : 'แนะนำจากโปรไฟล์ที่รวมข้อมูลแล้วและยินยอมรับคำเชิญ'}</p></div>
              {matches.length > 0 && <label><span className="sr-only">กรองประเภทผู้รับ</span><select value={tier} onChange={(event) => setTier(event.target.value)}><option value="all">ทุกประเภท</option><option value="direct">ตรงความสนใจ</option><option value="lookalike">ความสนใจใกล้เคียง</option></select></label>}
            </div>
            {visible.length ? (
              <ul className="match-list">{visible.map((match) => {
                const profile = profiles.find((item) => item.id === match.profileId);
                if (!profile) return null;
                return (
                  <motion.li key={match.profileId} initial={{ y: 4 }} animate={{ y: 0 }} transition={{ duration: 0.2 }}>
                    <div className="match-heading">
                      <label className="recipient-choice">
                        <input type="checkbox" checked={match.selected} disabled={busy} onChange={(event) => updateMatch(match.profileId, { selected: event.target.checked })} />
                        <span className="person-avatar" aria-hidden="true">{profile.avatarInitials}</span>
                        <span><strong>{profile.nickname}</strong><small>{profile.fullName}</small></span>
                      </label>
                      <div className="chip-list"><span className={`chip ${match.tier === 'direct' ? 'chip-positive' : ''}`}>{match.tier === 'direct' ? 'ตรงความสนใจ' : 'ความสนใจใกล้เคียง'}</span><span className="match-score">{match.matchScore}%</span></div>
                    </div>
                    <p>{match.aiReasoning}</p>
                    <button type="button" className="text-button" aria-haspopup="dialog" onClick={() => setWhyProfileId(match.profileId)}><Quote size={15} aria-hidden="true" /> ทำไมแนะนำคนนี้ <span className="sr-only">ของ {profile.nickname}</span></button>
                    <details className="invite-details">
                      <summary><ChevronDown size={16} aria-hidden="true" /> ดูหรือแก้คำเชิญ <span className="sr-only">ของ {profile.nickname}</span></summary>
                      <label className="field">ข้อความถึง {profile.nickname}<textarea rows={2} maxLength={500} disabled={busy} value={match.personalizedInvite} onChange={(event) => updateMatch(match.profileId, { personalizedInvite: event.target.value })} /></label>
                    </details>
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
          <dl><div><dt>ช่องทาง</dt><dd lang="en">LINE · Demo</dd></div><div><dt>ผู้รับที่เลือก</dt><dd>{selected.length} คน</dd></div></dl>
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
