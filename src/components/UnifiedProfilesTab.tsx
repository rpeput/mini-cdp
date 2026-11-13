import { motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Search,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import type { UnifiedProfile } from '../types/cdp.ts';
import {
  CARD_SURFACE_CLASS,
  countNeedsReviewAttributes,
  getEffectiveAttributeStatus,
} from '../utils/cdpHelpers.ts';

interface UnifiedProfilesTabProps {
  profiles: UnifiedProfile[];
  confidenceThreshold: number;
  manuallyApprovedIds: ReadonlySet<string>;
  onSelectProfile: (profileId: string) => void;
}

type ProfileFilterChip =
  | 'ทั้งหมด'
  | 'หมูกระทะ'
  | 'เดินป่า'
  | 'เที่ยวทะเล'
  | 'สายชิลล์'
  | 'Needs Review';

const FILTER_CHIPS: ProfileFilterChip[] = [
  'ทั้งหมด',
  'หมูกระทะ',
  'เดินป่า',
  'เที่ยวทะเล',
  'สายชิลล์',
  'Needs Review',
];

const CHIP_PATTERNS: Record<Exclude<ProfileFilterChip, 'ทั้งหมด' | 'Needs Review'>, RegExp> = {
  หมูกระทะ: /หมูกระทะ|ปิ้งย่าง|ชาบู|หมาล่า|สายกิน/i,
  เดินป่า: /เดินป่า|ขึ้นดอย|กางเต็นท์|แคมปิ้ง|เทรล/i,
  เที่ยวทะเล: /ทะเล|ดำน้ำ|เกาะ|หาด|แสมสาร|ภูเก็ต/i,
  สายชิลล์: /ชิลล์|วันศุกร์|แฮงเอาท์|คาเฟ่|บอร์ดเกม/i,
};

export function UnifiedProfilesTab({
  profiles,
  confidenceThreshold,
  manuallyApprovedIds,
  onSelectProfile,
}: UnifiedProfilesTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeChip, setActiveChip] = useState<ProfileFilterChip>('ทั้งหมด');

  const needsReviewTotal = countNeedsReviewAttributes(
    profiles,
    confidenceThreshold,
    manuallyApprovedIds,
  );

  const filteredProfiles = profiles.filter((profile) => {
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      const searchable = [
        profile.fullName,
        profile.nickname,
        profile.studentId,
        ...profile.mergedSources.map((s) => `${s.handle} ${s.rawText}`),
        ...profile.attributes.map((a) => `${a.value} ${a.evidenceQuote}`),
      ]
        .join(' ')
        .toLowerCase();
      if (!searchable.includes(query)) {
        return false;
      }
    }

    if (activeChip === 'ทั้งหมด') {
      return true;
    }

    if (activeChip === 'Needs Review') {
      return profile.attributes.some(
        (attr) =>
          getEffectiveAttributeStatus(
            attr,
            confidenceThreshold,
            manuallyApprovedIds,
          ) === 'needs_review',
      );
    }

    const pattern = CHIP_PATTERNS[activeChip];
    const corpus = [
      ...profile.attributes
        .filter((a) => a.status !== 'rejected')
        .map((a) => `${a.value} ${a.evidenceQuote}`),
      ...profile.mergedSources.map((s) => s.rawText),
    ].join(' ');

    return pattern.test(corpus);
  });

  return (
    <section aria-label="Unified Profiles Directory" className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink-primary sm:text-2xl">
            Unified Customer Profiles
          </h1>
          <p className="mt-1 text-sm text-ink-secondary">
            Click any profile card to inspect raw sources, verbatim evidence
            quotes, governance approvals, and raw CDP JSON.
          </p>
        </div>
        <div className="font-data text-xs text-ink-secondary">
          Showing <strong className="text-ink-primary">{filteredProfiles.length}</strong> of{' '}
          <strong className="text-ink-primary">{profiles.length}</strong> profiles
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className={`${CARD_SURFACE_CLASS} flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between`}>
        <div className="relative flex-1 md:max-w-sm">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-secondary"
            aria-hidden="true"
          />
          <input
            type="search"
            name="profileSearch"
            autoComplete="off"
            spellCheck={false}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาชื่อ ชื่อเล่น รหัสนิสิต หรือความชอบ…"
            aria-label="Search unified profiles"
            className="min-h-10 w-full rounded-lg border border-border-subtle bg-canvas py-2 pr-3 pl-9 text-sm text-ink-primary placeholder:text-ink-secondary focus:border-brand-amber focus:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 font-thai"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {FILTER_CHIPS.map((chip) => {
            const active = activeChip === chip;
            const isReviewChip = chip === 'Needs Review';
            return (
              <motion.button
                key={chip}
                type="button"
                whileTap={{ scale: 0.985 }}
                aria-pressed={active}
                onClick={() => setActiveChip(chip)}
                className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 font-thai ${
                  active
                    ? 'border-brand-slate bg-brand-slate text-white'
                    : isReviewChip && needsReviewTotal > 0
                      ? 'border-amber-300 bg-brand-amber-soft text-amber-900 hover:bg-amber-200/70'
                      : 'border-border-subtle bg-surface text-ink-secondary hover:text-ink-primary'
                }`}
              >
                {isReviewChip ? (
                  <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                ) : null}
                <span>{chip}</span>
                {isReviewChip ? (
                  <span className="font-data rounded-full bg-black/10 px-1.5 py-0.2 text-[10px]">
                    {needsReviewTotal}
                  </span>
                ) : null}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* 15 Friend Card Grid */}
      {filteredProfiles.length === 0 ? (
        <div className={`${CARD_SURFACE_CLASS} p-10 text-center`}>
          <p className="text-sm font-semibold text-ink-primary">
            No profiles match "{searchQuery || activeChip}"
          </p>
          <p className="mt-1 text-xs text-ink-secondary">
            Try clearing the search input or switching back to "ทั้งหมด".
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProfiles.map((profile) => {
            const closedLoopCount = profile.attributes.filter((a) =>
              a.id.startsWith('attr_fb_'),
            ).length;

            return (
              <motion.button
                key={profile.id}
                type="button"
                whileTap={{ scale: 0.985 }}
                onClick={() => onSelectProfile(profile.id)}
                className={`${CARD_SURFACE_CLASS} group flex min-w-0 flex-col justify-between p-4 text-left transition-colors hover:border-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50`}
              >
                <div className="space-y-3">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                        style={{ backgroundColor: profile.avatarColor }}
                        aria-hidden="true"
                      >
                        {profile.avatarInitials}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h2 className="truncate text-sm font-bold tracking-tight text-ink-primary font-thai">
                            {profile.nickname}
                          </h2>
                          <span className="font-data text-[11px] text-ink-secondary">
                            {profile.studentId}
                          </span>
                        </div>
                        <p className="truncate text-xs text-ink-secondary font-thai">
                          {profile.fullName}
                        </p>
                      </div>
                    </div>

                    <ChevronRight
                      className="h-4 w-4 shrink-0 text-ink-secondary transition-transform group-hover:translate-x-0.5 group-hover:text-ink-primary"
                      aria-hidden="true"
                    />
                  </div>

                  {/* Governance Badges */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                        profile.consentPdpa
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                          : 'border-rose-200 bg-rose-50 text-rose-800'
                      }`}
                    >
                      {profile.consentPdpa ? (
                        <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                      ) : (
                        <ShieldAlert className="h-3 w-3" aria-hidden="true" />
                      )}
                      <span>
                        {profile.consentPdpa ? 'PDPA OK' : 'PDPA Opt-Out'}
                      </span>
                    </span>

                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                        profile.isStitched
                          ? 'border-border-subtle bg-zinc-100 text-ink-primary'
                          : 'border-rose-200 bg-rose-50 text-rose-800'
                      }`}
                    >
                      {profile.isStitched
                        ? `Stitched (${profile.mergedSources.length})`
                        : 'Unmerged'}
                    </span>

                    {closedLoopCount > 0 ? (
                      <span className="inline-flex items-center rounded-full border border-amber-300 bg-brand-amber-soft px-2 py-0.5 font-data text-[10px] font-semibold text-amber-900">
                        +{closedLoopCount} Closed-Loop
                      </span>
                    ) : null}
                  </div>

                  {/* Attribute Pills */}
                  {profile.attributes.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-border-subtle bg-canvas px-3 py-2 text-xs text-ink-secondary">
                      Pending Identity Stitching in Tab 1
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {profile.attributes.map((attr) => {
                        const effective = getEffectiveAttributeStatus(
                          attr,
                          confidenceThreshold,
                          manuallyApprovedIds,
                        );
                        const isClosedLoop = attr.id.startsWith('attr_fb_');
                        const pillStyle =
                          effective === 'rejected'
                            ? 'border-rose-200 bg-rose-50 text-rose-800 line-through opacity-75'
                            : effective === 'needs_review'
                              ? 'border-amber-300 bg-brand-amber-soft text-amber-900'
                              : isClosedLoop
                                ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                                : 'border-border-subtle bg-canvas text-ink-primary';

                        return (
                          <span
                            key={attr.id}
                            className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium font-thai ${pillStyle}`}
                          >
                            {effective === 'verified' ? (
                              <CheckCircle2
                                className="h-3 w-3 shrink-0 text-status-verified"
                                aria-hidden="true"
                              />
                            ) : effective === 'needs_review' ? (
                              <AlertTriangle
                                className="h-3 w-3 shrink-0 text-brand-amber-hover"
                                aria-hidden="true"
                              />
                            ) : (
                              <XCircle
                                className="h-3 w-3 shrink-0 text-status-declined"
                                aria-hidden="true"
                              />
                            )}
                            <span>{attr.value}</span>
                            <span className="font-data text-[10px] opacity-80">
                              {attr.confidence}%
                            </span>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-border-subtle pt-2.5 text-[11px] text-ink-secondary">
                  <span className="font-data">
                    {profile.campaignHistory.length} campaigns
                  </span>
                  <span className="font-medium text-brand-amber-hover group-hover:underline">
                    Inspect Evidence →
                  </span>
                </div>
              </motion.button>
            );
          })}
        </div>
      )}
    </section>
  );
}
