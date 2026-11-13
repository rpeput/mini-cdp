import { MotionConfig } from 'framer-motion';
import { useCallback, useState } from 'react';
import { AnalyticsLoopTab } from './components/AnalyticsLoopTab.tsx';
import { CampaignSegmentTab } from './components/CampaignSegmentTab.tsx';
import { CollectUnifyTab } from './components/CollectUnifyTab.tsx';
import { LoginGate } from './components/LoginGate.tsx';
import { ProfileInspectorDrawer } from './components/ProfileInspectorDrawer.tsx';
import { type ToastItem, ToastRegion } from './components/ToastRegion.tsx';
import { TopNavbar } from './components/TopNavbar.tsx';
import { UnifiedProfilesTab } from './components/UnifiedProfilesTab.tsx';
import { XRayDrawer } from './components/XRayDrawer.tsx';
import {
  CAMPAIGN_PRESETS,
  INITIAL_PROFILES,
  RAW_SOURCE_RECORDS,
} from './data/seedData.ts';
import {
  runIdentityStitching,
  segmentCampaign,
  simulateCampaignResponses,
} from './services/aiEngine.ts';
import type {
  CampaignMatch,
  CampaignRecord,
  PipelineLog,
  UnifiedProfile,
  WorkflowTabId,
} from './types/cdp.ts';
import { countNeedsReviewAttributes } from './utils/cdpHelpers.ts';

function cloneInitialProfiles(): UnifiedProfile[] {
  return INITIAL_PROFILES.map((profile) => ({
    ...profile,
    attributes: profile.attributes.map((attr) => ({ ...attr })),
    mergedSources: profile.mergedSources.map((src) => ({ ...src })),
    campaignHistory: profile.campaignHistory.map((item) => ({ ...item })),
  }));
}

let toastCounter = 0;

export function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState<WorkflowTabId>('collect');
  const [profiles, setProfiles] = useState<UnifiedProfile[]>(() =>
    cloneInitialProfiles(),
  );
  const [confidenceThreshold, setConfidenceThreshold] = useState(75);
  const [manuallyApprovedIds, setManuallyApprovedIds] = useState<Set<string>>(
    () => new Set(),
  );

  const [campaignPrompt, setCampaignPrompt] = useState(CAMPAIGN_PRESETS[0]);
  const [segmentMatches, setSegmentMatches] = useState<CampaignMatch[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);

  const [pipelineLogs, setPipelineLogs] = useState<PipelineLog[]>([]);
  const [inspectedProfileId, setInspectedProfileId] = useState<string | null>(
    null,
  );
  const [isXRayOpen, setIsXRayOpen] = useState(false);

  const [isStitching, setIsStitching] = useState(false);
  const [stitchStage, setStitchStage] = useState<0 | 1 | 2 | 3>(0);
  const [isSegmenting, setIsSegmenting] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const pushToast = useCallback(
    (tone: ToastItem['tone'], title: string, detail?: string) => {
      toastCounter += 1;
      const id = `toast_${Date.now()}_${toastCounter}`;
      setToasts((prev) => [...prev.slice(-2), { id, tone, title, detail }]);
    },
    [],
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const appendLogs = useCallback((logs: PipelineLog[]) => {
    setPipelineLogs((prev) => [...logs, ...prev].slice(0, 60));
  }, []);

  const handleLogin = (openXRay: boolean) => {
    setIsLoggedIn(true);
    setIsXRayOpen(openXRay);
    pushToast(
      'info',
      openXRay
        ? 'Entered AI Lead X-Ray Workspace'
        : 'Signed into Mini CDP Workspace',
      'Loaded 15 Computing Dept profiles and 45 multi-source signals.',
    );
  };

  const handleResetDemo = () => {
    setProfiles(cloneInitialProfiles());
    setConfidenceThreshold(75);
    setManuallyApprovedIds(new Set());
    setCampaignPrompt(CAMPAIGN_PRESETS[0]);
    setSegmentMatches([]);
    setCampaigns([]);
    setActiveCampaignId(null);
    setPipelineLogs([]);
    setInspectedProfileId(null);
    setStitchStage(0);
    setActiveTab('collect');
    pushToast(
      'info',
      'Demo Workspace Reset',
      'Restored 5 pre-stitched profiles and 30 pending queue records.',
    );
  };

  const handleRunStitching = async () => {
    setIsStitching(true);
    setStitchStage(1);
    await new Promise((r) => setTimeout(r, 220));
    setStitchStage(2);
    const result = await runIdentityStitching(profiles);
    setStitchStage(3);
    await new Promise((r) => setTimeout(r, 220));

    setProfiles(result.profiles);
    appendLogs(result.logs);
    setIsStitching(false);
    setStitchStage(0);

    pushToast(
      'success',
      `Unified ${result.stitchedCount} Profiles`,
      `Resolved all remaining raw records across LINE, Facebook, and Dept Roster.`,
    );
  };

  const handleToggleMerge = (profileId: string) => {
    let wasStitched = false;
    setProfiles((prev) =>
      prev.map((profile) => {
        if (profile.id !== profileId) {
          return profile;
        }
        wasStitched = profile.isStitched;
        const mergedSources = profile.isStitched
          ? []
          : RAW_SOURCE_RECORDS.filter((r) => r.linkedProfileId === profile.id);
        return {
          ...profile,
          isStitched: !profile.isStitched,
          mergedSources,
        };
      }),
    );

    pushToast(
      wasStitched ? 'warning' : 'success',
      wasStitched ? 'Profile Unmerged' : 'Profile Re-merged',
      wasStitched
        ? 'Returned 3 raw records back to the ingestion queue.'
        : 'Restored linked LINE, Facebook, and Roster sources.',
    );
  };

  const handleAttributeDecision = (
    profileId: string,
    attributeId: string,
    decision: 'verified' | 'rejected',
  ) => {
    setProfiles((prev) =>
      prev.map((profile) => {
        if (profile.id !== profileId) {
          return profile;
        }
        return {
          ...profile,
          attributes: profile.attributes.map((attr) =>
            attr.id === attributeId ? { ...attr, status: decision } : attr,
          ),
        };
      }),
    );

    setManuallyApprovedIds((prev) => {
      const next = new Set(prev);
      if (decision === 'verified') {
        next.add(attributeId);
      } else {
        next.delete(attributeId);
      }
      return next;
    });

    pushToast(
      decision === 'verified' ? 'success' : 'warning',
      decision === 'verified' ? 'Attribute Verified' : 'Attribute Rejected',
    );
  };

  const handleRunSegment = async (prompt: string) => {
    setIsSegmenting(true);
    const result = await segmentCampaign(prompt, profiles);
    setSegmentMatches(result.matches);
    appendLogs(result.logs);
    setIsSegmenting(false);

    const directCount = result.matches.filter(
      (m) => m.tier === 'direct',
    ).length;
    const lookalikeCount = result.matches.length - directCount;
    pushToast(
      'success',
      'Semantic Segmentation Ready',
      `Found ${directCount} direct matches and ${lookalikeCount} lookalike candidates.`,
    );
  };

  const handleLaunchCampaign = (
    campaignName: string,
    matches: CampaignMatch[],
  ) => {
    const selected = matches.filter((m) => m.selected);
    if (selected.length === 0) {
      return;
    }

    const newCampaign: CampaignRecord = {
      id: `camp_${Date.now()}`,
      name: campaignName,
      createdAt: new Date().toISOString(),
      matches: matches.map((m) => ({ ...m })),
      simulated: false,
      closedLoopUpdatesCount: 0,
      replies: [],
    };

    setCampaigns((prev) => [newCampaign, ...prev]);
    setActiveCampaignId(newCampaign.id);
    setActiveTab('analytics');
    appendLogs([
      {
        id: `log_launch_${Date.now()}`,
        timestamp: new Date().toISOString(),
        step: 'Campaign Launched',
        detail: `Queued ${selected.length} personalized Thai LINE invitations for "${campaignName}".`,
        latencyMs: 14,
      },
    ]);

    pushToast(
      'success',
      `Launched "${campaignName}"`,
      `Sent to ${selected.length} consented recipients. Click Simulate Friend Replies next.`,
    );
  };

  const handleSimulateReplies = async (campaignId: string) => {
    const targetCampaign = campaigns.find((c) => c.id === campaignId);
    if (!targetCampaign) {
      return;
    }

    setIsSimulating(true);
    const result = await simulateCampaignResponses(
      targetCampaign.name,
      targetCampaign.matches,
      profiles,
    );

    const matchTierByProfile = new Map(
      targetCampaign.matches.map((m) => [m.profileId, m.tier]),
    );

    setProfiles(result.profiles);
    appendLogs(result.logs);

    setCampaigns((prev) =>
      prev.map((camp) => {
        if (camp.id !== campaignId) {
          return camp;
        }
        return {
          ...camp,
          simulated: true,
          closedLoopUpdatesCount: result.interactions.length,
          replies: result.interactions.map((entry) => ({
            profileId: entry.profileId,
            status: entry.interaction.status,
            replyText: entry.interaction.replyText ?? '',
            tier: matchTierByProfile.get(entry.profileId) ?? 'direct',
            feedbackTag: entry.feedbackAttribute.value,
            feedbackCategory: entry.feedbackAttribute.category,
          })),
        };
      }),
    );

    setIsSimulating(false);
    pushToast(
      'success',
      'Closed-Loop CDP Sync Complete',
      `Updated ${result.interactions.length} profiles with real campaign feedback tags.`,
    );
  };

  const unstitchedIds = new Set(
    profiles.filter((p) => !p.isStitched).map((p) => p.id),
  );
  const unmergedCount = RAW_SOURCE_RECORDS.filter((r) =>
    unstitchedIds.has(r.linkedProfileId),
  ).length;
  const stitchedCount = profiles.filter((p) => p.isStitched).length;
  const needsReviewCount = countNeedsReviewAttributes(
    profiles,
    confidenceThreshold,
    manuallyApprovedIds,
  );
  const inspectedProfile =
    profiles.find((p) => p.id === inspectedProfileId) ?? null;

  return (
    <MotionConfig reducedMotion="user">
      {!isLoggedIn ? (
        <LoginGate onLogin={handleLogin} />
      ) : (
        <div className="min-h-dvh overflow-x-hidden bg-canvas text-ink-primary">
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-brand-slate focus:px-3 focus:py-2 focus:text-xs focus:font-semibold focus:text-white focus:ring-2 focus:ring-amber-500/50 focus:outline-none"
          >
            Skip to main content
          </a>
          <TopNavbar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            unmergedCount={unmergedCount}
            stitchedCount={stitchedCount}
            totalProfiles={profiles.length}
            campaignCount={campaigns.length}
            needsReviewCount={needsReviewCount}
            confidenceThreshold={confidenceThreshold}
            onThresholdChange={setConfidenceThreshold}
            isXRayOpen={isXRayOpen}
            onToggleXRay={() => setIsXRayOpen((prev) => !prev)}
            onResetDemo={handleResetDemo}
          />

          <main
            id="main-content"
            className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8"
          >
            {activeTab === 'collect' ? (
              <CollectUnifyTab
                profiles={profiles}
                confidenceThreshold={confidenceThreshold}
                manuallyApprovedIds={manuallyApprovedIds}
                isStitching={isStitching}
                stitchStage={stitchStage}
                onRunStitching={handleRunStitching}
                onToggleMerge={handleToggleMerge}
                onAttributeDecision={handleAttributeDecision}
                onInspectProfile={setInspectedProfileId}
              />
            ) : null}

            {activeTab === 'profiles' ? (
              <UnifiedProfilesTab
                profiles={profiles}
                confidenceThreshold={confidenceThreshold}
                manuallyApprovedIds={manuallyApprovedIds}
                onSelectProfile={setInspectedProfileId}
              />
            ) : null}

            {activeTab === 'segment' ? (
              <CampaignSegmentTab
                profiles={profiles}
                campaignPrompt={campaignPrompt}
                onPromptChange={setCampaignPrompt}
                matches={segmentMatches}
                onMatchesChange={setSegmentMatches}
                isSegmenting={isSegmenting}
                onRunSegment={handleRunSegment}
                onLaunchCampaign={handleLaunchCampaign}
              />
            ) : null}

            {activeTab === 'analytics' ? (
              <AnalyticsLoopTab
                campaigns={campaigns}
                activeCampaignId={activeCampaignId}
                onSelectCampaign={setActiveCampaignId}
                profiles={profiles}
                isSimulating={isSimulating}
                onSimulateReplies={handleSimulateReplies}
                onGoToSegmentation={() => setActiveTab('segment')}
                onInspectProfile={setInspectedProfileId}
                onGoToProfiles={() => setActiveTab('profiles')}
              />
            ) : null}
          </main>

          <ProfileInspectorDrawer
            profile={inspectedProfile}
            onClose={() => setInspectedProfileId(null)}
            confidenceThreshold={confidenceThreshold}
            manuallyApprovedIds={manuallyApprovedIds}
            onAttributeDecision={handleAttributeDecision}
          />

          <XRayDrawer
            open={isXRayOpen}
            onClose={() => setIsXRayOpen(false)}
            profiles={profiles}
            pipelineLogs={pipelineLogs}
            confidenceThreshold={confidenceThreshold}
            campaignCount={campaigns.length}
          />

          <ToastRegion
            toasts={toasts}
            onDismiss={dismissToast}
            suppressed={inspectedProfile !== null || isXRayOpen}
          />
        </div>
      )}
    </MotionConfig>
  );
}

export default App;
