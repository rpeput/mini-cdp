import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  GitCommitHorizontal,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { useId } from 'react';
import type { CampaignRecord, UnifiedProfile } from '../types/cdp.ts';
import { CARD_SURFACE_CLASS, CATEGORY_META } from '../utils/cdpHelpers.ts';

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
  const selectId = useId();
  const profileMap = new Map(profiles.map((p) => [p.id, p]));
  const activeCampaign =
    campaigns.find((c) => c.id === activeCampaignId) ??
    campaigns[0] ??
    null;

  if (!activeCampaign) {
    return (
      <section aria-label="Loop Analytics and Profile Sync">
        <div className={`${CARD_SURFACE_CLASS} p-10 text-center`}>
          <Activity
            className="mx-auto h-7 w-7 text-brand-amber-hover"
            aria-hidden="true"
          />
          <h1 className="mt-3 text-lg font-bold tracking-tight text-ink-primary">
            No Campaigns Launched Yet
          </h1>
          <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-ink-secondary font-thai">
            สร้างกลุ่มเป้าหมายใน Customer Studio (Stage 3) แล้วกด &quot;Launch
            Campaign to Selected&quot; เพื่อติดตามผลลัพธ์และซิงก์ข้อมูลกลับเข้าโปรไฟล์อัตโนมัติ
          </p>
          <motion.button
            type="button"
            whileTap={{ scale: 0.985 }}
            onClick={onGoToSegmentation}
            className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand-slate px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
          >
            <Sparkles className="h-4 w-4 text-brand-amber" aria-hidden="true" />
            <span>Open Customer Studio</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </motion.button>
        </div>
      </section>
    );
  }

  const selectedTargets = activeCampaign.matches.filter((m) => m.selected);
  const totalSent = selectedTargets.length;
  const directSent = selectedTargets.filter((m) => m.tier === 'direct').length;
  const lookalikeSent = selectedTargets.filter(
    (m) => m.tier === 'lookalike',
  ).length;

  const acceptedReplies = activeCampaign.replies.filter(
    (r) => r.status === 'accepted',
  );
  const declinedReplies = activeCampaign.replies.filter(
    (r) => r.status === 'declined',
  );

  const acceptedRate =
    activeCampaign.simulated && totalSent > 0
      ? Math.round((acceptedReplies.length / totalSent) * 100)
      : 0;
  const declinedRate =
    activeCampaign.simulated && totalSent > 0
      ? Math.round((declinedReplies.length / totalSent) * 100)
      : 0;

  const lookalikeAccepted = activeCampaign.replies.filter(
    (r) => r.tier === 'lookalike' && r.status === 'accepted',
  ).length;
  const lookalikeRate =
    activeCampaign.simulated && lookalikeSent > 0
      ? Math.round((lookalikeAccepted / lookalikeSent) * 100)
      : 0;

  const directSharePct =
    totalSent > 0 ? Math.round((directSent / totalSent) * 100) : 0;
  const lookalikeSharePct = totalSent > 0 ? 100 - directSharePct : 0;

  const inviteByProfile = new Map(
    activeCampaign.matches.map((m) => [m.profileId, m]),
  );

  return (
    <section
      aria-label="Campaign Analytics and Closed-Loop Feedback"
      className="space-y-6"
    >
      {/* Top Guided Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface px-2.5 py-0.5 text-[11px] font-semibold text-ink-secondary">
            <Activity
              className="h-3 w-3 text-brand-amber-hover"
              aria-hidden="true"
            />
            <span>Stage 4 · Closed-Loop Attribution &amp; Profile Sync</span>
          </div>
          <h1 className="mt-2 text-xl font-bold tracking-tight text-ink-primary sm:text-2xl">
            Loop Analytics &amp; Profile Write-Back
          </h1>
          <p className="mt-1 text-sm text-ink-secondary font-thai">
            Active Campaign:{' '}
            <strong className="font-semibold text-ink-primary">
              {activeCampaign.name}
            </strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {campaigns.length > 1 ? (
            <div className="flex items-center gap-2">
              <label htmlFor={selectId} className="sr-only">
                Select launched campaign
              </label>
              <select
                id={selectId}
                name="campaignSelect"
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
            </div>
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

      {/* 4 Real KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className={`${CARD_SURFACE_CLASS} p-4`}>
          <span className="text-xs font-medium text-ink-secondary">
            Total Dispatched
          </span>
          <p className="font-data mt-2 text-2xl font-bold tracking-tight text-ink-primary">
            {totalSent}
          </p>
          <p className="mt-1 font-data text-xs text-ink-secondary">
            {directSent} Direct · {lookalikeSent} Lookalike
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
            Closed-Loop Synced
          </span>
          <p className="font-data mt-2 text-2xl font-bold tracking-tight text-ink-primary">
            {activeCampaign.closedLoopUpdatesCount}
          </p>
          <p className="mt-1 text-xs text-ink-secondary">
            New traits written to Customer 360
          </p>
        </div>
      </div>

      {/* Real Conversion & Audience Funnel Progress Bar (strictly real counts) */}
      <div className={`${CARD_SURFACE_CLASS} p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-ink-primary">
              {activeCampaign.simulated
                ? 'Campaign Response Breakdown & CDP Write-Back'
                : 'Target Audience Composition'}
            </h2>
            <p className="text-xs text-ink-secondary font-thai">
              {activeCampaign.simulated
                ? 'สัดส่วนคำตอบจริงจากการจำลองและจำนวน Attribute ใหม่ที่เขียนกลับเข้า Golden Record'
                : 'สัดส่วนกลุ่ม Direct และ Lookalike ที่พร้อมรับการจำลองผลตอบรับทาง LINE'}
            </p>
          </div>
          <span className="font-data text-xs font-semibold text-ink-primary">
            {totalSent} recipients
          </span>
        </div>

        <div
          className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-zinc-100"
          role="img"
          aria-label={
            activeCampaign.simulated
              ? `Campaign responses: ${acceptedReplies.length} accepted, ${declinedReplies.length} declined`
              : `Audience mix: ${directSent} direct, ${lookalikeSent} lookalike`
          }
        >
          {activeCampaign.simulated ? (
            <>
              {acceptedRate > 0 ? (
                <div
                  key="bar-accepted"
                  style={{ width: `${acceptedRate}%` }}
                  className="bg-status-verified"
                />
              ) : null}
              {declinedRate > 0 ? (
                <div
                  key="bar-declined"
                  style={{ width: `${declinedRate}%` }}
                  className="bg-status-declined"
                />
              ) : null}
            </>
          ) : (
            <>
              {directSharePct > 0 ? (
                <div
                  key="bar-direct"
                  style={{ width: `${directSharePct}%` }}
                  className="bg-brand-slate"
                />
              ) : null}
              {lookalikeSharePct > 0 ? (
                <div
                  key="bar-lookalike"
                  style={{ width: `${lookalikeSharePct}%` }}
                  className="bg-brand-amber"
                />
              ) : null}
            </>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs">
          {activeCampaign.simulated ? (
            <>
              <span className="inline-flex items-center gap-1.5 font-medium text-ink-primary">
                <CheckCircle2
                  className="h-3.5 w-3.5 text-status-verified"
                  aria-hidden="true"
                />
                <span>Accepted:</span>
                <strong className="font-data">
                  {acceptedReplies.length} ({acceptedRate}%)
                </strong>
              </span>
              <span className="inline-flex items-center gap-1.5 font-medium text-ink-primary">
                <XCircle
                  className="h-3.5 w-3.5 text-status-declined"
                  aria-hidden="true"
                />
                <span>Declined:</span>
                <strong className="font-data">
                  {declinedReplies.length} ({declinedRate}%)
                </strong>
              </span>
              <span className="inline-flex items-center gap-1.5 font-medium text-amber-900">
                <RefreshCw
                  className="h-3.5 w-3.5 text-brand-amber-hover"
                  aria-hidden="true"
                />
                <span>CDP Traits Synced:</span>
                <strong className="font-data">
                  +{activeCampaign.closedLoopUpdatesCount}
                </strong>
              </span>
            </>
          ) : (
            <>
              <span className="inline-flex items-center gap-1.5 font-medium text-ink-primary">
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 rounded-sm bg-brand-slate"
                />
                <span>Direct Match:</span>
                <strong className="font-data">
                  {directSent} ({directSharePct}%)
                </strong>
              </span>
              <span className="inline-flex items-center gap-1.5 font-medium text-ink-primary">
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 rounded-sm bg-brand-amber"
                />
                <span>Lookalike Expansion:</span>
                <strong className="font-data">
                  {lookalikeSent} ({lookalikeSharePct}%)
                </strong>
              </span>
            </>
          )}
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
                  เขียน Behavioral Attribute ใหม่จำนวน{' '}
                  <strong className="font-data">
                    {activeCampaign.closedLoopUpdatesCount}
                  </strong>{' '}
                  รายการกลับลงใน UnifiedProfile แล้ว สามารถเปิดดูได้ทันทีใน Customer
                  360
                </p>
              </div>
            </div>
            <motion.button
              type="button"
              whileTap={{ scale: 0.985 }}
              onClick={onGoToProfiles}
              className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-amber-400 bg-surface px-3 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
            >
              <span>Verify in Customer 360</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </motion.button>
          </div>
        </motion.div>
      ) : null}

      {/* Outgoing Invites / 3-Step Closed-Loop Diff Cards */}
      <div className={`${CARD_SURFACE_CLASS} divide-y divide-border-subtle`}>
        <div className="flex items-center justify-between px-5 py-3.5">
          <h2 className="text-sm font-semibold tracking-tight text-ink-primary">
            {activeCampaign.simulated
              ? '3-Step Closed-Loop Attribution Trace'
              : 'Dispatched Personalized LINE Invitations'}
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
                const outboundMatch = inviteByProfile.get(reply.profileId);
                const categoryMeta = CATEGORY_META[reply.feedbackCategory];

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
                    className="space-y-4 p-5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                          style={{ backgroundColor: profile.avatarColor }}
                          aria-hidden="true"
                        >
                          {profile.avatarInitials}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-ink-primary font-thai">
                              {profile.nickname}
                            </span>
                            <span className="text-xs text-ink-secondary font-thai">
                              {profile.fullName}
                            </span>
                            <span className="font-data rounded border border-border-subtle bg-canvas px-1.5 py-0.5 text-[10px] uppercase text-ink-secondary">
                              {reply.tier}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
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

                        <button
                          type="button"
                          aria-label={`Inspect updated profile for ${profile.nickname} (${profile.fullName})`}
                          onClick={() => onInspectProfile(profile.id)}
                          className="rounded text-xs font-semibold text-brand-amber-hover hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
                        >
                          Inspect Updated Profile →
                        </button>
                      </div>
                    </div>

                    {/* 3-Step Trace Grid: Outbound -> Reply -> CDP Trait Diff */}
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="rounded-lg border border-border-subtle bg-canvas p-3">
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-secondary">
                          <Send className="h-3 w-3" aria-hidden="true" />
                          <span>1. Outbound LINE Invite</span>
                        </div>
                        <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-ink-secondary font-thai">
                          &quot;
                          {outboundMatch?.personalizedInvite ??
                            activeCampaign.name}
                          &quot;
                        </p>
                      </div>

                      <div className="rounded-lg border border-border-subtle bg-canvas p-3">
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-secondary">
                          <MessageSquare
                            className="h-3 w-3 text-brand-amber-hover"
                            aria-hidden="true"
                          />
                          <span>2. Thai Customer Reply</span>
                        </div>
                        <p className="mt-1.5 text-xs leading-relaxed text-ink-primary font-thai">
                          &quot;{reply.replyText}&quot;
                        </p>
                      </div>

                      <div className="rounded-lg border border-amber-300 bg-brand-amber-soft/65 p-3">
                        <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-amber-950">
                          <span className="inline-flex items-center gap-1.5">
                            <GitCommitHorizontal
                              className="h-3.5 w-3.5 text-brand-amber-hover"
                              aria-hidden="true"
                            />
                            <span>3. CDP Profile Write-Back</span>
                          </span>
                          <span
                            className={`rounded border px-1.5 py-0.2 text-[10px] ${categoryMeta.badgeClass}`}
                          >
                            {categoryMeta.label}
                          </span>
                        </div>
                        <p className="mt-2 inline-flex items-center gap-1 rounded border border-amber-300 bg-surface px-2 py-1 text-xs font-semibold text-amber-950 font-thai">
                          <span>+ {reply.feedbackTag}</span>
                        </p>
                      </div>
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
                          &quot;{match.personalizedInvite}&quot;
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
