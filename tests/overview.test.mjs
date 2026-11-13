import assert from 'node:assert/strict';
import { test } from 'node:test';
import { INITIAL_PROFILES, RAW_SOURCE_RECORDS } from '../src/data/seedData.ts';
import { summarizeCampaign } from '../src/utils/campaignFlow.ts';
import { getEffectiveAttributeStatus } from '../src/utils/cdpHelpers.ts';
import { buildFunnel, buildNextActions, countVerifiedInterests } from '../src/utils/overview.ts';
import { applyReviewDecisions, listReviewRows, queryReviewRows, undoReviewDecisions } from '../src/utils/reviewQueue.ts';

const stitched = INITIAL_PROFILES.map((profile) => ({ ...profile, isStitched: true }));
const noApprovals = new Set();
const reviewQuery = { query: '', friend: 'all', source: 'all', band: 'all', sortKey: 'confidence', direction: 'asc' };

function campaign(replies) {
  const matches = replies.map((status, index) => ({ profileId: stitched[index].id, tier: 'direct', matchScore: 90, aiReasoning: '', personalizedInvite: 'x', selected: true }));
  return {
    id: 'c1', name: 'หมูกระทะ', createdAt: '2026-01-01T00:00:00Z', matches, simulated: true, closedLoopUpdatesCount: 0,
    replies: replies.map((status, index) => ({ profileId: stitched[index].id, status, replyText: '', tier: 'direct', feedbackTag: '' })),
  };
}

test('the review queue holds exactly the interests below the threshold on combined profiles', () => {
  for (const threshold of [50, 75, 95]) {
    const rows = listReviewRows(stitched, threshold, noApprovals);
    const expected = stitched.flatMap((p) => p.attributes).filter((a) => a.status !== 'rejected' && a.confidence < threshold);
    assert.equal(rows.length, expected.length);
    assert.ok(rows.every((row) => getEffectiveAttributeStatus(row.attribute, threshold, noApprovals) === 'needs_review'));
  }
  assert.equal(listReviewRows(INITIAL_PROFILES.map((p) => ({ ...p, isStitched: false })), 95, noApprovals).length, 0);
  const rows = listReviewRows(stitched, 95, noApprovals);
  const approved = new Set([rows[0].attribute.id]);
  assert.equal(listReviewRows(stitched, 95, approved).length, rows.length - 1);
});

test('the queue sorts lowest confidence first and filters by friend, source and band', () => {
  const rows = listReviewRows(stitched, 95, noApprovals);
  assert.ok(rows.length > 3);
  const sorted = queryReviewRows(rows, reviewQuery).map((row) => row.attribute.confidence);
  assert.deepEqual(sorted, [...sorted].sort((a, b) => a - b));
  const friend = rows[0].profile.id;
  assert.ok(queryReviewRows(rows, { ...reviewQuery, friend }).every((row) => row.profile.id === friend));
  const source = rows[0].attribute.source;
  assert.ok(queryReviewRows(rows, { ...reviewQuery, source }).every((row) => row.attribute.source === source));
  assert.ok(queryReviewRows(rows, { ...reviewQuery, band: 'under60' }).every((row) => row.attribute.confidence < 60));
  assert.ok(queryReviewRows(rows, { ...reviewQuery, band: '70up' }).every((row) => row.attribute.confidence >= 70));
  assert.equal(queryReviewRows(rows, { ...reviewQuery, query: 'zzz-no-match' }).length, 0);
});

test('confirming and rejecting in a batch move items out of the queue, and undo restores them', () => {
  const rows = listReviewRows(stitched, 95, noApprovals);
  const [a, b, c] = rows;
  const targets = (list) => list.map((row) => ({ profileId: row.profile.id, attributeId: row.attribute.id }));
  const state = { profiles: stitched, approved: [] };

  const confirmed = applyReviewDecisions(state, targets([a, b]), 'verified');
  assert.equal(confirmed.snapshot.length, 2);
  assert.equal(listReviewRows(confirmed.profiles, 95, new Set(confirmed.approved)).length, rows.length - 2);
  assert.ok(confirmed.approved.includes(a.attribute.id));

  const rejected = applyReviewDecisions(confirmed, targets([c]), 'rejected');
  const left = listReviewRows(rejected.profiles, 95, new Set(rejected.approved));
  assert.equal(left.length, rows.length - 3);
  // Rejected interests stay on the profile; nothing is deleted.
  const total = (profiles) => profiles.reduce((sum, p) => sum + p.attributes.length, 0);
  assert.equal(total(rejected.profiles), total(stitched));

  const restored = undoReviewDecisions(rejected, rejected.snapshot);
  assert.equal(listReviewRows(restored.profiles, 95, new Set(restored.approved)).length, rows.length - 2);
  const back = undoReviewDecisions(restored, confirmed.snapshot);
  assert.deepEqual(back.profiles, stitched);
  assert.deepEqual(back.approved, []);

  // A target that no longer exists is ignored and reported by a shorter snapshot.
  assert.equal(applyReviewDecisions(state, [{ profileId: 'nobody', attributeId: 'none' }], 'verified').snapshot.length, 0);
});

test('undo restores an interest that was already approved before it was rejected', () => {
  const [row] = listReviewRows(stitched, 95, noApprovals);
  const target = [{ profileId: row.profile.id, attributeId: row.attribute.id }];
  const approvedFirst = applyReviewDecisions({ profiles: stitched, approved: [] }, target, 'verified');
  const rejectedAfter = applyReviewDecisions(approvedFirst, target, 'rejected');
  assert.equal(rejectedAfter.approved.includes(row.attribute.id), false);
  const undone = undoReviewDecisions(rejectedAfter, rejectedAfter.snapshot);
  assert.equal(undone.approved.includes(row.attribute.id), true);
  assert.equal(undone.profiles.find((p) => p.id === row.profile.id).attributes.find((x) => x.id === row.attribute.id).status, 'verified');
});

test('funnel counts match the lists and campaign totals shown on other pages', () => {
  const none = buildFunnel(RAW_SOURCE_RECORDS, INITIAL_PROFILES, []);
  assert.deepEqual(none.map((stage) => stage.id), ['messages', 'combined', 'consented', 'sent', 'accepted']);
  assert.equal(none[0].count, RAW_SOURCE_RECORDS.length);
  assert.equal(none[1].count, INITIAL_PROFILES.filter((p) => p.isStitched).length);
  assert.equal(none[2].count, INITIAL_PROFILES.filter((p) => p.isStitched && p.consentPdpa).length);
  assert.equal(none[3].count, 0);
  assert.equal(none[4].count, 0);

  const latest = campaign(['accepted', 'accepted', 'declined', 'pending']);
  const older = campaign(['accepted']);
  const funnel = buildFunnel(RAW_SOURCE_RECORDS, stitched, [latest, older]);
  const totals = summarizeCampaign(latest);
  assert.equal(funnel[3].count, totals.sent);
  assert.equal(funnel[4].count, totals.accepted);
  assert.equal(totals.sent, 4);
  assert.equal(totals.accepted, 2);
  assert.ok(funnel[2].count <= funnel[1].count);
});

test('next actions are ordered by importance, capped at three, and empty when nothing waits', () => {
  const base = { profiles: stitched, campaigns: [], inbox: [], confidenceThreshold: 50, manuallyApprovedIds: noApprovals };
  const rowsAt95 = listReviewRows(stitched, 95, noApprovals).length;

  const all = buildNextActions({
    ...base, confidenceThreshold: 95,
    profiles: [{ ...stitched[0], isStitched: false }, ...stitched.slice(1)],
    inbox: [{ id: 'u1', source: 'LINE_CHAT', handle: 'x', rawText: 'y', timestamp: '' }],
    campaigns: [campaign(['pending', 'accepted'])],
  }, 10);
  assert.deepEqual(all.map((action) => action.id), ['stitch', 'review', 'inbox', 'replies']);
  assert.equal(all[0].count, 1);
  assert.equal(all[3].count, 1);
  assert.equal(buildNextActions({ ...base, confidenceThreshold: 95, inbox: [{ id: 'u1' }], campaigns: [campaign(['pending'])] }).length, 3);
  assert.ok(rowsAt95 > 0);

  const clear = buildNextActions({ ...base, profiles: stitched.map((p) => ({ ...p, attributes: p.attributes.map((a) => ({ ...a, confidence: 99 })) })) });
  assert.deepEqual(clear, []);
});

test('interest mix counts only confirmed interests on combined profiles', () => {
  const mix = countVerifiedInterests(stitched, 75, noApprovals);
  assert.deepEqual(mix.map((slice) => slice.label), ['อาหาร', 'กิจกรรม', 'สไตล์', 'งบ']);
  const verified = stitched.flatMap((p) => p.attributes).filter((a) => getEffectiveAttributeStatus(a, 75, noApprovals) === 'verified');
  assert.equal(mix.reduce((sum, slice) => sum + slice.count, 0), verified.length);
  const higher = countVerifiedInterests(stitched, 95, noApprovals).reduce((sum, slice) => sum + slice.count, 0);
  assert.ok(higher <= verified.length);
  assert.equal(countVerifiedInterests(INITIAL_PROFILES.map((p) => ({ ...p, isStitched: false })), 75, noApprovals).reduce((s, x) => s + x.count, 0), 0);
});

test('landing numbers, recipients and exclusions match a real run of the local engine', async (context) => {
  context.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ fallback: true })));
  const { CAMPAIGN_PRESETS, RAW_SOURCE_RECORDS: records } = await import('../src/data/seedData.ts');
  const { runIdentityStitching, segmentCampaign, simulateCampaignResponses } = await import('../src/services/aiEngine.ts');
  const { buildReplySummaries, createCampaign } = await import('../src/utils/campaignFlow.ts');
  const { LANDING_EXCLUDED, LANDING_MISREADS, LANDING_NUMBERS, LANDING_OUTCOME, LANDING_RECIPIENTS, LANDING_SCENARIOS } = await import('../src/data/landingDemo.ts');
  const { buildDemoNumbers } = await import('../src/utils/demoNumbers.ts');

  const combined = await runIdentityStitching(INITIAL_PROFILES, records);
  const { matches } = await segmentCampaign(CAMPAIGN_PRESETS[0], combined.profiles);
  const made = createCampaign('landing', 'x', '2026-01-01T00:00:00Z', matches, combined.profiles);
  const { interactions } = await simulateCampaignResponses('landing', CAMPAIGN_PRESETS[0], made.matches, combined.profiles);
  made.replies = buildReplySummaries(made, interactions);
  assert.deepEqual(LANDING_OUTCOME, summarizeCampaign(made));

  assert.equal(LANDING_NUMBERS.messages, records.length);
  assert.equal(LANDING_NUMBERS.profiles, combined.profiles.length);
  assert.equal(LANDING_NUMBERS.sent, made.matches.length);
  assert.equal(LANDING_NUMBERS.notConsented, 1);
  assert.deepEqual(buildDemoNumbers([], [], { sent: 2, accepted: 1, declined: 0, pending: 1 }), { messages: 0, profiles: 0, sent: 2, accepted: 1, notConsented: 0 });

  for (const item of LANDING_RECIPIENTS) {
    const match = matches.find((entry) => entry.profileId === item.profile.id);
    assert.ok(match && match.selected && match.tier === 'direct', item.profile.nickname);
    assert.equal(match.matchScore, item.score);
    assert.ok(item.record.rawText.includes(item.term));
  }

  // The friend who did not agree is never a recipient, for any activity the page offers.
  for (const scenario of LANDING_SCENARIOS) {
    const result = await segmentCampaign(scenario.prompt, combined.profiles);
    assert.ok(result.matches.every((match) => match.profileId !== LANDING_EXCLUDED.profile.id), scenario.id);
    if (scenario.id === 'none') assert.equal(result.matches.length, 0);
  }
  assert.equal(LANDING_EXCLUDED.profile.consentPdpa, false);

  // The keyword rules call every hit a "like"; the fixtures say otherwise for these messages.
  for (const item of LANDING_MISREADS) {
    assert.ok(item.rules.length > 0 && item.rules.every((line) => line.startsWith('ชอบ')));
    assert.notDeepEqual(item.rules, item.answer, item.id);
  }
});
