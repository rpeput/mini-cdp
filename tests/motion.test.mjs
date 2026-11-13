import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CAMPAIGN_PRESETS, INITIAL_PROFILES, RAW_SOURCE_RECORDS } from '../src/data/seedData.ts';
import { runIdentityStitching, segmentCampaign, simulateCampaignResponses } from '../src/services/aiEngine.ts';
import { buildReplySummaries, createCampaign, recordSentInvitations, summarizeCampaign } from '../src/utils/campaignFlow.ts';
import {
  applyPlaybackEvent, buildPlaybackEvents, buildStitchFx, DEFAULT_PLAYBACK, EMPTY_PLAYBACK, finalPlayback,
  playableReplyIds, playbackAt, playbackDuration, staggerDelay, visibleReplies,
} from '../src/utils/motionSequence.ts';

const offline = (context) => context.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ fallback: true })));

async function simulatedCampaign(context) {
  offline(context);
  const stitched = await runIdentityStitching(INITIAL_PROFILES, RAW_SOURCE_RECORDS);
  const { matches } = await segmentCampaign(CAMPAIGN_PRESETS[0], stitched.profiles);
  const campaign = createCampaign('motion-campaign', CAMPAIGN_PRESETS[0], '2026-01-01T00:00:00Z', matches.map((match) => ({ ...match, selected: true })), stitched.profiles);
  const sentProfiles = recordSentInvitations(stitched.profiles, campaign);
  const result = await simulateCampaignResponses(campaign.id, campaign.name, campaign.matches, sentProfiles);
  const replies = buildReplySummaries(campaign, result.interactions);
  return { campaign, replies, simulated: { ...campaign, simulated: true, replies } };
}

test('stagger delays grow per row, stop at the cap and never go negative', () => {
  assert.deepEqual([0, 1, 2].map((rank) => staggerDelay(rank)), [0, 40, 80]);
  assert.equal(staggerDelay(7), 280);
  assert.equal(staggerDelay(8), 280);
  assert.equal(staggerDelay(500), 280);
  assert.equal(staggerDelay(-3), 0);
  assert.ok(staggerDelay(20, 40, 8) <= 40 * 8, 'a long list is capped at roughly 300ms');
});

test('replies arrive one at a time, in recipient order, each after it started typing', async (context) => {
  const { simulated } = await simulatedCampaign(context);
  const ids = playableReplyIds(simulated);
  const recipients = simulated.matches.map((match) => match.profileId);
  assert.deepEqual(ids, recipients.filter((id) => ids.includes(id)), 'keeps recipient order');
  assert.ok(ids.length >= 3);
  assert.ok(ids.length < recipients.length, 'recipients who stay silent are not replayed');
  const events = buildPlaybackEvents(ids);
  assert.deepEqual(events.filter((event) => event.type === 'arrive').map((event) => event.profileId), ids);
  for (const id of ids) {
    const typing = events.find((event) => event.type === 'typing' && event.profileId === id);
    const arrive = events.find((event) => event.type === 'arrive' && event.profileId === id);
    assert.ok(typing.at < arrive.at, 'typing comes first');
  }
  assert.deepEqual(events.map((event) => event.at), [...events.map((event) => event.at)].sort((a, b) => a - b));
  let state = EMPTY_PLAYBACK;
  const counts = [];
  for (const event of events) {
    state = applyPlaybackEvent(state, event);
    if (event.type === 'arrive') counts.push(state.arrived.length);
  }
  assert.deepEqual(counts, ids.map((_, index) => index + 1), 'the arrived count goes up by one each time');
});

test('a long run is compressed to fit the time budget and a short run keeps its natural pace', () => {
  const many = Array.from({ length: 40 }, (_, index) => `p${index}`);
  assert.ok(playbackDuration(buildPlaybackEvents(many)) <= DEFAULT_PLAYBACK.maxTotalMs);
  const few = buildPlaybackEvents(['a', 'b', 'c']);
  assert.equal(few.find((event) => event.type === 'typing' && event.profileId === 'c').at, 2 * DEFAULT_PLAYBACK.gapMs);
  assert.deepEqual(buildPlaybackEvents([]), []);
});

test('the final totals equal the real data, and so does skipping the run', async (context) => {
  const { simulated } = await simulatedCampaign(context);
  const real = summarizeCampaign(simulated);
  const ids = playableReplyIds(simulated);
  const events = buildPlaybackEvents(ids);
  const totalsFrom = (state) => summarizeCampaign({ ...simulated, replies: visibleReplies(simulated.replies, ids, state) });

  assert.deepEqual(totalsFrom(playbackAt(events, Infinity)), real, 'playing to the end');
  assert.deepEqual(totalsFrom(finalPlayback(ids)), real, 'skipping');
  assert.deepEqual(totalsFrom(null), real, 'no run at all (reduced motion, or a revisit)');
  assert.deepEqual(playbackAt(events, Infinity), finalPlayback(ids));

  const start = totalsFrom(EMPTY_PLAYBACK);
  assert.deepEqual(start, { sent: real.sent, accepted: 0, declined: 0, pending: real.sent }, 'before any reply every invitation is waiting');
  let previous = start;
  for (const at of events.map((event) => event.at)) {
    const now = totalsFrom(playbackAt(events, at));
    assert.equal(now.sent, real.sent);
    assert.equal(now.accepted + now.declined + now.pending, real.sent, 'totals always add up');
    assert.ok(now.accepted >= previous.accepted && now.declined >= previous.declined, 'counts never go back');
    previous = now;
  }
});

test('replies the organiser pasted are always shown and are never replayed', async (context) => {
  const { simulated } = await simulatedCampaign(context);
  const first = simulated.matches[0].profileId;
  const replies = simulated.replies.map((reply) => reply.profileId === first ? { ...reply, status: 'accepted', origin: 'pasted' } : reply);
  const campaign = { ...simulated, replies };
  const ids = playableReplyIds(campaign);
  assert.ok(!ids.includes(first));
  const shown = visibleReplies(replies, ids, EMPTY_PLAYBACK);
  assert.ok(shown.some((reply) => reply.profileId === first));
  assert.ok(ids.every((id) => !shown.some((reply) => reply.profileId === id)));
});

test('a stitch run lists the messages that finished and the interests they produced', async (context) => {
  offline(context);
  const result = await runIdentityStitching(INITIAL_PROFILES, RAW_SOURCE_RECORDS);
  const fx = buildStitchFx(1, INITIAL_PROFILES, result.profiles, RAW_SOURCE_RECORDS);
  const waiting = INITIAL_PROFILES.filter((profile) => !profile.isStitched);
  assert.equal(fx.profilesWaitingBefore, waiting.length);
  assert.equal(fx.profilesWaitingAfter, result.profiles.filter((profile) => !profile.isStitched).length);
  assert.equal(fx.profilesStitchedAfter, result.profiles.filter((profile) => profile.isStitched).length);
  assert.equal(fx.profilesStitchedBefore + waiting.length - fx.profilesWaitingAfter, fx.profilesStitchedAfter);
  const waitingIds = new Set(waiting.map((profile) => profile.id));
  assert.ok(fx.recordIds.length > 0);
  assert.ok(fx.recordIds.every((id) => waitingIds.has(RAW_SOURCE_RECORDS.find((record) => record.id === id).linkedProfileId)));
  assert.ok(fx.freshAttributeIds.length > 0);
  assert.equal(fx.freshAttributeIds.length, Object.values(fx.freshByProfile).flat().length);
  for (const [recordId, values] of Object.entries(fx.evidenceByRecord)) {
    assert.ok(fx.recordIds.includes(recordId), 'evidence sits on a message that was processed');
    assert.ok(values.length > 0);
  }
  const unchanged = buildStitchFx(2, result.profiles, result.profiles, RAW_SOURCE_RECORDS);
  assert.deepEqual([unchanged.recordIds, unchanged.freshAttributeIds], [[], []], 'a second run with nothing waiting changes nothing');
});
