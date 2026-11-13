import { motion } from 'framer-motion';
import {
  Activity,
  Code2,
  GitMerge,
  Layers,
  RotateCcw,
  Sparkles,
  Users,
} from 'lucide-react';
import { useId } from 'react';
import type { WorkflowTabId } from '../types/cdp.ts';

interface TopNavbarProps {
  activeTab: WorkflowTabId;
  onTabChange: (tab: WorkflowTabId) => void;
  unmergedCount: number;
  stitchedCount: number;
  totalProfiles: number;
  campaignCount: number;
  needsReviewCount: number;
  confidenceThreshold: number;
  onThresholdChange: (value: number) => void;
  isXRayOpen: boolean;
  onToggleXRay: () => void;
  onResetDemo: () => void;
}

export function TopNavbar({
  activeTab,
  onTabChange,
  unmergedCount,
  stitchedCount,
  totalProfiles,
  campaignCount,
  needsReviewCount,
  confidenceThreshold,
  onThresholdChange,
  isXRayOpen,
  onToggleXRay,
  onResetDemo,
}: TopNavbarProps) {
  const sliderId = useId();
  const sliderProgress = `${((confidenceThreshold - 50) / (95 - 50)) * 100}%`;

  const tabs: Array<{
    id: WorkflowTabId;
    label: string;
    badge: string;
    icon: typeof Layers;
    badgeAccent: boolean;
  }> = [
    {
      id: 'collect',
      label: '1. Collect & Unify',
      badge: `${unmergedCount}`,
      icon: Layers,
      badgeAccent: unmergedCount > 0,
    },
    {
      id: 'profiles',
      label: '2. Unified Profiles',
      badge: `${stitchedCount}/${totalProfiles}`,
      icon: Users,
      badgeAccent: false,
    },
    {
      id: 'segment',
      label: '3. AI Segmentation',
      badge: 'Activate',
      icon: Sparkles,
      badgeAccent: false,
    },
    {
      id: 'analytics',
      label: '4. Campaign & Loop',
      badge: `${campaignCount}`,
      icon: Activity,
      badgeAccent: campaignCount > 0,
    },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/85 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4 py-3">
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-slate text-white">
              <GitMerge
                className="h-4 w-4 text-brand-amber"
                aria-hidden="true"
              />
            </div>
            <div className="flex items-baseline gap-2">
              <span
                translate="no"
                className="text-sm font-bold tracking-tight text-ink-primary"
              >
                Mini CDP
              </span>
              <span className="hidden text-xs text-ink-secondary sm:inline">
                Computing Dept Demo
              </span>
            </div>
          </div>

          {/* Governance Controls + X-Ray + Reset */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-3 rounded-lg border border-border-subtle bg-surface px-3 py-1.5">
              <label
                htmlFor={sliderId}
                className="text-xs font-medium text-ink-secondary"
              >
                Confidence Threshold
              </label>
              <div className="w-24 sm:w-28">
                <input
                  id={sliderId}
                  name="confidenceThreshold"
                  type="range"
                  min={50}
                  max={95}
                  step={1}
                  value={confidenceThreshold}
                  aria-label="Confidence Threshold"
                  aria-valuetext={`${confidenceThreshold}%`}
                  onChange={(event) =>
                    onThresholdChange(Number(event.target.value))
                  }
                  style={{ '--slider-progress': sliderProgress } as React.CSSProperties}
                  className="cdp-slider"
                />
              </div>
              <span className="font-data min-w-[3ch] text-right text-xs font-semibold text-ink-primary">
                {confidenceThreshold}%
              </span>
              {needsReviewCount > 0 ? (
                <span className="hidden rounded border border-amber-300 bg-brand-amber-soft px-1.5 py-0.5 font-data text-[11px] font-medium text-amber-900 md:inline">
                  {needsReviewCount} review
                </span>
              ) : null}
            </div>

            <motion.button
              type="button"
              role="switch"
              aria-checked={isXRayOpen}
              whileTap={{ scale: 0.985 }}
              onClick={onToggleXRay}
              className={`inline-flex min-h-8 items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 ${
                isXRayOpen
                  ? 'border-brand-amber bg-brand-amber-soft text-amber-950'
                  : 'border-brand-slate bg-brand-slate text-white hover:bg-slate-800'
              }`}
            >
              <Code2
                className={`h-3.5 w-3.5 ${
                  isXRayOpen ? 'text-brand-amber-hover' : 'text-brand-amber'
                }`}
                aria-hidden="true"
              />
              <span>X-Ray Mode</span>
              <span
                aria-hidden="true"
                className={`inline-block h-2 w-2 rounded-full ${
                  isXRayOpen ? 'bg-brand-amber-hover' : 'bg-amber-400'
                }`}
              />
            </motion.button>

            <motion.button
              type="button"
              whileTap={{ scale: 0.985 }}
              onClick={onResetDemo}
              aria-label="Reset demo workspace"
              className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-border-subtle bg-surface px-2.5 py-1 text-xs font-medium text-ink-secondary transition-colors hover:bg-zinc-100 hover:text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Reset Demo</span>
            </motion.button>
          </div>
        </div>

        {/* 4 Workflow Tabs */}
        <nav
          aria-label="CDP Workflow Stages"
          className="-mb-px flex items-center gap-1 overflow-x-auto"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                aria-current={isActive ? 'step' : undefined}
                onClick={() => onTabChange(tab.id)}
                className={`relative inline-flex min-h-10 shrink-0 items-center gap-2 px-3.5 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 sm:text-sm ${
                  isActive
                    ? 'text-ink-primary'
                    : 'text-ink-secondary hover:text-ink-primary'
                }`}
              >
                <Icon
                  className={`h-3.5 w-3.5 ${
                    isActive ? 'text-brand-amber-hover' : 'text-ink-secondary'
                  }`}
                  aria-hidden="true"
                />
                <span>{tab.label}</span>
                <span
                  className={`font-data rounded-full border px-1.5 py-0.5 text-[11px] font-medium ${
                    tab.badgeAccent
                      ? 'border-amber-300 bg-brand-amber-soft text-amber-900'
                      : 'border-border-subtle bg-zinc-100 text-ink-secondary'
                  }`}
                >
                  {tab.badge}
                </span>
                {isActive ? (
                  <motion.span
                    layoutId="top-nav-active-tab"
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute inset-x-1 bottom-0 h-0.5 rounded-full bg-brand-amber"
                  />
                ) : null}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
