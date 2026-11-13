import assert from 'node:assert/strict';
import { test } from 'node:test';
import aiHandler from '../api/ai.ts';
import { callAiRaw, setAiEnabled } from '../src/services/aiClient.ts';
import { IDENTITY_CASES, REPLY_CASES, SIGNAL_CASES } from '../src/data/aiFixtures.ts';
import { INITIAL_PROFILES, RAW_SOURCE_RECORDS } from '../src/data/seedData.ts';
import { clearAiCalls, costOf, getAiCalls, percentile, summarizeAiCalls } from '../src/services/aiMetrics.ts';
import { applyBriefToMatches, missingConstraints, parseBriefPayload, parseBriefWithRules } from '../src/services/ai/brief.ts';
import { parseCampaignSummary, summarizeWithRules } from '../src/services/ai/campaignSummary.ts';
import { runEvaluation } from '../src/services/ai/evaluation.ts';
import { parseResolutions, resolveIdentities, resolveWithRules } from '../src/services/ai/identity.ts';
import { checkInvitesWithRules, parseInviteChecks } from '../src/services/ai/inviteCheck.ts';
import { parseReplyReading, readReplyWithRules } from '../src/services/ai/replyReading.ts';
import { parseSearchIntent, parseSearchWithRules } from '../src/services/ai/searchIntent.ts';
import { parseSignalReading, readSignalsWithRules } from '../src/services/ai/signals.ts';
import { applyPastedReply, linkUnlinkedRecord } from '../src/utils/aiActions.ts';
import { queryProfiles } from '../src/utils/listViews.ts';

const noModel = (context) => context.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ fallback: true })));
test('turning off AI skips new requests, cancels pending reads and allows requests after re-enabling', async (context) => {
  const fetchMock = context.mock.method(globalThis, 'fetch', async (_, { signal }) => {
    if (fetchMock.mock.callCount() === 0) {
      await new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
    }
    return Response.json({ fallback: false, data: { constraints: [] } });
  });
  clearAiCalls();
  try {
    const pending = callAiRaw('parse_brief', { prompt: 'ชวนเดินป่า' });
    setAiEnabled(false);
    assert.equal(await pending, null);
    assert.equal(await callAiRaw('segment', {}), null);
    assert.equal(fetchMock.mock.callCount(), 1);
    assert.equal(getAiCalls().length, 0);
    setAiEnabled(true);
    assert.deepEqual((await callAiRaw('parse_brief', {}))?.data, { constraints: [] });
    assert.equal(fetchMock.mock.callCount(), 2);
  } finally {
    setAiEnabled(true);
    clearAiCalls();
  }
});
test('the AI proxy sets low effort for DeepSeek and forwards the Gather session to OpenCode Go', async (context) => {
  const session = '12345678-1234-4234-8234-123456789abc';
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, `${process.env.LLM_BASE_URL}/chat/completions`);
    const isGo = url.startsWith('https://opencode.ai/inference/go/');
    assert.equal(options.headers['x-opencode-session'], isGo ? session : undefined);
    assert.equal(options.headers['User-Agent'], isGo ? 'Gather/1.0' : undefined);
    assert.equal(JSON.parse(options.body).reasoning_effort, isGo ? 'low' : undefined);
    return Response.json({ choices: [{ message: { content: '{"constraints":[],"clarifyingQuestion":""}' } }] });
  });
  const keys = ['LLM_API_KEY', 'LLM_BASE_URL', 'LLM_WIRE_API', 'LLM_MODEL'];
  const previous = keys.map((key) => process.env[key]);
  try {
    process.env.LLM_API_KEY = 'test-key';
    process.env.LLM_WIRE_API = 'chat';
    for (const baseUrl of ['https://opencode.ai/inference/go/openai/v1', 'https://example.com/v1']) {
      process.env.LLM_BASE_URL = baseUrl;
      process.env.LLM_MODEL = baseUrl.includes('opencode.ai') ? 'deepseek-v4.1-flash' : 'gpt-4.1-mini';
      const response = { status(code) { assert.equal(code, 200); return this; }, json(body) { assert.equal(body.fallback, false); } };
      await aiHandler({
        method: 'POST',
        headers: { 'x-gather-ai-session': session },
        body: { action: 'parse_brief', payload: { prompt: 'ชวนเดินป่า' } },
      }, response);
    }
  } finally {
    for (const [index, key] of keys.entries()) {
      if (previous[index] === undefined) delete process.env[key];
      else process.env[key] = previous[index];
    }
  }
});
const answerWith = (context, reply) =>
  context.mock.method(globalThis, 'fetch', async (_url, init) => {
    const { action, payload } = JSON.parse(init.body);
    return new Response(JSON.stringify({ fallback: false, action, model: 'test-model', data: reply(action, payload), usage: { inputTokens: 100, outputTokens: 20 } }));
  });

test('the keyword baseline scores what the fixtures are built to show', () => {
  const identity = resolveWithRules(IDENTITY_CASES, INITIAL_PROFILES, RAW_SOURCE_RECORDS);
  assert.deepEqual(identity.filter((item, index) => item.profileId === IDENTITY_CASES[index].gold).map((item) => item.recordId),
    ['fx_id_4', 'fx_id_5', 'fx_id_8', 'fx_id_9']);
  const replies = REPLY_CASES.filter((item) => {
    const reading = readReplyWithRules(item.reply);
    return reading.status === item.gold.status && Boolean(reading.condition) === item.gold.hasCondition;
  });
  assert.deepEqual(replies.map((item) => item.id), ['fx_re_1', 'fx_re_2', 'fx_re_4', 'fx_re_7', 'fx_re_8']);
  const signals = SIGNAL_CASES.filter((item) => {
    const found = readSignalsWithRules(item.text).map((reading) => reading.id).sort().join();
    return found === [...item.gold.likes].sort().join() && item.gold.dislikes.length === 0;
  });
  assert.deepEqual(signals.map((item) => item.id), ['fx_sg_3', 'fx_sg_4', 'fx_sg_6', 'fx_sg_7']);
});

test('identity answers must cover every record, name real friends and quote the record', () => {
  const records = IDENTITY_CASES.slice(0, 2);
  const good = {
    resolutions: [
      { recordId: 'fx_id_1', profileId: 'prof_02', confidence: 88, reason: 'ชื่อ Fahsai', clue: 'Fahsai' },
      { recordId: 'fx_id_2', profileId: 'prof_04', confidence: 82, reason: 'ชื่อ Pitchaya', clue: 'Pitchaya A.' },
    ],
  };
  const parsed = parseResolutions(good, records, INITIAL_PROFILES);
  assert.deepEqual(parsed.map((item) => item.profileId), ['prof_02', 'prof_04']);
  assert.equal(parsed[0].source, 'model');

  const ungrounded = structuredClone(good);
  ungrounded.resolutions[0].clue = 'ฟ้าใส';
  const downgraded = parseResolutions(ungrounded, records, INITIAL_PROFILES);
  assert.equal(downgraded[0].profileId, null);
  assert.equal(downgraded[1].profileId, 'prof_04');

  const ghost = structuredClone(good);
  ghost.resolutions[0].profileId = 'prof_99';
  assert.equal(parseResolutions(ghost, records, INITIAL_PROFILES), null);
  assert.equal(parseResolutions({ resolutions: good.resolutions.slice(0, 1) }, records, INITIAL_PROFILES), null);
  assert.equal(parseResolutions({ resolutions: [...good.resolutions, good.resolutions[0]] }, records, INITIAL_PROFILES), null);
  assert.equal(parseResolutions({ resolutions: [{ ...good.resolutions[0], recordId: 'other' }, good.resolutions[1]] }, records, INITIAL_PROFILES), null);
  assert.equal(parseResolutions({ resolutions: 'x' }, records, INITIAL_PROFILES), null);
});

test('calls are recorded as model, unavailable or invalid, with provider token counts', async (context) => {
  clearAiCalls();
  noModel(context);
  await resolveIdentities(IDENTITY_CASES.slice(0, 1), INITIAL_PROFILES, RAW_SOURCE_RECORDS);
  answerWith(context, () => ({ resolutions: [] }));
  const invalid = await resolveIdentities(IDENTITY_CASES.slice(0, 1), INITIAL_PROFILES, RAW_SOURCE_RECORDS);
  assert.equal(invalid.source, 'rules');
  answerWith(context, (_action, payload) => ({ resolutions: payload.records.map((record) => ({ recordId: record.id, profileId: null, confidence: 10, reason: 'ไม่แน่ใจ', clue: '' })) }));
  const valid = await resolveIdentities(IDENTITY_CASES.slice(0, 2), INITIAL_PROFILES, RAW_SOURCE_RECORDS);
  assert.equal(valid.source, 'model');
  const calls = getAiCalls();
  assert.deepEqual(calls.map((call) => call.outcome), ['unavailable', 'invalid', 'model']);
  assert.ok(calls.every((call) => call.action === 'resolve_identity'));
  assert.deepEqual([calls[2].inputTokens, calls[2].outputTokens, calls[2].estimated], [100, 20, false]);
  assert.equal(calls[0].inputTokens, 0);
  const [summary] = summarizeAiCalls(calls, { input: 2, output: 8 });
  assert.deepEqual([summary.calls, summary.model, summary.unavailable, summary.invalid], [3, 1, 1, 1]);
  assert.ok(Math.abs(summary.fallbackRate - 2 / 3) < 1e-9);
  assert.equal(summary.cost, (200 * 2 + 40 * 8) / 1_000_000);
  clearAiCalls();
});

test('latency percentiles and cost follow the documented formula', () => {
  assert.equal(percentile([], 50), null);
  assert.equal(percentile([10, 20, 30, 40], 50), 20);
  assert.equal(percentile([10, 20, 30, 40], 95), 40);
  assert.equal(costOf(1_000_000, 500_000, { input: 1, output: 4 }), 3);
  assert.equal(costOf(10, 10, { input: null, output: 4 }), null);
});

test('a reply reading keeps a preference only when its quote is in the reply', () => {
  const reply = 'งบตึงอ่ะ ถ้าไม่เกิน 200 ไปแน่';
  const base = { status: 'pending', confidence: 86, condition: 'ถ้างบไม่เกิน 200', reason: 'มีเงื่อนไข', followUp: 'ยืนยันงบ', newPreference: { category: 'budget', value: 'งบประหยัด', evidenceQuote: 'งบตึง' } };
  const kept = parseReplyReading(base, reply);
  assert.equal(kept.status, 'pending');
  assert.equal(kept.newPreference.evidenceQuote, 'งบตึง');
  const invented = parseReplyReading({ ...base, newPreference: { ...base.newPreference, evidenceQuote: 'ไม่มีเงิน' } }, reply);
  assert.equal(invented.newPreference, null);
  assert.equal(parseReplyReading({ ...base, status: 'maybe' }, reply), null);
  assert.equal(parseReplyReading({ ...base, newPreference: { category: 'money', value: 'x', evidenceQuote: 'งบตึง' } }, reply), null);
  assert.equal(parseReplyReading({ ...base, newPreference: null }, reply).newPreference, null);
});

test('signal readings use the fixed taxonomy and refuse invented quotes', () => {
  const text = 'ไม่ชอบทะเลเลย แดดร้อน ชอบเดินป่ามากกว่า';
  const ok = parseSignalReading({ interests: [
    { id: 'beach', polarity: 'dislikes', evidenceQuote: 'ไม่ชอบทะเลเลย', reason: 'ปฏิเสธ' },
    { id: 'hiking', polarity: 'likes', evidenceQuote: 'ชอบเดินป่ามากกว่า', reason: 'ชอบ' },
    { id: 'hiking', polarity: 'likes', evidenceQuote: 'ชอบเดินป่ามากกว่า', reason: 'ซ้ำ' },
  ] }, text);
  assert.deepEqual(ok.map((item) => `${item.id}:${item.polarity}`), ['beach:dislikes', 'hiking:likes']);
  assert.equal(parseSignalReading({ interests: [{ id: 'sushi', polarity: 'likes', evidenceQuote: 'ชอบ', reason: '' }] }, text), null);
  assert.equal(parseSignalReading({ interests: [{ id: 'hiking', polarity: 'likes', evidenceQuote: 'รักการเดินป่า', reason: '' }] }, text), null);
  assert.equal(parseSignalReading({ interests: [{ id: 'hiking', polarity: 'maybe', evidenceQuote: 'ชอบ', reason: '' }] }, text), null);
  assert.deepEqual(parseSignalReading({ interests: [] }, text), []);
});

test('a campaign description becomes grounded, editable constraints', () => {
  const prompt = 'ชวนกินหมูกระทะวันศุกร์ งบไม่เกิน 250 ไม่เกิน 6 คน';
  const brief = parseBriefWithRules(prompt);
  const by = Object.fromEntries(brief.constraints.map((item) => [item.kind, item.value]));
  assert.equal(by.day, 'วันศุกร์');
  assert.equal(by.budgetMax, 250);
  assert.equal(by.groupSize, 6);
  assert.ok(brief.constraints.every((item) => prompt.includes(item.quote)));
  assert.deepEqual(missingConstraints(brief.constraints), []);
  assert.equal(brief.clarifyingQuestion, '');
  const vague = parseBriefWithRules('ชวนเดินป่า');
  assert.deepEqual(missingConstraints(vague.constraints), ['day', 'budgetMax', 'groupSize']);
  assert.equal(vague.clarifyingQuestion, 'อยากชวนวันไหนและงบไม่เกินเท่าไหร่?');

  const thaiNumber = 'ชวนไปบุฟเฟ่ต์ งบไม่เกินสามร้อย';
  const ok = parseBriefPayload({ constraints: [{ kind: 'budgetMax', value: 300, quote: 'งบไม่เกินสามร้อย' }], clarifyingQuestion: 'ชวนกี่คน?' }, thaiNumber);
  assert.equal(ok.constraints[0].value, 300);
  assert.equal(ok.source, 'model');
  assert.equal(parseBriefPayload({ constraints: [{ kind: 'budgetMax', value: 300, quote: 'งบสามร้อย' }], clarifyingQuestion: '' }, thaiNumber), null);
  assert.equal(parseBriefPayload({ constraints: [{ kind: 'budgetMax', value: '300', quote: 'งบไม่เกินสามร้อย' }], clarifyingQuestion: '' }, thaiNumber), null);
  assert.equal(parseBriefPayload({ constraints: [{ kind: 'weather', value: 'ร้อน', quote: 'งบ' }], clarifyingQuestion: '' }, thaiNumber), null);
});

test('a brief limits the selected group and warns about friends short of money', async (context) => {
  noModel(context);
  const { segmentCampaign } = await import('../src/services/aiEngine.ts');
  const { matches } = await segmentCampaign('ชวนกินหมูกระทะ', INITIAL_PROFILES);
  const direct = matches.filter((match) => match.selected).length;
  assert.ok(direct >= 3);
  const sized = applyBriefToMatches(matches, parseBriefWithRules('ชวนกินหมูกระทะ ไม่เกิน 2 คน'), INITIAL_PROFILES);
  assert.equal(sized.filter((match) => match.selected).length, 2);
  assert.equal(sized.length, matches.length);
  const strongest = [...matches].sort((a, b) => b.matchScore - a.matchScore).filter((match) => match.selected).slice(0, 2).map((match) => match.profileId);
  assert.deepEqual(sized.filter((match) => match.selected).map((match) => match.profileId).sort(), strongest.sort());
  assert.deepEqual(applyBriefToMatches(matches, null, INITIAL_PROFILES), matches);
  const tight = INITIAL_PROFILES.find((profile) => profile.attributes.some((attribute) => attribute.category === 'budget' && /ช็อต|ประหยัด/.test(attribute.value)));
  const pool = [{ ...matches[0], profileId: tight.id }];
  assert.match(applyBriefToMatches(pool, parseBriefWithRules('ชวนกินหมูกระทะ งบไม่เกิน 600'), INITIAL_PROFILES)[0].aiReasoning, /ระวัง/);
  assert.doesNotMatch(applyBriefToMatches(pool, parseBriefWithRules('ชวนกินหมูกระทะ งบไม่เกิน 200'), INITIAL_PROFILES)[0].aiReasoning, /ระวัง/);
});

test('invitation checks flag facts that are not in the brief and drop ungrounded flags', () => {
  const brief = parseBriefWithRules('ชวนกินหมูกระทะวันศุกร์ งบไม่เกิน 250');
  const invites = [
    { profileId: 'prof_01', nickname: 'บอส', text: 'บอส ชวนกินหมูกระทะวันศุกร์ งบไม่เกิน 250 ไปไหม' },
    { profileId: 'prof_02', nickname: 'ฟ้าใส', text: 'ฟ้าใส ศุกร์นี้ 19:30 ที่ร้านสมใจ ไปไหม' },
    { profileId: 'prof_03', nickname: 'นนท์', text: 'นนท์ ไปกินหมูกระทะกัน' },
  ];
  const checks = checkInvitesWithRules(invites, brief);
  assert.equal(checks[0].ok, true);
  assert.ok(checks[1].problems.some((problem) => problem.kind === 'unsupported_fact' && problem.quote.includes('19:30')));
  assert.ok(checks[1].problems.some((problem) => problem.quote.includes('ร้านสมใจ')));
  assert.deepEqual(checks[2].problems.map((problem) => problem.kind), ['missing_info', 'missing_info']);

  const model = parseInviteChecks({ checks: invites.map((invite) => ({
    profileId: invite.profileId,
    ok: false,
    problems: [{ kind: 'unsupported_fact', quote: invite.profileId === 'prof_02' ? '19:30' : 'ไม่มีในข้อความ', explanation: 'x' }],
  })) }, invites);
  assert.equal(model[1].ok, false);
  assert.equal(model[0].ok, true);
  assert.equal(model[2].ok, true);
  assert.equal(parseInviteChecks({ checks: [] }, invites), null);
});

test('a campaign summary cites real recipients and the rule baseline explains tagged replies', () => {
  const profiles = INITIAL_PROFILES.slice(0, 4);
  const matches = profiles.map((profile) => ({ profileId: profile.id, tier: 'direct', matchScore: 90, aiReasoning: '', personalizedInvite: 'x', selected: true }));
  const campaign = {
    id: 'c', name: 'ทดสอบ', createdAt: '2026-01-01T00:00:00Z', matches, simulated: true, closedLoopUpdatesCount: 3,
    replies: [
      { profileId: profiles[0].id, status: 'accepted', replyText: 'ได้เลย', tier: 'direct', feedbackTag: 'ตอบรับไว' },
      { profileId: profiles[1].id, status: 'declined', replyText: 'ปลายเดือนช็อต', tier: 'direct', feedbackTag: 'ปลายเดือนช็อต' },
      { profileId: profiles[2].id, status: 'pending', replyText: 'ไปได้แต่ขอเลื่อน', tier: 'direct', feedbackTag: '', note: 'ขอเลื่อน' },
    ],
  };
  const points = summarizeWithRules(campaign, profiles);
  assert.ok(points.every((point) => point.citations.length > 0));
  assert.ok(points.some((point) => point.citations.includes(profiles[1].id) && point.text.includes('ปลายเดือนช็อต')));
  assert.ok(points.some((point) => point.kind === 'next_step' && point.citations.includes(profiles[3].id)));

  const parsed = parseCampaignSummary({ points: [
    { kind: 'insight', text: 'งบเป็นเหตุผลหลัก', citations: [profiles[1].id, 'ghost'] },
    { kind: 'insight', text: 'ไม่มีหลักฐาน', citations: ['ghost'] },
    { kind: 'next_step', text: 'เสนอร้านราคาประหยัด', citations: [profiles[1].id, profiles[1].id] },
  ] }, campaign);
  assert.deepEqual(parsed.map((point) => point.citations), [[profiles[1].id], [profiles[1].id]]);
  assert.equal(parseCampaignSummary({ points: [{ kind: 'insight', text: 'x', citations: ['ghost'] }] }, campaign), null);
  assert.equal(parseCampaignSummary({ points: [{ kind: 'opinion', text: 'x', citations: [] }] }, campaign), null);
});

test('a search question becomes table filters that the table runs itself', () => {
  const intent = parseSearchWithRules('ใครงบตึงและเคยปฏิเสธ');
  assert.deepEqual(intent.anyTerms, ['ช็อต', 'ประหยัด']);
  assert.equal(intent.reply, 'declined');
  assert.equal(parseSearchWithRules('เรียงตามอัตราตอบรับ').reply, 'all');
  assert.deepEqual(parseSearchWithRules('เรียงตามอัตราตอบรับ').sort, { key: 'acceptance', direction: 'desc' });
  assert.equal(parseSearchWithRules('คนที่ยังไม่ยินยอม').status, 'no-consent');
  assert.equal(parseSearchWithRules('สวัสดี').explanation.startsWith('ไม่พบ'), true);

  const ok = { terms: [], anyTerms: ['เดินป่า'], status: 'ready', interest: 'activity', reply: 'all', sort: { key: 'name', direction: 'asc' }, explanation: 'x' };
  assert.equal(parseSearchIntent(ok).source, 'model');
  assert.equal(parseSearchIntent({ ...ok, status: 'everyone' }), null);
  assert.equal(parseSearchIntent({ ...ok, sort: { key: 'salary', direction: 'asc' } }), null);
  assert.equal(parseSearchIntent({ ...ok, terms: ['x'.repeat(60)] }), null);

  const base = { query: '', status: 'all', interest: 'all', reply: 'all', sortKey: 'name', direction: 'asc' };
  const withAny = queryProfiles(INITIAL_PROFILES, 75, new Set(), { ...base, anyTerms: ['เดินป่า', 'ทะเล'] });
  const plain = queryProfiles(INITIAL_PROFILES, 75, new Set(), { ...base, query: 'เดินป่า' });
  assert.ok(withAny.length >= plain.length && plain.length > 0);
  assert.equal(queryProfiles(INITIAL_PROFILES, 75, new Set(), { ...base, anyTerms: ['ไม่มีคำนี้'] }).length, 0);
});

test('a confirmed link adds the message to the friend and reopens their processing, without touching consent', () => {
  const unlinked = { id: 'u1', source: 'FACEBOOK_POST', handle: 'Thanakrit P.', rawText: 'ไม่เอาโปรโมชั่นนะ', timestamp: '2026-01-01T00:00:00Z' };
  const target = INITIAL_PROFILES.find((profile) => profile.id === 'prof_01');
  assert.equal(target.isStitched, true);
  const linked = linkUnlinkedRecord(RAW_SOURCE_RECORDS, INITIAL_PROFILES, unlinked, 'prof_01');
  assert.equal(linked.records.length, RAW_SOURCE_RECORDS.length + 1);
  assert.equal(linked.records.at(-1).linkedProfileId, 'prof_01');
  const after = linked.profiles.find((profile) => profile.id === 'prof_01');
  assert.deepEqual([after.isStitched, after.consentPdpa], [false, target.consentPdpa]);
  assert.equal(linked.profiles.filter((profile) => profile.isStitched).length, INITIAL_PROFILES.filter((profile) => profile.isStitched).length - 1);
  assert.equal(linkUnlinkedRecord(RAW_SOURCE_RECORDS, INITIAL_PROFILES, unlinked, 'nobody'), null);
  assert.equal(linkUnlinkedRecord(linked.records, linked.profiles, unlinked, 'prof_02'), null);
});

test('a pasted reply replaces the simulated one in the campaign and the profile history', async (context) => {
  context.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ fallback: true })));
  const { segmentCampaign, simulateCampaignResponses } = await import('../src/services/aiEngine.ts');
  const { createCampaign, recordSentInvitations, buildReplySummaries, summarizeCampaign } = await import('../src/utils/campaignFlow.ts');
  const { matches } = await segmentCampaign('ชวนกินหมูกระทะ', INITIAL_PROFILES);
  const campaign = createCampaign('c9', 'ชวนกินหมูกระทะ', '2026-01-01T00:00:00Z', matches, INITIAL_PROFILES);
  const sent = recordSentInvitations(INITIAL_PROFILES, campaign);
  const [first, second] = campaign.matches;
  const reading = { profileId: first.profileId, replyText: ' ไปได้แต่ขอเลื่อนเป็นสัปดาห์หน้านะ งบตึงนิดหน่อย ', status: 'pending', note: 'ขอเลื่อนเป็นสัปดาห์หน้า', confidence: 70, preference: { category: 'budget', value: 'งบประหยัด', evidenceQuote: 'งบตึง' } };

  const applied = applyPastedReply(campaign, sent, reading, '2026-01-02T00:00:00Z');
  assert.equal(applied.campaign.replies.length, 1);
  assert.deepEqual([applied.campaign.replies[0].origin, applied.campaign.replies[0].status, applied.campaign.replies[0].note], ['pasted', 'pending', 'ขอเลื่อนเป็นสัปดาห์หน้า']);
  assert.equal(applied.campaign.closedLoopUpdatesCount, 0);
  const profile = applied.profiles.find((item) => item.id === first.profileId);
  const entry = profile.campaignHistory.filter((item) => item.campaignId === 'c9');
  assert.equal(entry.length, 1);
  assert.deepEqual([entry[0].status, entry[0].replyText, entry[0].note, entry[0].sentMessage], ['pending', 'ไปได้แต่ขอเลื่อนเป็นสัปดาห์หน้านะ งบตึงนิดหน่อย', 'ขอเลื่อนเป็นสัปดาห์หน้า', first.personalizedInvite]);
  const learned = profile.attributes.find((attribute) => attribute.id === `attr_reply_${first.profileId}_c9`);
  assert.deepEqual([learned.evidenceQuote, learned.status, learned.source, learned.confidence], ['งบตึง', 'needs_review', 'LINE_CHAT', 75]);
  assert.ok(profile.attributes.length === sent.find((item) => item.id === first.profileId).attributes.length + 1);

  // Saving again for the same friend replaces rather than duplicates.
  const again = applyPastedReply(applied.campaign, applied.profiles, { ...reading, status: 'accepted', note: '', confidence: 92, preference: null }, '2026-01-03T00:00:00Z');
  assert.equal(again.campaign.replies.length, 1);
  assert.equal(again.campaign.replies[0].status, 'accepted');
  assert.equal(again.campaign.closedLoopUpdatesCount, 1);
  assert.equal(again.profiles.find((item) => item.id === first.profileId).attributes.some((attribute) => attribute.id === `attr_reply_${first.profileId}_c9`), false);

  // Real replies survive a later simulation of the other recipients, and the totals still add up.
  const pasted = again.campaign.replies;
  const rest = campaign.matches.filter((match) => match.profileId !== first.profileId);
  const result = await simulateCampaignResponses('c9', campaign.name, rest, again.profiles);
  const merged = { ...campaign, simulated: true, replies: [...pasted, ...buildReplySummaries(campaign, result.interactions)] };
  const totals = summarizeCampaign(merged);
  assert.equal(totals.sent, campaign.matches.length);
  assert.equal(totals.accepted + totals.declined + totals.pending, totals.sent);
  assert.equal(merged.replies.find((reply) => reply.profileId === first.profileId).origin, 'pasted');
  assert.equal(result.profiles.find((item) => item.id === first.profileId).campaignHistory.find((item) => item.campaignId === 'c9').status, 'accepted');

  assert.equal(applyPastedReply(campaign, sent, { ...reading, replyText: '   ' }, 'x'), null);
  assert.equal(applyPastedReply(campaign, sent, { ...reading, profileId: 'prof_99' }, 'x'), null);
  void second;
});

test('without a model the evaluation reports rule scores only', async (context) => {
  noModel(context);
  clearAiCalls();
  const suites = await runEvaluation(INITIAL_PROFILES, RAW_SOURCE_RECORDS);
  assert.deepEqual(suites.map((suite) => [suite.key, suite.cases.length, suite.rulesCorrect, suite.modelCorrect, suite.modelAnswered]),
    [['identity', 9, 4, null, 0], ['reply', 8, 5, null, 0], ['signal', 7, 4, null, 0]]);
  clearAiCalls();
});

test('a model that matches the gold answers scores full marks and the evaluation says so', async (context) => {
  clearAiCalls();
  const requests = [];
  answerWith(context, (action, payload) => {
    requests.push(action);
    if (action === 'resolve_identity') {
      assert.ok(payload.records.length <= 3);
      return { resolutions: payload.records.map((record) => {
        const gold = IDENTITY_CASES.find((item) => item.id === record.id);
        return { recordId: record.id, profileId: gold.gold, confidence: gold.gold ? 90 : 20, reason: 'ตามเฉลย', clue: gold.gold ? record.handle : '' };
      }) };
    }
    if (action === 'classify_reply') {
      const gold = REPLY_CASES.find((item) => item.reply === payload.reply).gold;
      return { status: gold.status, confidence: 90, condition: gold.hasCondition ? 'มีเงื่อนไข' : '', reason: 'ตามเฉลย', newPreference: null, followUp: '' };
    }
    const gold = SIGNAL_CASES.find((item) => item.text === payload.text).gold;
    return { interests: [
      ...gold.likes.map((id) => ({ id, polarity: 'likes', evidenceQuote: payload.text, reason: '' })),
      ...gold.dislikes.map((id) => ({ id, polarity: 'dislikes', evidenceQuote: payload.text, reason: '' })),
    ] };
  });
  setAiEnabled(false);
  try {
    const basic = await runEvaluation(INITIAL_PROFILES, RAW_SOURCE_RECORDS);
    assert.ok(basic.every((suite) => suite.modelAnswered === 0));
    assert.equal(requests.length, 0);
  } finally {
    setAiEnabled(true);
  }
  const suites = await runEvaluation(INITIAL_PROFILES, RAW_SOURCE_RECORDS);
  assert.equal(requests.filter((action) => action === 'resolve_identity').length, 3);
  assert.deepEqual(suites.map((suite) => [suite.key, suite.modelCorrect, suite.modelAnswered]), [['identity', 9, 9], ['reply', 8, 8], ['signal', 7, 7]]);
  assert.ok(suites.every((suite) => suite.rulesCorrect < suite.cases.length));
  assert.ok(getAiCalls().every((call) => call.outcome === 'model'));
  clearAiCalls();
});
