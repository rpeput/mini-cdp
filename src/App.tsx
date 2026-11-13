import { MotionConfig, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AnalyticsLoopTab } from './components/AnalyticsLoopTab.tsx';
import { CampaignSegmentTab } from './components/CampaignSegmentTab.tsx';
import { CollectUnifyTab } from './components/CollectUnifyTab.tsx';
import { LandingPage } from './components/LandingPage.tsx';
import { ProfileInspectorDrawer } from './components/ProfileInspectorDrawer.tsx';
import { type ToastItem, ToastRegion } from './components/ToastRegion.tsx';
import { DemoAccountBanner } from './components/DemoAccountBanner.tsx';
import { TopNavbar } from './components/TopNavbar.tsx';
import { UnifiedProfilesTab } from './components/UnifiedProfilesTab.tsx';
import { XRayDrawer } from './components/XRayDrawer.tsx';
import { CAMPAIGN_PRESETS, INITIAL_PROFILES, RAW_SOURCE_RECORDS } from './data/seedData.ts';
import { runIdentityStitching, segmentCampaign, simulateCampaignResponses } from './services/aiEngine.ts';
import type { CampaignMatch, CampaignRecord, DataSourceType, PipelineLog, RawSourceRecord, UnifiedProfile, WorkflowTabId } from './types/cdp.ts';
import { buildReplySummaries, createCampaign, recordSentInvitations } from './utils/campaignFlow.ts';
import { getEffectiveAttributeStatus } from './utils/cdpHelpers.ts';
import './App.css';

const storageKey = 'gather-demo-v1';

interface DemoData {
  records: RawSourceRecord[];
  profiles: UnifiedProfile[];
  campaigns: CampaignRecord[];
  logs: PipelineLog[];
  approved: string[];
  threshold: number;
}

function initialDemo(): DemoData {
  return { profiles: INITIAL_PROFILES, records: RAW_SOURCE_RECORDS, campaigns: [], logs: [], approved: [], threshold: 75 };
}

function loadDemo(): DemoData {
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null') as DemoData | null;
    if (saved && Array.isArray(saved.profiles) && Array.isArray(saved.records) &&
      Array.isArray(saved.campaigns) && Array.isArray(saved.logs) && Array.isArray(saved.approved) &&
      Number.isFinite(saved.threshold)) return saved;
  } catch {
    // The demo remains usable if storage is blocked or its contents are invalid.
  }
  return initialDemo();
}

export function App() {
  const [demo, setDemo] = useState(loadDemo);
  const { profiles, records, campaigns, logs, threshold, approved } = demo;
  const manuallyApprovedIds = new Set(approved);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState<WorkflowTabId>('profiles');
  const [campaignPrompt, setCampaignPrompt] = useState(CAMPAIGN_PRESETS[0]);
  const [matches, setMatches] = useState<CampaignMatch[]>([]);
  const [didSegment, setDidSegment] = useState(false);
  const [segmentSource, setSegmentSource] = useState<'model' | 'local' | null>(null);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [inspectedProfileId, setInspectedProfileId] = useState<string | null>(null);
  const [isXRayOpen, setIsXRayOpen] = useState(false);
  const [operation, setOperation] = useState<'stitch' | 'segment' | 'simulate' | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const mainRef = useRef<HTMLElement>(null);
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
    setCampaignPrompt(CAMPAIGN_PRESETS[0]);
    clearMatches();
    setActiveCampaignId(null);
    setActiveTab('profiles');
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
    notify('info', 'เพิ่มข้อความเข้าคิวแล้ว', 'กดรวมและสกัดข้อมูลเพื่อตรวจว่าพบความสนใจอะไร');
  }

  async function stitch() {
    if (busy) return;
    setOperation('stitch');
    try {
      const result = await runIdentityStitching(profiles, records);
      setDemo((current) => ({ ...current, profiles: result.profiles, logs: [...result.logs, ...current.logs].slice(0, 60) }));
      clearMatches();
      notify('success', `รวมข้อมูลแล้ว ${result.stitchedCount} โปรไฟล์`, result.usedFallback ? 'สกัดด้วยกฎจากข้อความตัวอย่าง' : 'ตรวจข้อความอ้างอิงจากผลวิเคราะห์ AI แล้ว');
    } catch {
      notify('warning', 'รวมข้อมูลไม่สำเร็จ', 'ข้อมูลยังอยู่ในคิว ลองกดประมวลผลอีกครั้ง');
    } finally {
      setOperation(null);
    }
  }

  function decideAttribute(profileId: string, attributeId: string, decision: 'verified' | 'rejected') {
    if (busy) return;
    setDemo((current) => ({
      ...current,
      approved: decision === 'verified' ? [...new Set([...current.approved, attributeId])] : current.approved.filter((id) => id !== attributeId),
      profiles: current.profiles.map((profile) => profile.id === profileId ? {
        ...profile, attributes: profile.attributes.map((attribute) => attribute.id === attributeId ? { ...attribute, status: decision } : attribute),
      } : profile),
    }));
    clearMatches();
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
      const result = await segmentCampaign(prompt, reviewedProfiles);
      setDemo((current) => ({ ...current, logs: [...result.logs, ...current.logs].slice(0, 60) }));
      setMatches(result.matches);
      setDidSegment(true);
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
    setActiveTab('analytics');
    clearMatches();
    notify('success', `ส่งคำเชิญจำลองแล้ว ${campaign.matches.length} คน`, 'กดจำลองคำตอบเพื่อดูผลตอบกลับ');
  }

  async function simulate(id: string) {
    const target = campaigns.find((campaign) => campaign.id === id);
    if (busy || !target || target.simulated) return;
    setOperation('simulate');
    try {
      const result = await simulateCampaignResponses(id, target.name, target.matches, profiles);
      const replies = buildReplySummaries(target, result.interactions);
      setDemo((current) => ({
        ...current,
        profiles: result.profiles,
        logs: [...result.logs, ...current.logs].slice(0, 60),
        campaigns: current.campaigns.map((campaign) => campaign.id === id ? {
          ...campaign, simulated: true, replies,
          closedLoopUpdatesCount: replies.filter((reply) => reply.status !== 'pending').length,
        } : campaign),
      }));
      clearMatches();
    } catch {
      notify('warning', 'จำลองคำตอบไม่สำเร็จ', 'สถานะคำเชิญเดิมยังอยู่ ลองอีกครั้งได้');
    } finally {
      setOperation(null);
    }
  }

  const inspectedProfile = profiles.find((profile) => profile.id === inspectedProfileId) ?? null;
  const goToCampaign = () => setActiveTab('segment');
  const goToSources = () => setActiveTab('collect');

  return (
    <MotionConfig reducedMotion="user">
      {isLoggedIn ? (
        <div className="workspace">
          <a href="#main-content" className="skip-link">ข้ามไปยังเนื้อหา</a>
          <TopNavbar activeTab={activeTab} onTabChange={setActiveTab} onToggleXRay={() => setIsXRayOpen(true)}
            onResetDemo={resetDemo} onReturnToLanding={() => setIsLoggedIn(false)} busy={busy} />
          <main id="main-content" ref={mainRef} tabIndex={-1} className="workspace-main">
            <DemoAccountBanner activeTab={activeTab} friendCount={profiles.length} onTabChange={setActiveTab} />
            <motion.div key={activeTab} className="workspace-content" initial={{ y: 5 }} animate={{ y: 0 }} transition={{ duration: 0.18 }}>
              {activeTab === 'profiles' && <UnifiedProfilesTab profiles={profiles} confidenceThreshold={threshold} manuallyApprovedIds={manuallyApprovedIds}
                onSelectProfile={setInspectedProfileId} onGoToSources={goToSources} onGoToCampaign={goToCampaign} />}
              {activeTab === 'collect' && <CollectUnifyTab profiles={profiles} records={records} busy={busy} isStitching={operation === 'stitch'} confidenceThreshold={threshold}
                onThresholdChange={(value) => {
                  setDemo((current) => ({ ...current, threshold: value }));
                  clearMatches();
                }}
                onRunStitching={stitch} onAddSignal={addSignal} onInspectProfile={setInspectedProfileId} onGoToCampaign={goToCampaign} />}
              {activeTab === 'segment' && <CampaignSegmentTab profiles={profiles} records={records} confidenceThreshold={threshold} manuallyApprovedIds={manuallyApprovedIds}
                segmentSource={segmentSource} onInspectProfile={setInspectedProfileId} campaignPrompt={campaignPrompt} matches={matches} busy={busy}
                isSegmenting={operation === 'segment'} didSegment={didSegment} onPromptChange={(prompt) => { setCampaignPrompt(prompt); clearMatches(); }}
                onMatchesChange={setMatches} onRunSegment={recommend} onLaunchCampaign={launch} onGoToSources={goToSources} />}
              {activeTab === 'analytics' && <AnalyticsLoopTab campaigns={campaigns} activeCampaignId={activeCampaignId} profiles={profiles} busy={busy}
                isSimulating={operation === 'simulate'} onSelectCampaign={setActiveCampaignId} onSimulateReplies={simulate}
                onGoToSegmentation={goToCampaign} onInspectProfile={setInspectedProfileId} />}
            </motion.div>
          </main>
          <ProfileInspectorDrawer profile={inspectedProfile} records={records} onClose={() => setInspectedProfileId(null)}
            confidenceThreshold={threshold} manuallyApprovedIds={manuallyApprovedIds} onAttributeDecision={decideAttribute} busy={busy} />
          <XRayDrawer open={isXRayOpen} onClose={() => setIsXRayOpen(false)} pipelineLogs={logs} />
          <ToastRegion toasts={toasts} onDismiss={dismissToast} suppressed={inspectedProfile !== null || isXRayOpen} />
        </div>
      ) : (
        <LandingPage onEnterWorkspace={(tab) => {
          setActiveTab(tab);
          if (tab === 'segment') {
            setCampaignPrompt(CAMPAIGN_PRESETS[0]);
            clearMatches();
          }
          setIsLoggedIn(true);
        }} />
      )}
    </MotionConfig>
  );
}

export default App;
