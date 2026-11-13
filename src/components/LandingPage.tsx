import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  ArrowRight,
  Check,
  CheckCircle2,
  Code2,
  Database,
  GitMerge,
  Layers,
  Lock,
  Menu,
  Quote,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  CAMPAIGN_PRESETS,
  INITIAL_PROFILES,
  RAW_SOURCE_RECORDS,
} from '../data/seedData.ts';
import type { UnifiedProfile, WorkflowTabId } from '../types/cdp.ts';
import {
  CATEGORY_META,
  SOURCE_META,
  getEffectiveAttributeStatus,
} from '../utils/cdpHelpers.ts';

interface LandingPageProps {
  onEnterWorkspace: (initialTab?: WorkflowTabId, openXRay?: boolean) => void;
}

type SandboxStage = 'unify' | 'govern' | 'activate';
type RoleView = 'marketer' | 'engineer';

const SANDBOX_PROFILES = INITIAL_PROFILES.slice(0, 3);
const LANDING_PRESETS = CAMPAIGN_PRESETS.slice(0, 3);

function computeLandingActivationPreview(
  profile: UnifiedProfile,
  preset: string,
): {
  tier: 'direct' | 'lookalike';
  score: number;
  reasoning: string;
  invite: string;
} {
  const corpus = profile.attributes
    .map((a) => `${a.value} ${a.evidenceQuote}`)
    .join(' ');

  if (preset.includes('หมูกระทะ')) {
    if (/หมูกระทะ|ปิ้งย่าง|ชาบู/i.test(corpus)) {
      return {
        tier: 'direct',
        score: profile.id === 'prof_02' ? 96 : 94,
        reasoning: `ตรงกลุ่มเป้าหมายหลักจาก attribute "${profile.attributes[0]?.value ?? ''}" พร้อมหลักฐานจาก LINE_CHAT`,
        invite: `${profile.nickname} เย็นนี้รวมตี้หมูกระทะหลังมอกันไหม? เห็นบ่นหิวปิ้งย่างอยู่พอดี ไปด้วยกันนะ`,
      };
    }
    return {
      tier: 'lookalike',
      score: 76,
      reasoning: `Lookalike จากโปรไฟล์สายแฮงเอาท์วันศุกร์ และให้ความสำคัญกับงบประมาณ (${profile.attributes[2]?.value ?? 'คุ้มค่า'})`,
      invite: `ทักนะ ${profile.nickname} วันศุกร์นี้มีตี้หมูกระทะร้านประจำราคาไม่เกิน 299 สนใจแวะมาจอยกันไหม`,
    };
  }

  if (preset.includes('เดินป่า')) {
    if (/เดินป่า|ขึ้นดอย/i.test(corpus)) {
      return {
        tier: 'direct',
        score: 95,
        reasoning: `ตรงกลุ่ม Outdoor เต็มๆ จากโพสต์ "${profile.attributes[1]?.evidenceQuote ?? ''}"`,
        invite: `${profile.nickname} เสาร์นี้มีแพลนขึ้นดอยเดินป่าเบาๆ เอาสายธรรมชาติไปด้วยกันรอบนี้ไหม`,
      };
    }
    return {
      tier: 'lookalike',
      score: 73,
      reasoning: `Lookalike จากพฤติกรรมชอบบรรยากาศชิลล์และกิจกรรมกลุ่มกับเพื่อนภาคคอมฯ`,
      invite: `ชวน ${profile.nickname} เปลี่ยนบรรยากาศไปเดินป่าชมวิววันเสาร์แบบงบประหยัด หารค่ารถกันเบาๆ สนใจไหม`,
    };
  }

  // Default: ทะเล/ดำน้ำ
  if (/ทะเล|ดำน้ำ/i.test(corpus)) {
    return {
      tier: 'direct',
      score: 93,
      reasoning: `ตรงกลุ่มกิจกรรมทะเลชัดเจนจากสัญญาณ ${profile.attributes[0]?.source ?? 'LINE_CHAT'}`,
      invite: `${profile.nickname} อาทิตย์หน้ามีตี้ทริปทะเล-ดำน้ำ ช่วงนี้เคลียร์งานแล็บเสร็จพอดี ไปพักด้วยกันไหม`,
    };
  }

  return {
    tier: 'lookalike',
    score: 79,
    reasoning: `Lookalike จากไลฟ์สไตล์สายถ่ายรูป/คาเฟ่และชอบพักผ่อนฮีลใจช่วงสุดสัปดาห์`,
    invite: `${profile.nickname} ไปทริปทะเลวันหยุดสั้นๆ หาคาเฟ่ริมหาดถ่ายรูปแสงสวยๆ กับแก๊งเพื่อนกันไหม`,
  };
}

const COMPARISON_ROWS = [
  {
    pillar: 'Identity Stitching',
    legacy:
      'ต้องใช้รหัสสมาชิกหรือเบอร์โทรตรงกัน 100% พลาดข้อมูลจาก LINE handles และโพสต์โซเชียลที่ชื่อไม่ตรงกัน',
    composable:
      'AI Cross-Channel Resolution จับคู่นามแฝง LINE, ชื่อเล่นไทย และ Roster IDs พร้อมตรวจสอบการเชื่อมโยงได้',
  },
  {
    pillar: 'AI Hallucination Control',
    legacy:
      'LLM ติดแท็กแบบกล่องดำ (Black-box) ไม่รู้ที่มาของข้อมูล ทีมธุรกิจไม่กล้านำไปใช้กับลูกค้าจริง',
    composable:
      'ทุก Attribute ต้องผูก Verbatim Evidence Quote จากข้อความจริง + Confidence Slider (`50–95%`) ให้คน Approve/Reject',
  },
  {
    pillar: 'Audience & Activation',
    legacy:
      'ทีมการตลาดต้องเปิด Ticket รอทีม Data เขียน SQL แล้ว Broadcast หว่านทุกคนโดยไม่แยกบริบท',
    composable:
      'พิมพ์โจทย์ภาษาไทยหรืออังกฤษได้ทันที แยก Direct (`82–98%`) vs Lookalike (`65–81%`) พร้อมส่ง LINE 1:1 และกัน PDPA Opt-Out',
  },
  {
    pillar: 'Closed-Loop Feedback',
    legacy:
      'ยิงแคมเปญออกไปแล้วจบเลย ผลตอบรับของลูกค้าไม่ถูกบันทึกกลับมาพัฒนาโปรไฟล์รอบถัดไป',
    composable:
      'คำตอบลูกค้าถูกวิเคราะห์และอัปเดตกลับเป็น Behavioral Tags พร้อม Quote บน Customer 360 โดยอัตโนมัติ',
  },
] as const;

export function LandingPage({ onEnterWorkspace }: LandingPageProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Interactive Hero Sandbox State (powered 100% by real seedData.ts)
  const [sandboxProfileId, setSandboxProfileId] = useState<string>(
    SANDBOX_PROFILES[0].id,
  );
  const [sandboxStage, setSandboxStage] = useState<SandboxStage>('unify');
  const [heroThreshold, setHeroThreshold] = useState<number>(75);
  const [heroPreset, setHeroPreset] = useState<string>(LANDING_PRESETS[0]);
  const [activeRole, setActiveRole] = useState<RoleView>('marketer');

  const sliderId = useId();
  const sliderProgress = `${((heroThreshold - 50) / (95 - 50)) * 100}%`;

  const stageTabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const roleTabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsScrolled(!entry.isIntersecting);
      },
      { threshold: [0] },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  const activeSandboxProfile = useMemo(
    () =>
      SANDBOX_PROFILES.find((p) => p.id === sandboxProfileId) ??
      SANDBOX_PROFILES[0],
    [sandboxProfileId],
  );

  const activeSandboxSources = useMemo(
    () =>
      RAW_SOURCE_RECORDS.filter(
        (r) => r.linkedProfileId === activeSandboxProfile.id,
      ),
    [activeSandboxProfile.id],
  );

  const heroActivation = useMemo(
    () => computeLandingActivationPreview(activeSandboxProfile, heroPreset),
    [activeSandboxProfile, heroPreset],
  );

  const handleTablistArrowNav = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
    refs: React.MutableRefObject<Array<HTMLButtonElement | null>>,
    selectAtIndex: (nextIndex: number) => void,
    count: number,
  ) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') {
      return;
    }
    event.preventDefault();
    const nextIndex =
      event.key === 'ArrowRight'
        ? (index + 1) % count
        : (index - 1 + count) % count;
    selectAtIndex(nextIndex);
    refs.current[nextIndex]?.focus();
  };

  const stageItems: Array<{ id: SandboxStage; label: string }> = [
    { id: 'unify', label: '1. Unify Signals' },
    { id: 'govern', label: '2. Govern Evidence' },
    { id: 'activate', label: '3. AI Decisioning' },
  ];

  const roleItems: Array<{ id: RoleView; label: string }> = [
    { id: 'marketer', label: 'CRM & Loyalty Marketers' },
    { id: 'engineer', label: 'Data & AI Engineering Leads' },
  ];

  return (
    <div className="min-h-dvh overflow-x-hidden bg-canvas text-ink-primary">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-brand-slate focus:px-3 focus:py-2 focus:text-xs focus:font-semibold focus:text-white focus:ring-2 focus:ring-amber-500/50 focus:outline-none"
      >
        Skip to main content
      </a>

      {/* Scroll Sentinel for Sticky Header State */}
      <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />

      {/* Sticky Editorial Top Navigation */}
      <header
        className={`sticky top-0 z-30 border-b transition-colors duration-200 ${
          isScrolled
            ? 'border-zinc-200 bg-white shadow-[0_2px_10px_rgba(9,9,11,0.05)]'
            : 'border-border-subtle bg-white'
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-slate text-white">
              <GitMerge
                className="h-4 w-4 text-brand-amber"
                aria-hidden="true"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                translate="no"
                className="text-base font-bold tracking-tight text-ink-primary"
              >
                Mini CDP
              </span>
              <span className="rounded-md border border-amber-300 bg-brand-amber-soft px-2 py-0.5 text-[11px] font-semibold text-amber-950">
                Composable Edition
              </span>
            </div>
          </div>

          {/* Primary Navigation */}
          <nav aria-label="Primary" className="flex items-center gap-2">
            <ul className="hidden items-center gap-1 md:flex">
              <li>
                <a
                  href="#platform"
                  className="inline-flex min-h-9 items-center rounded-lg px-3 py-1.5 text-xs font-medium text-ink-secondary transition-colors hover:bg-zinc-100 hover:text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
                >
                  Platform
                </a>
              </li>
              <li>
                <a
                  href="#comparison"
                  className="inline-flex min-h-9 items-center rounded-lg px-3 py-1.5 text-xs font-medium text-ink-secondary transition-colors hover:bg-zinc-100 hover:text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
                >
                  Silos vs AI
                </a>
              </li>
              <li>
                <a
                  href="#roles"
                  className="inline-flex min-h-9 items-center rounded-lg px-3 py-1.5 text-xs font-medium text-ink-secondary transition-colors hover:bg-zinc-100 hover:text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
                >
                  For Teams
                </a>
              </li>
              <li>
                <a
                  href="#architecture"
                  className="inline-flex min-h-9 items-center rounded-lg px-3 py-1.5 text-xs font-medium text-ink-secondary transition-colors hover:bg-zinc-100 hover:text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
                >
                  Architecture
                </a>
              </li>
            </ul>

            <button
              type="button"
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
              aria-controls="landing-mobile-menu"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-border-subtle bg-surface text-ink-primary hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 md:hidden"
            >
              {mobileMenuOpen ? (
                <X className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Menu className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </nav>

          {/* Header Actions */}
          <div className="hidden items-center gap-2.5 sm:flex">
            <motion.button
              type="button"
              whileTap={{ scale: 0.985 }}
              onClick={() => onEnterWorkspace('collect', true)}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border-subtle bg-surface px-3 py-1.5 text-xs font-semibold text-ink-primary transition-colors hover:border-amber-300 hover:bg-brand-amber-soft/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
            >
              <Code2
                className="h-3.5 w-3.5 text-brand-amber-hover"
                aria-hidden="true"
              />
              <span>X-Ray Mode</span>
            </motion.button>

            <motion.button
              type="button"
              whileTap={{ scale: 0.985 }}
              onClick={() => onEnterWorkspace('collect', false)}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-brand-slate px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
            >
              <span>Open Customer Studio</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </motion.button>
          </div>
        </div>

        {/* Mobile Menu Disclosure */}
        {mobileMenuOpen ? (
          <div
            id="landing-mobile-menu"
            className="border-t border-border-subtle bg-surface px-4 py-3 md:hidden"
          >
            <div className="flex flex-col gap-1">
              {[
                { href: '#platform', label: 'Platform' },
                { href: '#comparison', label: 'Silos vs AI' },
                { href: '#roles', label: 'For Teams' },
                { href: '#architecture', label: 'Architecture' },
              ].map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-medium text-ink-primary hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
                >
                  {link.label}
                </a>
              ))}
              <div className="mt-2 grid grid-cols-2 gap-2 border-t border-border-subtle pt-3">
                <button
                  type="button"
                  onClick={() => onEnterWorkspace('collect', true)}
                  className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-border-subtle bg-surface px-3 text-xs font-semibold text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
                >
                  <Code2 className="h-3.5 w-3.5 text-brand-amber-hover" aria-hidden="true" />
                  <span>X-Ray Mode</span>
                </button>
                <button
                  type="button"
                  onClick={() => onEnterWorkspace('collect', false)}
                  className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-brand-slate px-3 text-xs font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
                >
                  <span>Customer Studio</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </header>

      <main id="main-content">
        {/* SECTION 1: HERO + INTERACTIVE LIVE SANDBOX */}
        <section
          id="platform"
          className="cdp-grid-backdrop border-b border-border-subtle"
        >
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
            <div className="grid items-start gap-10 lg:grid-cols-12 lg:gap-12">
              {/* Left Narrative Column */}
              <div className="min-w-0 space-y-6 lg:col-span-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-surface px-3 py-1 shadow-[0_1px_2px_rgba(9,9,11,0.04)]">
                  <span
                    className="h-2 w-2 rounded-full bg-status-verified"
                    aria-hidden="true"
                  />
                  <span className="text-xs font-semibold text-ink-primary">
                    Composable AI CDP · Ready for CRM & LINE OA
                  </span>
                </div>

                <h1 className="text-3xl font-extrabold tracking-tight text-ink-primary sm:text-5xl lg:text-[3.125rem] lg:leading-[1.08]">
                  Turn noisy Thai chat into governed, AI-activated customer
                  journeys.
                </h1>

                <p className="max-w-xl text-base leading-relaxed text-ink-secondary font-thai">
                  รวมข้อมูลลูกค้าจากแชต <strong className="font-semibold text-ink-primary">LINE</strong>,{' '}
                  โพสต์โซเชียล และฐานข้อมูลหลังบ้านที่ชื่อไม่ตรงกันให้เป็น Single Customer View{' '}
                  พร้อมประโยคหลักฐานยืนยันตัวตน, ตัวกรองความเชื่อมั่น, และระบบยิงแคมเปญ 1:1 ผ่าน AI Decisioning
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.985 }}
                    onClick={() => onEnterWorkspace('collect', false)}
                    className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-brand-slate px-6 py-3 text-sm font-semibold text-white shadow-[0_2px_8px_rgba(15,23,42,0.18)] transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
                  >
                    <span>Launch Customer Studio</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </motion.button>

                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.985 }}
                    onClick={() => onEnterWorkspace('collect', true)}
                    className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-border-subtle bg-surface px-5 py-3 text-sm font-semibold text-ink-primary shadow-[0_1px_2px_rgba(9,9,11,0.04)] transition-colors hover:border-amber-300 hover:bg-brand-amber-soft/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
                  >
                    <Code2
                      className="h-4 w-4 text-brand-amber-hover"
                      aria-hidden="true"
                    />
                    <span>Inspect Architecture (X-Ray)</span>
                  </motion.button>
                </div>

                {/* Grounded Live Dataset Proof Bar */}
                <dl className="grid grid-cols-2 gap-4 border-t border-border-subtle pt-6 sm:grid-cols-4">
                  <div>
                    <dt className="text-[11px] font-medium text-ink-secondary">
                      Profiles in Sandbox
                    </dt>
                    <dd className="font-data mt-0.5 text-lg font-bold text-ink-primary">
                      {INITIAL_PROFILES.length}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium text-ink-secondary">
                      Raw Channel Signals
                    </dt>
                    <dd className="font-data mt-0.5 text-lg font-bold text-ink-primary">
                      {RAW_SOURCE_RECORDS.length}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium text-ink-secondary">
                      Grounded Evidence
                    </dt>
                    <dd className="font-data mt-0.5 text-lg font-bold text-status-verified">
                      100% Quoted
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium text-ink-secondary">
                      AI Hybrid Engine
                    </dt>
                    <dd className="font-data mt-0.5 text-sm font-bold text-ink-primary">
                      gpt-6-luna
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Right Interactive Sandbox Column */}
              <div className="min-w-0 lg:col-span-6">
                <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-surface shadow-[0_4px_20px_rgba(9,9,11,0.06),0_1px_3px_rgba(9,9,11,0.05)]">
                  {/* Sandbox Window Chrome */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle bg-zinc-50/90 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Sparkles
                        className="h-4 w-4 text-brand-amber-hover"
                        aria-hidden="true"
                      />
                      <span className="text-xs font-semibold text-ink-primary">
                        Interactive Live Preview
                      </span>
                    </div>

                    {/* Customer Profile Switcher */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {SANDBOX_PROFILES.map((prof) => {
                        const selected = prof.id === activeSandboxProfile.id;
                        return (
                          <button
                            key={prof.id}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => setSandboxProfileId(prof.id)}
                            className={`inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 font-thai ${
                              selected
                                ? 'border-brand-slate bg-brand-slate text-white'
                                : 'border-border-subtle bg-surface text-ink-secondary hover:text-ink-primary'
                            }`}
                          >
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: prof.avatarColor }}
                              aria-hidden="true"
                            />
                            <span>{prof.nickname}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Interactive Stage Tabs */}
                  <div
                    role="tablist"
                    aria-label="Interactive pipeline stage preview"
                    className="grid grid-cols-3 border-b border-border-subtle bg-canvas"
                  >
                    {stageItems.map((item, idx) => {
                      const active = sandboxStage === item.id;
                      return (
                        <button
                          key={item.id}
                          ref={(el) => {
                            stageTabRefs.current[idx] = el;
                          }}
                          type="button"
                          role="tab"
                          id={`hero-stage-tab-${item.id}`}
                          aria-selected={active}
                          onClick={() => setSandboxStage(item.id)}
                          onKeyDown={(e) =>
                            handleTablistArrowNav(
                              e,
                              idx,
                              stageTabRefs,
                              (next) => setSandboxStage(stageItems[next].id),
                              stageItems.length,
                            )
                          }
                          className={`relative flex min-h-11 items-center justify-center px-2 py-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-500/60 ${
                            active
                              ? 'border-b-2 border-brand-amber bg-surface text-ink-primary'
                              : 'text-ink-secondary hover:bg-white/60 hover:text-ink-primary'
                          }`}
                        >
                          <span className="truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Interactive Stage Panel Content */}
                  <div className="p-5">
                    <AnimatePresence mode="wait">
                      {sandboxStage === 'unify' ? (
                        <motion.div
                          key={`unify-${activeSandboxProfile.id}`}
                          role="tabpanel"
                          aria-labelledby="hero-stage-tab-unify"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.18 }}
                          className="space-y-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs font-medium text-ink-secondary font-thai">
                              3 แหล่งข้อมูลที่ชื่อผู้ใช้ต่างกัน ถูกเชื่อมรวมเป็น{' '}
                              <strong className="font-data text-ink-primary">
                                {activeSandboxProfile.id}
                              </strong>
                            </p>
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                              <GitMerge className="h-3 w-3" aria-hidden="true" />
                              <span>Unified 3 → 1</span>
                            </span>
                          </div>

                          <div className="space-y-2">
                            {activeSandboxSources.map((src) => (
                              <div
                                key={src.id}
                                className="rounded-lg border border-border-subtle bg-canvas p-3"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${SOURCE_META[src.source].badgeClass}`}
                                    >
                                      {SOURCE_META[src.source].shortLabel}
                                    </span>
                                    <span className="font-data text-xs font-semibold text-ink-primary">
                                      @{src.handle}
                                    </span>
                                  </div>
                                  <span className="font-data text-[10px] text-ink-secondary">
                                    {src.id}
                                  </span>
                                </div>
                                <p className="mt-1.5 text-xs leading-relaxed text-ink-secondary font-thai">
                                  "{src.rawText}"
                                </p>
                              </div>
                            ))}
                          </div>

                          <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5">
                            <div className="flex items-center gap-3">
                              <div
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                                style={{
                                  backgroundColor:
                                    activeSandboxProfile.avatarColor,
                                }}
                                aria-hidden="true"
                              >
                                {activeSandboxProfile.avatarInitials}
                              </div>
                              <div>
                                <p className="text-sm font-bold text-ink-primary font-thai">
                                  {activeSandboxProfile.nickname} ·{' '}
                                  {activeSandboxProfile.fullName}
                                </p>
                                <p className="font-data text-[11px] text-ink-secondary">
                                  {activeSandboxProfile.studentId} ·{' '}
                                  {activeSandboxProfile.attributes.length}{' '}
                                  attributes resolved
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setSandboxStage('govern')}
                              className="inline-flex min-h-8 items-center gap-1 rounded-lg bg-brand-slate px-3 py-1 text-[11px] font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
                            >
                              <span>Inspect Evidence</span>
                              <ArrowRight
                                className="h-3 w-3"
                                aria-hidden="true"
                              />
                            </button>
                          </div>
                        </motion.div>
                      ) : null}

                      {sandboxStage === 'govern' ? (
                        <motion.div
                          key={`govern-${activeSandboxProfile.id}`}
                          role="tabpanel"
                          aria-labelledby="hero-stage-tab-govern"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.18 }}
                          className="space-y-4"
                        >
                          {/* Interactive Confidence Gate Slider inside Landing Preview */}
                          <div className="rounded-xl border border-border-subtle bg-canvas p-3.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <label
                                htmlFor={sliderId}
                                className="text-xs font-semibold text-ink-primary"
                              >
                                Try Confidence Threshold Gate (AI Hallucination
                                Filter)
                              </label>
                              <span className="font-data rounded-md border border-border-subtle bg-surface px-2 py-0.5 text-xs font-bold text-ink-primary">
                                {heroThreshold}%
                              </span>
                            </div>
                            <div className="mt-2">
                              <input
                                id={sliderId}
                                name="heroConfidenceThreshold"
                                type="range"
                                min={50}
                                max={95}
                                step={1}
                                value={heroThreshold}
                                onChange={(e) =>
                                  setHeroThreshold(Number(e.target.value))
                                }
                                style={
                                  {
                                    '--slider-progress': sliderProgress,
                                  } as React.CSSProperties
                                }
                                className="cdp-slider"
                              />
                            </div>
                            <p className="mt-1 text-[11px] text-ink-secondary font-thai">
                              ลองเลื่อนค่า Gate ดูครับ: Trait ที่ความมั่นใจต่ำกว่า{' '}
                              <span className="font-data font-semibold">
                                {heroThreshold}%
                              </span>{' '}
                              จะถูกสลับเป็นสถานะ <strong className="text-amber-900">Needs Review</strong> ทันที
                            </p>
                          </div>

                          <div className="space-y-2.5">
                            {activeSandboxProfile.attributes.map((attr) => {
                              const status = getEffectiveAttributeStatus(
                                attr,
                                heroThreshold,
                                new Set(),
                              );
                              return (
                                <div
                                  key={attr.id}
                                  className="rounded-lg border border-border-subtle bg-surface p-3"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <span
                                        className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${CATEGORY_META[attr.category].badgeClass}`}
                                      >
                                        {CATEGORY_META[attr.category].label}
                                      </span>
                                      <span className="text-xs font-semibold text-ink-primary font-thai">
                                        {attr.value}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-data text-xs font-bold text-ink-primary">
                                        {attr.confidence}%
                                      </span>
                                      <span
                                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                                          status === 'verified'
                                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                            : 'border-amber-300 bg-brand-amber-soft text-amber-950'
                                        }`}
                                      >
                                        {status === 'verified' ? (
                                          <CheckCircle2
                                            className="h-3 w-3 text-status-verified"
                                            aria-hidden="true"
                                          />
                                        ) : (
                                          <ShieldCheck
                                            className="h-3 w-3 text-brand-amber-hover"
                                            aria-hidden="true"
                                          />
                                        )}
                                        <span>
                                          {status === 'verified'
                                            ? 'Verified'
                                            : 'Needs Review'}
                                        </span>
                                      </span>
                                    </div>
                                  </div>
                                  <div className="mt-2 flex items-start gap-1.5 rounded border border-border-subtle bg-canvas px-2.5 py-1.5">
                                    <Quote
                                      className="mt-0.5 h-3 w-3 shrink-0 text-ink-secondary"
                                      aria-hidden="true"
                                    />
                                    <p className="text-[11px] leading-relaxed text-ink-secondary font-thai">
                                      "{attr.evidenceQuote}"
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </motion.div>
                      ) : null}

                      {sandboxStage === 'activate' ? (
                        <motion.div
                          key={`activate-${activeSandboxProfile.id}-${heroPreset}`}
                          role="tabpanel"
                          aria-labelledby="hero-stage-tab-activate"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.18 }}
                          className="space-y-4"
                        >
                          <div className="space-y-2">
                            <span className="text-xs font-semibold text-ink-secondary">
                              Select Campaign Prompt (AI Semantic Match):
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {LANDING_PRESETS.map((preset) => {
                                const selected = heroPreset === preset;
                                return (
                                  <button
                                    key={preset}
                                    type="button"
                                    aria-pressed={selected}
                                    onClick={() => setHeroPreset(preset)}
                                    className={`min-h-8 rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 font-thai ${
                                      selected
                                        ? 'border-brand-amber bg-brand-amber-soft text-amber-950'
                                        : 'border-border-subtle bg-canvas text-ink-primary hover:border-amber-300'
                                    }`}
                                  >
                                    {preset}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Decisioning Card + LINE Preview */}
                          <div className="rounded-xl border border-border-subtle bg-canvas p-4 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                                    heroActivation.tier === 'direct'
                                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                      : 'border-amber-300 bg-brand-amber-soft text-amber-950'
                                  }`}
                                >
                                  {heroActivation.tier === 'direct'
                                    ? 'Tier 1: Direct Match'
                                    : 'Tier 2: Lookalike'}
                                </span>
                                <span className="font-data text-xs font-bold text-ink-primary">
                                  Match Score: {heroActivation.score}%
                                </span>
                              </div>
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-status-verified">
                                <Lock className="h-3 w-3" aria-hidden="true" />
                                <span>PDPA OK</span>
                              </span>
                            </div>

                            <p className="text-xs leading-relaxed text-ink-secondary font-thai">
                              {heroActivation.reasoning}
                            </p>

                            {/* Realistic LINE OA Message Bubble Preview */}
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
                              <div className="flex items-center justify-between text-[10px] font-semibold text-emerald-900">
                                <span>LINE OA 1:1 Personalized Invite</span>
                                <span className="font-data">
                                  to @{activeSandboxSources[0]?.handle}
                                </span>
                              </div>
                              <div className="mt-2 rounded-lg rounded-tl-none border border-emerald-200 bg-surface px-3 py-2.5 text-xs leading-relaxed text-ink-primary shadow-[0_1px_2px_rgba(9,9,11,0.03)] font-thai">
                                "{heroActivation.invite}"
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4">
                      <span className="text-xs text-ink-secondary">
                        Ready to test all {INITIAL_PROFILES.length} profiles
                        with live AI?
                      </span>
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.985 }}
                        onClick={() => onEnterWorkspace('segment', false)}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-brand-slate px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
                      >
                        <span>Open in Customer Studio</span>
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </motion.button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2: SILOS VS COMPOSABLE AI CDP */}
        <section
          id="comparison"
          className="border-b border-border-subtle bg-surface py-16 sm:py-20"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl space-y-2">
              <p className="text-xs font-semibold tracking-wider text-brand-amber-hover uppercase">
                Why Composable AI CDP
              </p>
              <h2 className="text-2xl font-bold tracking-tight text-ink-primary sm:text-3xl">
                Stop guessing in siloed spreadsheets. Activate grounded Thai
                insights.
              </h2>
              <p className="text-sm leading-relaxed text-ink-secondary font-thai">
                ออกแบบมาเพื่อปิดช่องว่างระหว่างข้อมูลแชตลูกค้าที่ไม่เป็นโครงสร้าง กับการทำงานจริงของทีม CRM องค์กร
              </p>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-2">
              {COMPARISON_ROWS.map((row) => (
                <div
                  key={row.pillar}
                  className="overflow-hidden rounded-xl border border-border-subtle bg-canvas"
                >
                  <div className="border-b border-border-subtle bg-surface px-5 py-3">
                    <h3 className="text-sm font-bold tracking-tight text-ink-primary">
                      {row.pillar}
                    </h3>
                  </div>
                  <div className="grid gap-3 p-5 sm:grid-cols-2">
                    <div className="rounded-lg border border-rose-200 bg-rose-50/50 p-3.5">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-800">
                        <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Legacy Workflow</span>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-ink-secondary font-thai">
                        {row.legacy}
                      </p>
                    </div>
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3.5">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-900">
                        <CheckCircle2
                          className="h-3.5 w-3.5 text-status-verified"
                          aria-hidden="true"
                        />
                        <span>Mini CDP Approach</span>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-ink-primary font-thai">
                        {row.composable}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 3: BUILT FOR DATA & MARKETING TEAMS (ROLE SWITCHER) */}
        <section
          id="roles"
          className="border-b border-border-subtle bg-canvas py-16 sm:py-20"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div className="max-w-2xl space-y-2">
                <p className="text-xs font-semibold tracking-wider text-brand-amber-hover uppercase">
                  One Platform, Two Superpowers
                </p>
                <h2 className="text-2xl font-bold tracking-tight text-ink-primary sm:text-3xl">
                  Built for Marketers to move fast, and Engineers to trust
                  every field.
                </h2>
              </div>

              {/* Role Switcher Tablist */}
              <div
                role="tablist"
                aria-label="Platform view by team role"
                className="inline-flex rounded-xl border border-border-subtle bg-surface p-1 shadow-[0_1px_2px_rgba(9,9,11,0.04)]"
              >
                {roleItems.map((role, idx) => {
                  const active = activeRole === role.id;
                  return (
                    <button
                      key={role.id}
                      ref={(el) => {
                        roleTabRefs.current[idx] = el;
                      }}
                      type="button"
                      role="tab"
                      id={`role-tab-${role.id}`}
                      aria-selected={active}
                      onClick={() => setActiveRole(role.id)}
                      onKeyDown={(e) =>
                        handleTablistArrowNav(
                          e,
                          idx,
                          roleTabRefs,
                          (next) => setActiveRole(roleItems[next].id),
                          roleItems.length,
                        )
                      }
                      className={`min-h-9 rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 ${
                        active
                          ? 'border-b-2 border-brand-amber bg-brand-slate text-white'
                          : 'text-ink-secondary hover:text-ink-primary'
                      }`}
                    >
                      {role.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-8">
              {activeRole === 'marketer' ? (
                <div
                  role="tabpanel"
                  aria-labelledby="role-tab-marketer"
                  className="grid items-stretch gap-6 rounded-2xl border border-border-subtle bg-surface p-6 shadow-[0_1px_2px_rgba(9,9,11,0.04),0_4px_12px_rgba(9,9,11,0.03)] lg:grid-cols-12 lg:p-8"
                >
                  <div className="flex flex-col justify-between space-y-5 lg:col-span-6">
                    <div className="space-y-3">
                      <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-brand-amber-soft px-2.5 py-1 text-xs font-semibold text-amber-950">
                        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Customer Studio & LINE Activation</span>
                      </span>
                      <h3 className="text-xl font-bold tracking-tight text-ink-primary">
                        Launch Thai semantic segments in seconds without writing
                        SQL
                      </h3>
                      <p className="text-sm leading-relaxed text-ink-secondary font-thai">
                        ทีม CRM สามารถพิมพ์โจทย์แคมเปญเป็นภาษาไทยตรงๆ เพื่อให้ AI คัดแยกกลุ่มเป้าหมาย{' '}
                        <strong>Tier 1 (Direct Match)</strong> และ{' '}
                        <strong>Tier 2 (Lookalike Expansion)</strong> พร้อมแก้ไขข้อความทักทายรายบุคคลใน Studio ก่อนกดส่ง
                      </p>
                    </div>

                    <ul className="space-y-2.5 text-xs text-ink-primary font-thai">
                      {[
                        'คัดกรอง PDPA Opt-Out ให้อัตโนมัติก่อนปล่อยแคมเปญทุกครั้ง',
                        'เปรียบเทียบ Conversion ของกลุ่ม Direct vs Lookalike ได้ทันทีใน Tab 4',
                        'ผลตอบรับจากแชตลูกค้าไหลกลับมาอัปเดตโปรไฟล์อัตโนมัติ (Closed-Loop)',
                      ].map((bullet) => (
                        <li key={bullet} className="flex items-start gap-2">
                          <Check
                            className="mt-0.5 h-4 w-4 shrink-0 text-status-verified"
                            aria-hidden="true"
                          />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>

                    <div>
                      <button
                        type="button"
                        onClick={() => onEnterWorkspace('segment', false)}
                        className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand-slate px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
                      >
                        <span>Try Audience Studio</span>
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border-subtle bg-canvas p-5 lg:col-span-6">
                    <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                      <span className="font-data text-xs font-semibold text-ink-primary">
                        Audience Decisioning Preview
                      </span>
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-data text-[10px] font-semibold text-emerald-800">
                        14 Consented · 1 Opt-Out Shielded
                      </span>
                    </div>
                    <div className="mt-4 space-y-2.5">
                      {SANDBOX_PROFILES.map((prof, idx) => (
                        <div
                          key={prof.id}
                          className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-surface p-3"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-ink-primary font-thai">
                              {prof.nickname} ({prof.fullName})
                            </p>
                            <p className="truncate text-[11px] text-ink-secondary font-thai">
                              {prof.attributes.map((a) => a.value).join(' · ')}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 rounded-full border px-2 py-0.5 font-data text-[11px] font-bold ${
                              idx < 2
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                : 'border-amber-300 bg-brand-amber-soft text-amber-950'
                            }`}
                          >
                            {idx === 0
                              ? 'Direct 95%'
                              : idx === 1
                                ? 'Direct 92%'
                                : 'Lookalike 76%'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  role="tabpanel"
                  aria-labelledby="role-tab-engineer"
                  className="grid items-stretch gap-6 rounded-2xl border border-border-subtle bg-surface p-6 shadow-[0_1px_2px_rgba(9,9,11,0.04),0_4px_12px_rgba(9,9,11,0.03)] lg:grid-cols-12 lg:p-8"
                >
                  <div className="flex flex-col justify-between space-y-5 lg:col-span-6">
                    <div className="space-y-3">
                      <span className="inline-flex items-center gap-1.5 rounded-md border border-border-subtle bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-ink-primary">
                        <Code2
                          className="h-3.5 w-3.5 text-brand-amber-hover"
                          aria-hidden="true"
                        />
                        <span>Serverless Proxy & Schema Governance</span>
                      </span>
                      <h3 className="text-xl font-bold tracking-tight text-ink-primary">
                        Zero-hallucination citations, strict TypeScript
                        contracts, and resilient AI proxy
                      </h3>
                      <p className="text-sm leading-relaxed text-ink-secondary font-thai">
                        ทุกการเรียก AI ผ่าน Vercel Serverless{' '}
                        <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">
                          POST /api/ai
                        </code>{' '}
                        เชื่อม MaxPlus AI (<code className="text-xs">gpt-6-luna</code>) พร้อมสลับ{' '}
                        <code className="text-xs">/chat/completions</code> ↔{' '}
                        <code className="text-xs">/responses</code> อัตโนมัติ และถอยกลับใช้ Local Semantic Engine ทันทีเมื่อไม่มี Key
                      </p>
                    </div>

                    <ul className="space-y-2.5 text-xs text-ink-primary">
                      {[
                        'Substring-verified evidenceQuote validation prevents fabricated AI attributes',
                        'Client code never stores or transmits LLM_API_KEY (server-only boundary)',
                        'Deterministic fallback guarantees 100% live demo uptime offline or on Vercel',
                      ].map((bullet) => (
                        <li key={bullet} className="flex items-start gap-2">
                          <Check
                            className="mt-0.5 h-4 w-4 shrink-0 text-status-verified"
                            aria-hidden="true"
                          />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>

                    <div>
                      <button
                        type="button"
                        onClick={() => onEnterWorkspace('collect', true)}
                        className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand-slate px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
                      >
                        <span>Open AI Lead X-Ray Mode</span>
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-slate-800 bg-brand-slate p-5 text-zinc-100 lg:col-span-6">
                    <div className="flex items-center justify-between border-b border-slate-700 pb-2.5">
                      <span className="font-data text-xs font-semibold text-amber-300">
                        src/types/cdp.ts · Grounded Attribute Contract
                      </span>
                      <span className="font-data text-[10px] text-zinc-400">
                        strict: true
                      </span>
                    </div>
                    <pre className="mt-3 overflow-x-auto font-data text-xs leading-relaxed text-zinc-200">
                      <code>{`interface ExtractedAttribute {
  id: string;
  category: 'food' | 'activity' | 'vibe' | 'budget';
  value: string;
  confidence: number;       // 50-95% gate check
  evidenceQuote: string;    // Exact source substring
  source: 'LINE_CHAT' | 'FACEBOOK_POST' | 'DEPT_ROSTER';
  status: 'verified' | 'needs_review' | 'rejected';
}`}</code>
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* SECTION 4: 4-PILLAR WORKSPACE JUMP BENTO */}
        <section
          id="architecture"
          className="border-b border-border-subtle bg-surface py-16 sm:py-20"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl space-y-2">
              <p className="text-xs font-semibold tracking-wider text-brand-amber-hover uppercase">
                Interactive 4-Pillar Workspace
              </p>
              <h2 className="text-2xl font-bold tracking-tight text-ink-primary sm:text-3xl">
                Jump directly into any stage of the CDP lifecycle
              </h2>
            </div>

            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  tab: 'collect' as WorkflowTabId,
                  step: '01',
                  title: 'Collect & Unify',
                  subtitle: 'Identity Graph + Queue',
                  desc: 'Visual 3-to-1 handle resolution, AI stitching for 30 raw signals, and inline Unmerge / Re-merge testing.',
                  icon: Layers,
                },
                {
                  tab: 'profiles' as WorkflowTabId,
                  step: '02',
                  title: 'Customer 360',
                  subtitle: 'Evidence & Governance',
                  desc: 'Searchable profiles in Card or Enterprise Table view with source quote inspection and Raw JSON drawer.',
                  icon: Users,
                },
                {
                  tab: 'segment' as WorkflowTabId,
                  step: '03',
                  title: 'Customer Studio',
                  subtitle: 'Semantic AI Decisioning',
                  desc: 'Prompt-driven Direct vs Lookalike scoring, generated SQL logic preview, and live LINE OA invite preview.',
                  icon: Sparkles,
                },
                {
                  tab: 'analytics' as WorkflowTabId,
                  step: '04',
                  title: 'Activation & Loop',
                  subtitle: 'Closed-Loop Sync',
                  desc: 'Real conversion funnels, simulated Thai chat replies, and automatic behavioral trait writebacks.',
                  icon: Activity,
                },
              ].map((card) => {
                const Icon = card.icon;
                return (
                  <button
                    key={card.step}
                    type="button"
                    onClick={() => onEnterWorkspace(card.tab, false)}
                    className="group flex flex-col justify-between rounded-xl border border-border-subtle bg-canvas p-5 text-left transition-colors hover:border-brand-amber hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border-subtle bg-surface text-brand-amber-hover">
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </div>
                        <span className="font-data text-xs font-semibold text-ink-secondary">
                          {card.step}
                        </span>
                      </div>
                      <h3 className="mt-4 text-base font-bold tracking-tight text-ink-primary">
                        {card.title}
                      </h3>
                      <p className="mt-0.5 text-xs font-semibold text-brand-amber-hover">
                        {card.subtitle}
                      </p>
                      <p className="mt-2 text-xs leading-relaxed text-ink-secondary">
                        {card.desc}
                      </p>
                    </div>
                    <span className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-ink-primary group-hover:text-brand-amber-hover">
                      <span>Open Step {card.step}</span>
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* SECTION 5: CONVERSION BANNER */}
        <section className="bg-canvas py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col justify-between gap-6 rounded-2xl bg-brand-slate p-8 text-white shadow-[0_8px_30px_rgba(15,23,42,0.18)] lg:flex-row lg:items-center lg:p-10">
              <div className="max-w-2xl space-y-2">
                <div className="inline-flex items-center gap-2 text-xs font-semibold text-amber-300">
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Full Interactive Sandbox Ready</span>
                </div>
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  Ready to present the full Customer Studio experience?
                </h2>
                <p className="text-sm leading-relaxed text-zinc-300 font-thai">
                  เข้าสู่ Workspace เพื่อสาธิตการรวมโปรไฟล์ 15 รายการ การปรับเกณฑ์ความเชื่อมั่น และ Closed-Loop AI Activation แบบสดๆ
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.985 }}
                  onClick={() => onEnterWorkspace('collect', false)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-amber px-5 py-2.5 text-sm font-semibold text-brand-slate transition-colors hover:bg-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                >
                  <span>Enter Customer Studio</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </motion.button>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.985 }}
                  onClick={() => onEnterWorkspace('collect', true)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-600 bg-slate-800/70 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                >
                  <Database className="h-4 w-4 text-amber-300" aria-hidden="true" />
                  <span>Open X-Ray Mode</span>
                </motion.button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border-subtle bg-surface py-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 text-xs text-ink-secondary sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <span translate="no" className="font-semibold text-ink-primary">
              Mini CDP
            </span>
            <span>· Composable AI Customer Data Platform Demo</span>
          </div>
          <div className="flex items-center gap-4 font-data text-[11px]">
            <span>LINE_CHAT + FACEBOOK_POST + DEPT_ROSTER</span>
            <span>PDPA Enforced</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
