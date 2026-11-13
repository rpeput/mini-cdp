import type { BriefConstraint, BriefConstraintKind, CampaignBrief, CampaignMatch, UnifiedProfile } from '../../types/cdp.ts';
import { SEMANTIC_CLUSTERS } from '../aiEngine.ts';
import { callAi } from '../aiClient.ts';
import { isObject, isString, isVerbatim } from './guards.ts';

const KINDS = new Set<string>(['activity', 'day', 'time', 'place', 'budgetMax', 'groupSize']);
/** Constraints the organiser is asked about when they are missing. */
const ASKED: ReadonlyArray<{ kind: BriefConstraintKind; question: string }> = [
  { kind: 'day', question: 'อยากชวนวันไหน' },
  { kind: 'budgetMax', question: 'งบไม่เกินเท่าไหร่' },
  { kind: 'groupSize', question: 'ชวนกี่คน' },
];

const DAY = /(?:วัน)?(?:จันทร์|อังคาร|พุธ|พฤหัสบดี|พฤหัส|ศุกร์|เสาร์|อาทิตย์)(?:นี้|หน้า)?(?:\s*-\s*(?:วัน)?(?:จันทร์|อังคาร|พุธ|พฤหัสบดี|พฤหัส|ศุกร์|เสาร์|อาทิตย์))?|สุดสัปดาห์|พรุ่งนี้|วันนี้/;
const TIME = /หลังเลิกเรียน|หลังมอ|ตอนเย็น|ตอนเช้า|ช่วงเช้า|\b\d{1,2}[:.]\d{2}\b|\d{1,2}\s*โมง(?:เช้า|เย็น)?|\d{1,2}\s*ทุ่ม/;
const PLACE = /ร้าน[^\s,]+|คอร์ตหลังมอ|หอสมุด|เมืองเก่า|บางแสน|หัวหิน|ม่อนแจ่ม|ภูทับเบิก|เขาใหญ่|เชียงดาว|แสมสาร|เสม็ด|ภูเก็ต|หน้ามอ|ในมอ/;
const BUDGET = /(?:งบ(?:ไม่เกิน|ประมาณ)?|ไม่เกิน)\s*(\d{2,5})(?:\s*บาท)?|(\d{2,5})\s*บาท/;
const SIZE = /(?:ไม่เกิน\s*)?(\d{1,2})\s*คน/;

export function constraint(brief: Pick<CampaignBrief, 'constraints'>, kind: BriefConstraintKind): BriefConstraint | undefined {
  return brief.constraints.find((item) => item.kind === kind);
}

export function missingConstraints(constraints: readonly BriefConstraint[]): BriefConstraintKind[] {
  return ASKED.map((item) => item.kind).filter((kind) => !constraints.some((item) => item.kind === kind));
}

function questionFor(constraints: readonly BriefConstraint[]): string {
  const missing = ASKED.filter((item) => missingConstraints(constraints).includes(item.kind)).slice(0, 2);
  return missing.length ? `${missing.map((item) => item.question).join('และ')}?` : '';
}

/** Regex baseline: reads digits and common day, time and place words, but not number words or loose phrasing. */
export function parseBriefWithRules(prompt: string): CampaignBrief {
  const constraints: BriefConstraint[] = [];
  const lower = prompt.toLowerCase();
  const cluster = SEMANTIC_CLUSTERS.find((item) => item.promptKeywords.some((keyword) => lower.includes(keyword.toLowerCase()) && keyword !== 'กิน'));
  const activityWord = cluster?.promptKeywords.find((keyword) => lower.includes(keyword.toLowerCase()) && keyword !== 'กิน');
  if (cluster && activityWord) constraints.push({ kind: 'activity', value: cluster.label.replace(/^สาย/, ''), quote: prompt.slice(lower.indexOf(activityWord.toLowerCase()), lower.indexOf(activityWord.toLowerCase()) + activityWord.length) });
  const day = prompt.match(DAY);
  if (day) constraints.push({ kind: 'day', value: day[0], quote: day[0] });
  const time = prompt.match(TIME);
  if (time) constraints.push({ kind: 'time', value: time[0], quote: time[0] });
  const place = prompt.match(PLACE);
  if (place) constraints.push({ kind: 'place', value: place[0], quote: place[0] });
  const budget = prompt.match(BUDGET);
  if (budget) constraints.push({ kind: 'budgetMax', value: Number(budget[1] ?? budget[2]), quote: budget[0] });
  const size = prompt.match(SIZE);
  if (size && !/บาท/.test(size[0])) constraints.push({ kind: 'groupSize', value: Number(size[1]), quote: size[0] });
  return { prompt, constraints, clarifyingQuestion: questionFor(constraints), source: 'local' };
}

export function parseBriefPayload(raw: unknown, prompt: string): CampaignBrief | null {
  if (!isObject(raw) || !Array.isArray(raw.constraints) || !isString(raw.clarifyingQuestion)) return null;
  const constraints: BriefConstraint[] = [];
  const seen = new Set<string>();
  for (const item of raw.constraints) {
    if (!isObject(item) || !isString(item.kind) || !KINDS.has(item.kind) || !isString(item.quote)) return null;
    const kind = item.kind as BriefConstraintKind;
    const numeric = kind === 'budgetMax' || kind === 'groupSize';
    if (numeric ? typeof item.value !== 'number' || !Number.isFinite(item.value) || item.value <= 0 : !isString(item.value) || !item.value.trim()) return null;
    // Number words may be normalised ("สามร้อย" becomes 300), but the quote must still be in the description.
    if (!isVerbatim(item.quote, prompt)) return null;
    if (seen.has(kind)) continue;
    seen.add(kind);
    constraints.push({ kind, value: numeric ? Math.round(item.value as number) : String(item.value).trim().slice(0, 60), quote: item.quote.trim() });
  }
  return { prompt, constraints, clarifyingQuestion: raw.clarifyingQuestion.trim().slice(0, 140), source: 'model' };
}

/** Reads the campaign description into editable constraints. The organiser can remove or change any of them. */
export async function readBrief(prompt: string): Promise<CampaignBrief> {
  const result = await callAi('parse_brief', { prompt }, (raw) => parseBriefPayload(raw, prompt));
  return result.data ?? parseBriefWithRules(prompt);
}

/** A friend whose profile says they are short of money. */
function hasTightBudget(profile: UnifiedProfile): boolean {
  return profile.attributes.some((attribute) => attribute.category === 'budget' && attribute.status !== 'rejected' && /ช็อต|ประหยัด/.test(attribute.value));
}

/** A cap above this is not cheap enough to leave a short-of-money friend out of the warning. */
export const CHEAP_BUDGET_LIMIT = 250;

/**
 * Applies the constraints to recommendations: a group size keeps only that many people selected
 * (strongest first), and a friend with a tight budget gets a visible warning unless the campaign
 * is cheap. Nobody is removed from the list.
 */
export function applyBriefToMatches(matches: readonly CampaignMatch[], brief: CampaignBrief | null, profiles: readonly UnifiedProfile[]): CampaignMatch[] {
  if (!brief) return [...matches];
  const size = constraint(brief, 'groupSize')?.value;
  const budget = constraint(brief, 'budgetMax')?.value;
  const byId = new Map(profiles.map((profile) => [profile.id, profile]));
  const strongest = [...matches].sort((a, b) => b.matchScore - a.matchScore);
  const keep = typeof size === 'number' ? new Set(strongest.filter((match) => match.selected).slice(0, size).map((match) => match.profileId)) : null;
  return matches.map((match) => {
    const profile = byId.get(match.profileId);
    const warn = profile && hasTightBudget(profile) && (typeof budget !== 'number' || budget > CHEAP_BUDGET_LIMIT);
    return {
      ...match,
      selected: keep ? keep.has(match.profileId) : match.selected,
      aiReasoning: warn ? `${match.aiReasoning} · ระวัง: ${profile.nickname}มีโน้ตว่างบตึง` : match.aiReasoning,
    };
  });
}
