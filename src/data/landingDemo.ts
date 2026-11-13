import { extractRuleSignals } from '../services/aiEngine.ts';
import { readSignalsWithRules, SIGNAL_TAXONOMY } from '../services/ai/signals.ts';
import { buildDemoNumbers } from '../utils/demoNumbers.ts';
import { SIGNAL_CASES } from './aiFixtures.ts';
import { CAMPAIGN_PRESETS, INITIAL_PROFILES, RAW_SOURCE_RECORDS } from './seedData.ts';

const message = RAW_SOURCE_RECORDS.find((record) => record.id === 'raw_02_line');
const profile = INITIAL_PROFILES.find((person) => person.id === message?.linkedProfileId);
const evidence = profile?.attributes.find((attribute) => attribute.evidenceQuote === message?.rawText);
const post = RAW_SOURCE_RECORDS.find((record) => record.id === 'raw_02_fb' && record.linkedProfileId === profile?.id);
const postEvidence = profile?.attributes.find((attribute) => attribute.evidenceQuote === post?.rawText);

if (!message || !profile || !evidence || !post || !postEvidence) throw new Error('Gather landing demo evidence is missing');

// Snapshot the local demo outcome so replay never calls the API or writes to the workspace.
export const LANDING_DEMO = {
  message,
  profile,
  evidence,
  highlight: 'หมูกระทะก็ได้ ขอแค่มีชีส',
  facebook: { message: post, evidence: postEvidence, highlight: 'แสงดีมาก ถ่ายรูปเพลิน' },
  campaign: CAMPAIGN_PRESETS[0],
  invitation: 'ฟ้าใส เรามีกิจกรรม “ชวนกินหมูกระทะหลังมอ” เห็นว่าน่าจะตรงกับความสนใจเรื่องชาบู / หมูกระทะชีส สนใจไปด้วยกันไหม?',
  reply: `ได้เลย! ${profile.nickname}ว่างพอดี เดี๋ยวเจอกันตามนัดนะ`,
  feedback: 'ตอบรับแคมเปญไว',
};

/**
 * What happens when the first campaign is sent in the demo. These counts are a snapshot of the local
 * engine run (combine all 15 friends, recommend for the first preset, send, simulate replies);
 * tests/overview.test.mjs re-runs the engine and fails when they drift.
 */
export const LANDING_OUTCOME = { sent: 9, accepted: 6, declined: 1, pending: 2 };

export const LANDING_NUMBERS = buildDemoNumbers(RAW_SOURCE_RECORDS, INITIAL_PROFILES, LANDING_OUTCOME);

/** Scenarios offered by the closing call to action. The last one is meant to find nobody. */
export const LANDING_SCENARIOS = [
  { id: 'mookata', label: 'ชวนกินหมูกระทะ', hint: `พบผู้รับ ${LANDING_OUTCOME.sent} คน`, prompt: CAMPAIGN_PRESETS[0] },
  { id: 'hiking', label: 'หาตี้เดินป่า', hint: 'ดูผู้รับที่ตรงและใกล้เคียง', prompt: CAMPAIGN_PRESETS[1] },
  { id: 'none', label: 'ชวนไปเล่นสกี', hint: 'ไม่พบผู้รับ แอปบอกตรง ๆ', prompt: 'ชวนไปเล่นสกีที่ญี่ปุ่น' },
] as const;

/** Recommended recipients shown in the story. The term is what the quote is matched on. */
const RECIPIENT_SNAPSHOT = [
  { profileId: 'prof_02', score: 98, term: 'หมูกระทะ' },
  { profileId: 'prof_06', score: 97, term: 'หมูกระทะ' },
  { profileId: 'prof_04', score: 90, term: 'ปิ้งย่าง' },
];

export const LANDING_RECIPIENTS = RECIPIENT_SNAPSHOT.map(({ profileId, score, term }) => {
  const person = INITIAL_PROFILES.find((item) => item.id === profileId);
  const record = RAW_SOURCE_RECORDS.find((item) => item.linkedProfileId === profileId && item.rawText.includes(term));
  if (!person || !record) throw new Error(`Gather landing recipient ${profileId} is missing`);
  return { profile: person, score, term, record };
});

/** A friend who has not agreed to receive invitations, with a message that would otherwise match. */
const notConsented = INITIAL_PROFILES.find((item) => !item.consentPdpa);
const excludedRecord = RAW_SOURCE_RECORDS.find((item) => item.linkedProfileId === notConsented?.id && extractRuleSignals(item.rawText).length > 0);
if (!notConsented || !excludedRecord) throw new Error('Gather landing excluded friend is missing');
export const LANDING_EXCLUDED = { profile: notConsented, record: excludedRecord, interest: extractRuleSignals(excludedRecord.rawText)[0].value };

/** Messages the keyword rules misread. The rule result is computed here; the correct answer is the fixture's written answer. */
const labelOf = (id: string) => SIGNAL_TAXONOMY.find((item) => item.id === id)?.label ?? id;
export const LANDING_MISREADS = ['fx_sg_1', 'fx_sg_2', 'fx_sg_5'].map((id) => {
  const item = SIGNAL_CASES.find((fixture) => fixture.id === id);
  if (!item) throw new Error(`Gather landing fixture ${id} is missing`);
  return {
    id,
    text: item.text,
    rules: readSignalsWithRules(item.text).map((signal) => `ชอบ ${labelOf(signal.id)}`),
    answer: [...item.gold.likes.map((x) => `ชอบ ${labelOf(x)}`), ...item.gold.dislikes.map((x) => `ไม่ชอบ ${labelOf(x)}`)],
    note: item.note,
  };
});
