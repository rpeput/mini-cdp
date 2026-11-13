import type { CampaignRecord, CampaignReplySummary, RawSourceRecord, UnifiedProfile } from '../types/cdp.ts';

/**
 * The workspace animations only *present* data that is already final in state. Everything that
 * decides order, timing or the value an animation lands on lives here as pure functions, so the
 * final numbers can be tested and a skipped or reduced-motion run reaches the same values.
 */

export const STAGGER_STEP_MS = 40;
export const STAGGER_CAP = 8;

/** Delay for the row at `rank`. Rows past `cap` share the last delay so long lists never wait long. */
export function staggerDelay(rank: number, step = STAGGER_STEP_MS, cap = STAGGER_CAP): number {
  return Math.min(Math.max(rank, 0), cap - 1) * step;
}

// ---- closed loop: replies arriving one by one ----------------------------------------------

export interface PlaybackEvent {
  at: number;
  type: 'typing' | 'arrive';
  profileId: string;
}

export interface PlaybackOptions {
  /** How long the "typing" state shows before the reply lands. */
  typingMs: number;
  /** Time between one reply starting to type and the next one. */
  gapMs: number;
  /** The whole run never exceeds this, however many replies there are. */
  maxTotalMs: number;
}

export const DEFAULT_PLAYBACK: PlaybackOptions = { typingMs: 480, gapMs: 200, maxTotalMs: 2200 };

export interface PlaybackState {
  typing: string[];
  arrived: string[];
}

/** Replies the demo simulated, in recipient order. Replies the organiser pasted are already real and are not replayed. */
export function playableReplyIds(campaign: CampaignRecord | undefined): string[] {
  if (!campaign) return [];
  const recipients = campaign.matches.filter((match) => match.selected);
  return recipients
    .filter((match) => {
      const reply = campaign.replies.find((item) => item.profileId === match.profileId);
      return reply !== undefined && reply.origin !== 'pasted' && reply.status !== 'pending';
    })
    .map((match) => match.profileId);
}

/** Typing starts and replies land in `ids` order; the gap shrinks so the run fits `maxTotalMs`. */
export function buildPlaybackEvents(ids: readonly string[], options: PlaybackOptions = DEFAULT_PLAYBACK): PlaybackEvent[] {
  if (!ids.length) return [];
  const gap = ids.length > 1 ? Math.min(options.gapMs, Math.max(0, (options.maxTotalMs - options.typingMs) / (ids.length - 1))) : 0;
  const events: PlaybackEvent[] = [];
  ids.forEach((profileId, index) => {
    const start = Math.round(index * gap);
    events.push({ at: start, type: 'typing', profileId });
    events.push({ at: start + options.typingMs, type: 'arrive', profileId });
  });
  // Typing before arriving at equal times keeps a reply from landing before it started.
  return events.sort((a, b) => a.at - b.at || (a.type === b.type ? 0 : a.type === 'typing' ? -1 : 1));
}

export function playbackDuration(events: readonly PlaybackEvent[]): number {
  return events.reduce((latest, event) => Math.max(latest, event.at), 0);
}

export const EMPTY_PLAYBACK: PlaybackState = { typing: [], arrived: [] };

export function applyPlaybackEvent(state: PlaybackState, event: PlaybackEvent): PlaybackState {
  if (event.type === 'typing') {
    return state.arrived.includes(event.profileId) || state.typing.includes(event.profileId)
      ? state
      : { ...state, typing: [...state.typing, event.profileId] };
  }
  return state.arrived.includes(event.profileId)
    ? state
    : { typing: state.typing.filter((id) => id !== event.profileId), arrived: [...state.arrived, event.profileId] };
}

/** The state once every reply has landed; skipping a run jumps straight here. */
export function finalPlayback(ids: readonly string[]): PlaybackState {
  return { typing: [], arrived: [...ids] };
}

/** The state `atMs` into a run. Applying the whole timeline gives `finalPlayback`. */
export function playbackAt(events: readonly PlaybackEvent[], atMs: number): PlaybackState {
  return events.filter((event) => event.at <= atMs).reduce(applyPlaybackEvent, EMPTY_PLAYBACK);
}

/**
 * Replies to show while a run is in progress. With no run (`state` null) every reply shows, so the
 * persisted data is always what a reader sees once the run ends, is skipped or is never started.
 */
export function visibleReplies(replies: readonly CampaignReplySummary[], playable: readonly string[], state: PlaybackState | null): CampaignReplySummary[] {
  if (!state) return [...replies];
  const held = new Set(playable.filter((id) => !state.arrived.includes(id)));
  return replies.filter((reply) => !held.has(reply.profileId));
}

// ---- pipeline: messages becoming interests ---------------------------------------------------

export interface StitchFx {
  /** Increases with every stitch run. */
  id: number;
  /** Messages that went from waiting to processed. */
  recordIds: string[];
  /** Interests that were not on the profile before, per message that holds their evidence. */
  evidenceByRecord: Record<string, string[]>;
  /** Interests that are new on each profile. */
  freshByProfile: Record<string, string[]>;
  /** Attribute ids of every new interest. */
  freshAttributeIds: string[];
  profilesWaitingBefore: number;
  profilesWaitingAfter: number;
  profilesStitchedBefore: number;
  profilesStitchedAfter: number;
  /** The new interests have been shown on the friends list once. */
  profilesSeen: boolean;
}

export function buildStitchFx(id: number, before: readonly UnifiedProfile[], after: readonly UnifiedProfile[], records: readonly RawSourceRecord[]): StitchFx {
  const beforeById = new Map(before.map((profile) => [profile.id, profile]));
  const processedProfiles = new Set(after.filter((profile) => profile.isStitched && beforeById.get(profile.id)?.isStitched === false).map((profile) => profile.id));
  const recordIds = records.filter((record) => processedProfiles.has(record.linkedProfileId)).map((record) => record.id);
  const evidenceByRecord: Record<string, string[]> = {};
  const freshByProfile: Record<string, string[]> = {};
  const freshAttributeIds: string[] = [];
  for (const profile of after) {
    const known = new Set((beforeById.get(profile.id)?.attributes ?? []).map((attribute) => attribute.id));
    for (const attribute of profile.attributes) {
      if (known.has(attribute.id)) continue;
      freshAttributeIds.push(attribute.id);
      (freshByProfile[profile.id] ??= []).push(attribute.value);
      const record = records.find((item) => item.linkedProfileId === profile.id && attribute.evidenceQuote && item.rawText.includes(attribute.evidenceQuote));
      if (record) (evidenceByRecord[record.id] ??= []).push(attribute.value);
    }
  }
  const stitched = (list: readonly UnifiedProfile[]) => list.filter((profile) => profile.isStitched).length;
  return {
    id, recordIds, evidenceByRecord, freshByProfile, freshAttributeIds,
    profilesWaitingBefore: before.length - stitched(before),
    profilesWaitingAfter: after.length - stitched(after),
    profilesStitchedBefore: stitched(before),
    profilesStitchedAfter: stitched(after),
    profilesSeen: false,
  };
}
