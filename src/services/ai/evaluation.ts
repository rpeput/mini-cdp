import { IDENTITY_CASES, REPLY_CASES, SIGNAL_CASES } from '../../data/aiFixtures.ts';
import type { RawSourceRecord, UnifiedProfile } from '../../types/cdp.ts';
import { resolveIdentities, resolveWithRules } from './identity.ts';
import { readReply, readReplyWithRules } from './replyReading.ts';
import { readSignals, readSignalsWithRules, SIGNAL_TAXONOMY } from './signals.ts';

export interface EvalCase {
  id: string;
  input: string;
  note: string;
  gold: string;
  rules: string;
  rulesOk: boolean;
  /** The model's answer, or null when the model was not used for this case. */
  model: string | null;
  modelOk: boolean | null;
}

export interface EvalSuite {
  key: 'identity' | 'reply' | 'signal';
  title: string;
  question: string;
  cases: EvalCase[];
  rulesCorrect: number;
  /** Cases the model answered correctly, or null when the model answered none of them. */
  modelCorrect: number | null;
  modelAnswered: number;
}

const STATUS_TEXT = { accepted: 'ตอบรับ', declined: 'ปฏิเสธ', pending: 'ยังไม่ตัดสินใจ' } as const;
const labelOf = (id: string) => SIGNAL_TAXONOMY.find((item) => item.id === id)?.label ?? id;
const sortedIds = (ids: readonly string[]) => [...ids].sort().join(',');

function finish(suite: Omit<EvalSuite, 'rulesCorrect' | 'modelCorrect' | 'modelAnswered'>): EvalSuite {
  const answered = suite.cases.filter((item) => item.modelOk !== null);
  return {
    ...suite,
    rulesCorrect: suite.cases.filter((item) => item.rulesOk).length,
    modelCorrect: answered.length ? answered.filter((item) => item.modelOk).length : null,
    modelAnswered: answered.length,
  };
}

function signalText(likes: readonly string[], dislikes: readonly string[]): string {
  const parts = [likes.length && `ชอบ: ${likes.map(labelOf).join(', ')}`, dislikes.length && `ไม่ชอบ: ${dislikes.map(labelOf).join(', ')}`].filter(Boolean);
  return parts.join(' · ') || 'ไม่มีความสนใจ';
}

/**
 * Scores the keyword rules and the model on the same ambiguous messages. The rules always run. The
 * model runs through the proxy, so without a key every case reports "not answered" instead of a score.
 */
export async function runEvaluation(profiles: readonly UnifiedProfile[], known: readonly RawSourceRecord[]): Promise<EvalSuite[]> {
  const nick = (id: string | null) => (id ? profiles.find((profile) => profile.id === id)?.nickname ?? id : 'ไม่ระบุ');

  const ruleIdentity = resolveWithRules(IDENTITY_CASES, profiles, known);
  const modelIdentity = (await Promise.all([
    resolveIdentities(IDENTITY_CASES.slice(0, 3), profiles, known),
    resolveIdentities(IDENTITY_CASES.slice(3, 6), profiles, known),
    resolveIdentities(IDENTITY_CASES.slice(6), profiles, known),
  ])).flatMap((result) => result.suggestions.map((suggestion) => result.source === 'model' ? suggestion : null));
  const identity = finish({
    key: 'identity',
    title: 'ใครเป็นเจ้าของข้อความ',
    question: 'บอกว่าข้อความจากชื่อบัญชีแปลก ๆ เป็นของเพื่อนคนไหน และไม่เดาเมื่อไม่แน่ใจ',
    cases: IDENTITY_CASES.map((item, index) => {
      const rules = ruleIdentity[index];
      const model = modelIdentity[index];
      // A suggestion under the floor is "not sure", the same as naming nobody.
      const named = (suggestion: { profileId: string | null; confidence: number } | null) => (suggestion && suggestion.confidence >= 60 ? suggestion.profileId : null);
      return {
        id: item.id,
        input: `${item.handle} · ${item.rawText}`,
        note: item.note,
        gold: nick(item.gold),
        rules: nick(rules.profileId),
        rulesOk: rules.profileId === item.gold,
        model: model ? nick(named(model)) : null,
        modelOk: model ? named(model) === item.gold : null,
      };
    }),
  });

  const reply = finish({
    key: 'reply',
    title: 'อ่านคำตอบกลับ',
    question: 'ดูว่าเพื่อนตอบรับ ปฏิเสธ หรือยังไม่ตัดสินใจ รวมถึงเงื่อนไขที่แนบมา',
    cases: await Promise.all(REPLY_CASES.map(async (item) => {
      const rules = readReplyWithRules(item.reply);
      const model = await readReply('ชวนไปกินหมูกระทะ', item.reply, { nickname: 'เพื่อน', attributes: [] });
      const fits = (reading: { status: string; condition: string }) => reading.status === item.gold.status && Boolean(reading.condition) === item.gold.hasCondition;
      const text = (reading: { status: keyof typeof STATUS_TEXT; condition: string }) => `${STATUS_TEXT[reading.status]}${reading.condition ? ` (${reading.condition})` : ''}`;
      return {
        id: item.id,
        input: item.reply,
        note: item.note,
        gold: `${STATUS_TEXT[item.gold.status]}${item.gold.hasCondition ? ' (มีเงื่อนไข)' : ''}`,
        rules: text(rules),
        rulesOk: fits(rules),
        model: model.source === 'model' ? text(model) : null,
        modelOk: model.source === 'model' ? fits(model) : null,
      };
    })),
  });

  const signal = finish({
    key: 'signal',
    title: 'เพื่อนชอบหรือเลิกชอบอะไร',
    question: 'แยกสิ่งที่เพื่อนชอบ ออกจากสิ่งที่เลิกแล้ว ไม่ชอบ หรือแค่พูดถึง',
    cases: await Promise.all(SIGNAL_CASES.map(async (item) => {
      const rules = readSignalsWithRules(item.text);
      const model = await readSignals(item.text);
      const split = (readings: ReadonlyArray<{ id: string; polarity: string }>) => ({
        likes: readings.filter((reading) => reading.polarity === 'likes').map((reading) => reading.id),
        dislikes: readings.filter((reading) => reading.polarity === 'dislikes').map((reading) => reading.id),
      });
      const fits = (readings: ReadonlyArray<{ id: string; polarity: string }>) => {
        const found = split(readings);
        return sortedIds(found.likes) === sortedIds(item.gold.likes) && sortedIds(found.dislikes) === sortedIds(item.gold.dislikes);
      };
      const show = (readings: ReadonlyArray<{ id: string; polarity: string }>) => signalText(split(readings).likes, split(readings).dislikes);
      return {
        id: item.id,
        input: item.text,
        note: item.note,
        gold: signalText(item.gold.likes, item.gold.dislikes),
        rules: show(rules),
        rulesOk: fits(rules),
        model: model.source === 'model' ? show(model.signals) : null,
        modelOk: model.source === 'model' ? fits(model.signals) : null,
      };
    })),
  });

  return [identity, reply, signal];
}
