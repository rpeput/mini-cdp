import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { AiAction } from '../src/types/cdp.ts';

const DEFAULT_BASE_URL = 'https://api.maxplus-ai.cc/auto-pools/v1';
const DEFAULT_MODEL = 'gpt-6-luna';
const REQUEST_TIMEOUT_MS = 25_000;

type WireApiMode = 'auto' | 'chat' | 'responses';

const VALID_ACTIONS = new Set<AiAction>([
  'stitch',
  'segment',
  'simulate_replies',
]);

const SYSTEM_PROMPTS: Record<AiAction, string> = {
  stitch: `You are the identity-resolution and attribute-extraction engine for Mini CDP, an enterprise Thai/English Customer Data Platform.
Analyze raw records across LINE_CHAT, FACEBOOK_POST, and DEPT_ROSTER for university Computing department profiles.
Rules:
1. Understand casual Thai chat phrasing, Thai nicknames (ชื่อเล่น), bilingual Tinglish, slang, abbreviations, and budget hints (e.g. "ไม่เกิน 300", "ปลายเดือนช็อต", "สายบุฟเฟ่ต์คุ้มๆ", "หมูกระทะ", "ปิ้งย่าง", "เดินป่า", "กางเต็นท์", "ดำน้ำ", "บอร์ดเกม").
2. Link raw records to the matching profileId via nicknames, handles, and conversational cues without inventing facts.
3. Extract structured ExtractedAttribute objects with category strictly in ["food", "activity", "vibe", "budget"].
4. Every ExtractedAttribute MUST include:
   - id (unique string)
   - category ("food" | "activity" | "vibe" | "budget")
   - value (concise normalized Thai or bilingual label)
   - confidence (integer from 64 to 97)
   - evidenceQuote (exact verbatim substring copied directly from rawText)
   - source ("LINE_CHAT" | "FACEBOOK_POST" | "DEPT_ROSTER")
   - status ("verified" when confidence >= 80, "needs_review" when confidence is 64-79)
5. Return valid JSON matching:
   {
     "stitchedProfiles": [
       {
         "profileId": string,
         "linkedRecordIds": string[],
         "attributes": ExtractedAttribute[]
       }
     ],
     "reasoning": string
   }`,

  segment: `You are the semantic audience segmentation and lookalike discovery engine for Mini CDP.
Evaluate a campaign prompt (in Thai or English) against stitched customer profiles, their ExtractedAttribute items, source evidence, and past campaign history.
Rules:
1. Respect PDPA consent: only match profiles where consentPdpa is true and isStitched is true.
2. Divide matches into two tiers matching CampaignMatch:
   - "direct": explicit semantic overlap with requested food, activity, vibe, or budget criteria (matchScore integer 82-98, selected: true).
   - "lookalike": adjacent affinity or behavioral similarity inferred from related Thai lifestyle cues or past accepted campaigns (matchScore integer 65-81, selected: false).
3. Do NOT include emojis in aiReasoning or personalizedInvite.
4. Return valid JSON matching:
   {
     "matches": [
       {
         "profileId": string,
         "tier": "direct" | "lookalike",
         "matchScore": number,
         "aiReasoning": string (crisp 1-line Thai reasoning referencing profile attributes),
         "personalizedInvite": string (natural warm Thai LINE invite addressed to nickname matching their vibe),
         "selected": boolean
       }
     ]
   }
Sort matches by matchScore descending.`,

  simulate_replies: `You are the customer response simulator for Mini CDP campaign launches and closed-loop feedback.
Given campaignName, target CampaignMatch entries, and each friend's UnifiedProfile (attributes, budget constraints, and past interactions):
Rules:
1. Generate realistic Thai/bilingual LINE chat replies reflecting each friend's actual preferences, budget constraints, and workload. Roughly 75% accepted and 25% declined.
2. Do NOT include emojis in replyText.
3. For each target, return a new closed-loop behavioral ExtractedAttribute (e.g. "ตอบรับแคมเปญไว" for accepted, or "ปลายเดือนช็อต" / "ติดปั่นโปรเจกต์ช่วงนี้" for declined) with exact evidenceQuote equal to replyText.
4. Return valid JSON matching:
   {
     "replies": [
       {
         "profileId": string,
         "status": "accepted" | "declined",
         "replyText": string,
         "feedbackAttribute": {
           "category": "food" | "activity" | "vibe" | "budget",
           "value": string,
           "confidence": number (82-95)
         }
       }
     ]
   }`,
};

interface ChatCompletionsApiResponse {
  choices?: Array<{
    message?: {
      content?:
        | string
        | Array<{
            type?: string;
            text?: string;
          }>
        | null;
    };
  }>;
}

interface ResponsesApiResponse {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
}

interface UpstreamCallResult {
  ok: boolean;
  status: number;
  content: string;
}

interface ParsedRequestBody {
  action: AiAction;
  payload: unknown;
}

function isAiAction(value: unknown): value is AiAction {
  return typeof value === 'string' && VALID_ACTIONS.has(value as AiAction);
}

function parseRequestBody(rawBody: unknown): ParsedRequestBody | null {
  let parsed: unknown = rawBody;

  if (typeof rawBody === 'string') {
    if (!rawBody.trim()) {
      return null;
    }
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return null;
    }
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return null;
  }

  const record = parsed as Record<string, unknown>;
  if (!isAiAction(record.action) || record.payload === undefined) {
    return null;
  }

  return {
    action: record.action,
    payload: record.payload,
  };
}

function normalizeOpenAiBaseUrl(rawUrl: string): string {
  return rawUrl
    .trim()
    .replace(/\/+(chat\/completions|responses)\/?$/i, '')
    .replace(/\/+$/, '');
}

function resolveWireApiMode(rawMode: string | undefined): WireApiMode {
  const normalized = rawMode?.trim().toLowerCase();
  if (normalized === 'chat' || normalized === 'responses') {
    return normalized;
  }
  return 'auto';
}

function extractChatContent(payload: ChatCompletionsApiResponse): string {
  const raw = payload.choices?.[0]?.message?.content;
  if (typeof raw === 'string') {
    return raw.trim();
  }
  if (Array.isArray(raw)) {
    return raw
      .map((part) => (typeof part.text === 'string' ? part.text : ''))
      .join('')
      .trim();
  }
  return '';
}

function extractResponsesContent(payload: ResponsesApiResponse): string {
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text.trim();
  }
  if (!Array.isArray(payload.output)) {
    return '';
  }

  const chunks: string[] = [];
  for (const item of payload.output) {
    if (!Array.isArray(item.content)) {
      continue;
    }
    for (const part of item.content) {
      if (typeof part.text === 'string' && part.text) {
        chunks.push(part.text);
      }
    }
  }
  return chunks.join('').trim();
}

function parseModelJson(rawText: string): unknown {
  const trimmed = rawText.trim();
  const unwrapped = trimmed.startsWith('```')
    ? trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    : trimmed;

  return JSON.parse(unwrapped) as unknown;
}

async function callChatCompletions(params: {
  baseUrl: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
  timeoutMs: number;
}): Promise<UpstreamCallResult> {
  const response = await fetch(`${params.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model: params.model,
      messages: [
        { role: 'system', content: params.systemPrompt },
        { role: 'user', content: params.userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: params.temperature,
    }),
    signal: AbortSignal.timeout(params.timeoutMs),
  });

  if (!response.ok) {
    return { ok: false, status: response.status, content: '' };
  }

  const data = (await response.json()) as ChatCompletionsApiResponse;
  return { ok: true, status: response.status, content: extractChatContent(data) };
}

async function callResponsesApi(params: {
  baseUrl: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  timeoutMs: number;
}): Promise<UpstreamCallResult> {
  const response = await fetch(`${params.baseUrl}/responses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model: params.model,
      instructions: params.systemPrompt,
      input: params.userPrompt,
      text: {
        format: {
          type: 'json_object',
        },
      },
    }),
    signal: AbortSignal.timeout(params.timeoutMs),
  });

  if (!response.ok) {
    return { ok: false, status: response.status, content: '' };
  }

  const data = (await response.json()) as ResponsesApiResponse;
  return {
    ok: true,
    status: response.status,
    content: extractResponsesContent(data),
  };
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
    return;
  }

  const parsedBody = parseRequestBody(req.body);
  if (!parsedBody) {
    res.status(400).json({
      error:
        'Invalid request body. Expected JSON with { action: "stitch" | "segment" | "simulate_replies", payload }.',
    });
    return;
  }

  const apiKey =
    process.env.LLM_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    res.status(200).json({ fallback: true });
    return;
  }

  const baseUrl = normalizeOpenAiBaseUrl(
    process.env.LLM_BASE_URL ||
      process.env.OPENAI_BASE_URL ||
      DEFAULT_BASE_URL,
  );
  const model = (
    process.env.LLM_MODEL ||
    process.env.OPENAI_MODEL ||
    DEFAULT_MODEL
  ).trim();
  const wireApiMode = resolveWireApiMode(process.env.LLM_WIRE_API);

  const { action, payload } = parsedBody;
  const systemPrompt = SYSTEM_PROMPTS[action];
  const userPrompt = JSON.stringify(payload);
  const temperature = action === 'simulate_replies' ? 0.5 : 0.15;
  const deadlineAt = Date.now() + REQUEST_TIMEOUT_MS;

  try {
    let result: UpstreamCallResult;

    if (wireApiMode === 'responses') {
      result = await callResponsesApi({
        baseUrl,
        apiKey,
        model,
        systemPrompt,
        userPrompt,
        timeoutMs: Math.max(1_000, deadlineAt - Date.now()),
      });
    } else {
      result = await callChatCompletions({
        baseUrl,
        apiKey,
        model,
        systemPrompt,
        userPrompt,
        temperature,
        timeoutMs: Math.max(1_000, deadlineAt - Date.now()),
      });

      const shouldRetryResponses =
        wireApiMode === 'auto' &&
        !result.ok &&
        [400, 404, 405, 422].includes(result.status) &&
        deadlineAt - Date.now() > 2_000;

      if (shouldRetryResponses) {
        result = await callResponsesApi({
          baseUrl,
          apiKey,
          model,
          systemPrompt,
          userPrompt,
          timeoutMs: Math.max(1_000, deadlineAt - Date.now()),
        });
      }
    }

    if (!result.ok) {
      console.error(
        `[api/ai] Upstream LLM (${model}) returned HTTP ${result.status} for action "${action}"`,
      );
      res.status(200).json({
        fallback: true,
        reason: `upstream_http_${result.status}`,
      });
      return;
    }

    if (!result.content) {
      console.error(
        `[api/ai] Upstream LLM (${model}) returned empty content for action "${action}"`,
      );
      res.status(200).json({ fallback: true, reason: 'empty_response' });
      return;
    }

    const structuredData = parseModelJson(result.content);
    res.status(200).json({
      fallback: false,
      action,
      model,
      data: structuredData,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown upstream error';
    console.error(`[api/ai] Falling back for action "${action}": ${message}`);
    res.status(200).json({ fallback: true, reason: 'upstream_unavailable' });
  }
}
