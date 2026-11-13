import { motion } from 'framer-motion';
import {
  CheckCircle2,
  Code2,
  Edit3,
  Loader2,
  MessageSquare,
  Send,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Users,
} from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { CAMPAIGN_PRESETS } from '../data/seedData.ts';
import type { CampaignMatch, UnifiedProfile } from '../types/cdp.ts';
import { CARD_SURFACE_CLASS } from '../utils/cdpHelpers.ts';

interface CampaignSegmentTabProps {
  profiles: UnifiedProfile[];
  campaignPrompt: string;
  onPromptChange: (value: string) => void;
  matches: CampaignMatch[];
  onMatchesChange: (matches: CampaignMatch[]) => void;
  isSegmenting: boolean;
  onRunSegment: (prompt: string) => Promise<void>;
  onLaunchCampaign: (campaignName: string, matches: CampaignMatch[]) => void;
}

type StudioLogicTab = 'visual' | 'sql';

export function CampaignSegmentTab({
  profiles,
  campaignPrompt,
  onPromptChange,
  matches,
  onMatchesChange,
  isSegmenting,
  onRunSegment,
  onLaunchCampaign,
}: CampaignSegmentTabProps) {
  const [focusedProfileId, setFocusedProfileId] = useState<string | null>(null);
  const [logicTab, setLogicTab] = useState<StudioLogicTab>('visual');
  const promptInputId = useId();
  const visualTabRef = useRef<HTMLButtonElement | null>(null);
  const sqlTabRef = useRef<HTMLButtonElement | null>(null);

  const profileMap = new Map(profiles.map((p) => [p.id, p]));
  const directMatches = matches.filter((m) => m.tier === 'direct');
  const lookalikeMatches = matches.filter((m) => m.tier === 'lookalike');
  const selectedMatches = matches.filter((m) => m.selected);

  const activeStudioMatch =
    matches.find((m) => m.profileId === focusedProfileId) ??
    selectedMatches[0] ??
    matches[0] ??
    null;
  const activeStudioProfile = activeStudioMatch
    ? profileMap.get(activeStudioMatch.profileId) ?? null
    : null;

  const stitchedEligibleCount = profiles.filter(
    (p) => p.isStitched && p.consentPdpa,
  ).length;
  const pdpaOptOutCount = profiles.filter(
    (p) => p.isStitched && !p.consentPdpa,
  ).length;
  const lookalikeSelectedCount = lookalikeMatches.filter((m) => m.selected).length;

  const toggleMatchSelection = (profileId: string) => {
    onMatchesChange(
      matches.map((m) =>
        m.profileId === profileId ? { ...m, selected: !m.selected } : m,
      ),
    );
  };

  const handleBulkSelectDirect = () => {
    onMatchesChange(
      matches.map((m) =>
        m.tier === 'direct' ? { ...m, selected: true } : m,
      ),
    );
  };

  const handleBulkToggleLookalike = () => {
    const shouldSelect = lookalikeSelectedCount < lookalikeMatches.length;
    onMatchesChange(
      matches.map((m) =>
        m.tier === 'lookalike' ? { ...m, selected: shouldSelect } : m,
      ),
    );
  };

  const handleBulkClear = () => {
    onMatchesChange(matches.map((m) => ({ ...m, selected: false })));
  };

  const updateInviteMessage = (profileId: string, invite: string) => {
    onMatchesChange(
      matches.map((m) =>
        m.profileId === profileId ? { ...m, personalizedInvite: invite } : m,
      ),
    );
  };

  const handlePresetClick = async (preset: string) => {
    onPromptChange(preset);
    await onRunSegment(preset);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onRunSegment(campaignPrompt);
  };

  const handleLogicTabKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    current: StudioLogicTab,
  ) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const next: StudioLogicTab = current === 'visual' ? 'sql' : 'visual';
      setLogicTab(next);
      if (next === 'visual') {
        visualTabRef.current?.focus();
      } else {
        sqlTabRef.current?.focus();
      }
    }
  };

  const sanitizedPromptForSql = (
    campaignPrompt.trim() || 'Weekend Mookata & Social Hangout'
  ).replace(/'/g, "''");

  const renderMatchCard = (match: CampaignMatch) => {
    const profile = profileMap.get(match.profileId);
    if (!profile) {
      return null;
    }
    const isFocused = activeStudioMatch?.profileId === match.profileId;

    return (
      <div
        key={match.profileId}
        className={`rounded-xl border p-3.5 transition-colors ${
          isFocused
            ? 'border-brand-amber bg-brand-amber-soft/30'
            : match.selected
              ? 'border-border-subtle bg-surface'
              : 'border-border-subtle bg-canvas/70'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              name={`select_${match.profileId}`}
              aria-label={`Select ${profile.nickname} (${profile.fullName}) for campaign`}
              checked={match.selected}
              onChange={() => toggleMatchSelection(match.profileId)}
              className="mt-1 h-4 w-4 shrink-0 rounded border-zinc-300 accent-brand-amber focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
            />
            <div className="flex min-w-0 items-center gap-2.5">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
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
                  <span className="text-xs text-ink-secondary font-thai">
                    {profile.fullName}
                  </span>
                </div>
                <p className="mt-0.5 break-words text-xs leading-relaxed text-ink-secondary font-thai">
                  {match.aiReasoning}
                </p>
              </div>
            </div>
          </label>

          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <span
              className={`font-data rounded-full border px-2 py-0.5 text-xs font-bold ${
                match.tier === 'direct'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-amber-300 bg-brand-amber-soft text-amber-900'
              }`}
            >
              {match.matchScore}%
            </span>
            <motion.button
              type="button"
              whileTap={{ scale: 0.985 }}
              aria-label={`Edit personalized invite for ${profile.nickname}`}
              onClick={() => setFocusedProfileId(match.profileId)}
              className="inline-flex min-h-6 items-center gap-1 rounded border border-border-subtle bg-surface px-2 py-0.5 text-[11px] font-medium text-ink-primary hover:border-brand-amber hover:text-brand-amber-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
            >
              <Edit3 className="h-3 w-3" aria-hidden="true" />
              <span>Preview LINE</span>
            </motion.button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <section
      aria-label="Customer Studio AI Segmentation and Activation"
      className="space-y-6"
    >
      {/* Top Audience Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface px-2.5 py-0.5 text-[11px] font-semibold text-ink-secondary">
            <Sparkles
              className="h-3 w-3 text-brand-amber-hover"
              aria-hidden="true"
            />
            <span>Stage 3 · Customer Studio &amp; LINE Activation</span>
          </div>
          <h1 className="mt-2 text-xl font-bold tracking-tight text-ink-primary sm:text-2xl">
            AI Customer Studio &amp; Semantic Activation
          </h1>
          <p className="mt-1 text-sm leading-relaxed text-ink-secondary font-thai">
            พิมพ์โจทย์แคมเปญภาษาไทยหรืออังกฤษให้ AI คัดกลุ่ม{' '}
            <strong className="font-semibold text-ink-primary">
              Direct Match
            </strong>{' '}
            และ{' '}
            <strong className="font-semibold text-ink-primary">
              Lookalike Expansion
            </strong>{' '}
            พร้อมตรวจสิทธิ์ PDPA และจำลองแชท LINE OA รายบุคคลทันที
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-secondary">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface px-3 py-1.5 font-data">
            <Users
              className="h-3.5 w-3.5 text-status-verified"
              aria-hidden="true"
            />
            <span>
              <strong className="text-ink-primary">
                {stitchedEligibleCount}
              </strong>{' '}
              eligible
            </span>
          </span>
          {pdpaOptOutCount > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 font-data text-rose-800">
              <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{pdpaOptOutCount} PDPA shielded</span>
            </span>
          ) : null}
        </div>
      </div>

      {/* Customer Studio Composer + Logic Preview */}
      <form
        onSubmit={handleSubmit}
        className={`${CARD_SURFACE_CLASS} space-y-5 p-5`}
      >
        <div className="space-y-2">
          <span className="text-xs font-semibold text-ink-secondary">
            1-Click Campaign Presets
          </span>
          <div className="flex flex-wrap gap-2">
            {CAMPAIGN_PRESETS.map((preset) => {
              const active = campaignPrompt.trim() === preset;
              return (
                <motion.button
                  key={preset}
                  type="button"
                  whileTap={{ scale: 0.985 }}
                  onClick={() => handlePresetClick(preset)}
                  className={`min-h-8 rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 font-thai ${
                    active
                      ? 'border-brand-amber bg-brand-amber-soft text-amber-950'
                      : 'border-border-subtle bg-canvas text-ink-primary hover:border-amber-300'
                  }`}
                >
                  {preset}
                </motion.button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <label htmlFor={promptInputId} className="sr-only">
            Campaign segmentation prompt
          </label>
          <input
            id={promptInputId}
            type="text"
            name="campaignPrompt"
            autoComplete="off"
            value={campaignPrompt}
            onChange={(e) => onPromptChange(e.target.value)}
            placeholder="พิมพ์โจทย์แคมเปญ เช่น ชวนไปคาเฟ่ถ่ายรูปแถวเมืองเก่า หรือ ตี้บอร์ดเกมวันศุกร์…"
            className="min-h-11 flex-1 rounded-lg border border-border-subtle bg-canvas px-3.5 py-2 text-sm text-ink-primary placeholder:text-ink-secondary focus:border-brand-amber focus:bg-surface focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 font-thai"
          />
          <motion.button
            type="submit"
            whileTap={{ scale: 0.985 }}
            aria-busy={isSegmenting}
            disabled={isSegmenting || !campaignPrompt.trim()}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-brand-slate px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
          >
            {isSegmenting ? (
              <>
                <Loader2
                  className="h-4 w-4 animate-spin text-brand-amber"
                  aria-hidden="true"
                />
                <span>Segmenting…</span>
              </>
            ) : (
              <>
                <Sparkles
                  className="h-4 w-4 text-brand-amber"
                  aria-hidden="true"
                />
                <span>Find Target Segment</span>
              </>
            )}
          </motion.button>
        </div>

        {/* Visual Builder vs Generated SQL Switcher */}
        <div className="rounded-xl border border-border-subtle bg-canvas">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle px-3.5 py-2">
            <div
              role="tablist"
              aria-label="Audience definition mode"
              className="flex items-center gap-1"
            >
              <button
                ref={visualTabRef}
                id="tab-studio-visual"
                type="button"
                role="tab"
                aria-selected={logicTab === 'visual'}
                aria-controls="panel-studio-visual"
                tabIndex={logicTab === 'visual' ? 0 : -1}
                onKeyDown={(e) => handleLogicTabKeyDown(e, 'visual')}
                onClick={() => setLogicTab('visual')}
                className={`inline-flex min-h-7 items-center gap-1.5 border-b-2 px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 ${
                  logicTab === 'visual'
                    ? 'border-brand-amber text-ink-primary'
                    : 'border-transparent text-ink-secondary hover:text-ink-primary'
                }`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Visual Rule Builder</span>
              </button>

              <button
                ref={sqlTabRef}
                id="tab-studio-sql"
                type="button"
                role="tab"
                aria-selected={logicTab === 'sql'}
                aria-controls="panel-studio-sql"
                tabIndex={logicTab === 'sql' ? 0 : -1}
                onKeyDown={(e) => handleLogicTabKeyDown(e, 'sql')}
                onClick={() => setLogicTab('sql')}
                className={`inline-flex min-h-7 items-center gap-1.5 border-b-2 px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 ${
                  logicTab === 'sql'
                    ? 'border-brand-amber text-ink-primary'
                    : 'border-transparent text-ink-secondary hover:text-ink-primary'
                }`}
              >
                <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Generated SQL Logic</span>
              </button>
            </div>

            <span className="font-data text-[11px] text-ink-secondary">
              Governance Filter: <strong className="text-ink-primary">PDPA = TRUE</strong>
            </span>
          </div>

          {logicTab === 'visual' ? (
            <div
              id="panel-studio-visual"
              role="tabpanel"
              aria-labelledby="tab-studio-visual"
              className="flex flex-wrap items-center gap-2 p-3.5 text-xs"
            >
              <span className="rounded-md border border-border-subtle bg-surface px-2.5 py-1 font-data text-[11px] font-medium text-ink-primary">
                WHERE is_stitched = TRUE
              </span>
              <span className="font-semibold text-ink-secondary">AND</span>
              <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-data text-[11px] font-semibold text-emerald-800">
                consent_pdpa = TRUE ({stitchedEligibleCount} profiles)
              </span>
              <span className="font-semibold text-ink-secondary">AND</span>
              <span className="rounded-md border border-amber-300 bg-brand-amber-soft px-2.5 py-1 text-[11px] font-medium text-amber-950 font-thai">
                AI_SEMANTIC_MATCH(traits, &quot;
                {campaignPrompt.trim() || 'เลือก Preset ด้านบน'}&quot;)
              </span>
            </div>
          ) : (
            <div
              id="panel-studio-sql"
              role="tabpanel"
              aria-labelledby="tab-studio-sql"
              className="p-3.5"
            >
              <pre
                style={{ fontVariantLigatures: 'none' }}
                className="overflow-x-auto rounded-lg bg-brand-slate p-3.5 font-data text-[11px] leading-relaxed text-zinc-100"
              >
                <code>
                  {`SELECT p.id, p.nickname, p.student_id,
       SEMANTIC_SCORE(p.attributes, '${sanitizedPromptForSql}') AS match_score
FROM unified_profiles p
WHERE p.is_stitched = TRUE
  AND p.consent_pdpa = TRUE
HAVING match_score >= 65 -- Direct (82-98) + Lookalike (65-81)
ORDER BY match_score DESC;`}
                </code>
              </pre>
            </div>
          )}
        </div>
      </form>

      {/* Results Split + LINE OA Message Studio */}
      {matches.length === 0 ? (
        <div className={`${CARD_SURFACE_CLASS} p-10 text-center`}>
          <Sparkles
            className="mx-auto h-6 w-6 text-brand-amber-hover"
            aria-hidden="true"
          />
          <h2 className="mt-3 text-sm font-semibold text-ink-primary">
            Ready to segment your unified audience
          </h2>
          <p className="mt-1 text-xs text-ink-secondary font-thai">
            เลือกแคมเปญ Preset ด้านบน หรือพิมพ์โจทย์ความสนใจ แล้วกด &quot;Find
            Target Segment&quot;
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Bulk Governance & Selection Bar */}
          <div
            className={`${CARD_SURFACE_CLASS} flex flex-wrap items-center justify-between gap-3 px-4 py-3`}
          >
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-ink-primary">
                Segment Controls:
              </span>
              <span className="font-data rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                {directMatches.length} Direct
              </span>
              <span className="font-data rounded-full border border-amber-300 bg-brand-amber-soft px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                {lookalikeMatches.length} Lookalike
              </span>
              <span className="font-data text-ink-secondary">
                · <strong className="text-ink-primary">{selectedMatches.length}</strong>{' '}
                selected
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={handleBulkSelectDirect}
                className="inline-flex min-h-7 items-center rounded-md border border-border-subtle bg-canvas px-2.5 py-1 text-[11px] font-medium text-ink-primary hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
              >
                Select All Direct
              </button>
              <button
                type="button"
                onClick={handleBulkToggleLookalike}
                className="inline-flex min-h-7 items-center rounded-md border border-border-subtle bg-canvas px-2.5 py-1 text-[11px] font-medium text-ink-primary hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
              >
                {lookalikeSelectedCount < lookalikeMatches.length
                  ? 'Include Lookalikes'
                  : 'Exclude Lookalikes'}
              </button>
              <button
                type="button"
                onClick={handleBulkClear}
                className="inline-flex min-h-7 items-center rounded-md border border-border-subtle bg-canvas px-2.5 py-1 text-[11px] font-medium text-ink-secondary hover:bg-zinc-100 hover:text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="grid items-start gap-6 lg:grid-cols-12">
            {/* Left: Tier 1 Direct + Tier 2 Lookalike */}
            <div className="min-w-0 space-y-6 lg:col-span-7">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2
                      className="h-4 w-4 text-status-verified"
                      aria-hidden="true"
                    />
                    <h2 className="text-sm font-semibold tracking-tight text-ink-primary">
                      Tier 1: Direct Match
                    </h2>
                  </div>
                  <span className="font-data rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                    {directMatches.length} matched · 82–98%
                  </span>
                </div>

                {directMatches.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border-subtle bg-surface p-4 text-xs text-ink-secondary">
                    No direct keyword overlaps; review Lookalike candidates below.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {directMatches.map(renderMatchCard)}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles
                      className="h-4 w-4 text-brand-amber-hover"
                      aria-hidden="true"
                    />
                    <h2 className="text-sm font-semibold tracking-tight text-ink-primary">
                      Tier 2: Lookalike / Vibe Match
                    </h2>
                  </div>
                  <span className="font-data rounded-full border border-amber-300 bg-brand-amber-soft px-2 py-0.5 text-[11px] font-medium text-amber-900">
                    {lookalikeMatches.length} expanded · 65–81%
                  </span>
                </div>

                {lookalikeMatches.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border-subtle bg-surface p-4 text-xs text-ink-secondary">
                    No additional lookalike matches generated.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {lookalikeMatches.map(renderMatchCard)}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Personalized Message Studio + Live LINE OA Bubble Mockup */}
            <aside
              className={`${CARD_SURFACE_CLASS} min-w-0 space-y-4 p-5 lg:sticky lg:top-28 lg:col-span-5`}
            >
              <div className="border-b border-border-subtle pb-3">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-amber-hover">
                  LINE OA Activation Preview
                </span>
                <h2 className="mt-1 text-sm font-semibold tracking-tight text-ink-primary">
                  {activeStudioProfile
                    ? `1:1 Invite for ${activeStudioProfile.nickname} (${activeStudioProfile.fullName})`
                    : 'Select a match to preview LINE OA message'}
                </h2>
              </div>

              {activeStudioMatch && activeStudioProfile ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`font-data rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                        activeStudioMatch.tier === 'direct'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                          : 'border-amber-300 bg-brand-amber-soft text-amber-900'
                      }`}
                    >
                      {activeStudioMatch.tier === 'direct'
                        ? 'Direct Match'
                        : 'Lookalike'}{' '}
                      · {activeStudioMatch.matchScore}%
                    </span>
                    <span className="break-words text-xs text-ink-secondary font-thai">
                      {activeStudioMatch.aiReasoning}
                    </span>
                  </div>

                  {/* Realistic LINE OA Chat Mockup Frame */}
                  <div className="overflow-hidden rounded-xl border border-border-subtle bg-canvas">
                    <div className="flex items-center justify-between border-b border-border-subtle bg-brand-slate px-3.5 py-2 text-white">
                      <div className="flex items-center gap-2">
                        <MessageSquare
                          className="h-3.5 w-3.5 text-emerald-400"
                          aria-hidden="true"
                        />
                        <span className="text-xs font-semibold">
                          LINE OA Dispatch Preview
                        </span>
                      </div>
                      <span className="font-data text-[10px] text-zinc-300">
                        To: {activeStudioProfile.nickname}
                      </span>
                    </div>

                    <div className="space-y-2 p-3.5">
                      <div className="flex items-start gap-2.5">
                        <div
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-slate font-data text-[10px] font-bold text-amber-400"
                          aria-hidden="true"
                        >
                          BZ
                        </div>
                        <div className="rounded-xl rounded-tl-xs border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs leading-relaxed text-ink-primary font-thai">
                          {activeStudioMatch.personalizedInvite ||
                            'พิมพ์ข้อความเชิญด้านล่างเพื่อดูตัวอย่างทันที…'}
                        </div>
                      </div>
                      <p className="text-right font-data text-[10px] text-ink-secondary">
                        Personalized via Customer 360 Evidence
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="studio-invite-textarea"
                      className="block text-xs font-medium text-ink-secondary"
                    >
                      Edit Tailored Thai LINE Copy
                    </label>
                    <textarea
                      id="studio-invite-textarea"
                      name="personalizedInvite"
                      autoComplete="off"
                      rows={4}
                      value={activeStudioMatch.personalizedInvite}
                      onChange={(e) =>
                        updateInviteMessage(
                          activeStudioMatch.profileId,
                          e.target.value,
                        )
                      }
                      className="w-full rounded-lg border border-border-subtle bg-canvas p-3 text-sm leading-relaxed text-ink-primary focus:border-brand-amber focus:bg-surface focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 font-thai"
                    />
                  </div>

                  <div className="rounded-lg border border-border-subtle bg-canvas p-3">
                    <p className="text-[11px] font-medium text-ink-secondary">
                      Selected Audience Summary
                    </p>
                    <p className="font-data mt-1 text-xs text-ink-primary">
                      {
                        selectedMatches.filter((m) => m.tier === 'direct')
                          .length
                      }{' '}
                      Direct +{' '}
                      {
                        selectedMatches.filter((m) => m.tier === 'lookalike')
                          .length
                      }{' '}
                      Lookalike = {selectedMatches.length} recipients
                    </p>
                  </div>

                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.985 }}
                    disabled={selectedMatches.length === 0}
                    onClick={() =>
                      onLaunchCampaign(
                        campaignPrompt.trim() || 'Untitled Campaign',
                        matches,
                      )
                    }
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-amber-hover px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
                  >
                    <Send className="h-4 w-4" aria-hidden="true" />
                    <span>
                      Launch Campaign to Selected ({selectedMatches.length})
                    </span>
                  </motion.button>
                </div>
              ) : null}
            </aside>
          </div>
        </div>
      )}
    </section>
  );
}
