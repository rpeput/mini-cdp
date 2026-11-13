import type { AttributeCategory, CampaignRecord, RawSourceRecord, UnifiedProfile, UnlinkedRecord, WorkflowTabId } from '../types/cdp.ts';
import { eligibleProfileIds, summarizeCampaign } from './campaignFlow.ts';
import { getEffectiveAttributeStatus } from './cdpHelpers.ts';
import { listReviewRows } from './reviewQueue.ts';

export const CATEGORY_LABEL_TH: Record<AttributeCategory, string> = {
  food: 'อาหาร',
  activity: 'กิจกรรม',
  vibe: 'สไตล์',
  budget: 'งบ',
};

export interface FunnelStage {
  id: 'messages' | 'combined' | 'consented' | 'sent' | 'accepted';
  label: string;
  unit: 'ข้อความ' | 'คน';
  count: number;
}

/**
 * Counts the path from raw messages to accepted invitations. Messages, combined profiles and
 * consented profiles are counted from the same lists the Sources and Friends pages show. Sent and
 * accepted come from summarizeCampaign for the newest campaign, the one the Results page opens first.
 */
export function buildFunnel(
  records: readonly RawSourceRecord[],
  profiles: readonly UnifiedProfile[],
  campaigns: readonly CampaignRecord[],
): FunnelStage[] {
  const totals = summarizeCampaign(campaigns[0]);
  return [
    { id: 'messages', label: 'ข้อความต้นทาง', unit: 'ข้อความ', count: records.length },
    { id: 'combined', label: 'โปรไฟล์ที่รวมข้อมูลแล้ว', unit: 'คน', count: profiles.filter((profile) => profile.isStitched).length },
    { id: 'consented', label: 'พร้อมรับคำเชิญ (ยินยอมแล้ว)', unit: 'คน', count: eligibleProfileIds(profiles).size },
    { id: 'sent', label: 'ส่งคำเชิญ (แคมเปญล่าสุด)', unit: 'คน', count: totals.sent },
    { id: 'accepted', label: 'ตอบรับ (แคมเปญล่าสุด)', unit: 'คน', count: totals.accepted },
  ];
}

export interface NextAction {
  id: 'stitch' | 'review' | 'inbox' | 'replies';
  title: string;
  detail: string;
  cta: string;
  tab: WorkflowTabId;
  /** Element id to scroll to on the target page. */
  anchor?: string;
  count: number;
}

export interface NextActionInput {
  profiles: readonly UnifiedProfile[];
  campaigns: readonly CampaignRecord[];
  inbox: readonly UnlinkedRecord[];
  confidenceThreshold: number;
  manuallyApprovedIds: ReadonlySet<string>;
}

/** Up to three things to do next, most important first. An empty list means nothing is waiting. */
export function buildNextActions(input: NextActionInput, limit = 3): NextAction[] {
  const waitingProfiles = input.profiles.filter((profile) => !profile.isStitched).length;
  const waitingInterests = listReviewRows(input.profiles, input.confidenceThreshold, input.manuallyApprovedIds).length;
  const unowned = input.inbox.length;
  const waitingReplies = summarizeCampaign(input.campaigns[0]).pending;
  const actions: NextAction[] = [];
  if (waitingProfiles) {
    actions.push({ id: 'stitch', count: waitingProfiles, title: `${waitingProfiles} โปรไฟล์รอรวมข้อมูล`,
      detail: 'ข้อความใหม่ยังไม่ถูกอ่านเข้าโปรไฟล์ กดรวมข้อมูลก่อนสร้างแคมเปญ', cta: 'ไปรวมข้อมูล', tab: 'collect' });
  }
  if (waitingInterests) {
    actions.push({ id: 'review', count: waitingInterests, title: `${waitingInterests} ความสนใจรอตรวจ`,
      detail: 'ระบบยังไม่มั่นใจ ตรวจข้อความอ้างอิงแล้วยืนยันหรือปฏิเสธ', cta: 'ไปตรวจความสนใจ', tab: 'collect', anchor: 'review-queue' });
  }
  if (unowned) {
    actions.push({ id: 'inbox', count: unowned, title: `ข้อความที่ยังไม่รู้เจ้าของ ${unowned} รายการ`,
      detail: 'เลือกว่าข้อความเหล่านี้เป็นของเพื่อนคนไหน', cta: 'ไปเลือกเจ้าของข้อความ', tab: 'collect', anchor: 'identity-inbox' });
  }
  if (waitingReplies) {
    actions.push({ id: 'replies', count: waitingReplies, title: `แคมเปญล่าสุดมี ${waitingReplies} คนยังไม่ตอบ`,
      detail: 'ดูว่าใครยังไม่ตอบ หรือบันทึกคำตอบที่ได้รับ', cta: 'ดูผลแคมเปญ', tab: 'analytics' });
  }
  return actions.slice(0, limit);
}

export interface InterestSlice {
  category: AttributeCategory;
  label: string;
  count: number;
}

/** Counts only interests a person or the threshold has confirmed, on combined profiles. */
export function countVerifiedInterests(
  profiles: readonly UnifiedProfile[],
  confidenceThreshold: number,
  manuallyApprovedIds: ReadonlySet<string>,
): InterestSlice[] {
  const counts: Record<AttributeCategory, number> = { food: 0, activity: 0, vibe: 0, budget: 0 };
  for (const profile of profiles) {
    if (!profile.isStitched) continue;
    for (const attribute of profile.attributes) {
      if (getEffectiveAttributeStatus(attribute, confidenceThreshold, manuallyApprovedIds) === 'verified') counts[attribute.category] += 1;
    }
  }
  return (Object.keys(CATEGORY_LABEL_TH) as AttributeCategory[]).map((category) => ({ category, label: CATEGORY_LABEL_TH[category], count: counts[category] }));
}
