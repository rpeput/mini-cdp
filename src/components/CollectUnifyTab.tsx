import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Database,
  GitMerge,
  Loader2,
  RotateCcw,
  Unlink2,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { RAW_SOURCE_RECORDS } from '../data/seedData.ts';
import type { DataSourceType, UnifiedProfile } from '../types/cdp.ts';
import {
  CARD_SURFACE_CLASS,
  SOURCE_META,
  formatDateShort,
  getEffectiveAttributeStatus,
} from '../utils/cdpHelpers.ts';

interface CollectUnifyTabProps {
  profiles: UnifiedProfile[];
  confidenceThreshold: number;
  manuallyApprovedIds: ReadonlySet<string>;
  isStitching: boolean;
  stitchStage: 0 | 1 | 2 | 3;
  onRunStitching: () => Promise<void>;
  onToggleMerge: (profileId: string) => void;
  onAttributeDecision: (
    profileId: string,
    attributeId: string,
    decision: 'verified' | 'rejected',
  ) => void;
  onInspectProfile: (profileId: string) => void;
}

type SourceFilter = 'ALL' | DataSourceType;

const SOURCE_FILTERS: Array<{ id: SourceFilter; label: string }> = [
  { id: 'ALL', label: 'All' },
  { id: 'LINE_CHAT', label: 'LINE_CHAT' },
  { id: 'FACEBOOK_POST', label: 'FACEBOOK_POST' },
  { id: 'DEPT_ROSTER', label: 'DEPT_ROSTER' },
];

const PIPELINE_STEPS = [
  {
    step: 1,
    title: '1. Entity Resolution',
    detail: 'Matching nicknames, handles & roster IDs',
  },
  {
    step: 2,
    title: '2. Attribute Extraction',
    detail: 'Extracting Thai/English traits & quotes',
  },
  {
    step: 3,
    title: '3. Confidence Governance',
    detail: 'Flagging uncertain traits below threshold',
  },
] as const;

export function CollectUnifyTab({
  profiles,
  confidenceThreshold,
  manuallyApprovedIds,
  isStitching,
  stitchStage,
  onRunStitching,
  onToggleMerge,
  onAttributeDecision,
  onInspectProfile,
}: CollectUnifyTabProps) {
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('ALL');

  const unstitchedIds = new Set(
    profiles.filter((p) => !p.isStitched).map((p) => p.id),
  );

  const unmergedRecords = RAW_SOURCE_RECORDS.filter((record) =>
    unstitchedIds.has(record.linkedProfileId),
  );
  const filteredRawRecords =
    sourceFilter === 'ALL'
      ? unmergedRecords
      : unmergedRecords.filter((record) => record.source === sourceFilter);

  const outputProfiles = profiles.filter(
    (profile) => profile.isStitched || profile.attributes.length > 0,
  );
  const stitchedCount = profiles.filter((p) => p.isStitched).length;
  const unstitchedCount = profiles.length - stitchedCount;

  return (
    <section aria-label="Collect and Unify Identity Stitching Lab" className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink-primary sm:text-2xl">
            Identity Stitching Lab
          </h1>
          <p className="mt-1 text-sm text-ink-secondary">
            Resolve unlinked Thai chat handles, social posts, and department
            rosters into verified Single Customer Views.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-data rounded-lg border border-border-subtle bg-surface px-3 py-1.5 text-xs font-medium text-ink-secondary">
            Queue: <strong className="text-ink-primary">{unmergedRecords.length}</strong> raw ·{' '}
            Unified: <strong className="text-status-verified">{stitchedCount}/{profiles.length}</strong>
          </span>
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-12">
        {/* Left Column: Raw Multi-Source Ingestion */}
        <div className={`${CARD_SURFACE_CLASS} flex min-w-0 flex-col lg:col-span-4`}>
          <div className="border-b border-border-subtle p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Database
                  className="h-4 w-4 text-brand-amber-hover"
                  aria-hidden="true"
                />
                <h2 className="text-sm font-semibold tracking-tight text-ink-primary">
                  Raw Multi-Source Ingestion
                </h2>
              </div>
              <span className="font-data rounded-full border border-border-subtle bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-ink-secondary">
                {unmergedRecords.length}
              </span>
            </div>

            <div
              role="tablist"
              aria-label="Filter raw records by source"
              className="mt-3 flex flex-wrap gap-1.5"
            >
              {SOURCE_FILTERS.map((tab) => {
                const count =
                  tab.id === 'ALL'
                    ? unmergedRecords.length
                    : unmergedRecords.filter((r) => r.source === tab.id).length;
                const active = sourceFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setSourceFilter(tab.id)}
                    className={`inline-flex min-h-7 items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 ${
                      active
                        ? 'border-brand-slate bg-brand-slate text-white'
                        : 'border-border-subtle bg-canvas text-ink-secondary hover:text-ink-primary'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className="font-data opacity-80">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="max-h-[34rem] space-y-2.5 overflow-y-auto p-4">
            {filteredRawRecords.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border-subtle bg-canvas p-6 text-center">
                <p className="text-xs font-semibold text-ink-primary">
                  Ingestion queue is empty
                </p>
                <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
                  All records in this channel have been resolved into unified
                  customer profiles.
                </p>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {filteredRawRecords.map((record) => (
                  <motion.div
                    key={record.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.18 }}
                    className="rounded-lg border border-border-subtle bg-canvas p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span
                        className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${SOURCE_META[record.source].badgeClass}`}
                      >
                        {record.source}
                      </span>
                      <span className="font-data text-[11px] text-ink-secondary">
                        {formatDateShort(record.timestamp)}
                      </span>
                    </div>
                    <p className="mt-1.5 break-words font-data text-xs font-semibold text-ink-primary">
                      @{record.handle}
                    </p>
                    <p className="mt-1 break-words text-xs leading-relaxed text-ink-secondary font-thai">
                      "{record.rawText}"
                    </p>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>

        {/* Center Pipeline Action */}
        <div className={`${CARD_SURFACE_CLASS} p-5 lg:col-span-3`}>
          <div className="space-y-4">
            <div>
              <span className="text-[11px] font-semibold tracking-wider text-brand-amber-hover uppercase">
                AI Resolution Pipeline
              </span>
              <h2 className="mt-1 text-sm font-semibold tracking-tight text-ink-primary">
                Hybrid Identity Stitcher
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
                Cross-references handles, Thai nicknames, and context cues to
                unify profiles and extract grounded traits.
              </p>
            </div>

            <motion.button
              type="button"
              whileTap={{ scale: 0.985 }}
              disabled={isStitching || unstitchedCount === 0}
              aria-busy={isStitching}
              onClick={onRunStitching}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-slate px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
            >
              {isStitching ? (
                <>
                  <Loader2
                    className="h-4 w-4 animate-spin text-brand-amber"
                    aria-hidden="true"
                  />
                  <span>Stitching Profiles…</span>
                </>
              ) : unstitchedCount === 0 ? (
                <>
                  <Check className="h-4 w-4 text-status-verified" aria-hidden="true" />
                  <span>All 15 Profiles Unified</span>
                </>
              ) : (
                <>
                  <GitMerge className="h-4 w-4 text-brand-amber" aria-hidden="true" />
                  <span>Run AI Identity Stitching ({unstitchedCount})</span>
                </>
              )}
            </motion.button>

            <div className="space-y-2 border-t border-border-subtle pt-4">
              {PIPELINE_STEPS.map((item) => {
                const isActive = isStitching && stitchStage === item.step;
                const isDone =
                  (!isStitching && unstitchedCount === 0) ||
                  stitchStage > item.step;
                return (
                  <div
                    key={item.step}
                    className={`rounded-lg border px-3 py-2.5 transition-colors ${
                      isActive
                        ? 'border-brand-amber bg-brand-amber-soft/70'
                        : isDone
                          ? 'border-emerald-200 bg-emerald-50/70'
                          : 'border-border-subtle bg-canvas'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-ink-primary">
                        {item.title}
                      </span>
                      {isActive ? (
                        <Loader2
                          className="h-3.5 w-3.5 animate-spin text-brand-amber-hover"
                          aria-hidden="true"
                        />
                      ) : isDone ? (
                        <Check
                          className="h-3.5 w-3.5 text-status-verified"
                          aria-hidden="true"
                        />
                      ) : (
                        <ArrowRight
                          className="h-3.5 w-3.5 text-ink-secondary"
                          aria-hidden="true"
                        />
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-ink-secondary">
                      {item.detail}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Single Customer View Output */}
        <div className={`${CARD_SURFACE_CLASS} flex min-w-0 flex-col lg:col-span-5`}>
          <div className="flex items-center justify-between gap-2 border-b border-border-subtle p-4">
            <div className="flex items-center gap-2">
              <GitMerge
                className="h-4 w-4 text-status-verified"
                aria-hidden="true"
              />
              <h2 className="text-sm font-semibold tracking-tight text-ink-primary">
                Single Customer View Output
              </h2>
            </div>
            <span className="font-data text-xs font-medium text-ink-secondary">
              {stitchedCount} active · Gate {confidenceThreshold}%
            </span>
          </div>

          <div className="max-h-[34rem] space-y-3 overflow-y-auto p-4">
            {outputProfiles.map((profile) => {
              const reviewAttrs = profile.attributes.filter(
                (attr) =>
                  getEffectiveAttributeStatus(
                    attr,
                    confidenceThreshold,
                    manuallyApprovedIds,
                  ) === 'needs_review',
              );

              return (
                <div
                  key={profile.id}
                  className={`rounded-xl border p-3.5 transition-colors ${
                    profile.isStitched
                      ? 'border-border-subtle bg-surface'
                      : 'border-rose-200 bg-rose-50/40'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onInspectProfile(profile.id)}
                      aria-label={`Inspect ${profile.nickname} profile`}
                      className="flex min-w-0 items-center gap-2.5 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
                    >
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                        style={{ backgroundColor: profile.avatarColor }}
                        aria-hidden="true"
                      >
                        {profile.avatarInitials}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-semibold text-ink-primary font-thai">
                            {profile.nickname}
                          </span>
                          <span className="text-xs text-ink-secondary font-thai">
                            {profile.fullName}
                          </span>
                        </div>
                        <p className="font-data text-[11px] text-ink-secondary">
                          {profile.studentId}
                        </p>
                      </div>
                    </button>

                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.985 }}
                      onClick={() => onToggleMerge(profile.id)}
                      aria-label={
                        profile.isStitched
                          ? `Unmerge ${profile.nickname}`
                          : `Re-merge ${profile.nickname}`
                      }
                      className={`inline-flex min-h-7 items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 ${
                        profile.isStitched
                          ? 'border-border-subtle bg-canvas text-ink-secondary hover:border-rose-300 hover:bg-rose-50 hover:text-rose-800'
                          : 'border-amber-300 bg-brand-amber-soft text-amber-900 hover:bg-amber-200/70'
                      }`}
                    >
                      {profile.isStitched ? (
                        <>
                          <Unlink2 className="h-3 w-3" aria-hidden="true" />
                          <span>Unmerge</span>
                        </>
                      ) : (
                        <>
                          <RotateCcw className="h-3 w-3" aria-hidden="true" />
                          <span>Re-merge</span>
                        </>
                      )}
                    </motion.button>
                  </div>

                  {/* Linked Source Badges */}
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    {profile.isStitched ? (
                      profile.mergedSources.map((src) => (
                        <span
                          key={src.id}
                          className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${SOURCE_META[src.source].badgeClass}`}
                        >
                          {SOURCE_META[src.source].shortLabel} · @{src.handle}
                        </span>
                      ))
                    ) : (
                      <span className="rounded border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-800">
                        Unmerged — 3 records returned to queue
                      </span>
                    )}
                  </div>

                  {/* Quick Governance Actions for Needs Review Attributes */}
                  {profile.isStitched && reviewAttrs.length > 0 ? (
                    <div className="mt-3 space-y-2 border-t border-border-subtle pt-2.5">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-900">
                        <AlertTriangle
                          className="h-3.5 w-3.5 text-brand-amber-hover"
                          aria-hidden="true"
                        />
                        <span>
                          Below {confidenceThreshold}% Gate — Quick Review
                        </span>
                      </div>
                      {reviewAttrs.map((attr) => (
                        <div
                          key={attr.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300/80 bg-brand-amber-soft/50 px-2.5 py-1.5"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-ink-primary font-thai">
                              {attr.value}{' '}
                              <span className="font-data text-[11px] text-amber-900">
                                ({attr.confidence}%)
                              </span>
                            </p>
                            <p className="truncate text-[11px] text-ink-secondary font-thai">
                              "{attr.evidenceQuote}"
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <motion.button
                              type="button"
                              whileTap={{ scale: 0.985 }}
                              onClick={() =>
                                onAttributeDecision(
                                  profile.id,
                                  attr.id,
                                  'verified',
                                )
                              }
                              aria-label={`Approve attribute ${attr.value}`}
                              className="inline-flex min-h-7 min-w-7 items-center justify-center rounded border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
                            >
                              <Check className="h-3.5 w-3.5" aria-hidden="true" />
                            </motion.button>
                            <motion.button
                              type="button"
                              whileTap={{ scale: 0.985 }}
                              onClick={() =>
                                onAttributeDecision(
                                  profile.id,
                                  attr.id,
                                  'rejected',
                                )
                              }
                              aria-label={`Reject attribute ${attr.value}`}
                              className="inline-flex min-h-7 min-w-7 items-center justify-center rounded border border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
                            >
                              <X className="h-3.5 w-3.5" aria-hidden="true" />
                            </motion.button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
