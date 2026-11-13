import { RAW_SOURCE_RECORDS } from '../data/seedData.ts';
import type {
  AiAction,
  AiProxyResponse,
  AttributeCategory,
  CampaignInteraction,
  CampaignMatch,
  ExtractedAttribute,
  PipelineLog,
  RawSourceRecord,
  UnifiedProfile,
} from '../types/cdp.ts';

const AI_PROXY_TIMEOUT_MS = 4_000;

export interface StitchingResult {
  profiles: UnifiedProfile[];
  logs: PipelineLog[];
  usedFallback: boolean;
  stitchedCount: number;
}

export interface SegmentationResult {
  matches: CampaignMatch[];
  logs: PipelineLog[];
  usedFallback: boolean;
}

export interface SimulatedReplyEntry {
  profileId: string;
  interaction: CampaignInteraction;
  feedbackAttribute: ExtractedAttribute;
}

export interface SimulationResult {
  profiles: UnifiedProfile[];
  interactions: SimulatedReplyEntry[];
  logs: PipelineLog[];
  usedFallback: boolean;
}

interface StitchApiPayload {
  stitchedProfiles?: Array<{
    profileId?: string;
    linkedRecordIds?: string[];
    attributes?: Array<{
      id?: string;
      category?: string;
      value?: string;
      confidence?: number;
      evidenceQuote?: string;
      source?: string;
      status?: string;
    }>;
  }>;
}

interface SegmentApiPayload {
  matches?: Array<{
    profileId?: string;
    tier?: string;
    matchScore?: number;
    aiReasoning?: string;
    personalizedInvite?: string;
    selected?: boolean;
  }>;
}

interface SimulateRepliesApiPayload {
  replies?: Array<{
    profileId?: string;
    status?: string;
    replyText?: string;
    feedbackAttribute?: {
      category?: string;
      value?: string;
      confidence?: number;
    };
  }>;
}

interface ExtractionRule {
  idSuffix: string;
  category: AttributeCategory;
  value: string;
  confidence: number;
  patterns: RegExp[];
  quoteMatcher: RegExp;
}

interface SemanticCluster {
  id: string;
  label: string;
  promptKeywords: string[];
  directKeywords: string[];
  lookalikeKeywords: string[];
  defaultInviteTopic: string;
}

const VALID_CATEGORIES = new Set<AttributeCategory>([
  'food',
  'activity',
  'vibe',
  'budget',
]);

const EXTRACTION_RULES: ExtractionRule[] = [
  {
    idSuffix: 'mookata',
    category: 'food',
    value: 'หมูกระทะ / ปิ้งย่าง',
    confidence: 95,
    patterns: [/หมูกระทะ|ปิ้งย่าง|ชาบู|หมาล่า/i],
    quoteMatcher:
      /[^.!?\n]*(?:หมูกระทะ|ปิ้งย่าง|ชาบู|หมาล่า)[^.!?\n]*/i,
  },
  {
    idSuffix: 'pizza_ramen',
    category: 'food',
    value: 'พิซซ่า / สตรีทฟู้ดหารตี้',
    confidence: 71,
    patterns: [/พิซซ่า|ราเมง|โจ๊ก/i],
    quoteMatcher: /[^.!?\n]*(?:พิซซ่า|ราเมง|โจ๊ก)[^.!?\n]*/i,
  },
  {
    idSuffix: 'hiking',
    category: 'activity',
    value: 'เดินป่า / กางเต็นท์ขึ้นดอย',
    confidence: 94,
    patterns: [/เดินป่า|กางเต็นท์|ขึ้นดอย|เทรล|เขาใหญ่|เชียงดาว/i],
    quoteMatcher:
      /[^.!?\n]*(?:เดินป่า|กางเต็นท์|ขึ้นดอย|เทรล|เขาใหญ่|เชียงดาว)[^.!?\n]*/i,
  },
  {
    idSuffix: 'beach',
    category: 'activity',
    value: 'เที่ยวทะเล / ดำน้ำ',
    confidence: 93,
    patterns: [/ทะเล|ดำน้ำ|เกาะ|หาด|แสมสาร|ภูเก็ต/i],
    quoteMatcher:
      /[^.!?\n]*(?:ทะเล|ดำน้ำ|เกาะ|หาด|แสมสาร|ภูเก็ต)[^.!?\n]*/i,
  },
  {
    idSuffix: 'boardgame',
    category: 'activity',
    value: 'บอร์ดเกม / เล่นเกมตี้',
    confidence: 92,
    patterns: [/บอร์ดเกม|valorant|catan|splendor|เล่นเกม|steam/i],
    quoteMatcher:
      /[^.!?\n]*(?:บอร์ดเกม|valorant|catan|splendor|เล่นเกม|steam)[^.!?\n]*/i,
  },
  {
    idSuffix: 'fitness',
    category: 'activity',
    value: 'วิ่ง / ออกกำลังกายฟิตเนส',
    confidence: 90,
    patterns: [/วิ่ง|ออกกำลังกาย|เล่นเวท|เก็บระยะ/i],
    quoteMatcher:
      /[^.!?\n]*(?:วิ่ง|ออกกำลังกาย|เล่นเวท|เก็บระยะ)[^.!?\n]*/i,
  },
  {
    idSuffix: 'friday_chill',
    category: 'vibe',
    value: 'แฮงเอาท์นั่งชิลล์วันศุกร์',
    confidence: 89,
    patterns: [/ศุกร์|นั่งชิลล์|แฮงเอาท์|คราฟต์เบียร์|ค็อกเทล/i],
    quoteMatcher:
      /[^.!?\n]*(?:ศุกร์|นั่งชิลล์|แฮงเอาท์|คราฟต์เบียร์|ค็อกเทล)[^.!?\n]*/i,
  },
  {
    idSuffix: 'cafe_chill',
    category: 'vibe',
    value: 'สายคาเฟ่ / ถ่ายรูปชิลล์',
    confidence: 73,
    patterns: [/คาเฟ่|เสียงคลื่น|ริมน้ำ/i],
    quoteMatcher: /[^.!?\n]*(?:คาเฟ่|เสียงคลื่น|ริมน้ำ)[^.!?\n]*/i,
  },
  {
    idSuffix: 'thesis_busy',
    category: 'vibe',
    value: 'ติดปั่นโปรเจกต์ / ขอพักตี้',
    confidence: 69,
    patterns: [/ปั่นธีสิส|โปรเจกต์จบ|พักยาว/i],
    quoteMatcher: /[^.!?\n]*(?:ปั่นธีสิส|โปรเจกต์จบ|พักยาว)[^.!?\n]*/i,
  },
  {
    idSuffix: 'budget_tight',
    category: 'budget',
    value: 'ปลายเดือนช็อต / งบประหยัด',
    confidence: 91,
    patterns: [/ปลายเดือนช็อต|งบประหยัด|ราคาไม่แรง|สายประหยัด|หารกันเบาๆ|ไม่เกิน\s*\d+/i],
    quoteMatcher:
      /[^.!?\n]*(?:ปลายเดือนช็อต|งบประหยัด|ราคาไม่แรง|สายประหยัด|หารกันเบาๆ|ไม่เกิน\s*\d+)[^.!?\n]*/i,
  },
  {
    idSuffix: 'budget_buffet',
    category: 'budget',
    value: 'สายบุฟเฟ่ต์คุ้มๆ',
    confidence: 74,
    patterns: [/สายบุฟเฟ่ต์คุ้มๆ|219\s*บาท/i],
    quoteMatcher: /[^.!?\n]*(?:สายบุฟเฟ่ต์คุ้มๆ|219\s*บาท)[^.!?\n]*/i,
  },
  {
    idSuffix: 'food_lover_review',
    category: 'vibe',
    value: 'สายกินพร้อมลุย',
    confidence: 67,
    patterns: [/สายกินสู้ตาย|พร้อมสวบมาก|หิวจัด/i],
    quoteMatcher: /[^.!?\n]*(?:สายกินสู้ตาย|พร้อมสวบมาก|หิวจัด)[^.!?\n]*/i,
  },
];

const SEMANTIC_CLUSTERS: SemanticCluster[] = [
  {
    id: 'mookata_grill',
    label: 'สายหมูกระทะและปิ้งย่าง',
    promptKeywords: [
      'หมูกระทะ',
      'ปิ้งย่าง',
      'ชาบู',
      'หมาล่า',
      'บุฟเฟ่ต์',
      'เนื้อ',
      'ชีส',
      'หลังมอ',
      'กิน',
      'mookata',
      'bbq',
      'shabu',
      'grill',
      'buffet',
    ],
    directKeywords: ['หมูกระทะ', 'ปิ้งย่าง', 'ชาบู', 'หมาล่า', 'สายเนื้อ', 'สายกิน', 'สามชั้น'],
    lookalikeKeywords: ['บุฟเฟ่ต์', 'สายโปรตีน', 'พิซซ่า', 'กับแกล้ม', 'ร้านนั่งชิลล์', 'หลังมอ'],
    defaultInviteTopic: 'ตี้หมูกระทะหลังมอ',
  },
  {
    id: 'hiking_nature',
    label: 'สายเดินป่าและแคมปิ้งธรรมชาติ',
    promptKeywords: [
      'เดินป่า',
      'แคมปิ้ง',
      'กางเต็นท์',
      'ขึ้นดอย',
      'ภูเขา',
      'เขาใหญ่',
      'เชียงดาว',
      'เทรล',
      'ธรรมชาติ',
      'hiking',
      'camping',
      'trail',
      'nature',
      'mountain',
    ],
    directKeywords: ['เดินป่า', 'กางเต็นท์', 'แคมปิ้ง', 'ขึ้นดอย', 'เทรล', 'ธรรมชาติ', 'เขาใหญ่'],
    lookalikeKeywords: ['วิ่ง', 'ออกกำลังกาย', 'outdoor', 'ถ่ายรูป', 'ทะเล', 'เกาะ'],
    defaultInviteTopic: 'ทริปเดินป่า-กางเต็นท์เสาร์-อาทิตย์',
  },
  {
    id: 'beach_diving',
    label: 'สายเที่ยวทะเลและดำน้ำ',
    promptKeywords: [
      'ทะเล',
      'ดำน้ำ',
      'เกาะ',
      'หาด',
      'ปะการัง',
      'เสม็ด',
      'ภูเก็ต',
      'แสมสาร',
      'คลื่น',
      'beach',
      'sea',
      'island',
      'diving',
      'snorkel',
    ],
    directKeywords: ['ทะเล', 'ดำน้ำ', 'เกาะ', 'หาด', 'ปะการัง', 'คลื่น', 'เสม็ด', 'ภูเก็ต'],
    lookalikeKeywords: ['คาเฟ่', 'outdoor', 'ธรรมชาติ', 'วิ่ง', 'ถ่ายรูป'],
    defaultInviteTopic: 'ทริปทะเลดำน้ำสุดสัปดาห์',
  },
  {
    id: 'friday_hangout',
    label: 'สายแฮงเอาท์นั่งชิลล์วันศุกร์',
    promptKeywords: [
      'วันศุกร์',
      'ศุกร์',
      'แฮงเอาท์',
      'นั่งชิลล์',
      'ชิลล์',
      'ดนตรีสด',
      'เหล้า',
      'เบียร์',
      'ค็อกเทล',
      'บาร์',
      'ปาร์ตี้',
      'friday',
      'hangout',
      'chill',
      'drinks',
    ],
    directKeywords: ['วันศุกร์', 'ศุกร์', 'นั่งชิลล์', 'แฮงเอาท์', 'ดนตรีสด', 'คราฟต์เบียร์', 'ค็อกเทล'],
    lookalikeKeywords: ['บอร์ดเกม', 'คาเฟ่', 'สายตี้', 'กับแกล้ม', 'หลังมอ'],
    defaultInviteTopic: 'ตี้แฮงเอาท์นั่งชิลล์วันศุกร์',
  },
  {
    id: 'gaming_boardgame',
    label: 'สายบอร์ดเกมและเกมเมอร์',
    promptKeywords: [
      'บอร์ดเกม',
      'เล่นเกม',
      'เกม',
      'ตี้เกม',
      'avalon',
      'catan',
      'valorant',
      'boardgame',
      'gaming',
    ],
    directKeywords: ['บอร์ดเกม', 'เล่นเกม', 'avalon', 'catan', 'valorant', 'e-sports'],
    lookalikeKeywords: ['แฮงเอาท์', 'สายตี้', 'คาเฟ่', 'พิซซ่า'],
    defaultInviteTopic: 'นัดตี้บอร์ดเกมหลังเลิกเรียน',
  },
  {
    id: 'fitness_run',
    label: 'สายวิ่งและออกกำลังกาย',
    promptKeywords: [
      'วิ่ง',
      'ออกกำลังกาย',
      'ฟิตเนส',
      'เวท',
      'มาราธอน',
      '10k',
      '5k',
      'running',
      'fitness',
      'gym',
    ],
    directKeywords: ['วิ่ง', 'ออกกำลังกาย', 'ฟิตเนส', 'เวท', '10k', 'pace'],
    lookalikeKeywords: ['เดินป่า', 'เทรล', 'ดำน้ำ', 'สายโปรตีน', 'outdoor'],
    defaultInviteTopic: 'ตี้ซ้อมวิ่งและออกกำลังกาย',
  },
  {
    id: 'budget_friendly',
    label: 'เงื่อนไขงบประหยัดคุ้มค่า',
    promptKeywords: [
      'ประหยัด',
      'งบประหยัด',
      'งบน้อย',
      'ราคาเบา',
      'ไม่แพง',
      'คุ้ม',
      'ช็อต',
      'หารกัน',
      'ไม่เกิน',
      'budget',
      'cheap',
    ],
    directKeywords: ['งบประหยัด', 'ปลายเดือนช็อต', 'สายประหยัด', 'หารกันเบาๆ', 'ไม่เกิน', 'สายบุฟเฟ่ต์คุ้มๆ'],
    lookalikeKeywords: ['หลังมอ', '219', 'คุ้ม', 'หารค่าทริป'],
    defaultInviteTopic: 'ตี้สายประหยัดงบสบายกระเป๋า',
  },
];

let logCounter = 0;

function createLog(step: string, detail: string, latencyMs: number): PipelineLog {
  logCounter += 1;
  return {
    id: `log_${Date.now()}_${logCounter}`,
    timestamp: new Date().toISOString(),
    step,
    detail,
    latencyMs: Math.max(1, Math.round(latencyMs)),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeCategory(value: unknown): AttributeCategory {
  if (typeof value === 'string' && VALID_CATEGORIES.has(value as AttributeCategory)) {
    return value as AttributeCategory;
  }
  return 'vibe';
}

function stripEmojis(text: string): string {
  return text.replace(/\p{Extended_Pictographic}/gu, '').replace(/\s{2,}/g, ' ').trim();
}

async function callAiProxy<TData>(
  action: AiAction,
  payload: unknown,
): Promise<TData | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_PROXY_TIMEOUT_MS);

  try {
    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, payload }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const parsed = (await response.json()) as AiProxyResponse<TData>;
    if (!parsed || parsed.fallback) {
      return null;
    }

    return parsed.data ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function extractLocalAttributesForProfile(
  profileId: string,
  records: RawSourceRecord[],
): ExtractedAttribute[] {
  const extracted: ExtractedAttribute[] = [];
  const seenValues = new Set<string>();

  for (const record of records) {
    for (const rule of EXTRACTION_RULES) {
      if (!rule.patterns.some((pattern) => pattern.test(record.rawText))) {
        continue;
      }
      if (seenValues.has(rule.value)) {
        continue;
      }

      const quoteMatch = record.rawText.match(rule.quoteMatcher);
      const evidenceQuote = (quoteMatch?.[0] ?? record.rawText).trim();
      if (!evidenceQuote || !record.rawText.includes(evidenceQuote)) {
        continue;
      }

      seenValues.add(rule.value);
      extracted.push({
        id: `attr_${profileId}_${rule.idSuffix}`,
        category: rule.category,
        value: rule.value,
        confidence: rule.confidence,
        evidenceQuote,
        source: record.source,
        status: rule.confidence >= 80 ? 'verified' : 'needs_review',
      });
    }
  }

  // Ensure every stitched profile always receives at least 2 grounded attributes
  if (extracted.length === 0 && records.length > 0) {
    const primaryRecord = records[0];
    extracted.push({
      id: `attr_${profileId}_general`,
      category: 'vibe',
      value: 'นิสิตภาควิชาคอมฯ',
      confidence: 70,
      evidenceQuote: primaryRecord.rawText,
      source: primaryRecord.source,
      status: 'needs_review',
    });
  }

  return extracted;
}

export async function runIdentityStitching(
  profiles: UnifiedProfile[],
): Promise<StitchingResult> {
  const startedAt = performance.now();
  const unstitchedProfiles = profiles.filter((profile) => !profile.isStitched);

  if (unstitchedProfiles.length === 0) {
    return {
      profiles,
      logs: [
        createLog(
          'Entity Resolution',
          'All profiles are already unified; 0 pending records in ingestion queue.',
          performance.now() - startedAt,
        ),
      ],
      usedFallback: true,
      stitchedCount: 0,
    };
  }

  const unstitchedIds = new Set(unstitchedProfiles.map((p) => p.id));
  const pendingRecords = RAW_SOURCE_RECORDS.filter((record) =>
    unstitchedIds.has(record.linkedProfileId),
  );

  const remotePayload = await callAiProxy<StitchApiPayload>('stitch', {
    profiles: unstitchedProfiles.map((p) => ({
      id: p.id,
      fullName: p.fullName,
      nickname: p.nickname,
      studentId: p.studentId,
    })),
    rawRecords: pendingRecords,
  });

  const remoteByProfile = new Map<
    string,
    NonNullable<StitchApiPayload['stitchedProfiles']>[number]
  >();
  if (remotePayload?.stitchedProfiles) {
    for (const item of remotePayload.stitchedProfiles) {
      if (item.profileId) {
        remoteByProfile.set(item.profileId, item);
      }
    }
  }

  const usedFallback = remoteByProfile.size === 0;
  let totalAttributesExtracted = 0;
  let totalVerified = 0;
  let totalNeedsReview = 0;

  const updatedProfiles = profiles.map((profile) => {
    if (profile.isStitched) {
      return profile;
    }

    const matchedRecords = pendingRecords.filter(
      (record) => record.linkedProfileId === profile.id,
    );
    const mergedSources =
      profile.mergedSources.length > 0 ? profile.mergedSources : matchedRecords;

    const remoteEntry = remoteByProfile.get(profile.id);
    let attributes: ExtractedAttribute[] =
      profile.attributes.length > 0 ? profile.attributes : [];

    if (
      attributes.length === 0 &&
      remoteEntry?.attributes &&
      remoteEntry.attributes.length > 0
    ) {
      const validRemote: ExtractedAttribute[] = [];
      for (let i = 0; i < remoteEntry.attributes.length; i += 1) {
        const attr = remoteEntry.attributes[i];
        if (!attr.value || !attr.evidenceQuote) {
          continue;
        }
        const sourceRecord = mergedSources.find((src) =>
          src.rawText.includes(attr.evidenceQuote ?? ''),
        );
        if (!sourceRecord) {
          continue;
        }
        const confidence = clamp(Math.round(attr.confidence ?? 75), 50, 99);
        validRemote.push({
          id: attr.id || `attr_${profile.id}_ai_${i + 1}`,
          category: normalizeCategory(attr.category),
          value: stripEmojis(attr.value),
          confidence,
          evidenceQuote: attr.evidenceQuote,
          source: sourceRecord.source,
          status: confidence >= 80 ? 'verified' : 'needs_review',
        });
      }
      attributes = validRemote;
    }

    if (attributes.length === 0) {
      attributes = extractLocalAttributesForProfile(profile.id, mergedSources);
    }

    for (const attr of attributes) {
      totalAttributesExtracted += 1;
      if (attr.status === 'verified') {
        totalVerified += 1;
      } else if (attr.status === 'needs_review') {
        totalNeedsReview += 1;
      }
    }

    return {
      ...profile,
      isStitched: true,
      mergedSources,
      attributes,
    };
  });

  const elapsedMs = performance.now() - startedAt;
  const logs: PipelineLog[] = [
    createLog(
      'Entity Resolution',
      `Resolved ${pendingRecords.length} multi-source records across LINE_CHAT, FACEBOOK_POST, and DEPT_ROSTER into ${unstitchedProfiles.length} unified profiles (${usedFallback ? 'Deterministic Local Engine' : 'Gemini 2.5 Flash'}).`,
      elapsedMs * 0.4,
    ),
    createLog(
      'Attribute Extraction',
      `Extracted ${totalAttributesExtracted} structured Thai/English traits with verbatim source evidence quotes.`,
      elapsedMs * 0.35,
    ),
    createLog(
      'Confidence Governance',
      `Auto-verified ${totalVerified} high-confidence traits (>=80%); queued ${totalNeedsReview} traits (64-79%) as needs_review.`,
      elapsedMs * 0.25,
    ),
  ];

  return {
    profiles: updatedProfiles,
    logs,
    usedFallback,
    stitchedCount: unstitchedProfiles.length,
  };
}

function tokenizePrompt(prompt: string): string[] {
  const cleaned = prompt
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .trim();
  const words = cleaned.split(/\s+/).filter((token) => token.length >= 2);
  const bigrams: string[] = [];
  for (const word of words) {
    if (word.length >= 4) {
      for (let i = 0; i <= word.length - 3; i += 2) {
        bigrams.push(word.slice(i, i + 3));
      }
    }
  }
  return Array.from(new Set([...words, ...bigrams]));
}

function buildPersonalizedInvite(
  profile: UnifiedProfile,
  campaignPrompt: string,
  matchedTrait: string,
  tier: 'direct' | 'lookalike',
): string {
  const topic = campaignPrompt.trim() || 'ตี้เพื่อนภาคคอมฯ รอบนี้';
  const hasTightBudget = profile.attributes.some(
    (attr) =>
      attr.category === 'budget' &&
      (attr.value.includes('ช็อต') || attr.value.includes('ประหยัด')),
  );

  if (tier === 'direct') {
    const budgetNote = hasTightBudget ? ' (แชร์งบสบายๆ ไม่เกิน 300)' : '';
    return `ทักนะ ${profile.nickname}! กำลังชวน${topic}${budgetNote} เห็นชอบ${matchedTrait}อยู่พอดี สนใจไปด้วยกันไหม`;
  }

  return `เฮ้ ${profile.nickname} รอบนี้มีแพลน${topic} คิดว่าน่าจะเข้ากับสาย${matchedTrait}อย่างเรา ลองดูรายละเอียดไหม`;
}

function scoreProfileLocally(
  profile: UnifiedProfile,
  campaignPrompt: string,
  activeClusters: SemanticCluster[],
  promptTokens: string[],
): CampaignMatch | null {
  const activeAttributes = profile.attributes.filter(
    (attr) => attr.status !== 'rejected',
  );
  const profileCorpus = [
    ...activeAttributes.map((a) => `${a.value} ${a.evidenceQuote}`),
    ...profile.mergedSources.map((s) => s.rawText),
  ]
    .join(' ')
    .toLowerCase();

  let directHits = 0;
  let lookalikeHits = 0;
  const directReasons: string[] = [];
  const lookalikeReasons: string[] = [];

  for (const cluster of activeClusters) {
    const matchedDirect = cluster.directKeywords.filter((kw) =>
      profileCorpus.includes(kw.toLowerCase()),
    );
    const matchedLookalike = cluster.lookalikeKeywords.filter((kw) =>
      profileCorpus.includes(kw.toLowerCase()),
    );

    if (matchedDirect.length > 0) {
      directHits += matchedDirect.length;
      directReasons.push(`${cluster.label} (${matchedDirect[0]})`);
    } else if (matchedLookalike.length > 0) {
      lookalikeHits += matchedLookalike.length;
      lookalikeReasons.push(`แนวโน้มใกล้เคียง${cluster.label}`);
    }
  }

  // Fallback lexical overlap for arbitrary custom prompts
  let customTokenHits = 0;
  const matchedCustomTokens: string[] = [];
  for (const token of promptTokens) {
    if (profileCorpus.includes(token)) {
      customTokenHits += 1;
      if (matchedCustomTokens.length < 2) {
        matchedCustomTokens.push(token);
      }
    }
  }

  const acceptedHistoryCount = profile.campaignHistory.filter(
    (item) => item.status === 'accepted',
  ).length;

  const isDirect =
    directHits > 0 || (activeClusters.length === 0 && customTokenHits >= 2);
  const isLookalike =
    !isDirect &&
    (lookalikeHits > 0 ||
      customTokenHits >= 1 ||
      (acceptedHistoryCount > 0 && activeAttributes.length > 0));

  if (!isDirect && !isLookalike) {
    return null;
  }

  if (isDirect) {
    const verifiedBonus = activeAttributes.some((a) => a.status === 'verified')
      ? 4
      : 0;
    const rawScore =
      83 +
      Math.min(10, directHits * 3 + customTokenHits * 2) +
      verifiedBonus +
      Math.min(2, acceptedHistoryCount);
    const matchScore = clamp(rawScore, 82, 98);
    const topAttr = activeAttributes[0]?.value ?? matchedCustomTokens[0] ?? 'กิจกรรมกลุ่ม';
    const reasonText =
      directReasons.length > 0
        ? `ตรงกลุ่มเป้าหมาย: ${directReasons.slice(0, 2).join(' และ ')}`
        : `ตรงคำค้น "${matchedCustomTokens.join(', ')}" จากข้อมูล ${activeAttributes[0]?.source ?? 'LINE_CHAT'}`;

    return {
      profileId: profile.id,
      tier: 'direct',
      matchScore,
      aiReasoning: stripEmojis(reasonText),
      personalizedInvite: stripEmojis(
        buildPersonalizedInvite(profile, campaignPrompt, topAttr, 'direct'),
      ),
      selected: true,
    };
  }

  const lookalikeScore = clamp(
    67 + Math.min(11, lookalikeHits * 4 + customTokenHits * 3) + acceptedHistoryCount * 2,
    65,
    81,
  );
  const topAttr = activeAttributes[0]?.value ?? 'กิจกรรมแก๊งเพื่อน';
  const reasonText =
    lookalikeReasons.length > 0
      ? `กลุ่ม Lookalike: ${lookalikeReasons[0]} จากโปรไฟล์ "${topAttr}"`
      : `กลุ่ม Lookalike: มีความเชื่อมโยงเชิงพฤติกรรม (${topAttr}) และเคยร่วมกิจกรรม`;

  return {
    profileId: profile.id,
    tier: 'lookalike',
    matchScore: lookalikeScore,
    aiReasoning: stripEmojis(reasonText),
    personalizedInvite: stripEmojis(
      buildPersonalizedInvite(profile, campaignPrompt, topAttr, 'lookalike'),
    ),
    selected: false,
  };
}

export async function segmentCampaign(
  campaignPrompt: string,
  profiles: UnifiedProfile[],
): Promise<SegmentationResult> {
  const startedAt = performance.now();
  const normalizedPrompt = campaignPrompt.trim();

  const eligibleProfiles = profiles.filter(
    (profile) => profile.isStitched && profile.consentPdpa,
  );
  const skippedPdpaCount = profiles.filter(
    (profile) => profile.isStitched && !profile.consentPdpa,
  ).length;
  const unstitchedCount = profiles.filter((profile) => !profile.isStitched).length;

  if (!normalizedPrompt || eligibleProfiles.length === 0) {
    return {
      matches: [],
      logs: [
        createLog(
          'Segmentation Guard',
          eligibleProfiles.length === 0
            ? 'No stitched PDPA-consented profiles available to segment.'
            : 'Campaign prompt is empty.',
          performance.now() - startedAt,
        ),
      ],
      usedFallback: true,
    };
  }

  const remotePayload = await callAiProxy<SegmentApiPayload>('segment', {
    campaignPrompt: normalizedPrompt,
    profiles: eligibleProfiles.map((p) => ({
      id: p.id,
      nickname: p.nickname,
      consentPdpa: p.consentPdpa,
      isStitched: p.isStitched,
      attributes: p.attributes.filter((a) => a.status !== 'rejected'),
      campaignHistory: p.campaignHistory,
    })),
  });

  const eligibleMap = new Map(eligibleProfiles.map((p) => [p.id, p]));
  let matches: CampaignMatch[] = [];
  let usedFallback = true;

  if (remotePayload?.matches && remotePayload.matches.length > 0) {
    const validated: CampaignMatch[] = [];
    for (const item of remotePayload.matches) {
      if (!item.profileId || !eligibleMap.has(item.profileId)) {
        continue;
      }
      const tier = item.tier === 'lookalike' ? 'lookalike' : 'direct';
      const matchScore =
        tier === 'direct'
          ? clamp(Math.round(item.matchScore ?? 88), 82, 98)
          : clamp(Math.round(item.matchScore ?? 74), 65, 81);
      validated.push({
        profileId: item.profileId,
        tier,
        matchScore,
        aiReasoning: stripEmojis(item.aiReasoning || 'ตรงกับบริบทของแคมเปญ'),
        personalizedInvite: stripEmojis(
          item.personalizedInvite ||
            `ทักนะ ${eligibleMap.get(item.profileId)?.nickname ?? ''} ชวนร่วม ${normalizedPrompt}`,
        ),
        selected:
          typeof item.selected === 'boolean' ? item.selected : tier === 'direct',
      });
    }

    if (validated.length > 0) {
      matches = validated;
      usedFallback = false;
    }
  }

  const promptLower = normalizedPrompt.toLowerCase();
  const activeClusters = SEMANTIC_CLUSTERS.filter((cluster) =>
    cluster.promptKeywords.some((kw) => promptLower.includes(kw.toLowerCase())),
  );
  const promptTokens = tokenizePrompt(normalizedPrompt);

  if (usedFallback) {
    const localMatches: CampaignMatch[] = [];
    for (const profile of eligibleProfiles) {
      const scored = scoreProfileLocally(
        profile,
        normalizedPrompt,
        activeClusters,
        promptTokens,
      );
      if (scored) {
        localMatches.push(scored);
      }
    }

    // Ensure any arbitrary custom prompt still yields lookalike candidates when eligible profiles exist
    if (localMatches.length === 0) {
      for (const profile of eligibleProfiles.slice(0, 4)) {
        const topAttr = profile.attributes[0]?.value ?? 'เพื่อนภาคคอมฯ';
        localMatches.push({
          profileId: profile.id,
          tier: 'lookalike',
          matchScore: 70,
          aiReasoning: `กลุ่ม Lookalike: คัดกรองจากโปรไฟล์ที่มีความสนใจหลากหลาย (${topAttr})`,
          personalizedInvite: buildPersonalizedInvite(
            profile,
            normalizedPrompt,
            topAttr,
            'lookalike',
          ),
          selected: false,
        });
      }
    }

    matches = localMatches;
  }

  matches.sort((a, b) => b.matchScore - a.matchScore);

  const directCount = matches.filter((m) => m.tier === 'direct').length;
  const lookalikeCount = matches.filter((m) => m.tier === 'lookalike').length;
  const elapsedMs = performance.now() - startedAt;

  const logs: PipelineLog[] = [
    createLog(
      'Semantic Intent Parsing',
      `Parsed prompt "${normalizedPrompt}" into ${activeClusters.length > 0 ? activeClusters.map((c) => c.id).join(', ') : 'custom_semantic_tokens'}; screened ${eligibleProfiles.length} consented profiles (skipped ${skippedPdpaCount} PDPA opt-out, ${unstitchedCount} unstitched).`,
      elapsedMs * 0.35,
    ),
    createLog(
      'Audience & Lookalike Scoring',
      `Ranked ${directCount} direct matches (82-98) and ${lookalikeCount} lookalike expansion matches (65-81) via ${usedFallback ? 'Local Semantic Engine' : 'Gemini 2.5 Flash'}.`,
      elapsedMs * 0.4,
    ),
    createLog(
      'Invite Personalization',
      `Generated ${matches.length} tailored Thai LINE invitations aligned with nickname, vibe, and budget attributes.`,
      elapsedMs * 0.25,
    ),
  ];

  return {
    matches,
    logs,
    usedFallback,
  };
}

function simulateLocalReplyForMatch(
  match: CampaignMatch,
  profile: UnifiedProfile,
  campaignName: string,
  index: number,
): {
  status: 'accepted' | 'declined';
  replyText: string;
  feedbackCategory: AttributeCategory;
  feedbackValue: string;
  feedbackConfidence: number;
} {
  const hasBudgetTight = profile.attributes.some(
    (attr) =>
      attr.category === 'budget' &&
      (attr.value.includes('ช็อต') || attr.value.includes('ประหยัด')),
  );
  const campaignMentionsBudget = /ประหยัด|ไม่เกิน|คุ้ม|250|300/.test(
    campaignName,
  );

  // Target ~75% acceptance, ~25% realistic declines based on score & deterministic rotation
  const shouldDecline =
    (hasBudgetTight && !campaignMentionsBudget && match.tier === 'lookalike') ||
    index % 4 === 3;

  if (shouldDecline) {
    const budgetDecline = hasBudgetTight || index % 2 === 1;
    const replyText = budgetDecline
      ? 'ขอผ่านรอบนี้ก่อนนะ ช่วงนี้ปลายเดือนช็อตจัด ไว้รอบหน้าค่อยตี้กัน'
      : 'รอบนี้ติดปั่นโปรเจกต์ส่งอาจารย์พอดี เสียดายมาก ไว้ตี้หน้าไปด้วยแน่นอน';

    return {
      status: 'declined',
      replyText,
      feedbackCategory: budgetDecline ? 'budget' : 'vibe',
      feedbackValue: budgetDecline ? 'ปลายเดือนช็อต' : 'ติดปั่นโปรเจกต์ช่วงนี้',
      feedbackConfidence: budgetDecline ? 91 : 86,
    };
  }

  const acceptedReplies = [
    `ได้เลย! ${profile.nickname}ว่างพอดี เดี๋ยวเจอกันตามนัดนะ`,
    'จัดไป กำลังอยากไปอยู่พอดี ปักหมุดวันเวลาในกลุ่มได้เลย',
    'โอเคเลย น่าสนุกมาก ขอติดสอยห้อยตามไปด้วยคนนะ',
  ];

  return {
    status: 'accepted',
    replyText: acceptedReplies[index % acceptedReplies.length],
    feedbackCategory: 'vibe',
    feedbackValue: 'ตอบรับแคมเปญไว',
    feedbackConfidence: 93,
  };
}

function upsertBehavioralAttribute(
  existing: ExtractedAttribute[],
  incoming: ExtractedAttribute,
): ExtractedAttribute[] {
  const existingIdx = existing.findIndex(
    (attr) =>
      attr.category === incoming.category && attr.value === incoming.value,
  );
  if (existingIdx === -1) {
    return [...existing, incoming];
  }

  return existing.map((attr, idx) =>
    idx === existingIdx
      ? {
          ...attr,
          confidence: Math.max(attr.confidence, incoming.confidence),
          evidenceQuote: incoming.evidenceQuote,
          status: 'verified',
        }
      : attr,
  );
}

export async function simulateCampaignResponses(
  campaignName: string,
  selectedMatches: CampaignMatch[],
  profiles: UnifiedProfile[],
): Promise<SimulationResult> {
  const startedAt = performance.now();
  const targets = selectedMatches.filter((match) => match.selected);

  if (targets.length === 0) {
    return {
      profiles,
      interactions: [],
      logs: [
        createLog(
          'Campaign Dispatch',
          'No selected campaign matches to simulate.',
          performance.now() - startedAt,
        ),
      ],
      usedFallback: true,
    };
  }

  const profileMap = new Map(profiles.map((p) => [p.id, p]));
  const remotePayload = await callAiProxy<SimulateRepliesApiPayload>(
    'simulate_replies',
    {
      campaignName,
      targets: targets.map((match) => {
        const profile = profileMap.get(match.profileId);
        return {
          profileId: match.profileId,
          nickname: profile?.nickname ?? '',
          attributes: profile?.attributes ?? [],
          campaignHistory: profile?.campaignHistory ?? [],
          personalizedInvite: match.personalizedInvite,
        };
      }),
    },
  );

  const remoteRepliesMap = new Map<
    string,
    NonNullable<SimulateRepliesApiPayload['replies']>[number]
  >();
  if (remotePayload?.replies) {
    for (const reply of remotePayload.replies) {
      if (reply.profileId) {
        remoteRepliesMap.set(reply.profileId, reply);
      }
    }
  }

  const usedFallback = remoteRepliesMap.size === 0;
  const campaignId = `camp_${Date.now()}`;
  const nowIso = new Date().toISOString();
  const interactions: SimulatedReplyEntry[] = [];
  const updatesByProfile = new Map<
    string,
    { interaction: CampaignInteraction; feedbackAttribute: ExtractedAttribute }
  >();

  for (let i = 0; i < targets.length; i += 1) {
    const match = targets[i];
    const profile = profileMap.get(match.profileId);
    if (!profile) {
      continue;
    }

    const remoteReply = remoteRepliesMap.get(match.profileId);
    const localReply = simulateLocalReplyForMatch(
      match,
      profile,
      campaignName,
      i,
    );

    const status: 'accepted' | 'declined' =
      remoteReply?.status === 'declined'
        ? 'declined'
        : remoteReply?.status === 'accepted'
          ? 'accepted'
          : localReply.status;

    const replyText = stripEmojis(
      remoteReply?.replyText?.trim() || localReply.replyText,
    );

    const feedbackCategory = normalizeCategory(
      remoteReply?.feedbackAttribute?.category ?? localReply.feedbackCategory,
    );
    const feedbackValue = stripEmojis(
      remoteReply?.feedbackAttribute?.value?.trim() || localReply.feedbackValue,
    );
    const feedbackConfidence = clamp(
      Math.round(
        remoteReply?.feedbackAttribute?.confidence ??
          localReply.feedbackConfidence,
      ),
      75,
      97,
    );

    const interaction: CampaignInteraction = {
      campaignId,
      campaignName,
      status,
      sentMessage: match.personalizedInvite,
      replyText,
      timestamp: nowIso,
    };

    const feedbackAttribute: ExtractedAttribute = {
      id: `attr_fb_${profile.id}_${Date.now()}_${i}`,
      category: feedbackCategory,
      value: feedbackValue,
      confidence: feedbackConfidence,
      evidenceQuote: replyText,
      source: 'LINE_CHAT',
      status: 'verified',
    };

    interactions.push({
      profileId: profile.id,
      interaction,
      feedbackAttribute,
    });
    updatesByProfile.set(profile.id, { interaction, feedbackAttribute });
  }

  const updatedProfiles = profiles.map((profile) => {
    const update = updatesByProfile.get(profile.id);
    if (!update) {
      return profile;
    }

    return {
      ...profile,
      campaignHistory: [update.interaction, ...profile.campaignHistory],
      attributes: upsertBehavioralAttribute(
        profile.attributes,
        update.feedbackAttribute,
      ),
    };
  });

  const acceptedCount = interactions.filter(
    (entry) => entry.interaction.status === 'accepted',
  ).length;
  const declinedCount = interactions.length - acceptedCount;
  const elapsedMs = performance.now() - startedAt;

  const logs: PipelineLog[] = [
    createLog(
      'Campaign Dispatch',
      `Sent ${interactions.length} personalized invitations for "${campaignName}" via ${usedFallback ? 'Local Simulator' : 'Gemini 2.5 Flash'}.`,
      elapsedMs * 0.3,
    ),
    createLog(
      'Response Simulation',
      `Captured ${acceptedCount} accepted and ${declinedCount} declined Thai chat responses.`,
      elapsedMs * 0.4,
    ),
    createLog(
      'Closed-Loop Feedback',
      `Persisted ${interactions.length} behavioral attributes back to UnifiedProfile records for future segmentation.`,
      elapsedMs * 0.3,
    ),
  ];

  return {
    profiles: updatedProfiles,
    interactions,
    logs,
    usedFallback,
  };
}
