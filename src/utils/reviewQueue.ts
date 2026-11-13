import type { AttributeStatus, DataSourceType, ExtractedAttribute, UnifiedProfile } from '../types/cdp.ts';
import { getEffectiveAttributeStatus, SOURCE_META } from './cdpHelpers.ts';
import { matchesSearch, sortItems, type SortDirection, type SortValue } from './tableQuery.ts';

/** One interest waiting for a person to confirm or reject it. */
export interface ReviewRow {
  key: string;
  profile: UnifiedProfile;
  attribute: ExtractedAttribute;
}

export type ConfidenceBand = 'under60' | '60to69' | '70up';

export interface ReviewQuery {
  query: string;
  /** A profile id, or "all". */
  friend: string;
  source: DataSourceType | 'all';
  band: ConfidenceBand | 'all';
  sortKey: string;
  direction: SortDirection;
}

export const REVIEW_SORT_KEYS = ['confidence', 'friend', 'interest', 'source'] as const;

export const CONFIDENCE_BANDS: Record<ConfidenceBand, string> = {
  under60: 'ต่ำกว่า 60%',
  '60to69': '60–69%',
  '70up': '70% ขึ้นไป',
};

export function reviewKey(profileId: string, attributeId: string): string {
  return `${profileId}:${attributeId}`;
}

export function bandOf(confidence: number): ConfidenceBand {
  if (confidence < 60) return 'under60';
  return confidence < 70 ? '60to69' : '70up';
}

/** Every interest on a combined profile that is below the threshold and not yet confirmed or rejected. */
export function listReviewRows(
  profiles: readonly UnifiedProfile[],
  confidenceThreshold: number,
  manuallyApprovedIds: ReadonlySet<string>,
): ReviewRow[] {
  const rows: ReviewRow[] = [];
  for (const profile of profiles) {
    if (!profile.isStitched) continue;
    for (const attribute of profile.attributes) {
      if (getEffectiveAttributeStatus(attribute, confidenceThreshold, manuallyApprovedIds) === 'needs_review') {
        rows.push({ key: reviewKey(profile.id, attribute.id), profile, attribute });
      }
    }
  }
  return rows;
}

/** Search, filter and sort the queue. The default order is lowest confidence first. */
export function queryReviewRows(rows: readonly ReviewRow[], options: ReviewQuery): ReviewRow[] {
  const filtered = rows.filter(({ profile, attribute }) =>
    (options.friend === 'all' || profile.id === options.friend) &&
    (options.source === 'all' || attribute.source === options.source) &&
    (options.band === 'all' || bandOf(attribute.confidence) === options.band) &&
    matchesSearch([profile.nickname, profile.fullName, attribute.value, attribute.evidenceQuote], options.query));
  const keys: Record<string, (row: ReviewRow) => SortValue> = {
    confidence: (row) => row.attribute.confidence,
    friend: (row) => row.profile.nickname,
    interest: (row) => row.attribute.value,
    source: (row) => SOURCE_META[row.attribute.source].label,
  };
  return sortItems(filtered, keys[options.sortKey] ?? keys.confidence, options.direction,
    (a, b) => a.attribute.confidence - b.attribute.confidence);
}

export interface ReviewTarget {
  profileId: string;
  attributeId: string;
}

/** What an interest looked like before a decision, so the decision can be undone exactly. */
export interface ReviewSnapshot extends ReviewTarget {
  previousStatus: AttributeStatus;
  wasApproved: boolean;
}

export interface ReviewState {
  profiles: UnifiedProfile[];
  approved: string[];
}

/**
 * Confirms or rejects interests in one step. Nothing is deleted: a rejected interest stays on the
 * profile with its status, and the snapshot returned lets undoReviewDecisions restore the earlier state.
 */
export function applyReviewDecisions(
  state: ReviewState,
  targets: readonly ReviewTarget[],
  decision: 'verified' | 'rejected',
): ReviewState & { snapshot: ReviewSnapshot[] } {
  const wanted = new Map<string, ReviewTarget>(targets.map((target) => [reviewKey(target.profileId, target.attributeId), target]));
  const approved = new Set(state.approved);
  const snapshot: ReviewSnapshot[] = [];
  const profiles = state.profiles.map((profile) => {
    if (!profile.attributes.some((attribute) => wanted.has(reviewKey(profile.id, attribute.id)))) return profile;
    return {
      ...profile,
      attributes: profile.attributes.map((attribute) => {
        if (!wanted.has(reviewKey(profile.id, attribute.id))) return attribute;
        snapshot.push({ profileId: profile.id, attributeId: attribute.id, previousStatus: attribute.status, wasApproved: approved.has(attribute.id) });
        if (decision === 'verified') approved.add(attribute.id);
        else approved.delete(attribute.id);
        return { ...attribute, status: decision };
      }),
    };
  });
  return { profiles, approved: [...approved], snapshot };
}

/** Puts every interest in the snapshot back to the status and approval it had before the decision. */
export function undoReviewDecisions(state: ReviewState, snapshot: readonly ReviewSnapshot[]): ReviewState {
  const byKey = new Map(snapshot.map((item) => [reviewKey(item.profileId, item.attributeId), item]));
  const approved = new Set(state.approved);
  const profiles = state.profiles.map((profile) => {
    if (!profile.attributes.some((attribute) => byKey.has(reviewKey(profile.id, attribute.id)))) return profile;
    return {
      ...profile,
      attributes: profile.attributes.map((attribute) => {
        const before = byKey.get(reviewKey(profile.id, attribute.id));
        if (!before) return attribute;
        if (before.wasApproved) approved.add(attribute.id);
        else approved.delete(attribute.id);
        return { ...attribute, status: before.previousStatus };
      }),
    };
  });
  return { profiles, approved: [...approved] };
}
