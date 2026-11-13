import { motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  LayoutGrid,
  Search,
  ShieldAlert,
  ShieldCheck,
  Table2,
  Users,
  XCircle,
} from 'lucide-react';
import { useId, useRef, useState } from 'react';
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

type DirectoryViewMode = 'cards' | 'table';

const FILTER_CHIPS: ProfileFilterChip[] = [
  'ทั้งหมด',
  'หมูกระทะ',
  'เดินป่า',
  'เที่ยวทะเล',
  'สายชิลล์',
  'Needs Review',
];

const CHIP_PATTERNS: Record<
  Exclude<ProfileFilterChip, 'ทั้งหมด' | 'Needs Review'>,
  RegExp
> = {
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
  const [viewMode, setViewMode] = useState<DirectoryViewMode>('cards');
  const searchInputId = useId();
  const cardsTabRef = useRef<HTMLButtonElement | null>(null);
  const tableTabRef = useRef<HTMLButtonElement | null>(null);

  const stitchedCount = profiles.filter((p) => p.isStitched).length;
  const pendingCount = profiles.length - stitchedCount;
  const pdpaOkCount = profiles.filter((p) => p.consentPdpa).length;
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

  const handleViewTabKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    current: DirectoryViewMode,
  ) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const next: DirectoryViewMode = current === 'cards' ? 'table' : 'cards';
      setViewMode(next);
      if (next === 'cards') {
        cardsTabRef.current?.focus();
      } else {
        tableTabRef.current?.focus();
      }
    }
  };

  return (
    <section aria-label="Customer 360 Unified Profiles" className="space-y-6">
      {/* Header + View Switcher */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface px-2.5 py-0.5 text-[11px] font-semibold text-ink-secondary">
            <Users
              className="h-3 w-3 text-brand-amber-hover"
              aria-hidden="true"
            />
            <span>Stage 2 · Golden Record Warehouse</span>
          </div>
          <h1 className="mt-2 text-xl font-bold tracking-tight text-ink-primary sm:text-2xl">
            Customer 360 Directory
          </h1>
          <p className="mt-1 text-sm leading-relaxed text-ink-secondary font-thai">
            คลิกดูโปรไฟล์ลูกค้าเพื่อตรวจหลักฐานต้นทาง สถานะยินยอม PDPA และข้อมูล
            Closed-Loop JSON แบบเต็มรูปแบบ
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="font-data text-xs text-ink-secondary">
            Showing{' '}
            <strong className="text-ink-primary">
              {filteredProfiles.length}
            </strong>{' '}
            of <strong className="text-ink-primary">{profiles.length}</strong>{' '}
            profiles
          </span>

          <div
            role="tablist"
            aria-label="Customer 360 layout view"
            className="inline-flex rounded-lg border border-border-subtle bg-surface p-1"
          >
            <button
              ref={cardsTabRef}
              id="tab-directory-cards"
              type="button"
              role="tab"
              aria-selected={viewMode === 'cards'}
              aria-controls="panel-directory-cards"
              tabIndex={viewMode === 'cards' ? 0 : -1}
              onKeyDown={(e) => handleViewTabKeyDown(e, 'cards')}
              onClick={() => setViewMode('cards')}
              className={`inline-flex min-h-8 items-center gap-1.5 rounded-md border-b-2 px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 ${
                viewMode === 'cards'
                  ? 'border-brand-amber bg-canvas text-ink-primary'
                  : 'border-transparent text-ink-secondary hover:text-ink-primary'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Cards</span>
            </button>
            <button
              ref={tableTabRef}
              id="tab-directory-table"
              type="button"
              role="tab"
              aria-selected={viewMode === 'table'}
              aria-controls="panel-directory-table"
              tabIndex={viewMode === 'table' ? 0 : -1}
              onKeyDown={(e) => handleViewTabKeyDown(e, 'table')}
              onClick={() => setViewMode('table')}
              className={`inline-flex min-h-8 items-center gap-1.5 rounded-md border-b-2 px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 ${
                viewMode === 'table'
                  ? 'border-brand-amber bg-canvas text-ink-primary'
                  : 'border-transparent text-ink-secondary hover:text-ink-primary'
              }`}
            >
              <Table2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Enterprise Table</span>
            </button>
          </div>
        </div>
      </div>

      {/* Live 4-Metric Customer 360 Health Ribbon */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className={`${CARD_SURFACE_CLASS} p-3.5`}>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-secondary">
            Unified Golden Records
          </p>
          <p className="font-data mt-1 text-xl font-bold tracking-tight text-ink-primary">
            {stitchedCount}/{profiles.length}
          </p>
          <p className="mt-0.5 text-[11px] text-ink-secondary">
            Resolved across 3 channels
          </p>
        </div>

        <div className={`${CARD_SURFACE_CLASS} p-3.5`}>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-secondary">
            Pending Ingestion Queue
          </p>
          <p className="font-data mt-1 text-xl font-bold tracking-tight text-ink-primary">
            {pendingCount}
          </p>
          <p className="mt-0.5 text-[11px] text-ink-secondary">
            Waiting for Stage 1 stitching
          </p>
        </div>

        <div className={`${CARD_SURFACE_CLASS} p-3.5`}>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-secondary">
            Needs Review @ {confidenceThreshold}%
          </p>
          <p
            className={`font-data mt-1 text-xl font-bold tracking-tight ${
              needsReviewTotal > 0 ? 'text-brand-amber-hover' : 'text-status-verified'
            }`}
          >
            {needsReviewTotal}
          </p>
          <p className="mt-0.5 text-[11px] text-ink-secondary">
            Flagged traits below threshold
          </p>
        </div>

        <div className={`${CARD_SURFACE_CLASS} p-3.5`}>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-secondary">
            PDPA Consented
          </p>
          <p className="font-data mt-1 text-xl font-bold tracking-tight text-status-verified">
            {pdpaOkCount}/{profiles.length}
          </p>
          <p className="mt-0.5 text-[11px] text-ink-secondary">
            Eligible for LINE OA outreach
          </p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div
        className={`${CARD_SURFACE_CLASS} flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between`}
      >
        <div className="relative flex-1 md:max-w-sm">
          <label htmlFor={searchInputId} className="sr-only">
            Search Customer 360 profiles by name, handle, or extracted trait
          </label>
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-secondary"
            aria-hidden="true"
          />
          <input
            id={searchInputId}
            type="search"
            name="profileSearch"
            autoComplete="off"
            spellCheck={false}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาชื่อ ชื่อเล่น รหัสนิสิต หรือความชอบ…"
            className="min-h-10 w-full rounded-lg border border-border-subtle bg-canvas py-2 pr-3 pl-9 text-sm text-ink-primary placeholder:text-ink-secondary focus:border-brand-amber focus:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 font-thai"
          />
        </div>

        <div
          role="group"
          aria-label="Filter Customer 360 profiles by trait"
          className="flex flex-wrap items-center gap-1.5"
        >
          {FILTER_CHIPS.map((chip) => {
            const isActive = activeChip === chip;
            const isReviewChip = chip === 'Needs Review';

            return (
              <motion.button
                key={chip}
                type="button"
                whileTap={{ scale: 0.985 }}
                aria-pressed={isActive}
                onClick={() => setActiveChip(chip)}
                className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 font-thai ${
                  isActive
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

      {/* Empty State or Directory View */}
      {filteredProfiles.length === 0 ? (
        <div className={`${CARD_SURFACE_CLASS} p-10 text-center`}>
          <p className="text-sm font-semibold text-ink-primary">
            No profiles match "{searchQuery || activeChip}"
          </p>
          <p className="mt-1 text-xs text-ink-secondary">
            Try clearing the search input or switching back to "ทั้งหมด".
          </p>
        </div>
      ) : viewMode === 'cards' ? (
        <div
          id="panel-directory-cards"
          role="tabpanel"
          aria-labelledby="tab-directory-cards"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
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
                      Pending Identity Resolution in Stage 1
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
      ) : (
        <div
          id="panel-directory-table"
          role="tabpanel"
          aria-labelledby="tab-directory-table"
          className={`${CARD_SURFACE_CLASS} overflow-hidden`}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] border-collapse text-left text-xs">
              <caption className="sr-only">
                Customer 360 unified profiles governance and attribute readiness table
              </caption>
              <thead>
                <tr className="border-b border-border-subtle bg-canvas text-[11px] font-semibold uppercase tracking-wider text-ink-secondary">
                  <th scope="col" className="px-4 py-3">
                    Customer
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Student ID
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Resolution &amp; PDPA
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Extracted Traits
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Needs Review
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Campaigns
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Evidence
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {filteredProfiles.map((profile) => {
                  const reviewCount = profile.attributes.filter(
                    (attr) =>
                      getEffectiveAttributeStatus(
                        attr,
                        confidenceThreshold,
                        manuallyApprovedIds,
                      ) === 'needs_review',
                  ).length;
                  const verifiedAttrs = profile.attributes.filter(
                    (attr) =>
                      getEffectiveAttributeStatus(
                        attr,
                        confidenceThreshold,
                        manuallyApprovedIds,
                      ) === 'verified',
                  );

                  return (
                    <tr
                      key={profile.id}
                      className="transition-colors hover:bg-canvas/70"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                            style={{ backgroundColor: profile.avatarColor }}
                            aria-hidden="true"
                          >
                            {profile.avatarInitials}
                          </div>
                          <div>
                            <p className="font-semibold text-ink-primary font-thai">
                              {profile.nickname}
                            </p>
                            <p className="text-[11px] text-ink-secondary font-thai">
                              {profile.fullName}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="font-data px-4 py-3 text-ink-secondary">
                        {profile.studentId}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                              profile.isStitched
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                : 'border-rose-200 bg-rose-50 text-rose-800'
                            }`}
                          >
                            {profile.isStitched
                              ? `Unified (${profile.mergedSources.length})`
                              : 'Queued'}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                              profile.consentPdpa
                                ? 'border-border-subtle bg-surface text-ink-primary'
                                : 'border-rose-200 bg-rose-50 text-rose-800'
                            }`}
                          >
                            {profile.consentPdpa ? 'PDPA OK' : 'Opt-Out'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {profile.attributes.length === 0 ? (
                          <span className="text-[11px] text-ink-secondary">
                            Not stitched yet
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {verifiedAttrs.slice(0, 2).map((attr) => (
                              <span
                                key={attr.id}
                                className="rounded border border-border-subtle bg-canvas px-1.5 py-0.5 text-[11px] text-ink-primary font-thai"
                              >
                                {attr.value}
                              </span>
                            ))}
                            {verifiedAttrs.length > 2 ? (
                              <span className="font-data rounded border border-border-subtle bg-canvas px-1.5 py-0.5 text-[10px] text-ink-secondary">
                                +{verifiedAttrs.length - 2}
                              </span>
                            ) : null}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {reviewCount > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-brand-amber-soft px-2 py-0.5 font-data text-[11px] font-semibold text-amber-900">
                            <AlertTriangle
                              className="h-3 w-3"
                              aria-hidden="true"
                            />
                            <span>{reviewCount}</span>
                          </span>
                        ) : (
                          <span className="font-data text-ink-secondary">0</span>
                        )}
                      </td>
                      <td className="font-data px-4 py-3 text-right text-ink-primary">
                        {profile.campaignHistory.length}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => onSelectProfile(profile.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-border-subtle bg-surface px-2.5 py-1 text-[11px] font-semibold text-brand-amber-hover transition-colors hover:bg-brand-amber-soft/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
                        >
                          <span>Inspect</span>
                          <ChevronRight className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
