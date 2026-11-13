import type { ReplyPreference } from '../services/ai/replyReading.ts';
import type { CampaignInteractionStatus, CampaignRecord, ExtractedAttribute, RawSourceRecord, UnifiedProfile, UnlinkedRecord } from '../types/cdp.ts';

/**
 * Links a message of unknown authorship to the friend a person confirmed. The friend goes back to
 * "not combined" so the next run reads the new message. Linking never changes consent.
 */
export function linkUnlinkedRecord(
  records: readonly RawSourceRecord[],
  profiles: readonly UnifiedProfile[],
  record: UnlinkedRecord,
  profileId: string,
): { records: RawSourceRecord[]; profiles: UnifiedProfile[] } | null {
  if (!profiles.some((profile) => profile.id === profileId) || records.some((item) => item.id === record.id)) return null;
  return {
    records: [...records, { ...record, linkedProfileId: profileId }],
    profiles: profiles.map((profile) => (profile.id === profileId ? { ...profile, isStitched: false } : profile)),
  };
}

export interface PastedReply {
  profileId: string;
  replyText: string;
  status: CampaignInteractionStatus;
  /** A condition or postponement, or an empty string. */
  note: string;
  preference: ReplyPreference | null;
  confidence: number;
}

/**
 * Writes a reply the organiser pasted back into the campaign and the friend's profile: the result
 * row, the invitation history item and, when the reply revealed one, a new interest with its quote.
 * Returns null when the friend was not a recipient or the reply is empty.
 */
export function applyPastedReply(
  campaign: CampaignRecord,
  profiles: readonly UnifiedProfile[],
  reply: PastedReply,
  nowIso: string,
): { campaign: CampaignRecord; profiles: UnifiedProfile[] } | null {
  const text = reply.replyText.trim();
  const match = campaign.matches.find((item) => item.selected && item.profileId === reply.profileId);
  if (!text || !match) return null;
  const replies = [
    ...campaign.replies.filter((item) => item.profileId !== reply.profileId),
    {
      profileId: reply.profileId,
      status: reply.status,
      replyText: text,
      tier: match.tier,
      feedbackTag: reply.preference?.value ?? '',
      feedbackCategory: reply.preference?.category,
      note: reply.note || undefined,
      origin: 'pasted' as const,
    },
  ];
  const attributeId = `attr_reply_${reply.profileId}_${campaign.id}`;
  return {
    campaign: { ...campaign, replies, closedLoopUpdatesCount: replies.filter((item) => item.status !== 'pending').length },
    profiles: profiles.map((profile) => {
      if (profile.id !== reply.profileId) return profile;
      const previous = profile.campaignHistory.find((item) => item.campaignId === campaign.id);
      const history = {
        campaignId: campaign.id,
        campaignName: campaign.name,
        status: reply.status,
        sentMessage: previous?.sentMessage ?? match.personalizedInvite,
        replyText: text,
        note: reply.note || undefined,
        timestamp: nowIso,
      };
      const learned: ExtractedAttribute[] = reply.preference
        ? [{
            id: attributeId,
            category: reply.preference.category,
            value: reply.preference.value,
            confidence: Math.min(97, Math.max(75, Math.round(reply.confidence))),
            evidenceQuote: reply.preference.evidenceQuote,
            source: 'LINE_CHAT',
            status: reply.confidence >= 80 ? 'verified' : 'needs_review',
          }]
        : [];
      return {
        ...profile,
        campaignHistory: [history, ...profile.campaignHistory.filter((item) => item.campaignId !== campaign.id)],
        attributes: [...profile.attributes.filter((attribute) => attribute.id !== attributeId), ...learned],
      };
    }),
  };
}
