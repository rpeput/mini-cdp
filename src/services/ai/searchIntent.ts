import { callAi } from '../aiClient.ts';
import { isObject, isString } from './guards.ts';

export type SearchStatus = 'all' | 'ready' | 'pending' | 'no-consent';
export type SearchInterest = 'all' | 'food' | 'activity' | 'vibe' | 'budget';
export type SearchReply = 'all' | 'accepted' | 'declined' | 'pending' | 'never';
export type SearchSortKey = 'name' | 'fullName' | 'studentId' | 'interests' | 'status' | 'acceptance';

export interface SearchIntent {
  /** Words that must all appear. */
  terms: string[];
  /** Alternatives where any one may appear. */
  anyTerms: string[];
  status: SearchStatus;
  interest: SearchInterest;
  reply: SearchReply;
  sort: { key: SearchSortKey; direction: 'asc' | 'desc' } | null;
  explanation: string;
  source: 'model' | 'rules';
}

const STATUSES = new Set<string>(['all', 'ready', 'pending', 'no-consent']);
const INTERESTS = new Set<string>(['all', 'food', 'activity', 'vibe', 'budget']);
const REPLIES = new Set<string>(['all', 'accepted', 'declined', 'pending', 'never']);
const SORT_KEYS = new Set<string>(['name', 'fullName', 'studentId', 'interests', 'status', 'acceptance']);

const TOPICS: ReadonlyArray<{ pattern: RegExp; label: string; any: string[] }> = [
  { pattern: /งบตึง|งบน้อย|ประหยัด|ช็อต|ไม่มีเงิน/, label: 'งบตึง', any: ['ช็อต', 'ประหยัด'] },
  { pattern: /หมูกระทะ|ปิ้งย่าง|ชาบู|หมาล่า/, label: 'หมูกระทะ/ชาบู', any: ['หมูกระทะ', 'ปิ้งย่าง', 'ชาบู'] },
  { pattern: /เดินป่า|แคมป์|กางเต็นท์|ขึ้นดอย/, label: 'เดินป่า', any: ['เดินป่า', 'กางเต็นท์'] },
  { pattern: /ทะเล|ดำน้ำ/, label: 'ทะเล', any: ['ทะเล', 'ดำน้ำ'] },
  { pattern: /บอร์ดเกม|เล่นเกม|เกมเมอร์/, label: 'บอร์ดเกม', any: ['บอร์ดเกม', 'เล่นเกม'] },
  { pattern: /วิ่ง|ออกกำลังกาย|ฟิตเนส/, label: 'วิ่ง/ออกกำลังกาย', any: ['วิ่ง', 'ออกกำลังกาย'] },
  { pattern: /คาเฟ่|ถ่ายรูป/, label: 'คาเฟ่', any: ['คาเฟ่', 'ถ่ายรูป'] },
];

/** Keyword baseline: a small dictionary of topics and status words. It cannot follow a sentence that mixes conditions. */
export function parseSearchWithRules(question: string): SearchIntent {
  const anyTerms: string[] = [];
  const labels: string[] = [];
  for (const topic of TOPICS) {
    if (topic.pattern.test(question)) {
      anyTerms.push(...topic.any);
      labels.push(topic.label);
    }
  }
  const noConsent = /ไม่ยินยอม|ยังไม่ยินยอม|ไม่อนุญาต/.test(question);
  const status: SearchStatus = noConsent ? 'no-consent' : /ยังไม่รวม|รอรวม|ยังไม่ประมวลผล/.test(question) ? 'pending' : /พร้อม/.test(question) ? 'ready' : 'all';
  const rateSort = /อัตราตอบรับ|ตอบรับบ่อย|ตอบรับมากสุด/.test(question);
  const withoutRate = question.replace(/อัตราตอบรับ|ตอบรับบ่อย|ตอบรับมากสุด/g, '');
  const reply: SearchReply = /ยังไม่เคย(?:ได้รับ|ชวน)|ไม่เคยได้รับคำเชิญ/.test(question) ? 'never' : /ยังไม่ตอบ/.test(question) ? 'pending' : /ปฏิเสธ/.test(question) ? 'declined' : /ตอบรับ/.test(withoutRate) ? 'accepted' : 'all';
  const parts = [...labels, status !== 'all' && 'สถานะ', reply !== 'all' && 'คำตอบ', rateSort && 'เรียงตามอัตราตอบรับ'].filter(Boolean);
  return {
    terms: [],
    anyTerms: [...new Set(anyTerms)],
    status,
    interest: 'all',
    reply,
    sort: rateSort ? { key: 'acceptance', direction: 'desc' } : null,
    explanation: parts.length ? `กรองตาม ${parts.join(', ')}` : 'ไม่พบเงื่อนไขที่เข้าใจ ลองระบุหัวข้อหรือสถานะ',
    source: 'rules',
  };
}

const wordList = (value: unknown): string[] | null =>
  Array.isArray(value) && value.length <= 8 && value.every((item) => isString(item) && item.trim().length > 0 && item.length <= 30)
    ? (value as string[]).map((item) => item.trim())
    : null;

export function parseSearchIntent(raw: unknown): SearchIntent | null {
  if (!isObject(raw)) return null;
  const terms = wordList(raw.terms);
  const anyTerms = wordList(raw.anyTerms);
  if (!terms || !anyTerms) return null;
  if (!isString(raw.status) || !STATUSES.has(raw.status) || !isString(raw.interest) || !INTERESTS.has(raw.interest) || !isString(raw.reply) || !REPLIES.has(raw.reply)) return null;
  let sort: SearchIntent['sort'] = null;
  if (raw.sort !== null && raw.sort !== undefined) {
    if (!isObject(raw.sort) || !isString(raw.sort.key) || !SORT_KEYS.has(raw.sort.key) || (raw.sort.direction !== 'asc' && raw.sort.direction !== 'desc')) return null;
    sort = { key: raw.sort.key as SearchSortKey, direction: raw.sort.direction };
  }
  return {
    terms,
    anyTerms,
    status: raw.status as SearchStatus,
    interest: raw.interest as SearchInterest,
    reply: raw.reply as SearchReply,
    sort,
    explanation: isString(raw.explanation) ? raw.explanation.trim().slice(0, 160) : '',
    source: 'model',
  };
}

/** Turns a question into table filters. The table runs the filters; the model never answers the question. */
export async function readSearch(question: string): Promise<SearchIntent> {
  const result = await callAi('parse_search', { question }, parseSearchIntent);
  return result.data ?? parseSearchWithRules(question);
}
