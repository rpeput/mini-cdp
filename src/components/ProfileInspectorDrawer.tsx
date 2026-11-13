import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Code2,
  Copy,
  Quote,
  ShieldAlert,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { RAW_SOURCE_RECORDS } from '../data/seedData.ts';
import type { AttributeStatus, UnifiedProfile } from '../types/cdp.ts';
import {
  CARD_SURFACE_CLASS,
  CATEGORY_META,
  SOURCE_META,
  STATUS_META,
  formatDateShort,
  getEffectiveAttributeStatus,
} from '../utils/cdpHelpers.ts';
import { DrawerShell } from './DrawerShell.tsx';

interface ProfileInspectorDrawerProps {
  profile: UnifiedProfile | null;
  onClose: () => void;
  confidenceThreshold: number;
  manuallyApprovedIds: ReadonlySet<string>;
  onAttributeDecision: (
    profileId: string,
    attributeId: string,
    decision: 'verified' | 'rejected',
  ) => void;
}

export function ProfileInspectorDrawer({
  profile,
  onClose,
  confidenceThreshold,
  manuallyApprovedIds,
  onAttributeDecision,
}: ProfileInspectorDrawerProps) {
  const [viewMode, setViewMode] = useState<'formatted' | 'json'>('formatted');
  const [copiedJson, setCopiedJson] = useState(false);

  const sourceRecords = profile
    ? profile.mergedSources.length > 0
      ? profile.mergedSources
      : RAW_SOURCE_RECORDS.filter((r) => r.linkedProfileId === profile.id)
    : [];

  const handleCopyJson = async () => {
    if (!profile) {
      return;
    }
    try {
      await navigator.clipboard.writeText(JSON.stringify(profile, null, 2));
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 1800);
    } catch {
      setCopiedJson(false);
    }
  };

  const renderStatusIcon = (status: AttributeStatus) => {
    if (status === 'verified') {
      return (
        <CheckCircle2
          className="h-3.5 w-3.5 text-status-verified"
          aria-hidden="true"
        />
      );
    }
    if (status === 'needs_review') {
      return (
        <AlertTriangle
          className="h-3.5 w-3.5 text-brand-amber-hover"
          aria-hidden="true"
        />
      );
    }
    return (
      <XCircle
        className="h-3.5 w-3.5 text-status-declined"
        aria-hidden="true"
      />
    );
  };

  return (
    <DrawerShell
      open={profile !== null}
      onClose={onClose}
      title={profile ? `${profile.nickname} — ${profile.fullName}` : 'Profile'}
      subtitle={
        profile
          ? `Student ID ${profile.studentId} · ${profile.id}`
          : undefined
      }
      widthClass="max-w-2xl"
      headerBadge={
        profile ? (
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
                {profile.consentPdpa ? 'PDPA Consented' : 'PDPA Opt-Out'}
              </span>
            </span>

            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                profile.isStitched
                  ? 'border-border-subtle bg-zinc-100 text-ink-primary'
                  : 'border-rose-200 bg-rose-50 text-rose-800'
              }`}
            >
              {profile.isStitched ? 'Unified View' : 'Unmerged Queue'}
            </span>
          </div>
        ) : null
      }
    >
      {profile ? (
        <div className="space-y-6">
          {/* Formatted / Raw JSON Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-subtle bg-canvas p-2">
            <div className="flex items-center gap-2.5 pl-1">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: profile.avatarColor }}
                aria-hidden="true"
              >
                {profile.avatarInitials}
              </div>
              <div>
                <p className="text-xs font-semibold text-ink-primary font-thai">
                  {profile.fullName} ({profile.nickname})
                </p>
                <p className="font-data text-[11px] text-ink-secondary">
                  {profile.attributes.length} traits · {sourceRecords.length}{' '}
                  sources
                </p>
              </div>
            </div>

            <div
              role="group"
              aria-label="Inspector Display Format"
              className="inline-flex rounded-lg border border-border-subtle bg-surface p-0.5"
            >
              <button
                type="button"
                onClick={() => setViewMode('formatted')}
                aria-pressed={viewMode === 'formatted'}
                className={`min-h-7 rounded-md px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 ${
                  viewMode === 'formatted'
                    ? 'bg-brand-slate text-white'
                    : 'text-ink-secondary hover:text-ink-primary'
                }`}
              >
                Formatted
              </button>
              <button
                type="button"
                onClick={() => setViewMode('json')}
                aria-pressed={viewMode === 'json'}
                className={`inline-flex min-h-7 items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 ${
                  viewMode === 'json'
                    ? 'bg-brand-slate text-white'
                    : 'text-ink-secondary hover:text-ink-primary'
                }`}
              >
                <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Raw JSON</span>
              </button>
            </div>
          </div>

          {viewMode === 'json' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-data text-xs text-ink-secondary">
                  UnifiedProfile payload
                </span>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.985 }}
                  onClick={handleCopyJson}
                  className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-border-subtle bg-surface px-2.5 py-1 text-xs font-medium text-ink-primary hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
                >
                  {copiedJson ? (
                    <Check
                      className="h-3.5 w-3.5 text-status-verified"
                      aria-hidden="true"
                    />
                  ) : (
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  <span>{copiedJson ? 'Copied JSON' : 'Copy JSON'}</span>
                </motion.button>
              </div>
              <pre className="overflow-x-auto rounded-xl border border-slate-800 bg-brand-slate p-4 font-data text-xs leading-relaxed text-zinc-100">
                <code>{JSON.stringify(profile, null, 2)}</code>
              </pre>
            </div>
          ) : (
            <>
              {/* Extracted Attributes & Governance */}
              <section aria-label="Extracted Attributes" className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold tracking-tight text-ink-primary">
                    Extracted Attributes & Evidence Quotes
                  </h3>
                  <span className="font-data text-xs text-ink-secondary">
                    Gate: {confidenceThreshold}%
                  </span>
                </div>

                {profile.attributes.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border-subtle bg-canvas p-4 text-xs text-ink-secondary">
                    This profile is currently unmerged. Run AI Identity
                    Stitching in Tab 1 to extract verified traits.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {profile.attributes.map((attr) => {
                      const effectiveStatus = getEffectiveAttributeStatus(
                        attr,
                        confidenceThreshold,
                        manuallyApprovedIds,
                      );
                      const isClosedLoop = attr.id.startsWith('attr_fb_');
                      return (
                        <div
                          key={attr.id}
                          className={`${CARD_SURFACE_CLASS} space-y-2.5 p-3.5`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span
                                  className={`rounded border px-1.5 py-0.5 text-[11px] font-medium ${CATEGORY_META[attr.category].badgeClass}`}
                                >
                                  {CATEGORY_META[attr.category].label}
                                </span>
                                <span
                                  className={`rounded border px-1.5 py-0.5 text-[11px] font-medium ${SOURCE_META[attr.source].badgeClass}`}
                                >
                                  {SOURCE_META[attr.source].shortLabel}
                                </span>
                                {isClosedLoop ? (
                                  <span className="rounded border border-amber-300 bg-brand-amber-soft px-1.5 py-0.5 text-[11px] font-semibold text-amber-900">
                                    Closed-Loop Sync
                                  </span>
                                ) : null}
                              </div>
                              <p className="text-sm font-semibold text-ink-primary font-thai">
                                {attr.value}
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_META[effectiveStatus].badgeClass}`}
                              >
                                {renderStatusIcon(effectiveStatus)}
                                <span>
                                  {STATUS_META[effectiveStatus].label}
                                </span>
                              </span>
                            </div>
                          </div>

                          {/* Confidence Bar */}
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
                              <div
                                className={`h-full rounded-full transition-[width] duration-200 ${
                                  effectiveStatus === 'rejected'
                                    ? 'bg-status-declined'
                                    : effectiveStatus === 'needs_review'
                                      ? 'bg-brand-amber'
                                      : 'bg-status-verified'
                                }`}
                                style={{ width: `${attr.confidence}%` }}
                              />
                            </div>
                            <span className="font-data text-xs font-semibold text-ink-primary">
                              {attr.confidence}%
                            </span>
                          </div>

                          {/* Verbatim Evidence Quote */}
                          <div className="flex items-start gap-2 rounded-lg border border-border-subtle bg-canvas px-3 py-2">
                            <Quote
                              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-secondary"
                              aria-hidden="true"
                            />
                            <p className="min-w-0 break-words text-xs leading-relaxed text-ink-secondary font-thai">
                              "{attr.evidenceQuote}"
                            </p>
                          </div>

                          {/* Manual Governance Buttons */}
                          <div className="flex items-center justify-end gap-2 pt-0.5">
                            <motion.button
                              type="button"
                              whileTap={{ scale: 0.985 }}
                              aria-label={`Approve ${CATEGORY_META[attr.category].label} attribute: ${attr.value}`}
                              onClick={() =>
                                onAttributeDecision(
                                  profile.id,
                                  attr.id,
                                  'verified',
                                )
                              }
                              className={`inline-flex min-h-7 items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 ${
                                effectiveStatus === 'verified'
                                  ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                                  : 'border-border-subtle bg-surface text-ink-primary hover:bg-emerald-50'
                              }`}
                            >
                              <Check className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>Approve</span>
                            </motion.button>
                            <motion.button
                              type="button"
                              whileTap={{ scale: 0.985 }}
                              aria-label={`Reject ${CATEGORY_META[attr.category].label} attribute: ${attr.value}`}
                              onClick={() =>
                                onAttributeDecision(
                                  profile.id,
                                  attr.id,
                                  'rejected',
                                )
                              }
                              className={`inline-flex min-h-7 items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 ${
                                effectiveStatus === 'rejected'
                                  ? 'border-rose-300 bg-rose-50 text-rose-900'
                                  : 'border-border-subtle bg-surface text-ink-secondary hover:bg-rose-50 hover:text-rose-800'
                              }`}
                            >
                              <X className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>Reject</span>
                            </motion.button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Linked Raw Source Records */}
              <section aria-label="Linked Raw Source Records" className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold tracking-tight text-ink-primary">
                    {profile.isStitched
                      ? 'Linked Raw Source Records'
                      : 'Pending Ingestion Source Records'}
                  </h3>
                  <span className="font-data text-xs text-ink-secondary">
                    {sourceRecords.length} records
                  </span>
                </div>
                <div className="space-y-2">
                  {sourceRecords.map((record) => (
                    <div
                      key={record.id}
                      className="rounded-lg border border-border-subtle bg-canvas p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded border px-1.5 py-0.5 text-[11px] font-medium ${SOURCE_META[record.source].badgeClass}`}
                          >
                            {SOURCE_META[record.source].label}
                          </span>
                          <span className="font-data text-xs font-medium text-ink-primary">
                            @{record.handle}
                          </span>
                        </div>
                        <span className="font-data text-[11px] text-ink-secondary">
                          {formatDateShort(record.timestamp)}
                        </span>
                      </div>
                      <p className="mt-2 break-words text-xs leading-relaxed text-ink-primary font-thai">
                        {record.rawText}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Campaign Interaction History */}
              <section
                aria-label="Campaign Interaction History"
                className="space-y-3"
              >
                <h3 className="text-sm font-semibold tracking-tight text-ink-primary">
                  Campaign History & Closed-Loop Replies
                </h3>
                {profile.campaignHistory.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border-subtle bg-canvas p-4 text-xs text-ink-secondary">
                    No outbound campaign interactions recorded yet.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {profile.campaignHistory.map((item) => (
                      <div
                        key={`${item.campaignId}_${item.timestamp}`}
                        className={`${CARD_SURFACE_CLASS} space-y-2 p-3.5`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-ink-primary font-thai">
                            {item.campaignName}
                          </span>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                              item.status === 'accepted'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                : item.status === 'declined'
                                  ? 'border-rose-200 bg-rose-50 text-rose-800'
                                  : 'border-amber-300 bg-brand-amber-soft text-amber-900'
                            }`}
                          >
                            {item.status === 'accepted'
                              ? 'Accepted'
                              : item.status === 'declined'
                                ? 'Declined'
                                : 'Pending'}
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed text-ink-secondary font-thai">
                          Sent: "{item.sentMessage}"
                        </p>
                        {item.replyText ? (
                          <div className="rounded-md border border-border-subtle bg-canvas px-3 py-2 text-xs leading-relaxed text-ink-primary font-thai">
                            Reply: "{item.replyText}"
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      ) : null}
    </DrawerShell>
  );
}
