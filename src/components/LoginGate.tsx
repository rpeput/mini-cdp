import { motion } from 'framer-motion';
import {
  ArrowRight,
  Code2,
  Database,
  GitMerge,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { CARD_SURFACE_CLASS } from '../utils/cdpHelpers.ts';

interface LoginGateProps {
  onLogin: (openXRay: boolean) => void;
}

const PILLARS = [
  {
    step: '01',
    title: 'Collect',
    description:
      'Ingest noisy cross-channel signals across LINE Chat, Facebook Posts, and Dept Rosters.',
    icon: Database,
  },
  {
    step: '02',
    title: 'Unify',
    description:
      'Resolve mismatched handles into Single Customer Views with verbatim Thai evidence quotes.',
    icon: GitMerge,
  },
  {
    step: '03',
    title: 'Activate',
    description:
      'Run semantic segmentation with Direct vs Lookalike scoring and tailored Thai invites.',
    icon: Sparkles,
  },
  {
    step: '04',
    title: 'Govern',
    description:
      'Enforce PDPA consent, confidence thresholds, and closed-loop reply feedback.',
    icon: ShieldCheck,
  },
] as const;

export function LoginGate({ onLogin }: LoginGateProps) {
  return (
    <main className="flex min-h-dvh flex-col justify-center overflow-x-hidden bg-canvas px-4 py-12 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto w-full max-w-4xl space-y-8"
      >
        <div className={`${CARD_SURFACE_CLASS} overflow-hidden`}>
          <div className="border-b border-border-subtle bg-zinc-50/70 px-6 py-4 sm:px-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-slate text-white">
                  <GitMerge className="h-4 w-4 text-brand-amber" aria-hidden="true" />
                </div>
                <div>
                  <span
                    translate="no"
                    className="text-sm font-semibold tracking-tight text-ink-primary"
                  >
                    Mini CDP
                  </span>
                  <span className="ml-2 rounded-md border border-amber-300 bg-brand-amber-soft px-2 py-0.5 text-[11px] font-medium text-amber-900">
                    Enterprise AI Workspace
                  </span>
                </div>
              </div>
              <span className="font-data text-xs text-ink-secondary">
                15 Profiles · 45 Multi-Source Signals · PDPA Ready
              </span>
            </div>
          </div>

          <div className="px-6 py-8 sm:px-8 sm:py-10">
            <div className="max-w-2xl space-y-3">
              <p className="text-xs font-semibold tracking-wider text-brand-amber-hover uppercase">
                AI-Powered Customer Data Platform
              </p>
              <h1 className="text-2xl font-bold tracking-tight text-ink-primary sm:text-3xl">
                Collect → Unify → Activate → Govern
              </h1>
              <p className="text-sm leading-relaxed text-ink-secondary">
                Turn fragmented Thai social conversations, LINE handles, and
                department rosters into verified Single Customer Views, semantic
                segments, and closed-loop campaign intelligence.
              </p>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {PILLARS.map((pillar) => {
                const Icon = pillar.icon;
                return (
                  <div
                    key={pillar.step}
                    className="rounded-lg border border-border-subtle bg-canvas p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Icon
                        className="h-4 w-4 text-brand-amber-hover"
                        aria-hidden="true"
                      />
                      <span className="font-data text-[11px] font-medium text-ink-secondary">
                        {pillar.step}
                      </span>
                    </div>
                    <h2 className="mt-2.5 text-sm font-semibold tracking-tight text-ink-primary">
                      {pillar.title}
                    </h2>
                    <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
                      {pillar.description}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-border-subtle pt-6">
              <motion.button
                type="button"
                whileTap={{ scale: 0.985 }}
                onClick={() => onLogin(false)}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-slate px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
              >
                <span>Sign in as Client (Demo Workspace)</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </motion.button>

              <motion.button
                type="button"
                whileTap={{ scale: 0.985 }}
                onClick={() => onLogin(true)}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border-subtle bg-surface px-4 py-2.5 text-sm font-medium text-ink-primary transition-colors hover:border-amber-300 hover:bg-brand-amber-soft/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
              >
                <Code2
                  className="h-4 w-4 text-brand-amber-hover"
                  aria-hidden="true"
                />
                <span>Launch directly in AI Lead X-Ray Mode</span>
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>
    </main>
  );
}
