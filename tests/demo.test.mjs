import './overview.test.mjs';
import './ai.test.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CAMPAIGN_PRESETS, INITIAL_PROFILES, RAW_SOURCE_RECORDS } from '../src/data/seedData.ts';
import { LANDING_DEMO } from '../src/data/landingDemo.ts';
import { runIdentityStitching, segmentCampaign, simulateCampaignResponses } from '../src/services/aiEngine.ts';
import { explainRecommendation } from '../src/services/recommendationEvidence.ts';
import { matchesSearch, pageWindow, paginate, sortItems } from '../src/utils/tableQuery.ts';
import { queryProfiles, querySources } from '../src/utils/listViews.ts';
import { buildReplySummaries, createCampaign, recordSentInvitations, summarizeCampaign } from '../src/utils/campaignFlow.ts';
import { getEffectiveAttributeStatus } from '../src/utils/cdpHelpers.ts';

test('the landing story uses the seeded campaign evidence and local simulation outcome', async (context) => {
  context.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ fallback: true })));
  const { message, profile, evidence, highlight, facebook, campaign, invitation, reply, feedback } = LANDING_DEMO;
  assert.ok(message.rawText.includes(highlight));
  assert.equal(evidence.evidenceQuote, message.rawText);
  assert.equal(profile.consentPdpa, true);
  assert.equal(facebook.message.linkedProfileId, profile.id);
  assert.equal(facebook.evidence.source, 'FACEBOOK_POST');
  assert.equal(facebook.evidence.evidenceQuote, facebook.message.rawText);
  assert.ok(facebook.message.rawText.includes(facebook.highlight));

  const reviewedProfiles = INITIAL_PROFILES.map((person) => ({
    ...person,
    attributes: person.attributes.filter((attribute) => getEffectiveAttributeStatus(attribute, 75, new Set()) === 'verified'),
  }));
  const { matches } = await segmentCampaign(campaign, reviewedProfiles);
  const match = matches.find((item) => item.profileId === profile.id);
  assert.equal(match.tier, 'direct');
  assert.equal(match.personalizedInvite, invitation);

  const recipients = matches.filter((item) => item.selected);
  const { interactions } = await simulateCampaignResponses('landing-test', campaign, recipients, INITIAL_PROFILES);
  const result = interactions.find((item) => item.profileId === profile.id);
  assert.equal(result.interaction.status, 'accepted');
  assert.equal(result.interaction.replyText, reply);
  assert.equal(result.feedbackAttribute.value, feedback);
});

test('a new signal reaches the profile and simulated replies update the same campaign', async (context) => {
  context.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ fallback: true })));
  const profile = INITIAL_PROFILES.find((item) => item.isStitched && item.consentPdpa);
  const rawText = 'ศุกร์นี้อยากกินหมูกระทะกับเพื่อนทั้งกลุ่ม';
  const records = [...RAW_SOURCE_RECORDS, {
    id: 'import-test', linkedProfileId: profile.id, source: 'LINE_CHAT',
    handle: profile.nickname, rawText, timestamp: '2026-01-01T00:00:00Z',
  }];
  const stitched = await runIdentityStitching(INITIAL_PROFILES.map((item) =>
    item.id === profile.id ? { ...item, attributes: [], isStitched: false } : item), records);
  const updated = stitched.profiles.find((item) => item.id === profile.id);
  assert.ok(updated.mergedSources.some((record) => record.id === 'import-test'));
  assert.ok(updated.attributes.some((attribute) => attribute.evidenceQuote === rawText));

  const { matches } = await segmentCampaign(CAMPAIGN_PRESETS[0], stitched.profiles);
  assert.ok(matches.some((match) => match.profileId === profile.id && match.tier === 'direct'));
  assert.ok(matches.every((match) => stitched.profiles.find((item) => item.id === match.profileId).consentPdpa));
  assert.ok(matches.length >= 3);
  const { matches: rejected } = await segmentCampaign(CAMPAIGN_PRESETS[0], [{
    ...updated,
    attributes: updated.attributes.map((attribute) => ({ ...attribute, status: 'rejected' })),
  }]);
  assert.deepEqual(rejected, []);
  const recipients = matches.map((match) => ({ ...match, selected: true }));
  const campaignId = 'test-campaign';
  const pendingProfiles = stitched.profiles.map((item) => ({
    ...item,
    campaignHistory: [{ campaignId, status: 'pending' }, ...item.campaignHistory],
  }));
  const result = await simulateCampaignResponses(campaignId, CAMPAIGN_PRESETS[0], recipients, pendingProfiles);
  const pending = result.interactions.find((entry) => entry.interaction.status === 'pending');
  assert.ok(pending);
  assert.equal(pending.feedbackAttribute, undefined);
  assert.ok(result.interactions.some((entry) => entry.interaction.status === 'accepted'));
  assert.equal(result.interactions.length, recipients.length);
  for (const { profileId, interaction } of result.interactions) {
    const history = result.profiles.find((item) => item.id === profileId).campaignHistory;
    assert.equal(history.filter((item) => item.campaignId === campaignId).length, 1);
    assert.equal(history[0], interaction);
  }
});

const mockSegmentAnswer = (context, data) =>
  context.mock.method(globalThis, 'fetch', async () =>
    new Response(JSON.stringify({ fallback: false, action: 'segment', model: 'test-model', data })));
const stitched = INITIAL_PROFILES.filter((item) => item.isStitched && item.consentPdpa);

test('a well-formed empty model answer means nobody fits and does not fall back', async (context) => {
  mockSegmentAnswer(context, { matches: [] });
  const result = await segmentCampaign(CAMPAIGN_PRESETS[0], INITIAL_PROFILES);
  assert.deepEqual(result.matches, []);
  assert.equal(result.source, 'model');
  assert.equal(result.usedFallback, false);
});

test('failed, malformed or out-of-audience model answers use the local rules', async (context) => {
  const optedOut = INITIAL_PROFILES.find((item) => !item.consentPdpa);
  const answers = [
    undefined,
    { matches: 'ทุกคน' },
    { matches: [null] },
    { matches: [{ profileId: stitched[0].id, tier: 'maybe' }] },
    { matches: [{ profileId: 'ghost', tier: 'direct' }] },
    { matches: [{ profileId: stitched[0].id, tier: 'direct', matchScore: 'high' }] },
    ...(optedOut ? [{ matches: [{ profileId: optedOut.id, tier: 'direct' }] }] : []),
  ];
  for (const answer of answers) {
    mockSegmentAnswer(context, answer);
    const result = await segmentCampaign(CAMPAIGN_PRESETS[0], INITIAL_PROFILES);
    assert.equal(result.source, 'local', JSON.stringify(answer));
    assert.ok(result.matches.length > 0);
    assert.ok(result.matches.every((match) => stitched.some((item) => item.id === match.profileId)));
  }
  context.mock.method(globalThis, 'fetch', async () => { throw new Error('offline'); });
  assert.equal((await segmentCampaign(CAMPAIGN_PRESETS[0], INITIAL_PROFILES)).source, 'local');
});

test('custom prompts match real vocabulary and not invitation filler', async (context) => {
  context.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ fallback: true })));
  const none = await segmentCampaign('ชวนไปดูหนังโรงหนังเรื่องใหม่', INITIAL_PROFILES);
  assert.deepEqual(none.matches, []);
  assert.equal(none.source, 'local');
  const photo = await segmentCampaign('ชวนไปถ่ายฟิล์มเมืองเก่า', INITIAL_PROFILES);
  assert.ok(photo.matches.some((match) => match.tier === 'direct'));
});

test('a valid model answer keeps its tiers, scores and invitations', async (context) => {
  const [first, second] = stitched;
  mockSegmentAnswer(context, { matches: [
    { profileId: first.id, tier: 'direct', matchScore: 90, aiReasoning: 'เหตุผล', personalizedInvite: 'ชวนนะ' },
    { profileId: second.id, tier: 'lookalike', matchScore: 200 },
    { profileId: first.id, tier: 'direct' },
  ] });
  const result = await segmentCampaign(CAMPAIGN_PRESETS[0], INITIAL_PROFILES);
  assert.equal(result.source, 'model');
  assert.equal(result.matches.length, 2);
  assert.equal(result.matches[0].personalizedInvite, 'ชวนนะ');
  assert.equal(result.matches[1].matchScore, 81);
  assert.equal(result.matches[1].selected, false);
});

test('each recommendation traces back to profile evidence and its source message', async (context) => {
  context.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ fallback: true })));
  for (const preset of [CAMPAIGN_PRESETS[0], CAMPAIGN_PRESETS[1]]) {
    const { matches } = await segmentCampaign(preset, INITIAL_PROFILES);
    assert.ok(matches.some((match) => match.tier === 'direct'));
    for (const match of matches) {
      const profile = INITIAL_PROFILES.find((item) => item.id === match.profileId);
      const { evidence, hasDirectEvidence } = explainRecommendation(profile, match, preset, RAW_SOURCE_RECORDS, 75, new Set());
      if (match.tier === 'direct') assert.ok(hasDirectEvidence, `${profile.nickname}: ${preset}`);
      for (const item of evidence) {
        assert.ok(profile.attributes.includes(item.attribute));
        assert.ok(`${item.attribute.value} ${item.attribute.evidenceQuote}`.toLowerCase().includes(item.matchedTerm.toLowerCase()));
        if (item.record) {
          assert.equal(item.record.linkedProfileId, profile.id);
          assert.ok(item.record.rawText.includes(item.attribute.evidenceQuote));
        }
      }
      if (match.tier === 'direct') assert.equal(evidence[0].relation, 'direct');
    }
  }
  const [first] = stitched;
  const rejected = { ...first, attributes: first.attributes.map((attribute) => ({ ...attribute, status: 'rejected' })) };
  assert.deepEqual(explainRecommendation(rejected, { tier: 'direct' }, CAMPAIGN_PRESETS[0], RAW_SOURCE_RECORDS, 75, new Set()).evidence, []);
});

test('sending keeps the chosen, edited invitations and replies match what was sent', async (context) => {
  context.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ fallback: true })));
  const { matches } = await segmentCampaign(CAMPAIGN_PRESETS[0], INITIAL_PROFILES);
  assert.ok(matches.length >= 4);
  const optedOut = INITIAL_PROFILES.find((item) => !item.consentPdpa);
  const candidates = matches.map((match, index) => ({ ...match, selected: index !== 1 }));
  candidates[0] = { ...candidates[0], personalizedInvite: '  ชวนแบบแก้เอง  ' };
  if (optedOut) candidates.push({ ...candidates[0], profileId: optedOut.id });
  const at = '2026-01-01T00:00:00Z';

  assert.equal(createCampaign('c1', 'ทดสอบ', at, candidates.map((m, i) => (i === 0 ? { ...m, personalizedInvite: ' ' } : m)), INITIAL_PROFILES), null);
  assert.equal(createCampaign('c1', ' ', at, candidates, INITIAL_PROFILES), null);
  assert.equal(createCampaign('c1', 'ทดสอบ', at, candidates.map((m) => ({ ...m, selected: false })), INITIAL_PROFILES), null);

  const campaign = createCampaign('c1', 'ทดสอบ', at, candidates, INITIAL_PROFILES);
  const sentIds = campaign.matches.map((match) => match.profileId);
  assert.equal(sentIds.length, matches.length - 1);
  assert.ok(!sentIds.includes(matches[1].profileId));
  if (optedOut) assert.ok(!sentIds.includes(optedOut.id));
  assert.equal(campaign.matches[0].personalizedInvite, 'ชวนแบบแก้เอง');

  const sentProfiles = recordSentInvitations(INITIAL_PROFILES, campaign);
  for (const profile of sentProfiles) {
    const entry = profile.campaignHistory.find((item) => item.campaignId === 'c1');
    assert.equal(Boolean(entry), sentIds.includes(profile.id));
    if (entry) assert.equal(entry.status, 'pending');
  }
  assert.deepEqual(summarizeCampaign(campaign), { sent: sentIds.length, accepted: 0, declined: 0, pending: sentIds.length });

  const result = await simulateCampaignResponses('c1', campaign.name, campaign.matches, sentProfiles);
  const replied = { ...campaign, simulated: true, replies: buildReplySummaries(campaign, result.interactions) };
  const totals = summarizeCampaign(replied);
  assert.equal(totals.sent, sentIds.length);
  assert.equal(totals.accepted + totals.declined + totals.pending, totals.sent);
  assert.ok(totals.accepted > 0 && totals.declined > 0 && totals.pending > 0);
  for (const reply of replied.replies) {
    const history = result.profiles.find((item) => item.id === reply.profileId).campaignHistory.filter((item) => item.campaignId === 'c1');
    assert.equal(history.length, 1);
    assert.equal(history[0].status, reply.status);
    assert.equal(history[0].replyText ?? '', reply.replyText);
    assert.equal(history[0].sentMessage, campaign.matches.find((match) => match.profileId === reply.profileId).personalizedInvite);
  }
  for (const profile of result.profiles.filter((item) => !sentIds.includes(item.id))) {
    assert.equal(profile.campaignHistory.some((item) => item.campaignId === 'c1'), false);
  }
});

test('pagination slices pages, clamps out-of-range pages and reports the range', () => {
  const items = Array.from({ length: 45 }, (_, index) => index + 1);
  const first = paginate(items, 1, 20);
  assert.deepEqual([first.rows.length, first.from, first.to, first.pageCount], [20, 1, 20, 3]);
  const last = paginate(items, 3, 20);
  assert.deepEqual([last.rows, last.from, last.to], [[41, 42, 43, 44, 45], 41, 45]);
  assert.equal(paginate(items, 99, 20).page, 3);
  assert.equal(paginate(items, -4, 20).page, 1);
  assert.equal(paginate(items, 1, 100).rows.length, 45);
  const empty = paginate([], 5, 10);
  assert.deepEqual([empty.rows, empty.page, empty.pageCount, empty.from, empty.to], [[], 1, 1, 0, 0]);
  assert.deepEqual(pageWindow(1, 3), [1, 2, 3]);
  assert.deepEqual(pageWindow(6, 12), [1, null, 5, 6, 7, null, 12]);
  assert.deepEqual(pageWindow(3, 12), [1, 2, 3, 4, null, 12]);
});

test('sorting uses Thai collation, keeps ties stable and puts missing values last', () => {
  const names = ['ปอนด์', 'กานต์', 'ฟ้าใส', 'บอส', 'เอก'];
  assert.deepEqual(sortItems(names, (name) => name, 'asc'), ['กานต์', 'บอส', 'ปอนด์', 'ฟ้าใส', 'เอก']);
  assert.deepEqual(sortItems(names, (name) => name, 'desc'), ['เอก', 'ฟ้าใส', 'ปอนด์', 'บอส', 'กานต์']);
  const rows = [{ id: 'a', n: 2 }, { id: 'b', n: null }, { id: 'c', n: 1 }, { id: 'd', n: 2 }, { id: 'e', n: null }];
  assert.deepEqual(sortItems(rows, (row) => row.n, 'asc').map((row) => row.id), ['c', 'a', 'd', 'b', 'e']);
  assert.deepEqual(sortItems(rows, (row) => row.n, 'desc').map((row) => row.id), ['a', 'd', 'c', 'b', 'e']);
  assert.deepEqual(sortItems(['10', '9', '100'], (value) => value, 'asc'), ['9', '10', '100']);
});

test('search needs every term and ignores case and spacing', () => {
  assert.equal(matchesSearch(['ชวนกินหมูกระทะ', 'Boss_99'], 'หมูกระทะ boss'), true);
  assert.equal(matchesSearch(['ชวนกินหมูกระทะ', 'Boss_99'], 'หมูกระทะ เดินป่า'), false);
  assert.equal(matchesSearch(['abc'], '   '), true);
});

test('source records filter, search and sort by time, friend and status', () => {
  const base = { query: '', source: 'all', status: 'all', sortKey: 'time', direction: 'desc' };
  const all = querySources(RAW_SOURCE_RECORDS, INITIAL_PROFILES, base);
  assert.equal(all.length, RAW_SOURCE_RECORDS.length);
  const times = all.map((row) => Date.parse(row.record.timestamp));
  assert.deepEqual(times, [...times].sort((a, b) => b - a));

  for (const source of ['LINE_CHAT', 'FACEBOOK_POST', 'DEPT_ROSTER']) {
    const rows = querySources(RAW_SOURCE_RECORDS, INITIAL_PROFILES, { ...base, source });
    assert.ok(rows.length > 0 && rows.every((row) => row.record.source === source));
  }
  const pending = querySources(RAW_SOURCE_RECORDS, INITIAL_PROFILES, { ...base, status: 'pending' });
  const processed = querySources(RAW_SOURCE_RECORDS, INITIAL_PROFILES, { ...base, status: 'processed' });
  assert.equal(pending.length + processed.length, all.length);
  assert.ok(pending.every((row) => !row.profile.isStitched) && processed.every((row) => row.profile.isStitched));

  const boss = INITIAL_PROFILES.find((item) => item.nickname === 'บอส');
  const byName = querySources(RAW_SOURCE_RECORDS, INITIAL_PROFILES, { ...base, query: boss.nickname });
  assert.ok(byName.length > 0 && byName.every((row) => row.record.linkedProfileId === boss.id || row.record.rawText.includes(boss.nickname) || row.record.handle.includes(boss.nickname)));
  const byText = querySources(RAW_SOURCE_RECORDS, INITIAL_PROFILES, { ...base, query: 'หมูกระทะ' });
  assert.ok(byText.length > 0 && byText.every((row) => row.record.rawText.includes('หมูกระทะ') || row.profile?.nickname.includes('หมูกระทะ')));

  const byStatus = querySources(RAW_SOURCE_RECORDS, INITIAL_PROFILES, { ...base, sortKey: 'status', direction: 'asc' });
  assert.equal(byStatus[0].status, 'pending');
  const byFriend = querySources(RAW_SOURCE_RECORDS, INITIAL_PROFILES, { ...base, sortKey: 'friend', direction: 'asc' });
  const names = byFriend.map((row) => row.profile.nickname);
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b, 'th', { numeric: true, sensitivity: 'base' })));
  assert.equal(querySources(RAW_SOURCE_RECORDS, INITIAL_PROFILES, { ...base, query: 'ไม่มีข้อความนี้แน่นอน' }).length, 0);
});

test('friend list filters by status, interest and replies, and sorts by acceptance', () => {
  const base = { query: '', status: 'all', interest: 'all', reply: 'all', sortKey: 'name', direction: 'asc' };
  const run = (extra) => queryProfiles(INITIAL_PROFILES, 75, new Set(), { ...base, ...extra });
  assert.equal(run({}).length, INITIAL_PROFILES.length);
  const ready = run({ status: 'ready' });
  assert.ok(ready.length > 0 && ready.every((row) => row.profile.isStitched && row.profile.consentPdpa));
  assert.ok(run({ status: 'pending' }).every((row) => !row.profile.isStitched));
  assert.ok(run({ status: 'no-consent' }).every((row) => !row.profile.consentPdpa));

  const food = run({ interest: 'food' });
  assert.ok(food.length > 0 && food.every((row) => row.verifiedTraits.some((trait) => trait.category === 'food')));
  const bySearch = run({ query: 'หมูกระทะ' });
  assert.ok(bySearch.length > 0);

  const history = (status) => [{ campaignId: 'x', campaignName: 'x', status, sentMessage: 'x', timestamp: '2026-01-01T00:00:00Z' }];
  const [a, b, c, d, ...rest] = INITIAL_PROFILES;
  const profiles = [
    { ...a, campaignHistory: [...history('accepted'), ...history('accepted')] },
    { ...b, campaignHistory: [...history('accepted'), ...history('declined')] },
    { ...c, campaignHistory: history('declined') },
    { ...d, campaignHistory: [] },
    ...rest.map((item) => ({ ...item, campaignHistory: [] })),
  ];
  const q = (extra) => queryProfiles(profiles, 75, new Set(), { ...base, ...extra });
  assert.deepEqual(new Set(q({ reply: 'accepted' }).map((row) => row.profile.id)), new Set([a.id, b.id]));
  assert.deepEqual(new Set(q({ reply: 'declined' }).map((row) => row.profile.id)), new Set([b.id, c.id]));
  assert.equal(q({ reply: 'never' }).length, profiles.length - 3);
  const byRate = q({ sortKey: 'acceptance', direction: 'desc' });
  assert.deepEqual(byRate.slice(0, 3).map((row) => row.acceptRate), [1, 0.5, 0]);
  assert.ok(byRate.slice(3).every((row) => row.acceptRate === null));
  const asc = q({ sortKey: 'acceptance', direction: 'asc' });
  assert.deepEqual(asc.slice(0, 3).map((row) => row.acceptRate), [0, 0.5, 1]);
  assert.ok(asc.slice(3).every((row) => row.acceptRate === null));
  const byTraits = q({ sortKey: 'interests', direction: 'desc' });
  assert.ok(byTraits[0].verifiedTraits.length >= byTraits.at(-1).verifiedTraits.length);
});
