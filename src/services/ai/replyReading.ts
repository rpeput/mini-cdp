import type { AttributeCategory, CampaignInteractionStatus, UnifiedProfile } from '../../types/cdp.ts';
import { extractRuleSignals } from '../aiEngine.ts';
import { callAi } from '../aiClient.ts';
import { asInt, isObject, isString, isVerbatim, stripEmoji } from './guards.ts';

export interface ReplyPreference {
  category: AttributeCategory;
  value: string;
  /** Copied from the reply. */
  evidenceQuote: string;
}

export interface ReplyReading {
  status: CampaignInteractionStatus;
  confidence: number;
  /** A condition or postponement the friend attached, or an empty string. */
  condition: string;
  reason: string;
  newPreference: ReplyPreference | null;
  /** A suggested next step for the organiser when the friend has not decided. */
  followUp: string;
  source: 'model' | 'rules';
}

const STATUSES = new Set<string>(['accepted', 'declined', 'pending']);
const CATEGORIES = new Set<string>(['food', 'activity', 'vibe', 'budget']);

const DECLINE = /ขอผ่าน|ไม่ไป|ไปไม่ได้|ไม่ว่าง|ไม่สะดวก|คงไม่|ไม่เอา|ไม่ได้อ่ะ/;
const ACCEPT = /ได้เลย|ไปด้วย|ไปดิ|ไปสิ|ไปแน่|ไปได้|โอเค|จัดไป|ตกลง|ว่างนะ|เอา/;

/**
 * Keyword baseline: a refusal word wins, then an agreement word, otherwise the reply is undecided.
 * It cannot see conditions, postponements or a refusal that cancels itself ("จะไม่ไปได้ไง").
 */
export function readReplyWithRules(reply: string): ReplyReading {
  const status: CampaignInteractionStatus = DECLINE.test(reply) ? 'declined' : ACCEPT.test(reply) ? 'accepted' : 'pending';
  const signal = extractRuleSignals(reply).find((item) => item.category === 'budget');
  return {
    status,
    confidence: status === 'pending' ? 50 : 70,
    condition: '',
    reason: status === 'pending' ? 'ไม่พบคำตอบรับหรือปฏิเสธ' : 'พบคำตอบรับหรือปฏิเสธในข้อความ',
    newPreference: signal ? { category: signal.category, value: signal.value, evidenceQuote: signal.evidenceQuote } : null,
    followUp: '',
    source: 'rules',
  };
}

/** A "condition" that only repeats the whole reply ("let me think") is the pending status itself, not a condition. */
function restatesReply(condition: string, reply: string): boolean {
  const flat = (text: string) => text.replace(/[\s.!?…ๆ]+/g, '');
  return flat(condition) !== '' && flat(condition) === flat(reply);
}

export function parseReplyReading(raw: unknown, reply: string): ReplyReading | null {
  if (!isObject(raw) || !isString(raw.status) || !STATUSES.has(raw.status)) return null;
  const confidence = asInt(raw.confidence, 0, 100);
  if (confidence === null || !isString(raw.reason) || !isString(raw.condition) || !isString(raw.followUp)) return null;
  let newPreference: ReplyPreference | null = null;
  if (raw.newPreference !== null && raw.newPreference !== undefined) {
    const pref = raw.newPreference;
    if (!isObject(pref) || !isString(pref.category) || !CATEGORIES.has(pref.category) || !isString(pref.value) || !isString(pref.evidenceQuote)) return null;
    // A preference is only kept when its evidence really is in the reply.
    if (pref.value.trim() && isVerbatim(pref.evidenceQuote, reply)) {
      newPreference = { category: pref.category as AttributeCategory, value: stripEmoji(pref.value).slice(0, 60), evidenceQuote: pref.evidenceQuote.trim() };
    }
  }
  return {
    status: raw.status as CampaignInteractionStatus,
    confidence,
    condition: restatesReply(raw.condition, reply) ? '' : stripEmoji(raw.condition).slice(0, 80),
    reason: stripEmoji(raw.reason).slice(0, 160),
    newPreference,
    followUp: stripEmoji(raw.followUp).slice(0, 160),
    source: 'model',
  };
}

/** Reads a real reply the organiser pasted. The result is a proposal; a person saves it. */
export async function readReply(invite: string, reply: string, profile: Pick<UnifiedProfile, 'nickname' | 'attributes'>): Promise<ReplyReading> {
  const result = await callAi(
    'classify_reply',
    { invite, reply, nickname: profile.nickname, knownInterests: profile.attributes.slice(0, 8).map((attribute) => attribute.value) },
    (raw) => parseReplyReading(raw, reply),
  );
  return result.data ?? readReplyWithRules(reply);
}
