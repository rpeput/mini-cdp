import type {
  AttributeCategory,
  AttributeStatus,
  DataSourceType,
  ExtractedAttribute,
  UnifiedProfile,
} from '../types/cdp.ts';

export const CARD_SURFACE_CLASS =
  'rounded-xl border border-border-subtle bg-surface shadow-[0_1px_2px_rgba(9,9,11,0.04),0_4px_12px_rgba(9,9,11,0.03)]';

export const SOURCE_META: Record<
  DataSourceType,
  { label: string; shortLabel: string; badgeClass: string }
> = {
  LINE_CHAT: {
    label: 'LINE Chat',
    shortLabel: 'LINE',
    badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  },
  FACEBOOK_POST: {
    label: 'Facebook Post',
    shortLabel: 'Facebook',
    badgeClass: 'border-slate-300 bg-slate-100 text-slate-800',
  },
  DEPT_ROSTER: {
    label: 'Dept Roster',
    shortLabel: 'Roster',
    badgeClass: 'border-amber-300 bg-brand-amber-soft text-amber-900',
  },
};

export const CATEGORY_META: Record<
  AttributeCategory,
  { label: string; badgeClass: string }
> = {
  food: {
    label: 'Food',
    badgeClass: 'border-amber-200 bg-amber-50 text-amber-900',
  },
  activity: {
    label: 'Activity',
    badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  },
  vibe: {
    label: 'Vibe',
    badgeClass: 'border-zinc-200 bg-zinc-100 text-zinc-800',
  },
  budget: {
    label: 'Budget',
    badgeClass: 'border-slate-300 bg-slate-100 text-slate-800',
  },
};

export const STATUS_META: Record<
  AttributeStatus,
  { label: string; badgeClass: string }
> = {
  verified: {
    label: 'Verified',
    badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  },
  needs_review: {
    label: 'Needs Review',
    badgeClass: 'border-amber-300 bg-brand-amber-soft text-amber-900',
  },
  rejected: {
    label: 'Rejected',
    badgeClass: 'border-rose-200 bg-rose-50 text-rose-800',
  },
};

export function getEffectiveAttributeStatus(
  attribute: ExtractedAttribute,
  confidenceThreshold: number,
  manuallyApprovedIds: ReadonlySet<string>,
): AttributeStatus {
  if (attribute.status === 'rejected') {
    return 'rejected';
  }
  if (manuallyApprovedIds.has(attribute.id)) {
    return 'verified';
  }
  if (attribute.confidence < confidenceThreshold) {
    return 'needs_review';
  }
  return 'verified';
}

export function countNeedsReviewAttributes(
  profiles: UnifiedProfile[],
  confidenceThreshold: number,
  manuallyApprovedIds: ReadonlySet<string>,
): number {
  let count = 0;
  for (const profile of profiles) {
    if (!profile.isStitched) {
      continue;
    }
    for (const attr of profile.attributes) {
      if (
        getEffectiveAttributeStatus(
          attr,
          confidenceThreshold,
          manuallyApprovedIds,
        ) === 'needs_review'
      ) {
        count += 1;
      }
    }
  }
  return count;
}

export function formatTimeShort(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) {
    return isoTimestamp;
  }
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function formatDateShort(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) {
    return isoTimestamp;
  }
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}
