import type { AttributeStatus, CampaignMatch, ExtractedAttribute, RawSourceRecord, UnifiedProfile } from '../types/cdp.ts';
import { getEffectiveAttributeStatus } from '../utils/cdpHelpers.ts';
import { SEMANTIC_CLUSTERS, tokenizePrompt } from './aiEngine.ts';

export type EvidenceRelation = 'direct' | 'related';

export interface RecommendationEvidence {
  attribute: ExtractedAttribute;
  /** The saved message the quote came from, when it is still among the source records. */
  record?: RawSourceRecord;
  /** direct: the activity is named in the evidence. related: only a neighbouring interest is. */
  relation: EvidenceRelation;
  matchedTerm: string;
  status: AttributeStatus;
}

export interface RecommendationExplanation {
  evidence: RecommendationEvidence[];
  /** True when at least one piece of evidence names the activity itself. */
  hasDirectEvidence: boolean;
}

/**
 * Traces a recommendation back to the profile attributes and source messages that explain it.
 * The terms come from the same semantic clusters and prompt tokens the local scorer uses, so a
 * model's reasoning is always checked against what the profile actually contains.
 */
export function explainRecommendation(
  profile: UnifiedProfile,
  match: Pick<CampaignMatch, 'tier'>,
  campaignPrompt: string,
  records: readonly RawSourceRecord[],
  confidenceThreshold: number,
  manuallyApprovedIds: ReadonlySet<string>,
): RecommendationExplanation {
  const prompt = campaignPrompt.trim().toLowerCase();
  const clusters = SEMANTIC_CLUSTERS.filter((cluster) =>
    cluster.promptKeywords.some((keyword) => prompt.includes(keyword.toLowerCase())),
  );
  const tokens = tokenizePrompt(campaignPrompt);
  const evidence: RecommendationEvidence[] = [];

  for (const attribute of profile.attributes) {
    const status = getEffectiveAttributeStatus(attribute, confidenceThreshold, manuallyApprovedIds);
    if (status === 'rejected') {
      continue;
    }
    const corpus = `${attribute.value} ${attribute.evidenceQuote}`.toLowerCase();
    const direct =
      clusters.flatMap((cluster) => cluster.directKeywords).find((keyword) => corpus.includes(keyword.toLowerCase())) ??
      (clusters.length === 0 ? tokens.find((token) => token.length >= 3 && corpus.includes(token)) : undefined);
    const related = direct
      ? undefined
      : clusters.flatMap((cluster) => cluster.lookalikeKeywords).find((keyword) => corpus.includes(keyword.toLowerCase())) ??
        (clusters.length === 0 ? tokens.find((token) => corpus.includes(token)) : undefined);
    const matchedTerm = direct ?? related;
    if (!matchedTerm) {
      continue;
    }
    evidence.push({
      attribute,
      record: records.find((record) => record.linkedProfileId === profile.id && record.rawText.includes(attribute.evidenceQuote)),
      relation: direct ? 'direct' : 'related',
      matchedTerm,
      status,
    });
  }

  const preferred: EvidenceRelation = match.tier === 'direct' ? 'direct' : 'related';
  evidence.sort((a, b) =>
    Number(b.relation === preferred) - Number(a.relation === preferred) || b.attribute.confidence - a.attribute.confidence,
  );
  return {
    evidence: evidence.slice(0, 3),
    hasDirectEvidence: evidence.some((item) => item.relation === 'direct'),
  };
}
