import type { RawSourceRecord, UnifiedProfile, UnlinkedRecord } from '../../types/cdp.ts';
import { callAi } from '../aiClient.ts';
import { asInt, isObject, isString, isVerbatim } from './guards.ts';

export interface IdentitySuggestion {
  recordId: string;
  /** The proposed friend, or null when the evidence does not point to exactly one. */
  profileId: string | null;
  confidence: number;
  reason: string;
  /** Text copied from the record that shows why; empty when nothing was proposed. */
  clue: string;
  source: 'model' | 'rules';
}

export interface IdentityResult {
  suggestions: IdentitySuggestion[];
  source: 'model' | 'rules';
}

/** A suggestion below this confidence is shown as "not sure" and never preselected. */
export const IDENTITY_CONFIDENCE_FLOOR = 60;

const norm = (value: string) => value.normalize('NFC').toLocaleLowerCase('th').trim();

function knownHandles(profileId: string, known: readonly RawSourceRecord[]): string[] {
  return [...new Set(known.filter((record) => record.linkedProfileId === profileId).map((record) => record.handle))];
}

/**
 * Keyword baseline. It links a message only on an exact known handle, or on a Thai nickname, a Thai
 * name part or a student id that appears in the handle or text. It cannot read English spellings.
 */
export function resolveWithRules(
  records: readonly UnlinkedRecord[],
  profiles: readonly UnifiedProfile[],
  known: readonly RawSourceRecord[],
): IdentitySuggestion[] {
  return records.map((record): IdentitySuggestion => {
    const handle = norm(record.handle);
    const haystack = norm(`${record.handle} ${record.rawText}`);
    const hits: Array<{ profile: UnifiedProfile; clue: string; confidence: number; reason: string }> = [];
    for (const profile of profiles) {
      const exact = knownHandles(profile.id, known).find((value) => norm(value) === handle);
      if (exact) {
        hits.push({ profile, clue: record.handle, confidence: 95, reason: 'ชื่อบัญชีตรงกับที่เคยพบ' });
        continue;
      }
      const thaiParts = [profile.nickname, ...profile.fullName.split(/\s+/)].filter((part) => /\p{Script=Thai}/u.test(part) && part.length >= 3);
      const part = thaiParts.find((value) => haystack.includes(norm(value))) ?? (haystack.includes(profile.studentId) ? profile.studentId : undefined);
      if (part) {
        const clue = record.handle.includes(part) ? part : record.rawText.includes(part) ? part : record.handle;
        hits.push({ profile, clue, confidence: 80, reason: `พบ “${part}” ในข้อความหรือชื่อบัญชี` });
      }
    }
    if (hits.length === 1) {
      const [hit] = hits;
      return { recordId: record.id, profileId: hit.profile.id, confidence: hit.confidence, reason: hit.reason, clue: hit.clue, source: 'rules' };
    }
    return {
      recordId: record.id,
      profileId: null,
      confidence: 0,
      reason: hits.length ? 'มีหลายคนที่เข้าข่าย จึงไม่เลือก' : 'กฎในเครื่องไม่พบชื่อที่ตรงกัน',
      clue: '',
      source: 'rules',
    };
  });
}

/**
 * Checks a model answer. Every record must be answered once, a named friend must be a real
 * candidate, and the clue must be copied from the record. A suggestion without a checkable clue is
 * kept as "not sure" rather than trusted.
 */
export function parseResolutions(raw: unknown, records: readonly UnlinkedRecord[], profiles: readonly UnifiedProfile[]): IdentitySuggestion[] | null {
  if (!isObject(raw) || !Array.isArray(raw.resolutions)) return null;
  const byRecord = new Map(records.map((record) => [record.id, record]));
  const profileIds = new Set(profiles.map((profile) => profile.id));
  const answered = new Map<string, IdentitySuggestion>();
  for (const item of raw.resolutions) {
    if (!isObject(item) || !isString(item.recordId)) return null;
    const record = byRecord.get(item.recordId);
    if (!record || answered.has(item.recordId)) return null;
    const confidence = asInt(item.confidence, 0, 100);
    if (confidence === null || !isString(item.reason) || !isString(item.clue)) return null;
    const profileId = item.profileId;
    if (profileId !== null && (!isString(profileId) || !profileIds.has(profileId))) return null;
    const grounded = profileId !== null && isVerbatim(item.clue, record.handle, record.rawText);
    answered.set(record.id, grounded || profileId === null
      ? { recordId: record.id, profileId, confidence, reason: item.reason.trim().slice(0, 160), clue: profileId === null ? '' : item.clue.trim(), source: 'model' }
      : { recordId: record.id, profileId: null, confidence: 0, reason: 'AI เสนอชื่อแต่ไม่มีหลักฐานที่ตรวจจากข้อความได้ จึงไม่ใช้', clue: '', source: 'model' });
  }
  if (answered.size !== records.length) return null;
  return records.map((record) => answered.get(record.id) as IdentitySuggestion);
}

/** Proposes an owner for each unknown-author message. A person always confirms before anything is linked. */
export async function resolveIdentities(
  records: readonly UnlinkedRecord[],
  profiles: readonly UnifiedProfile[],
  known: readonly RawSourceRecord[],
): Promise<IdentityResult> {
  const result = await callAi(
    'resolve_identity',
    {
      records: records.map(({ id, source, handle, rawText }) => ({ id, source, handle, rawText })),
      candidates: profiles.map((profile) => ({
        id: profile.id,
        nickname: profile.nickname,
        fullName: profile.fullName,
        studentId: profile.studentId,
        knownHandles: knownHandles(profile.id, known),
      })),
    },
    (raw) => parseResolutions(raw, records, profiles),
  );
  if (result.data) return { suggestions: result.data, source: 'model' };
  return { suggestions: resolveWithRules(records, profiles, known), source: 'rules' };
}
