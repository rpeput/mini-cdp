import type { AttributeCategory, CampaignInteractionStatus, DataSourceType, RawSourceRecord, UnifiedProfile } from '../types/cdp.ts';
import { getEffectiveAttributeStatus, SOURCE_META } from './cdpHelpers.ts';
import { matchesSearch, sortItems, type SortDirection, type SortValue } from './tableQuery.ts';

/* ---------- Source records ---------- */

export type RecordStatus = 'processed' | 'pending';

export interface SourceRow {
  record: RawSourceRecord;
  profile?: UnifiedProfile;
  status: RecordStatus;
}

export interface SourceQuery {
  query: string;
  source: DataSourceType | 'all';
  status: RecordStatus | 'all';
  sortKey: string;
  direction: SortDirection;
}

export const SOURCE_SORT_KEYS = ['time', 'friend', 'source', 'status'] as const;

function timeOf(record: RawSourceRecord): number {
  const time = Date.parse(record.timestamp);
  return Number.isNaN(time) ? 0 : time;
}

/** A record is processed once the friend it belongs to has been combined; new messages reopen it. */
export function querySources(records: readonly RawSourceRecord[], profiles: readonly UnifiedProfile[], options: SourceQuery): SourceRow[] {
  const byId = new Map(profiles.map((profile) => [profile.id, profile]));
  const rows: SourceRow[] = records
    .map((record) => {
      const profile = byId.get(record.linkedProfileId);
      return { record, profile, status: (profile?.isStitched ? 'processed' : 'pending') as RecordStatus };
    })
    .filter(({ record, profile, status }) =>
      (options.source === 'all' || record.source === options.source) &&
      (options.status === 'all' || status === options.status) &&
      matchesSearch([record.rawText, record.handle, profile?.nickname ?? '', profile?.fullName ?? '', profile?.studentId ?? ''], options.query));

  const keys: Record<string, (row: SourceRow) => SortValue> = {
    time: (row) => timeOf(row.record),
    friend: (row) => row.profile?.nickname ?? null,
    source: (row) => SOURCE_META[row.record.source].label,
    status: (row) => (row.status === 'pending' ? 0 : 1),
  };
  return sortItems(rows, keys[options.sortKey] ?? keys.time, options.direction, (a, b) => timeOf(b.record) - timeOf(a.record));
}

/* ---------- Friends ---------- */

export type ProfileStatus = 'ready' | 'pending' | 'no-consent';
export type ReplyFilter = CampaignInteractionStatus | 'never';

export interface ProfileRow {
  profile: UnifiedProfile;
  status: ProfileStatus;
  verifiedTraits: UnifiedProfile['attributes'];
  accepted: number;
  declined: number;
  pending: number;
  /** accepted ÷ answered invitations, or null when the friend has not answered any. */
  acceptRate: number | null;
}

export interface ProfileQuery {
  query: string;
  /** all, ready (combined and consented), pending (not combined yet) or no-consent. */
  status: ProfileStatus | 'all';
  interest: AttributeCategory | 'all';
  reply: ReplyFilter | 'all';
  /** Alternatives: a friend matches when any one of these appears in their name or interests. */
  anyTerms?: readonly string[];
  sortKey: string;
  direction: SortDirection;
}

export const PROFILE_SORT_KEYS = ['name', 'fullName', 'studentId', 'interests', 'status', 'acceptance'] as const;

const STATUS_RANK: Record<ProfileStatus, number> = { ready: 0, pending: 1, 'no-consent': 2 };

export function displayStatus(profile: UnifiedProfile): ProfileStatus {
  if (!profile.consentPdpa) return 'no-consent';
  return profile.isStitched ? 'ready' : 'pending';
}

export function queryProfiles(
  profiles: readonly UnifiedProfile[],
  confidenceThreshold: number,
  manuallyApprovedIds: ReadonlySet<string>,
  options: ProfileQuery,
): ProfileRow[] {
  const rows: ProfileRow[] = profiles.map((profile) => {
    const history = profile.campaignHistory;
    const accepted = history.filter((item) => item.status === 'accepted').length;
    const declined = history.filter((item) => item.status === 'declined').length;
    return {
      profile,
      status: displayStatus(profile),
      verifiedTraits: profile.attributes.filter((attribute) => getEffectiveAttributeStatus(attribute, confidenceThreshold, manuallyApprovedIds) === 'verified'),
      accepted,
      declined,
      pending: history.length - accepted - declined,
      acceptRate: accepted + declined ? accepted / (accepted + declined) : null,
    };
  });

  const filtered = rows.filter(({ profile, verifiedTraits, accepted, declined, pending }) => {
    // The status filter keeps its earlier meaning: "pending" is every friend not yet combined.
    if (options.status === 'ready' && !(profile.isStitched && profile.consentPdpa)) return false;
    if (options.status === 'pending' && profile.isStitched) return false;
    if (options.status === 'no-consent' && profile.consentPdpa) return false;
    if (options.interest !== 'all' && !verifiedTraits.some((trait) => trait.category === options.interest)) return false;
    if (options.reply === 'never' && profile.campaignHistory.length) return false;
    if (options.reply === 'accepted' && !accepted) return false;
    if (options.reply === 'declined' && !declined) return false;
    if (options.reply === 'pending' && !pending) return false;
    const fields = [profile.nickname, profile.fullName, profile.studentId, ...verifiedTraits.map((trait) => trait.value)];
    if (options.anyTerms?.length && !options.anyTerms.some((term) => matchesSearch(fields, term))) return false;
    return matchesSearch(fields, options.query);
  });

  const keys: Record<string, (row: ProfileRow) => SortValue> = {
    name: (row) => row.profile.nickname,
    fullName: (row) => row.profile.fullName,
    studentId: (row) => row.profile.studentId,
    interests: (row) => row.verifiedTraits.length,
    status: (row) => STATUS_RANK[row.status],
    acceptance: (row) => row.acceptRate,
  };
  return sortItems(filtered, keys[options.sortKey] ?? keys.name, options.direction, (a, b) => a.profile.nickname.localeCompare(b.profile.nickname, 'th'));
}
