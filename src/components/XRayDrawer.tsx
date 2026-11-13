import { motion } from 'framer-motion';
import {
  Activity,
  ArrowRight,
  Check,
  Code2,
  Copy,
  Database,
  GitMerge,
  ShieldCheck,
  Sparkles,
  Terminal,
} from 'lucide-react';
import { useState } from 'react';
import type { PipelineLog, UnifiedProfile } from '../types/cdp.ts';
import { CARD_SURFACE_CLASS, formatTimeShort } from '../utils/cdpHelpers.ts';
import { DrawerShell } from './DrawerShell.tsx';

interface XRayDrawerProps {
  open: boolean;
  onClose: () => void;
  profiles: UnifiedProfile[];
  pipelineLogs: PipelineLog[];
  confidenceThreshold: number;
  campaignCount: number;
}

type XRayTabId = 'architecture' | 'schema' | 'logs';

const XRAY_TABS: Array<{ id: XRayTabId; label: string; icon: typeof GitMerge }> =
  [
    { id: 'architecture', label: 'System Architecture', icon: GitMerge },
    { id: 'schema', label: 'Data Schema', icon: Code2 },
    { id: 'logs', label: 'Live AI Logs', icon: Terminal },
  ];

const SCHEMA_TEXT = `export type DataSourceType = 'LINE_CHAT' | 'FACEBOOK_POST' | 'DEPT_ROSTER';

export interface ExtractedAttribute {
  id: string;
  category: 'food' | 'activity' | 'vibe' | 'budget';
  value: string;
  confidence: number; // 0 - 100 governance score
  evidenceQuote: string; // Verbatim substring from RawSourceRecord
  source: DataSourceType;
  status: 'verified' | 'needs_review' | 'rejected';
}

export interface UnifiedProfile {
  id: string;
  fullName: string;
  nickname: string;
  studentId: string;
  avatarInitials: string;
  avatarColor: string;
  consentPdpa: boolean;
  attributes: ExtractedAttribute[];
  mergedSources: RawSourceRecord[];
  campaignHistory: CampaignInteraction[];
  isStitched: boolean;
}`;

export function XRayDrawer({
  open,
  onClose,
  profiles,
  pipelineLogs,
  confidenceThreshold,
  campaignCount,
}: XRayDrawerProps) {
  const [subTab, setSubTab] = useState<XRayTabId>('architecture');
  const [copied, setCopied] = useState(false);

  const stitchedCount = profiles.filter((p) => p.isStitched).length;
  const totalAttributes = profiles.reduce(
    (sum, p) => sum + p.attributes.length,
    0,
  );
  const sampleProfile = profiles.find((p) => p.isStitched) ?? profiles[0];

  const handleCopySchema = async () => {
    try {
      await navigator.clipboard.writeText(SCHEMA_TEXT);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const handleTabKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      setSubTab(XRAY_TABS[(index + 1) % XRAY_TABS.length].id);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setSubTab(
        XRAY_TABS[(index - 1 + XRAY_TABS.length) % XRAY_TABS.length].id,
      );
    }
  };

  return (
    <DrawerShell
      open={open}
      onClose={onClose}
      title="AI Lead X-Ray Mode"
      subtitle="Inspect pipeline topology, strict TypeScript CDP schemas, and live AI execution logs."
      widthClass="max-w-3xl"
      headerBadge={
        <span className="rounded-md border border-amber-300 bg-brand-amber-soft px-2 py-0.5 font-data text-[11px] font-medium text-amber-900">
          POST /api/ai + Local Fallback
        </span>
      }
    >
      <div className="space-y-5">
        <div
          role="tablist"
          aria-label="X-Ray Inspector Sections"
          className="flex items-center gap-1 border-b border-border-subtle"
        >
          {XRAY_TABS.map((tab, index) => {
            const Icon = tab.icon;
            const selected = subTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`xray-tab-${tab.id}`}
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                onKeyDown={(e) => handleTabKeyDown(e, index)}
                onClick={() => setSubTab(tab.id)}
                className={`relative inline-flex min-h-10 items-center gap-2 px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 sm:text-sm ${
                  selected
                    ? 'text-ink-primary'
                    : 'text-ink-secondary hover:text-ink-primary'
                }`}
              >
                <Icon
                  className={`h-3.5 w-3.5 ${
                    selected ? 'text-brand-amber-hover' : 'text-ink-secondary'
                  }`}
                  aria-hidden="true"
                />
                <span>{tab.label}</span>
                {tab.id === 'logs' ? (
                  <span className="font-data rounded-full border border-border-subtle bg-zinc-100 px-1.5 py-0.5 text-[11px] text-ink-secondary">
                    {pipelineLogs.length}
                  </span>
                ) : null}
                {selected ? (
                  <motion.span
                    layoutId="xray-subtab-indicator"
                    className="absolute inset-x-1 bottom-0 h-0.5 rounded-full bg-brand-amber"
                  />
                ) : null}
              </button>
            );
          })}
        </div>

        {subTab === 'architecture' ? (
          <div
            role="tabpanel"
            tabIndex={0}
            aria-labelledby="xray-tab-architecture"
            className="space-y-5"
          >
            <div className="grid gap-3 sm:grid-cols-4">
              <div className={`${CARD_SURFACE_CLASS} p-3.5`}>
                <span className="text-[11px] font-medium text-ink-secondary">
                  Stitched Entities
                </span>
                <p className="font-data mt-1 text-lg font-bold text-ink-primary">
                  {stitchedCount}/{profiles.length}
                </p>
              </div>
              <div className={`${CARD_SURFACE_CLASS} p-3.5`}>
                <span className="text-[11px] font-medium text-ink-secondary">
                  Extracted Traits
                </span>
                <p className="font-data mt-1 text-lg font-bold text-ink-primary">
                  {totalAttributes}
                </p>
              </div>
              <div className={`${CARD_SURFACE_CLASS} p-3.5`}>
                <span className="text-[11px] font-medium text-ink-secondary">
                  Confidence Gate
                </span>
                <p className="font-data mt-1 text-lg font-bold text-brand-amber-hover">
                  {confidenceThreshold}%
                </p>
              </div>
              <div className={`${CARD_SURFACE_CLASS} p-3.5`}>
                <span className="text-[11px] font-medium text-ink-secondary">
                  Campaigns Run
                </span>
                <p className="font-data mt-1 text-lg font-bold text-ink-primary">
                  {campaignCount}
                </p>
              </div>
            </div>

            {/* 4-Pillar Architecture Flow */}
            <div className={`${CARD_SURFACE_CLASS} p-5`}>
              <h3 className="text-sm font-semibold tracking-tight text-ink-primary">
                4-Pillar Pipeline Architecture
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
                Browser requests route through serverless{' '}
                <code className="rounded bg-zinc-100 px-1 py-0.5 text-[11px]">
                  POST /api/ai
                </code>{' '}
                (OpenAI-compatible MaxPlus AI <code className="rounded bg-zinc-100 px-1 py-0.5 text-[11px]">gpt-6-luna</code> via{' '}
                <code className="rounded bg-zinc-100 px-1 py-0.5 text-[11px]">
                  LLM_API_KEY
                </code>{' '}
                server-only) with deterministic Thai semantic fallback on{' '}
                <code className="rounded bg-zinc-100 px-1 py-0.5 text-[11px]">
                  {`{ fallback: true }`}
                </code>
                .
              </p>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-border-subtle bg-canvas p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Database
                        className="h-4 w-4 text-brand-amber-hover"
                        aria-hidden="true"
                      />
                      <span className="text-xs font-semibold text-ink-primary">
                        1. Multi-Source Ingest
                      </span>
                    </div>
                    <ArrowRight
                      className="h-3.5 w-3.5 text-ink-secondary"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-ink-secondary">
                    45 raw records across LINE_CHAT, FACEBOOK_POST, and
                    DEPT_ROSTER with non-trivial handles.
                  </p>
                </div>

                <div className="rounded-lg border border-border-subtle bg-canvas p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GitMerge
                        className="h-4 w-4 text-brand-amber-hover"
                        aria-hidden="true"
                      />
                      <span className="text-xs font-semibold text-ink-primary">
                        2. Entity Resolution & LLM Extraction
                      </span>
                    </div>
                    <ArrowRight
                      className="h-3.5 w-3.5 text-ink-secondary"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-ink-secondary">
                    Links profiles into Single Customer Views and extracts
                    food, activity, vibe, and budget attributes with exact
                    evidence quotes.
                  </p>
                </div>

                <div className="rounded-lg border border-border-subtle bg-canvas p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck
                        className="h-4 w-4 text-status-verified"
                        aria-hidden="true"
                      />
                      <span className="text-xs font-semibold text-ink-primary">
                        3. Confidence & PDPA Governance
                      </span>
                    </div>
                    <ArrowRight
                      className="h-3.5 w-3.5 text-ink-secondary"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-ink-secondary">
                    Global {confidenceThreshold}% threshold slider dynamically
                    flags uncertain attributes for human approve/reject review;
                    PDPA opt-outs stay excluded from activation.
                  </p>
                </div>

                <div className="rounded-lg border border-border-subtle bg-canvas p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles
                        className="h-4 w-4 text-brand-amber-hover"
                        aria-hidden="true"
                      />
                      <span className="text-xs font-semibold text-ink-primary">
                        4. Semantic Segmentation & Closed-Loop Sync
                      </span>
                    </div>
                    <Activity
                      className="h-3.5 w-3.5 text-status-verified"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-ink-secondary">
                    Splits Direct (82-98%) vs Lookalike (65-81%) segments,
                    personalizes Thai LINE invites, and writes simulated replies
                    back onto UnifiedProfile records.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {subTab === 'schema' ? (
          <div
            role="tabpanel"
            tabIndex={0}
            aria-labelledby="xray-tab-schema"
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs text-ink-secondary">
                Single source of truth defined in{' '}
                <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px]">
                  src/types/cdp.ts
                </code>
              </p>
              <motion.button
                type="button"
                whileTap={{ scale: 0.985 }}
                onClick={handleCopySchema}
                className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-border-subtle bg-surface px-2.5 py-1 text-xs font-medium text-ink-primary hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
              >
                {copied ? (
                  <Check
                    className="h-3.5 w-3.5 text-status-verified"
                    aria-hidden="true"
                  />
                ) : (
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>{copied ? 'Copied' : 'Copy TypeScript'}</span>
              </motion.button>
            </div>

            <pre className="overflow-x-auto rounded-xl border border-slate-800 bg-brand-slate p-4 font-data text-xs leading-relaxed text-zinc-100">
              <code>{SCHEMA_TEXT}</code>
            </pre>

            {sampleProfile ? (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold tracking-tight text-ink-primary">
                  Live Sample Record ({sampleProfile.id})
                </h3>
                <pre className="max-h-72 overflow-auto rounded-xl border border-border-subtle bg-canvas p-4 font-data text-[11px] leading-relaxed text-ink-primary">
                  <code>{JSON.stringify(sampleProfile, null, 2)}</code>
                </pre>
              </div>
            ) : null}
          </div>
        ) : null}

        {subTab === 'logs' ? (
          <div
            role="tabpanel"
            tabIndex={0}
            aria-labelledby="xray-tab-logs"
            className="space-y-3"
          >
            {pipelineLogs.length === 0 ? (
              <div className={`${CARD_SURFACE_CLASS} p-6 text-center`}>
                <p className="text-sm font-medium text-ink-primary">
                  No pipeline runs recorded yet
                </p>
                <p className="mt-1 text-xs text-ink-secondary">
                  Run AI Identity Stitching, Semantic Segmentation, or Reply
                  Simulation to stream live execution logs here.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {pipelineLogs.map((log) => (
                  <div
                    key={log.id}
                    className={`${CARD_SURFACE_CLASS} flex flex-col gap-1.5 p-3.5`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-data text-[11px] text-ink-secondary">
                          {formatTimeShort(log.timestamp)}
                        </span>
                        <span className="rounded border border-amber-300 bg-brand-amber-soft px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                          {log.step}
                        </span>
                      </div>
                      <span className="font-data rounded border border-border-subtle bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-ink-primary">
                        {log.latencyMs} ms
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-ink-secondary font-thai">
                      {log.detail}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </DrawerShell>
  );
}
