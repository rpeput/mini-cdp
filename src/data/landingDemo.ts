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
