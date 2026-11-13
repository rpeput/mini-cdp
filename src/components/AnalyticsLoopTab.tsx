import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Loader2,
  MessageSquare,
  RefreshCw,
  Sparkles,
  XCircle,
} from 'lucide-react';
import type { CampaignRecord, UnifiedProfile } from '../types/cdp.ts';
import { CARD_SURFACE_CLASS } from '../utils/cdpHelpers.ts';

interface AnalyticsLoopTabProps {
  campaigns: CampaignRecord[];
  activeCampaignId: string | null;
  onSelectCampaign: (campaignId: string) => void;
  profiles: UnifiedProfile[];
  isSimulating: boolean;
  onSimulateReplies: (campaignId: string) => Promise<void>;
  onGoToSegmentation: () => void;
  onInspectProfile: (profileId: string) => void;
  onGoToProfiles: () => void;
}

export function AnalyticsLoopTab({
  campaigns,
  activeCampaignId,
  onSelectCampaign,
  profiles,
  isSimulating,
  onSimulateReplies,
  onGoToSegmentation,
  onInspectProfile,
  onGoToProfiles,
}: AnalyticsLoopTabProps) {
  const profileMap = new Map(profiles.map((p) => [p.id, p]));
  const activeCampaign =
    campaigns.find((c) => c.id === activeCampaignId) ??
    campaigns[0] ??
    null;

  if (!activeCampaign) {
    return (
      <section aria-label="Campaign Analytics and Closed-Loop Feedback">
        <div className={`${CARD_SURFACE_CLASS} p-10 text-center`}>
          <Activity
            className="mx-auto h-7 w-7 text-brand-amber-hover"
            aria-hidden="true"
          />
          <h1 className="mt-3 text-lg font-bold tracking-tight text-ink-primary">
            No Campaigns Launched Yet
          </h1>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-ink-secondary">
            Build a target segment in Tab 3 and click "Launch Campaign to
            Selected" to track acceptance rates and run Closed-Loop feedback
            simulation.
          </p>
          <motion.button
            type="button"
            whileTap={{ scale: 0.985 }}
            onClick={onGoToSegmentation}
            className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand-slate px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
          >
            <Sparkles className="h-4 w-4 text-brand-amber" aria-hidden="true" />
            <span>Go to AI Segmentation</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </motion.button>
        </div>
      </section>
    );
  }

  const selectedTargets = activeCampaign.matches.filter((m) => m.selected);
  const totalSent = selectedTargets.length;
  const acceptedReplies = activeCampaign.replies.filter(
    (r) => r.status === 'accepted',
  );
  const acceptedRate =
    activeCampaign.simulated && totalSent > 0
      ? Math.round((acceptedReplies.length / totalSent) * 100)
      : 0;

  const lookalikeSent = selectedTargets.filter(
    (m) => m.tier === 'lookalike',
  ).length;
  const lookalikeAccepted = activeCampaign.replies.filter(
    (r) => r.tier === 'lookalike' && r.status === 'accepted',
  ).length;
  const lookalikeRate =
    activeCampaign.simulated && lookalikeSent > 0
      ? Math.round((lookalikeAccepted / lookalikeSent) * 100)
      : 0;

  return (
    <section
      aria-label="Campaign Analytics and Closed-Loop Feedback"
      className="space-y-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink-primary sm:text-2xl">
            Campaign Analytics & Closed-Loop Sync
          </h1>
          <p className="mt-1 text-sm text-ink-secondary font-thai">
            Active Campaign: <strong className="text-ink-primary">{activeCampaign.name}</strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {campaigns.length > 1 ? (
            <select
              name="campaignSelect"
              aria-label="Select launched campaign"
              value={activeCampaign.id}
              onChange={(e) => onSelectCampaign(e.target.value)}
              className="min-h-10 rounded-lg border border-border-subtle bg-surface px-3 py-2 text-xs font-medium text-ink-primary focus:border-brand-amber focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 font-thai"
            >
              {campaigns.map((camp) => (
                <option key={camp.id} value={camp.id}>
                  {camp.name}
                </option>
              ))}
            </select>
          ) : null}

          <motion.button
            type="button"
            whileTap={{ scale: 0.985 }}
            aria-busy={isSimulating}
            disabled={isSimulating || activeCampaign.simulated}
            onClick={() => onSimulateReplies(activeCampaign.id)}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand-slate px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
          >
            {isSimulating ? (
              <>
                <Loader2
                  className="h-4 w-4 animate-spin text-brand-amber"
                  aria-hidden="true"
                />
                <span>Simulating Replies…</span>
              </>
            ) : activeCampaign.simulated ? (
              <>
                <CheckCircle2
                  className="h-4 w-4 text-status-verified"
                  aria-hidden="true"
                />
                <span>Simulation Complete</span>
              </>
            ) : (
              <>
                <MessageSquare
                  className="h-4 w-4 text-brand-amber"
                  aria-hidden="true"
                />
                <span>Simulate Friend Replies</span>
              </>
            )}
          </motion.button>
        </div>
      </div>

      {/* 4 Crisp KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className={`${CARD_SURFACE_CLASS} p-4`}>
          <span className="text-xs font-medium text-ink-secondary">
            Total Sent
          </span>
          <p className="font-data mt-2 text-2xl font-bold tracking-tight text-ink-primary">
            {totalSent}
          </p>
          <p className="mt-1 text-xs text-ink-secondary">
            Consented Thai LINE invites
          </p>
        </div>

        <div className={`${CARD_SURFACE_CLASS} p-4`}>
          <span className="text-xs font-medium text-ink-secondary">
            Accepted Rate
          </span>
          <p className="font-data mt-2 text-2xl font-bold tracking-tight text-status-verified">
            {activeCampaign.simulated ? `${acceptedRate}%` : '—'}
          </p>
          <p className="mt-1 font-data text-xs text-ink-secondary">
            {activeCampaign.simulated
              ? `${acceptedReplies.length}/${totalSent} accepted`
              : 'Awaiting reply simulation'}
          </p>
        </div>

        <div className={`${CARD_SURFACE_CLASS} p-4`}>
          <span className="text-xs font-medium text-ink-secondary">
            Lookalike Conversion
          </span>
          <p className="font-data mt-2 text-2xl font-bold tracking-tight text-brand-amber-hover">
            {activeCampaign.simulated
              ? lookalikeSent > 0
                ? `${lookalikeRate}%`
                : 'N/A'
              : '—'}
          </p>
          <p className="mt-1 font-data text-xs text-ink-secondary">
            {lookalikeSent > 0
              ? `${lookalikeAccepted}/${lookalikeSent} lookalike converted`
              : '0 lookalike targets included'}
          </p>
        </div>

        <div className={`${CARD_SURFACE_CLASS} p-4`}>
          <span className="text-xs font-medium text-ink-secondary">
            Closed-Loop Profile Updates
          </span>
          <p className="font-data mt-2 text-2xl font-bold tracking-tight text-ink-primary">
            {activeCampaign.closedLoopUpdatesCount}
          </p>
          <p className="mt-1 text-xs text-ink-secondary">
            New attributes synced back to CDP
          </p>
        </div>
      </div>

      {/* Closed-Loop CDP Sync Banner */}
      {activeCampaign.simulated ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-xl border border-amber-300 bg-brand-amber-soft p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <RefreshCw
                className="mt-0.5 h-4 w-4 shrink-0 text-brand-amber-hover"
                aria-hidden="true"
              />
              <div>
                <h2 className="text-sm font-semibold text-amber-950">
                  Closed-Loop CDP Sync Active
                </h2>
                <p className="mt-0.5 text-xs leading-relaxed text-amber-900 font-thai">
                  Wrote {activeCampaign.closedLoopUpdatesCount} new behavioral
                  attributes back onto UnifiedProfile records. Inspect any
                  friend in Tab 2 to verify the synced tags and reply quotes.
                </p>
              </div>
            </div>
            <motion.button
              type="button"
              whileTap={{ scale: 0.985 }}
              onClick={onGoToProfiles}
              className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-amber-400 bg-surface px-3 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
            >
              <span>Verify in Tab 2</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </motion.button>
          </div>
        </motion.div>
      ) : null}

      {/* Outgoing Invites / Simulated Replies Stream */}
      <div className={`${CARD_SURFACE_CLASS} divide-y divide-border-subtle`}>
        <div className="flex items-center justify-between px-5 py-3.5">
          <h2 className="text-sm font-semibold tracking-tight text-ink-primary">
            {activeCampaign.simulated
              ? 'Simulated Thai Chat Replies & Synced Traits'
              : 'Dispatched Personalized Invitations'}
          </h2>
          <span className="font-data text-xs text-ink-secondary">
            {totalSent} recipients
          </span>
        </div>

        <AnimatePresence initial={false}>
          {activeCampaign.simulated
            ? activeCampaign.replies.map((reply, idx) => {
                const profile = profileMap.get(reply.profileId);
                if (!profile) {
                  return null;
                }
                const accepted = reply.status === 'accepted';
                return (
                  <motion.div
                    key={reply.profileId}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.24,
                      delay: idx * 0.05,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-start"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                        style={{ backgroundColor: profile.avatarColor }}
                        aria-hidden="true"
                      >
                        {profile.avatarInitials}
                      </div>
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-ink-primary font-thai">
                            {profile.nickname}
                          </span>
                          <span className="text-xs text-ink-secondary font-thai">
                            {profile.fullName}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                              accepted
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                : 'border-rose-200 bg-rose-50 text-rose-800'
                            }`}
                          >
                            {accepted ? (
                              <CheckCircle2
                                className="h-3 w-3 text-status-verified"
                                aria-hidden="true"
                              />
                            ) : (
                              <XCircle
                                className="h-3 w-3 text-status-declined"
                                aria-hidden="true"
                              />
                            )}
                            <span>{accepted ? 'Accepted' : 'Declined'}</span>
                          </span>
                        </div>
                        <p className="break-words rounded-lg border border-border-subtle bg-canvas px-3 py-2 text-xs leading-relaxed text-ink-primary font-thai">
                          "{reply.replyText}"
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                      <span className="rounded-md border border-amber-300 bg-brand-amber-soft px-2.5 py-1 text-[11px] font-semibold text-amber-950 font-thai">
                        Synced Tag: {reply.feedbackTag}
                      </span>
                      <button
                        type="button"
                        aria-label={`Inspect profile for ${profile.nickname} (${profile.fullName})`}
                        onClick={() => onInspectProfile(profile.id)}
                        className="text-xs font-medium text-brand-amber-hover hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
                      >
                        Inspect Profile →
                      </button>
                    </div>
                  </motion.div>
                );
              })
            : selectedTargets.map((match) => {
                const profile = profileMap.get(match.profileId);
                if (!profile) {
                  return null;
                }
                return (
                  <div
                    key={match.profileId}
                    className="flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                        style={{ backgroundColor: profile.avatarColor }}
                        aria-hidden="true"
                      >
                        {profile.avatarInitials}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-ink-primary font-thai">
                            {profile.nickname}
                          </span>
                          <span className="font-data rounded border border-border-subtle bg-canvas px-1.5 py-0.5 text-[11px] text-ink-secondary">
                            {match.tier} · {match.matchScore}%
                          </span>
                        </div>
                        <p className="mt-1 break-words text-xs leading-relaxed text-ink-secondary font-thai">
                          "{match.personalizedInvite}"
                        </p>
                      </div>
                    </div>

                    <span className="shrink-0 rounded-full border border-amber-300 bg-brand-amber-soft px-2.5 py-0.5 text-[11px] font-medium text-amber-900">
                      Pending Reply
                    </span>
                  </div>
                );
              })}
        </AnimatePresence>
      </div>
    </section>
  );
}
