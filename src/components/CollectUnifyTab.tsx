import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Database,
  GitMerge,
  Loader2,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Unlink2,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { RAW_SOURCE_RECORDS } from '../data/seedData.ts';
import type { DataSourceType, UnifiedProfile } from '../types/cdp.ts';
import {
  CARD_SURFACE_CLASS,
  CATEGORY_META,
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
    detail: 'Fuzzy-matching Thai nicknames, LINE handles & roster IDs',
  },
  {
    step: 2,
    title: '2. Attribute Extraction',
    detail: 'Extracting lifestyle traits + verbatim bilingual quotes',
  },
  {
    step: 3,
    title: '3. Confidence Governance',
    detail: 'Enforcing evidence citations above threshold gate',
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
  const [focusedProfileId, setFocusedProfileId] = useState<string | null>(
    () => profiles.find((p) => !p.isStitched)?.id ?? profiles[0]?.id ?? null,
  );

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

  const focusedProfile =
    profiles.find((p) => p.id === focusedProfileId) ??
    profiles.find((p) => !p.isStitched) ??
    profiles[0];

  const focusedSources = focusedProfile
    ? RAW_SOURCE_RECORDS.filter(
        (record) => record.linkedProfileId === focusedProfile.id,
      )
    : [];

  return (
    <section
      aria-label="Collect and Unify Identity Stitching Lab"
      className="space-y-6"
    >
      {/* Top Guided Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface px-2.5 py-0.5 text-[11px] font-semibold text-ink-secondary">
            <GitMerge
              className="h-3 w-3 text-brand-amber-hover"
              aria-hidden="true"
            />
            <span>Stage 1 · Composable Identity Graph</span>
          </div>
          <h1 className="mt-2 text-xl font-bold tracking-tight text-ink-primary sm:text-2xl">
            Identity Resolution &amp; Source Stitching
          </h1>
          <p className="mt-1 text-sm leading-relaxed text-ink-secondary font-thai">
            เชื่อมข้อมูลที่ชื่อและแฮนเดิลไม่ตรงกันจาก LINE, Facebook และ Roster
            เข้าด้วยกันเป็นโปรไฟล์เดียวที่ตรวจสอบหลักฐานอ้างอิงได้ทุกแท็ก
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <span className="font-data rounded-lg border border-border-subtle bg-surface px-3 py-2 text-xs font-medium text-ink-secondary">
            Queue:{' '}
            <strong className="text-ink-primary">
              {unmergedRecords.length}
            </strong>{' '}
            signals · Golden Records:{' '}
            <strong className="text-status-verified">
              {stitchedCount}/{profiles.length}
            </strong>
          </span>

          <motion.button
            type="button"
            whileTap={{ scale: 0.985 }}
            disabled={isStitching || unstitchedCount === 0}
            onClick={() => void onRunStitching()}
            className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-brand-slate px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
          >
            {isStitching ? (
              <>
                <Loader2
                  className="h-3.5 w-3.5 animate-spin text-brand-amber"
                  aria-hidden="true"
                />
                <span>Resolving Identities…</span>
              </>
            ) : unstitchedCount === 0 ? (
              <>
                <CheckCircle2
                  className="h-3.5 w-3.5 text-emerald-400"
                  aria-hidden="true"
                />
                <span>All 15 Unified</span>
              </>
            ) : (
              <>
                <Sparkles
                  className="h-3.5 w-3.5 text-brand-amber"
                  aria-hidden="true"
                />
                <span>Stitch {unstitchedCount} Queued Friends</span>
              </>
            )}
          </motion.button>
        </div>
      </div>

      {/* Interactive 3-to-1 Visual Identity Resolution Graph */}
      {focusedProfile ? (
        <div className={`${CARD_SURFACE_CLASS} overflow-hidden`}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle bg-canvas px-4 py-3 sm:px-5">
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-ink-primary">
                Interactive 3-to-1 Identity Graph
              </h2>
              <p className="text-xs text-ink-secondary font-thai">
                เลือกโปรไฟล์ด้านล่างหรือคลิกรายการในคิวเพื่อดูวิธีรวมแฮนเดิลต่างช่องทางเป็น Golden Record
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {profiles.map((profile) => {
                const isFocused = profile.id === focusedProfile.id;
                return (
                  <button
                    key={profile.id}
                    type="button"
                    aria-pressed={isFocused}
                    onClick={() => setFocusedProfileId(profile.id)}
                    className={`inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 font-thai ${
                      isFocused
                        ? 'border-brand-slate bg-brand-slate text-white'
                        : 'border-border-subtle bg-surface text-ink-secondary hover:border-zinc-300 hover:text-ink-primary'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`h-1.5 w-1.5 rounded-full ${
                        profile.isStitched
                          ? isFocused
                            ? 'bg-emerald-400'
                            : 'bg-status-verified'
                          : 'bg-brand-amber'
                      }`}
                    />
                    <span>{profile.nickname}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="cdp-grid-backdrop grid items-center gap-4 p-4 sm:p-5 lg:grid-cols-12">
            {/* Left: 3 Disconnected Signal Nodes */}
            <div className="space-y-2.5 lg:col-span-5">
              {focusedSources.map((record) => {
                const meta = SOURCE_META[record.source];
                return (
                  <div
                    key={record.id}
                    className="rounded-lg border border-border-subtle bg-surface p-3 shadow-[0_1px_2px_rgba(9,9,11,0.04)]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full border px-2 py-0.5 font-data text-[10px] font-semibold ${meta.badgeClass}`}
                        >
                          {meta.label}
                        </span>
                        <span className="font-data text-xs font-semibold text-ink-primary">
                          {record.handle}
                        </span>
                      </div>
                      <span className="font-data text-[10px] text-ink-secondary">
                        {formatDateShort(record.timestamp)}
                      </span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-ink-secondary font-thai">
                      "{record.rawText}"
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Center: SVG Resolution Connector + Engine State */}
            <div className="flex flex-col items-center justify-center gap-3 lg:col-span-3">
              <svg
                viewBox="0 0 180 64"
                className="hidden h-12 w-full text-zinc-300 lg:block"
                aria-hidden="true"
              >
                <path
                  d="M 8 10 C 65 10, 85 32, 165 32"
                  fill="none"
                  stroke={focusedProfile.isStitched ? '#059669' : '#D97706'}
                  strokeWidth="1.75"
                  strokeDasharray={focusedProfile.isStitched ? undefined : '4 4'}
                />
                <path
                  d="M 8 32 L 165 32"
                  fill="none"
                  stroke={focusedProfile.isStitched ? '#059669' : '#D97706'}
                  strokeWidth="1.75"
                  strokeDasharray={focusedProfile.isStitched ? undefined : '4 4'}
                />
                <path
                  d="M 8 54 C 65 54, 85 32, 165 32"
                  fill="none"
                  stroke={focusedProfile.isStitched ? '#059669' : '#D97706'}
                  strokeWidth="1.75"
                  strokeDasharray={focusedProfile.isStitched ? undefined : '4 4'}
                />
                <circle
                  cx="168"
                  cy="32"
                  r="4"
                  fill={focusedProfile.isStitched ? '#059669' : '#D97706'}
                />
              </svg>

              <div className="w-full rounded-xl border border-border-subtle bg-surface p-3.5 text-center shadow-[0_1px_2px_rgba(9,9,11,0.04)]">
                <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-secondary">
                  <GitMerge
                    className="h-3.5 w-3.5 text-brand-amber-hover"
                    aria-hidden="true"
                  />
                  <span>AI Match Core</span>
                </div>

                <div className="mt-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                      focusedProfile.isStitched
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : 'border-amber-300 bg-brand-amber-soft text-amber-900'
                    }`}
                  >
                    {focusedProfile.isStitched ? (
                      <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                    ) : (
                      <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                    )}
                    <span>
                      {focusedProfile.isStitched
                        ? 'Resolved Golden Record'
                        : 'Queued · 3 Disjoint IDs'}
                    </span>
                  </span>
                </div>

                <p className="mt-2 font-data text-[11px] text-ink-secondary">
                  Gate ≥ {confidenceThreshold}% · Student ID{' '}
                  {focusedProfile.studentId}
                </p>

                {focusedProfile.attributes.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => onToggleMerge(focusedProfile.id)}
                    className="mt-2.5 inline-flex min-h-7 items-center gap-1 rounded-md border border-border-subtle bg-canvas px-2.5 py-1 text-[11px] font-medium text-ink-secondary transition-colors hover:bg-zinc-100 hover:text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
                  >
                    {focusedProfile.isStitched ? (
                      <>
                        <Unlink2 className="h-3 w-3" aria-hidden="true" />
                        <span>Unmerge to Queue</span>
                      </>
                    ) : (
                      <>
                        <RotateCcw className="h-3 w-3" aria-hidden="true" />
                        <span>Re-merge Record</span>
                      </>
                    )}
                  </button>
                ) : null}
              </div>
            </div>

            {/* Right: 1 Single Customer View Node */}
            <div className="lg:col-span-4">
              <div className="rounded-xl border border-border-subtle bg-surface p-4 shadow-[0_1px_2px_rgba(9,9,11,0.04),0_4px_12px_rgba(9,9,11,0.03)]">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ backgroundColor: focusedProfile.avatarColor }}
                      aria-hidden="true"
                    >
                      {focusedProfile.avatarInitials}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="truncate text-sm font-bold text-ink-primary font-thai">
                          {focusedProfile.nickname}
                        </h3>
                        <span className="font-data text-[11px] text-ink-secondary">
                          {focusedProfile.studentId}
                        </span>
                      </div>
                      <p className="truncate text-xs text-ink-secondary font-thai">
                        {focusedProfile.fullName}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                      focusedProfile.consentPdpa
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : 'border-rose-200 bg-rose-50 text-rose-800'
                    }`}
                  >
                    {focusedProfile.consentPdpa ? (
                      <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                    ) : (
                      <ShieldAlert className="h-3 w-3" aria-hidden="true" />
                    )}
                    <span>
                      {focusedProfile.consentPdpa ? 'PDPA OK' : 'Opt-Out'}
                    </span>
                  </span>
                </div>

                {focusedProfile.attributes.length === 0 ? (
                  <div className="mt-3 rounded-lg border border-dashed border-amber-300 bg-brand-amber-soft/50 p-3">
                    <p className="text-xs font-medium text-amber-950 font-thai">
                      ยังไม่ได้สกัด Attributes · กด "Stitch Queued Friends" เพื่อผสาน {focusedSources.length} ช่องทางนี้เข้าด้วยกัน
                    </p>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {focusedProfile.attributes.map((attr) => {
                      const effective = getEffectiveAttributeStatus(
                        attr,
                        confidenceThreshold,
                        manuallyApprovedIds,
                      );
                      const pillStyle =
                        effective === 'rejected'
                          ? 'border-rose-200 bg-rose-50 text-rose-800 line-through opacity-75'
                          : effective === 'needs_review'
                            ? 'border-amber-300 bg-brand-amber-soft text-amber-900'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-900';

                      return (
                        <span
                          key={attr.id}
                          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium font-thai ${pillStyle}`}
                        >
                          <span className="font-data text-[10px] uppercase opacity-75">
                            {CATEGORY_META[attr.category].label}:
                          </span>
                          <span>{attr.value}</span>
                          <span className="font-data text-[10px]">
                            {attr.confidence}%
                          </span>
                        </span>
                      );
                    })}
                  </div>
                )}

                <div className="mt-3 flex items-center justify-between border-t border-border-subtle pt-2.5 text-xs">
                  <span className="font-data text-[11px] text-ink-secondary">
                    {focusedProfile.mergedSources.length} merged ·{' '}
                    {focusedProfile.attributes.length} traits
                  </span>
                  <button
                    type="button"
                    onClick={() => onInspectProfile(focusedProfile.id)}
                    className="font-semibold text-brand-amber-hover hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 rounded"
                  >
                    Inspect Evidence →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Bottom 3-Column Execution Workbench */}
      <div className="grid items-start gap-6 lg:grid-cols-12">
        {/* Left Column: Raw Multi-Source Ingestion */}
        <div
          className={`${CARD_SURFACE_CLASS} flex min-w-0 flex-col lg:col-span-4`}
        >
          <div className="border-b border-border-subtle p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Database
                  className="h-4 w-4 text-brand-amber-hover"
                  aria-hidden="true"
                />
                <h2 className="text-sm font-semibold tracking-tight text-ink-primary">
                  Raw Multi-Source Queue
                </h2>
              </div>
              <span className="font-data rounded-full border border-border-subtle bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-ink-secondary">
                {unmergedRecords.length}
              </span>
            </div>

            <div
              role="group"
              aria-label="Filter raw records by source"
              className="mt-3 flex flex-wrap gap-1.5"
            >
              {SOURCE_FILTERS.map((tab) => {
                const count =
                  tab.id === 'ALL'
                    ? unmergedRecords.length
                    : unmergedRecords.filter((r) => r.source === tab.id).length;
                const isActive = sourceFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setSourceFilter(tab.id)}
                    className={`inline-flex min-h-7 items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 ${
                      isActive
                        ? 'border-brand-slate bg-brand-slate text-white'
                        : 'border-border-subtle bg-canvas text-ink-secondary hover:text-ink-primary'
                    }`}
                  >
                    <span>
                      {tab.id === 'ALL'
                        ? 'All'
                        : SOURCE_META[tab.id].shortLabel}
                    </span>
                    <span
                      className={`font-data text-[10px] ${
                        isActive ? 'text-amber-300' : 'text-ink-secondary'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="max-h-[500px] space-y-2.5 overflow-y-auto p-4">
            {filteredRawRecords.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border-subtle bg-canvas p-6 text-center">
                <p className="text-sm font-semibold text-ink-primary">
                  Ingestion queue is empty
                </p>
                <p className="mt-1 text-xs text-ink-secondary">
                  All 45 source records have been stitched into Customer 360
                  profiles.
                </p>
              </div>
            ) : (
              filteredRawRecords.map((record) => {
                const meta = SOURCE_META[record.source];
                const isSelected = focusedProfile?.id === record.linkedProfileId;
                return (
                  <motion.button
                    key={record.id}
                    type="button"
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                    onClick={() => setFocusedProfileId(record.linkedProfileId)}
                    className={`w-full rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 ${
                      isSelected
                        ? 'border-brand-amber bg-brand-amber-soft/35'
                        : 'border-border-subtle bg-canvas hover:border-zinc-300 hover:bg-surface'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 font-data text-[11px] font-medium ${meta.badgeClass}`}
                      >
                        {meta.label}
                      </span>
                      <span className="font-data text-[11px] text-ink-secondary">
                        {formatDateShort(record.timestamp)}
                      </span>
                    </div>
                    <p className="font-data mt-2 text-xs font-semibold text-ink-primary">
                      {record.handle}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-ink-secondary font-thai">
                      {record.rawText}
                    </p>
                  </motion.button>
                );
              })
            )}
          </div>
        </div>

        {/* Center Column: Hybrid AI Identity Stitcher */}
        <div
          className={`${CARD_SURFACE_CLASS} flex min-w-0 flex-col justify-between p-5 lg:col-span-3`}
        >
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-300 bg-brand-amber-soft text-brand-amber-hover">
                <GitMerge className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-sm font-semibold tracking-tight text-ink-primary">
                  AI Identity Stitcher
                </h2>
                <p className="text-xs text-ink-secondary">
                  Hybrid Cloud + Local Resolver
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {PIPELINE_STEPS.map((item) => {
                const isDone = isStitching
                  ? stitchStage > item.step
                  : unstitchedCount === 0;
                const isCurrent = isStitching && stitchStage === item.step;

                return (
                  <div
                    key={item.step}
                    className={`rounded-lg border p-3 transition-colors ${
                      isCurrent
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
                      {isCurrent ? (
                        <Loader2
                          className="h-3.5 w-3.5 animate-spin text-brand-amber-hover"
                          aria-hidden="true"
                        />
                      ) : isDone ? (
                        <Check
                          className="h-3.5 w-3.5 text-status-verified"
                          aria-hidden="true"
                        />
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-ink-secondary">
                      {item.detail}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 space-y-3 border-t border-border-subtle pt-4">
            <motion.button
              type="button"
              whileTap={{ scale: 0.985 }}
              disabled={isStitching || unstitchedCount === 0}
              onClick={() => void onRunStitching()}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-slate px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
            >
              {isStitching ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>Stitching Profiles…</span>
                </>
              ) : unstitchedCount === 0 ? (
                <>
                  <Check className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                  <span>All 15 Friends Unified</span>
                </>
              ) : (
                <>
                  <span>Run AI Stitcher</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </>
              )}
            </motion.button>

            <p className="text-center font-data text-[11px] text-ink-secondary">
              {unstitchedCount > 0
                ? `${unstitchedCount} profiles (${unmergedRecords.length} signals) waiting`
                : 'Unmerge any card on the right to re-test live stitching'}
            </p>
          </div>
        </div>

        {/* Right Column: Single Customer View Output */}
        <div
          className={`${CARD_SURFACE_CLASS} flex min-w-0 flex-col lg:col-span-5`}
        >
          <div className="flex items-center justify-between gap-2 border-b border-border-subtle p-4">
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-ink-primary">
                Governed Customer Outputs
              </h2>
              <p className="text-xs text-ink-secondary">
                Inspect confidence governance, verbatim quotes &amp; merge state
              </p>
            </div>
            <span className="font-data rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
              {outputProfiles.length} processed
            </span>
          </div>

          <div className="max-h-[500px] space-y-3 overflow-y-auto p-4">
            <AnimatePresence initial={false}>
              {outputProfiles.map((profile) => {
                const isSelected = focusedProfile?.id === profile.id;
                return (
                  <motion.article
                    key={profile.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                    className={`rounded-xl border p-3.5 transition-colors ${
                      profile.isStitched
                        ? isSelected
                          ? 'border-brand-amber bg-surface'
                          : 'border-border-subtle bg-surface'
                        : 'border-rose-200 bg-rose-50/40'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setFocusedProfileId(profile.id)}
                        className="flex min-w-0 items-center gap-2.5 text-left rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
                      >
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                          style={{ backgroundColor: profile.avatarColor }}
                          aria-hidden="true"
                        >
                          {profile.avatarInitials}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-sm font-semibold text-ink-primary font-thai">
                              {profile.nickname}
                            </span>
                            <span className="font-data text-[11px] text-ink-secondary">
                              {profile.studentId}
                            </span>
                          </div>
                          <p className="truncate text-xs text-ink-secondary font-thai">
                            {profile.fullName}
                          </p>
                        </div>
                      </button>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                            profile.isStitched
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                              : 'border-rose-200 bg-rose-50 text-rose-800'
                          }`}
                        >
                          {profile.isStitched
                            ? `Merged (${profile.mergedSources.length})`
                            : 'Unmerged'}
                        </span>

                        <motion.button
                          type="button"
                          whileTap={{ scale: 0.985 }}
                          onClick={() => onToggleMerge(profile.id)}
                          aria-label={
                            profile.isStitched
                              ? `Unmerge ${profile.nickname}`
                              : `Re-merge ${profile.nickname}`
                          }
                          className="inline-flex min-h-7 items-center gap-1 rounded-md border border-border-subtle bg-canvas px-2 py-1 text-[11px] font-medium text-ink-secondary transition-colors hover:bg-zinc-100 hover:text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
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

                        <button
                          type="button"
                          onClick={() => onInspectProfile(profile.id)}
                          className="rounded-md px-2 py-1 text-[11px] font-semibold text-brand-amber-hover hover:bg-brand-amber-soft/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
                        >
                          Inspect →
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 space-y-2">
                      {profile.attributes.map((attr) => {
                        const effectiveStatus = getEffectiveAttributeStatus(
                          attr,
                          confidenceThreshold,
                          manuallyApprovedIds,
                        );
                        const needsReview = effectiveStatus === 'needs_review';
                        const isRejected = effectiveStatus === 'rejected';

                        return (
                          <div
                            key={attr.id}
                            className={`rounded-lg border px-2.5 py-2 text-xs ${
                              needsReview
                                ? 'border-amber-300 bg-brand-amber-soft/75'
                                : isRejected
                                  ? 'border-rose-200 bg-rose-50 opacity-75'
                                  : 'border-border-subtle bg-canvas'
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span
                                  className={`font-medium font-thai ${
                                    isRejected
                                      ? 'line-through text-rose-800'
                                      : 'text-ink-primary'
                                  }`}
                                >
                                  {attr.value}
                                </span>
                                <span className="font-data text-[11px] font-semibold text-ink-secondary">
                                  {attr.confidence}%
                                </span>
                                {needsReview ? (
                                  <span className="inline-flex items-center gap-1 rounded border border-amber-300 bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">
                                    <AlertTriangle
                                      className="h-2.5 w-2.5"
                                      aria-hidden="true"
                                    />
                                    <span>Needs Review</span>
                                  </span>
                                ) : null}
                                {isRejected ? (
                                  <span className="rounded border border-rose-200 bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-rose-800">
                                    Rejected
                                  </span>
                                ) : null}
                              </div>

                              {needsReview || isRejected ? (
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
                                    aria-label={`Approve ${attr.value}`}
                                    className="inline-flex min-h-6 items-center gap-1 rounded border border-emerald-300 bg-surface px-2 py-0.5 text-[11px] font-semibold text-emerald-800 transition-colors hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
                                  >
                                    <Check className="h-3 w-3" aria-hidden="true" />
                                    <span>Approve</span>
                                  </motion.button>
                                  {!isRejected ? (
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
                                      aria-label={`Reject ${attr.value}`}
                                      className="inline-flex min-h-6 items-center gap-1 rounded border border-rose-300 bg-surface px-2 py-0.5 text-[11px] font-semibold text-rose-800 transition-colors hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
                                    >
                                      <X className="h-3 w-3" aria-hidden="true" />
                                      <span>Reject</span>
                                    </motion.button>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                            <p className="mt-1 text-[11px] italic text-ink-secondary font-thai">
                              "{attr.evidenceQuote}"
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </motion.article>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
