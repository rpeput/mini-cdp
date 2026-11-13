import type { CampaignBrief } from '../../types/cdp.ts';
import { callAi } from '../aiClient.ts';
import { constraint } from './brief.ts';
import { isObject, isString, isVerbatim } from './guards.ts';

export type ProblemKind = 'unsupported_fact' | 'missing_info' | 'tone';

export interface InviteProblem {
  kind: ProblemKind;
  /** Copied from the invitation; empty for missing_info. */
  quote: string;
  explanation: string;
}

export interface InviteCheck {
  profileId: string;
  ok: boolean;
  problems: InviteProblem[];
}

export interface InviteToCheck {
  profileId: string;
  nickname: string;
  text: string;
}

export interface InviteCheckResult {
  checks: InviteCheck[];
  source: 'model' | 'rules';
}

const KINDS = new Set<string>(['unsupported_fact', 'missing_info', 'tone']);
// Facts an invitation can state: a clock time, a price, a day, a named place.
const FACTS = /\b\d{1,2}[:.]\d{2}\b|\d{1,2}\s*โมง(?:เช้า|เย็น)?|\d{1,2}\s*ทุ่ม|\d{2,5}\s*บาท|งบ\s*\d{2,5}|(?:วัน)?(?:จันทร์|อังคาร|พุธ|พฤหัสบดี|พฤหัส|ศุกร์|เสาร์|อาทิตย์)|ร้าน[^\s,]+/g;

/** Rule baseline: a fact in the invitation must also appear in the campaign description; a day or budget in the brief must reach the friend. */
export function checkInvitesWithRules(invites: readonly InviteToCheck[], brief: CampaignBrief): InviteCheck[] {
  const allowed = brief.prompt;
  const day = constraint(brief, 'day');
  const budget = constraint(brief, 'budgetMax');
  return invites.map(({ profileId, text }) => {
    const problems: InviteProblem[] = [];
    for (const fact of new Set(text.match(FACTS) ?? [])) {
      if (!allowed.includes(fact.trim())) problems.push({ kind: 'unsupported_fact', quote: fact, explanation: `“${fact}” ไม่มีในโจทย์แคมเปญ` });
    }
    if (day && !text.includes(String(day.value)) && !text.includes(day.quote)) problems.push({ kind: 'missing_info', quote: '', explanation: `ไม่ได้บอกวัน (${day.value}) ในคำเชิญ` });
    if (budget && !text.includes(String(budget.value))) problems.push({ kind: 'missing_info', quote: '', explanation: `ไม่ได้บอกงบ (${budget.value} บาท) ในคำเชิญ` });
    return { profileId, ok: problems.length === 0, problems };
  });
}

/** Checks a model answer: it must cover every invitation, and a quote must really be in that invitation. */
export function parseInviteChecks(raw: unknown, invites: readonly InviteToCheck[]): InviteCheck[] | null {
  if (!isObject(raw) || !Array.isArray(raw.checks)) return null;
  const byId = new Map(invites.map((invite) => [invite.profileId, invite]));
  const done = new Map<string, InviteCheck>();
  for (const item of raw.checks) {
    if (!isObject(item) || !isString(item.profileId) || !Array.isArray(item.problems) || typeof item.ok !== 'boolean') return null;
    const invite = byId.get(item.profileId);
    if (!invite || done.has(item.profileId)) return null;
    const problems: InviteProblem[] = [];
    for (const problem of item.problems) {
      if (!isObject(problem) || !isString(problem.kind) || !KINDS.has(problem.kind) || !isString(problem.quote) || !isString(problem.explanation)) return null;
      const kind = problem.kind as ProblemKind;
      // A flag that points at text which is not in the invitation is dropped, not shown.
      if (kind !== 'missing_info' && !isVerbatim(problem.quote, invite.text)) continue;
      problems.push({ kind, quote: kind === 'missing_info' ? '' : problem.quote.trim(), explanation: problem.explanation.trim().slice(0, 160) });
    }
    done.set(item.profileId, { profileId: item.profileId, ok: problems.length === 0, problems });
  }
  if (done.size !== invites.length) return null;
  return invites.map((invite) => done.get(invite.profileId) as InviteCheck);
}

export async function checkInvites(invites: readonly InviteToCheck[], brief: CampaignBrief): Promise<InviteCheckResult> {
  const result = await callAi(
    'check_invites',
    { brief: { prompt: brief.prompt, constraints: brief.constraints }, invites },
    (raw) => parseInviteChecks(raw, invites),
  );
  return result.data ? { checks: result.data, source: 'model' } : { checks: checkInvitesWithRules(invites, brief), source: 'rules' };
}
