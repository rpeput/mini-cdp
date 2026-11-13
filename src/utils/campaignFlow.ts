import type { SimulatedReplyEntry } from '../services/aiEngine.ts';
import type { CampaignMatch, CampaignRecord, UnifiedProfile } from '../types/cdp.ts';

export interface CampaignTotals {
  sent: number;
  accepted: number;
  declined: number;
  pending: number;
}

/** Recipients that may receive an invitation: combined profiles that consented. */
export function eligibleProfileIds(profiles: readonly UnifiedProfile[]): Set<string> {
  return new Set(profiles.filter((profile) => profile.isStitched && profile.consentPdpa).map((profile) => profile.id));
}

/**
 * Freezes the invitations the user chose and edited. Returns null when nothing can be sent:
 * no eligible recipient is selected, or a selected invitation is blank.
 */
export function createCampaign(
  id: string,
  name: string,
  createdAt: string,
  candidates: readonly CampaignMatch[],
  profiles: readonly UnifiedProfile[],
): CampaignRecord | null {
  const eligible = eligibleProfileIds(profiles);
  const selected = candidates.filter((match) => match.selected && eligible.has(match.profileId));
  if (!name.trim() || !selected.length || selected.some((match) => !match.personalizedInvite.trim())) {
    return null;
  }
  return {
    id,
    name,
    createdAt,
    matches: selected.map((match) => ({ ...match, personalizedInvite: match.personalizedInvite.trim() })),
    simulated: false,
    closedLoopUpdatesCount: 0,
    replies: [],
  };
}

/** Adds each sent invitation to the recipient's profile history as a pending item. */
export function recordSentInvitations(profiles: readonly UnifiedProfile[], campaign: CampaignRecord): UnifiedProfile[] {
  return profiles.map((profile) => {
    const match = campaign.matches.find((item) => item.profileId === profile.id);
    if (!match) {
      return profile;
    }
    return {
      ...profile,
      campaignHistory: [
        {
          campaignId: campaign.id,
          campaignName: campaign.name,
          status: 'pending' as const,
          sentMessage: match.personalizedInvite,
          timestamp: campaign.createdAt,
        },
        ...profile.campaignHistory.filter((item) => item.campaignId !== campaign.id),
      ],
    };
  });
}

export function buildReplySummaries(campaign: CampaignRecord, interactions: readonly SimulatedReplyEntry[]): CampaignRecord['replies'] {
  return interactions.map(({ profileId, interaction, feedbackAttribute }) => ({
    profileId,
    status: interaction.status,
    replyText: interaction.replyText ?? '',
    tier: campaign.matches.find((match) => match.profileId === profileId)?.tier ?? 'direct',
    feedbackTag: feedbackAttribute?.value ?? '',
    feedbackCategory: feedbackAttribute?.category,
  }));
}

/** Totals are counted from the people who were sent an invitation, so they always add up. */
export function summarizeCampaign(campaign: CampaignRecord | undefined): CampaignTotals {
  const recipients = campaign?.matches.filter((match) => match.selected) ?? [];
  let accepted = 0;
  let declined = 0;
  for (const match of recipients) {
    const status = campaign?.replies.find((reply) => reply.profileId === match.profileId)?.status;
    if (status === 'accepted') accepted += 1;
    else if (status === 'declined') declined += 1;
  }
  return { sent: recipients.length, accepted, declined, pending: recipients.length - accepted - declined };
}
