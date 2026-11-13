import type { CampaignRecord, UnifiedProfile } from '../../types/cdp.ts';
import { callAi } from '../aiClient.ts';
import { isObject, isString, stripEmoji } from './guards.ts';

export interface SummaryPoint {
  kind: 'insight' | 'next_step';
  text: string;
  /** Profile ids of the replies this point rests on. Every point has at least one. */
  citations: string[];
}

export interface CampaignSummary {
  points: SummaryPoint[];
  source: 'model' | 'rules';
}

interface ReplyInput {
  profileId: string;
  nickname: string;
  status: string;
  replyText: string;
  note: string;
  feedbackTag: string;
}

const MAX_POINTS = 5;

function replyInputs(campaign: CampaignRecord, profiles: readonly UnifiedProfile[]): ReplyInput[] {
  const names = new Map(profiles.map((profile) => [profile.id, profile.nickname]));
  return campaign.matches
    .filter((match) => match.selected)
    .map((match) => {
      const reply = campaign.replies.find((item) => item.profileId === match.profileId);
      return {
        profileId: match.profileId,
        nickname: names.get(match.profileId) ?? match.profileId,
        status: reply?.status ?? 'pending',
        replyText: reply?.replyText ?? '',
        note: reply?.note ?? '',
        feedbackTag: reply?.feedbackTag ?? '',
      };
    });
}

const join = (names: readonly string[]) => names.join(' ');

/** Rule baseline: groups the replies by the reason tag already saved on them. It explains only what was tagged. */
export function summarizeWithRules(campaign: CampaignRecord, profiles: readonly UnifiedProfile[]): SummaryPoint[] {
  const replies = replyInputs(campaign, profiles);
  const points: SummaryPoint[] = [];
  const declined = replies.filter((reply) => reply.status === 'declined');
  const byReason = new Map<string, ReplyInput[]>();
  for (const reply of declined) byReason.set(reply.feedbackTag || 'ไม่ระบุเหตุผล', [...(byReason.get(reply.feedbackTag || 'ไม่ระบุเหตุผล') ?? []), reply]);
  for (const [reason, group] of byReason) {
    points.push({ kind: 'insight', text: `${join(group.map((reply) => reply.nickname))} ปฏิเสธ (${reason})`, citations: group.map((reply) => reply.profileId) });
  }
  const conditional = replies.filter((reply) => reply.note);
  if (conditional.length) {
    points.push({ kind: 'insight', text: `${join(conditional.map((reply) => reply.nickname))} ตอบแบบมีเงื่อนไข: ${conditional.map((reply) => reply.note).join(', ')}`, citations: conditional.map((reply) => reply.profileId) });
  }
  const waiting = replies.filter((reply) => reply.status === 'pending' && !reply.note);
  if (waiting.length) {
    points.push({ kind: 'next_step', text: `ตามต่อ ${join(waiting.map((reply) => reply.nickname))} ที่ยังไม่ตอบ`, citations: waiting.map((reply) => reply.profileId) });
  }
  return points.slice(0, MAX_POINTS);
}

/** Keeps only points whose citations are real recipients. A point with none left is dropped. */
export function parseCampaignSummary(raw: unknown, campaign: CampaignRecord): SummaryPoint[] | null {
  if (!isObject(raw) || !Array.isArray(raw.points)) return null;
  const recipients = new Set(campaign.matches.filter((match) => match.selected).map((match) => match.profileId));
  const points: SummaryPoint[] = [];
  for (const item of raw.points) {
    if (!isObject(item) || !isString(item.text) || (item.kind !== 'insight' && item.kind !== 'next_step') || !Array.isArray(item.citations)) return null;
    const citations = [...new Set(item.citations.filter((id): id is string => isString(id) && recipients.has(id)))];
    const text = stripEmoji(item.text).slice(0, 220);
    if (citations.length && text) points.push({ kind: item.kind, text, citations });
  }
  return points.length ? points.slice(0, MAX_POINTS) : null;
}

/** Summarises a campaign. Counts come from the app; the model explains the replies and cites them. */
export async function summarizeCampaign(campaign: CampaignRecord, profiles: readonly UnifiedProfile[]): Promise<CampaignSummary> {
  const replies = replyInputs(campaign, profiles);
  const result = await callAi('summarize_campaign', { campaignName: campaign.name, replies }, (raw) => parseCampaignSummary(raw, campaign));
  return result.data ? { points: result.data, source: 'model' } : { points: summarizeWithRules(campaign, profiles), source: 'rules' };
}
