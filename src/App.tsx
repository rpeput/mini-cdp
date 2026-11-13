import { MotionConfig, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AnalyticsLoopTab } from './components/AnalyticsLoopTab.tsx';
import { CampaignSegmentTab } from './components/CampaignSegmentTab.tsx';
import { AiPerformanceTab } from './components/AiPerformanceTab.tsx';
import { CollectUnifyTab } from './components/CollectUnifyTab.tsx';
import { OverviewTab } from './components/OverviewTab.tsx';
import type { ReviewNotice } from './components/ReviewQueue.tsx';
import { LandingPage } from './components/LandingPage.tsx';
import { ProfileInspectorDrawer } from './components/ProfileInspectorDrawer.tsx';
import { type ToastItem, ToastRegion } from './components/ToastRegion.tsx';
import { DemoAccountBanner } from './components/DemoAccountBanner.tsx';
import { TopNavbar } from './components/TopNavbar.tsx';
import { UnifiedProfilesTab } from './components/UnifiedProfilesTab.tsx';
import { IDENTITY_CASES } from './data/aiFixtures.ts';
import { CAMPAIGN_PRESETS, INITIAL_PROFILES, RAW_SOURCE_RECORDS } from './data/seedData.ts';
import { runIdentityStitching, segmentCampaign, simulateCampaignResponses } from './services/aiEngine.ts';
import { applyBriefToMatches } from './services/ai/brief.ts';
import type { CampaignBrief, CampaignMatch, CampaignRecord, DataSourceType, RawSourceRecord, UnifiedProfile, UnlinkedRecord, WorkflowTabId } from './types/cdp.ts';
import { applyPastedReply, linkUnlinkedRecord, type PastedReply } from './utils/aiActions.ts';
import { buildReplySummaries, createCampaign, recordSentInvitations } from './utils/campaignFlow.ts';
import { buildStitchFx, type StitchFx } from './utils/motionSequence.ts';
import { getEffectiveAttributeStatus } from './utils/cdpHelpers.ts';
import { applyReviewDecisions, undoReviewDecisions, type ReviewTarget } from './utils/reviewQueue.ts';
import './App.css';

const storageKey = 'gather-demo-v1';

interface DemoData {
  records: RawSourceRecord[];
  profiles: UnifiedProfile[];
  campaigns: CampaignRecord[];
  approved: string[];
  threshold: number;
  /** Messages whose author is not known yet. */
  inbox: UnlinkedRecord[];
}

function initialDemo(): DemoData {
  return { profiles: INITIAL_PROFILES, records: RAW_SOURCE_RECORDS, campaigns: [], approved: [], threshold: 75, inbox: [] };
}

function loadDemo(): DemoData {
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null') as DemoData | null;
    if (saved && Array.isArray(saved.profiles) && Array.isArray(saved.records) &&
      Array.isArray(saved.campaigns) && Array.isArray(saved.approved) &&
      Number.isFinite(saved.threshold)) return { ...saved, inbox: Array.isArray(saved.inbox) ? saved.inbox : [] };
  } catch {
    // The demo remains usable if storage is blocked or its contents are invalid.
  }
  return initialDemo();
}

export function App() {
  const [demo, setDemo] = useState(loadDemo);
  const { profiles, records, campaigns, threshold, approved, inbox } = demo;
  const manuallyApprovedIds = new Set(approved);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState<WorkflowTabId>('profiles');
  const anchorRef = useRef<string | null>(null);
  const [reviewNotice, setReviewNotice] = useState<ReviewNotice | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [campaignPrompt, setCampaignPrompt] = useState(CAMPAIGN_PRESETS[0]);
  const [matches, setMatches] = useState<CampaignMatch[]>([]);
  const [didSegment, setDidSegment] = useState(false);
  const [segmentSource, setSegmentSource] = useState<'model' | 'local' | null>(null);
  const [brief, setBrief] = useState<CampaignBrief | null>(null);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [inspectedProfileId, setInspectedProfileId] = useState<string | null>(null);
  const [operation, setOperation] = useState<'stitch' | 'segment' | 'simulate' | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const mainRef = useRef<HTMLElement>(null);
  // Presentation-only: what the last run changed, so the screens can show it. The data above is already final.
  const [stitchFx, setStitchFx] = useState<StitchFx | null>(null);
  const [matchRun, setMatchRun] = useState(0);
  const [launchFx, setLaunchFx] = useState<{ campaignId: string; played: boolean } | null>(null);
  const [simulateRun, setSimulateRun] = useState<{ n: number; campaignId: string | null }>({ n: 0, campaignId: null });
  const fxCounter = useRef(0);
  const entered = useRef(false);
  const busy = operation !== null;

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(demo));
    } catch {
      // The in-memory workspace remains available if session storage is full.
    }
  }, [demo]);

  useEffect(() => {
    if (isLoggedIn) {
      entered.current = true;
      window.scrollTo({ top: 0, behavior: 'instant' });
      mainRef.current?.focus({ preventScroll: true });
    } else if (entered.current) {
      window.scrollTo({ top: 0, behavior: 'instant' });
      document.getElementById('landing-main')?.focus({ preventScroll: true });
    }
  }, [isLoggedIn, activeTab]);

  useEffect(() => {
    const id = anchorRef.current;
    anchorRef.current = null;
    const target = id && isLoggedIn ? document.getElementById(id) : null;
    if (target) {
      target.scrollIntoView({ block: 'start' });
      target.focus({ preventScroll: true });
    }
  }, [activeTab, isLoggedIn]);

  // New interests are highlighted on the sources and friends pages only; leaving them ends the highlight.
  const [fxTab, setFxTab] = useState(activeTab);
  if (fxTab !== activeTab) {
    setFxTab(activeTab);
    if (activeTab !== 'collect' && activeTab !== 'profiles') setStitchFx(null);
  }

  function navigate(tab: WorkflowTabId, target?: string) {
    anchorRef.current = target ?? null;
    setActiveTab(tab);
  }

  function notify(tone: ToastItem['tone'], title: string, detail?: string) {
    setToasts((items) => [...items.slice(-2), { id: crypto.randomUUID(), tone, title, detail }]);
  }

  const dismissToast = useCallback((id: string) => {
    setToasts((items) => items.filter((item) => item.id !== id));
  }, []);

  function clearMatches() {
    setMatches([]);
    setDidSegment(false);
    setSegmentSource(null);
  }

  function resetDemo() {
    if (busy || !window.confirm('เริ่มเดโมใหม่และล้างข้อมูลที่คุณเพิ่มกับผลแคมเปญในแท็บนี้?')) return;
    setDemo(initialDemo());
    setStitchFx(null);
    setLaunchFx(null);
    setCampaignPrompt(CAMPAIGN_PRESETS[0]);
    clearMatches();
    setActiveCampaignId(null);
    setActiveTab('profiles');
    setReviewNotice(null);
    setReviewError(null);
    notify('info', 'เริ่มเดโมใหม่แล้ว');
  }

  function addSignal(profileId: string, source: DataSourceType, text: string) {
    const profile = profiles.find((item) => item.id === profileId);
    if (busy || !profile || !text.trim() || text.length > 800) return;
    const record: RawSourceRecord = {
      id: crypto.randomUUID(), source, rawText: text, linkedProfileId: profile.id,
      handle: profile.nickname, timestamp: new Date().toISOString(),
    };
    setDemo((current) => ({
      ...current,
      records: [...current.records, record],
      profiles: current.profiles.map((item) => item.id === profileId ? { ...item, isStitched: false } : item),
    }));
    clearMatches();
    setStitchFx(null);
    notify('info', 'เพิ่มข้อความเข้าคิวแล้ว', 'กดรวมและสกัดข้อมูลเพื่อตรวจว่าพบความสนใจอะไร');
  }

  async function stitch() {
    if (busy) return;
    setOperation('stitch');
    try {
      const result = await runIdentityStitching(profiles, records);
      setDemo((current) => ({ ...current, profiles: result.profiles }));
      clearMatches();
      setStitchFx(buildStitchFx(++fxCounter.current, profiles, result.profiles, records));
      notify('success', `รวมข้อมูลแล้ว ${result.stitchedCount} โปรไฟล์`, result.usedFallback ? 'รวมข้อมูลจากคำที่พบในข้อความตัวอย่าง' : 'ตรวจข้อความอ้างอิงจากผลวิเคราะห์ AI แล้ว');
    } catch {
      notify('warning', 'รวมข้อมูลไม่สำเร็จ', 'ข้อมูลยังอยู่ในคิว ลองกดประมวลผลอีกครั้ง');
    } finally {
      setOperation(null);
    }
  }

  function decideAttribute(profileId: string, attributeId: string, decision: 'verified' | 'rejected') {
    if (busy) return;
    setDemo((current) => {
      const next = applyReviewDecisions({ profiles: current.profiles, approved: current.approved }, [{ profileId, attributeId }], decision);
      return { ...current, profiles: next.profiles, approved: next.approved };
    });
    clearMatches();
  }

  /** Confirms or rejects one or many interests from the review queue and keeps what is needed to undo it. */
  function decideReview(targets: ReviewTarget[], decision: 'verified' | 'rejected') {
    if (busy) return;
    const result = applyReviewDecisions({ profiles, approved }, targets, decision);
    if (!result.snapshot.length) {
      setReviewNotice(null);
      setReviewError('ไม่พบรายการที่เลือก อาจถูกตรวจไปแล้ว');
      return;
    }
    setDemo((current) => ({ ...current, profiles: result.profiles, approved: result.approved }));
    setReviewError(null);
    setReviewNotice({ decision, snapshot: result.snapshot });
    clearMatches();
  }

  function undoReview() {
    if (busy || !reviewNotice) return;
    const restored = undoReviewDecisions({ profiles, approved }, reviewNotice.snapshot);
    setDemo((current) => ({ ...current, profiles: restored.profiles, approved: restored.approved }));
    setReviewNotice(null);
    clearMatches();
    notify('info', `เลิกทำแล้ว ${reviewNotice.snapshot.length} รายการ`, 'ความสนใจกลับไปรอตรวจเหมือนเดิม');
  }

  async function recommend(prompt: string) {
    if (busy) return;
    clearMatches();
    setOperation('segment');
    try {
      const reviewedProfiles = profiles.map((profile) => ({
        ...profile,
        attributes: profile.attributes.filter((attribute) =>
          getEffectiveAttributeStatus(attribute, threshold, manuallyApprovedIds) === 'verified'),
      }));
      const activeBrief = brief && brief.prompt === prompt ? brief : null;
      const result = await segmentCampaign(prompt, reviewedProfiles, activeBrief);
      setMatches(applyBriefToMatches(result.matches, activeBrief, profiles));
      setDidSegment(true);
      setMatchRun((n) => n + 1);
      setSegmentSource(result.source);
    } catch {
      notify('warning', 'ค้นหาผู้รับไม่สำเร็จ', 'ลองกดแนะนำผู้รับคำเชิญอีกครั้ง');
    } finally {
      setOperation(null);
    }
  }

  function launch(name: string, candidates: CampaignMatch[]) {
    if (busy) return;
    const campaign = createCampaign(crypto.randomUUID(), name, new Date().toISOString(), candidates, profiles);
    if (!campaign) return;
    setDemo((current) => ({
      ...current,
      campaigns: [campaign, ...current.campaigns],
      profiles: recordSentInvitations(current.profiles, campaign),
    }));
    setActiveCampaignId(campaign.id);
    setLaunchFx({ campaignId: campaign.id, played: false });
    setActiveTab('analytics');
    clearMatches();
    notify('success', `ส่งคำเชิญจำลองแล้ว ${campaign.matches.length} คน`, 'กดจำลองคำตอบเพื่อดูผลตอบกลับ');
  }

  async function simulate(id: string) {
    const target = campaigns.find((campaign) => campaign.id === id);
    if (busy || !target || target.simulated) return;
    setOperation('simulate');
    try {
      // Replies the organiser pasted are real; only the remaining recipients are simulated.
      const pasted = target.replies.filter((reply) => reply.origin === 'pasted');
      const pastedIds = new Set(pasted.map((reply) => reply.profileId));
      const result = await simulateCampaignResponses(id, target.name, target.matches.filter((match) => !pastedIds.has(match.profileId)), profiles);
      const replies = [...pasted, ...buildReplySummaries(target, result.interactions)];
      setDemo((current) => ({
        ...current,
        profiles: result.profiles,
        campaigns: current.campaigns.map((campaign) => campaign.id === id ? {
          ...campaign, simulated: true, replies,
          closedLoopUpdatesCount: replies.filter((reply) => reply.status !== 'pending').length,
        } : campaign),
      }));
      setSimulateRun((current) => ({ n: current.n + 1, campaignId: id }));
      clearMatches();
    } catch {
      notify('warning', 'จำลองคำตอบไม่สำเร็จ', 'สถานะคำเชิญเดิมยังอยู่ ลองอีกครั้งได้');
    } finally {
      setOperation(null);
    }
  }

  function loadSampleInbox() {
    setDemo((current) => {
      const have = new Set([...current.inbox.map((item) => item.id), ...current.records.map((item) => item.id)]);
      const added = IDENTITY_CASES.filter((item) => !have.has(item.id)).map(({ id, source, handle, rawText, timestamp }) => ({ id, source, handle, rawText, timestamp }));
      return added.length ? { ...current, inbox: [...current.inbox, ...added] } : current;
    });
  }

  function confirmLink(recordId: string, profileId: string) {
    if (busy) return;
    const record = inbox.find((item) => item.id === recordId);
    const linked = record && linkUnlinkedRecord(records, profiles, record, profileId);
    if (!linked) return;
    setDemo((current) => ({ ...current, records: linked.records, profiles: linked.profiles, inbox: current.inbox.filter((item) => item.id !== recordId) }));
    clearMatches();
    notify('info', 'ผูกข้อความกับเพื่อนแล้ว', 'กดรวมและสกัดข้อมูลเพื่ออ่านข้อความนี้เข้าโปรไฟล์');
  }

  function dismissInbox(recordId: string) {
    setDemo((current) => ({ ...current, inbox: current.inbox.filter((item) => item.id !== recordId) }));
  }

  function savePastedReply(campaignId: string, reply: PastedReply) {
    const target = campaigns.find((campaign) => campaign.id === campaignId);
    const applied = target && applyPastedReply(target, profiles, reply, new Date().toISOString());
    if (!applied) return;
    setDemo((current) => ({
      ...current,
      profiles: applied.profiles,
      campaigns: current.campaigns.map((campaign) => (campaign.id === campaignId ? applied.campaign : campaign)),
    }));
    clearMatches();
    notify('success', 'บันทึกคำตอบจริงแล้ว', 'ยอดผลแคมเปญและโปรไฟล์อัปเดตแล้ว');
  }

  const inspectedProfile = profiles.find((profile) => profile.id === inspectedProfileId) ?? null;
  const goToCampaign = () => setActiveTab('segment');
  const goToSources = () => setActiveTab('collect');

  return (
    <MotionConfig reducedMotion="user">
      {isLoggedIn ? (
        <div className="workspace">
          <a href="#main-content" className="skip-link">ข้ามไปยังเนื้อหา</a>
          <TopNavbar activeTab={activeTab} onTabChange={setActiveTab}
            onResetDemo={resetDemo} onReturnToLanding={() => setIsLoggedIn(false)} busy={busy} />
          <main id="main-content" ref={mainRef} tabIndex={-1} className="workspace-main">
            <div className="workspace-content">
            <DemoAccountBanner activeTab={activeTab} onTabChange={setActiveTab} />
            <motion.div key={activeTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.27, ease: 'easeOut' }}>
              {activeTab === 'overview' && <OverviewTab profiles={profiles} records={records} campaigns={campaigns} inbox={inbox} confidenceThreshold={threshold}
                manuallyApprovedIds={manuallyApprovedIds} onNavigate={(tab, anchor) => {
                  if (tab === 'analytics') setActiveCampaignId(campaigns[0]?.id ?? null);
                  navigate(tab, anchor);
                }} />}
              {activeTab === 'profiles' && <UnifiedProfilesTab profiles={profiles} confidenceThreshold={threshold} manuallyApprovedIds={manuallyApprovedIds}
                freshByProfile={stitchFx?.freshByProfile} animateFresh={stitchFx ? !stitchFx.profilesSeen : false}
                onFreshSeen={() => setStitchFx((current) => current && !current.profilesSeen ? { ...current, profilesSeen: true } : current)}
                onSelectProfile={setInspectedProfileId} onGoToSources={goToSources} onGoToCampaign={goToCampaign} />}
              {activeTab === 'collect' && <CollectUnifyTab profiles={profiles} records={records} busy={busy} stitchFx={stitchFx} isStitching={operation === 'stitch'} confidenceThreshold={threshold}
                onThresholdChange={(value) => {
                  setDemo((current) => ({ ...current, threshold: value }));
                  clearMatches();
                }}
                onRunStitching={stitch} onAddSignal={addSignal} onInspectProfile={setInspectedProfileId} onGoToCampaign={goToCampaign}
                inbox={inbox} onLoadSampleInbox={loadSampleInbox} onConfirmLink={confirmLink} onDismissInbox={dismissInbox}
                manuallyApprovedIds={manuallyApprovedIds} reviewNotice={reviewNotice} reviewError={reviewError} onReviewDecide={decideReview}
                onReviewUndo={undoReview} onReviewClear={() => { setReviewNotice(null); setReviewError(null); }} />}
              {activeTab === 'segment' && <CampaignSegmentTab profiles={profiles} records={records} confidenceThreshold={threshold} manuallyApprovedIds={manuallyApprovedIds}
                segmentSource={segmentSource} onInspectProfile={setInspectedProfileId} brief={brief} onBriefChange={setBrief} campaignPrompt={campaignPrompt} matches={matches} busy={busy}
                isSegmenting={operation === 'segment'} didSegment={didSegment} onPromptChange={(prompt) => { setCampaignPrompt(prompt); setBrief(null); clearMatches(); }}
                onMatchesChange={setMatches} onRunSegment={recommend} onLaunchCampaign={launch} onGoToSources={goToSources} runId={matchRun} />}
              {activeTab === 'analytics' && <AnalyticsLoopTab campaigns={campaigns} activeCampaignId={activeCampaignId} profiles={profiles} busy={busy}
                isSimulating={operation === 'simulate'} onSelectCampaign={setActiveCampaignId} onSimulateReplies={simulate}
                onGoToSegmentation={goToCampaign} onInspectProfile={setInspectedProfileId} onSaveReply={savePastedReply}
                launchFx={launchFx} onLaunchPlayed={() => setLaunchFx((current) => current && !current.played ? { ...current, played: true } : current)}
                playbackRun={simulateRun.n} playbackCampaignId={simulateRun.campaignId} />}
              {activeTab === 'ai' && <AiPerformanceTab />}
            </motion.div>
            </div>
          </main>
          <ProfileInspectorDrawer profile={inspectedProfile} records={records} onClose={() => setInspectedProfileId(null)}
            confidenceThreshold={threshold} manuallyApprovedIds={manuallyApprovedIds} onAttributeDecision={decideAttribute} busy={busy} />
          <ToastRegion toasts={toasts} onDismiss={dismissToast} suppressed={inspectedProfile !== null} />
        </div>
      ) : (
        <LandingPage onEnterWorkspace={(tab, prompt) => {
          setActiveTab(tab);
          if (tab === 'segment') {
            setBrief(null);
            setCampaignPrompt(prompt ?? CAMPAIGN_PRESETS[0]);
            clearMatches();
          }
          setIsLoggedIn(true);
        }} />
      )}
    </MotionConfig>
  );
}

export default App;
