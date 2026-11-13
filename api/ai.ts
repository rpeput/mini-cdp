import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomUUID } from 'node:crypto';
import type { AiAction } from '../src/types/cdp.ts';
import { AI_UPSTREAM_TIMEOUT_MS } from '../src/types/cdp.ts';

const DEFAULT_BASE_URL = 'https://api.maxplus-ai.cc/auto-pools/v1';
const DEFAULT_MODEL = 'gpt-6-luna';

type WireApiMode = 'auto' | 'chat' | 'responses';

const VALID_ACTIONS = new Set<AiAction>([
  'stitch',
  'segment',
  'simulate_replies',
  'resolve_identity',
  'extract_signal',
  'classify_reply',
  'parse_brief',
  'check_invites',
  'summarize_campaign',
  'parse_search',
]);

/** Requests larger than this are refused before any paid call is made. */
const MAX_BODY_CHARS = 60_000;
const RATE_LIMIT_PER_MINUTE = 40;
const requestLog = new Map<string, number[]>();

/** Best-effort per-IP limit. Serverless instances do not share memory, so this only slows down casual abuse. */
function isRateLimited(key: string, now = Date.now()): boolean {
  const recent = (requestLog.get(key) ?? []).filter((time) => now - time < 60_000);
  recent.push(now);
  requestLog.set(key, recent);
  if (requestLog.size > 500) {
    for (const [name, times] of requestLog) {
      if (times.every((time) => now - time >= 60_000)) requestLog.delete(name);
    }
  }
  return recent.length > RATE_LIMIT_PER_MINUTE;
}

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
5. Do NOT extract an interest the writer rejects, has quit, or only mentions in passing (for example "เลิกกินหมูกระทะแล้ว", "ไม่ชอบทะเล"). Skip it instead of inventing a preference.
6. Return valid JSON matching:
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
4. If constraints are given (day, time, place, budgetMax, groupSize), respect them: mention the day and budget in personalizedInvite, and keep the number of selected matches within groupSize.
5. Return valid JSON matching:
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

  resolve_identity: `You resolve who wrote messages in a Thai university friend group. Each record has a source, a handle (display name) and rawText. Candidates are known friends with nickname, fullName, studentId and knownHandles.
Rules:
1. Match Thai and English spellings, transliterations, abbreviations and nicknames (for example "Fahsai T." can be ฟ้าใส, "Boss" can be บอส).
2. Pick one candidate only when the evidence points to exactly one. If two or more candidates fit equally, or none fit, return profileId null. Never guess.
3. "clue" must be copied exactly from the record's handle or rawText and show why you chose that candidate. Use an empty string when profileId is null.
4. confidence is an integer 0-100. Use below 60 when unsure.
5. Return valid JSON only:
   { "resolutions": [ { "recordId": string, "profileId": string | null, "confidence": number, "reason": string (one short Thai sentence), "clue": string } ] }
Return one resolution for every input record.`,

  extract_signal: `You read one Thai chat message or post and decide which interests from a fixed list the writer actually has.
Rules:
1. Use only ids from the given taxonomy.
2. polarity is "likes" when the writer wants, enjoys or plans the thing, and "dislikes" when the writer rejects, quit, avoids or complains about it. Questions and offers about the thing for other people are not the writer's own interest unless the writer joins in.
3. Understand negation, sarcasm and past tense in Thai ("เลิกกินแล้ว", "ไม่ชอบ", "จะไม่ไปได้ไง" means the writer will go).
4. evidenceQuote must be copied exactly from the message.
5. If the message states no interest from the taxonomy, return an empty list.
6. Return valid JSON only:
   { "interests": [ { "id": string, "polarity": "likes" | "dislikes", "evidenceQuote": string, "reason": string } ] }`,

  classify_reply: `You read a real Thai LINE reply to an activity invitation and classify it.
Rules:
1. status is "accepted" when the friend clearly agrees, "declined" when the friend clearly refuses, and "pending" when the answer is undecided, postponed, or depends on a condition.
2. Understand colloquial Thai, double negatives ("จะไม่ไปได้ไง" means yes), polite deflection and conditions ("ถ้างบไม่เกิน 200 ไปแน่").
3. condition is a short Thai phrase for the condition or postponement, or an empty string.
4. newPreference is a new interest, constraint or reason the reply reveals about the friend, with category "food" | "activity" | "vibe" | "budget", a short Thai value and an evidenceQuote copied exactly from the reply. Use null when there is none.
5. followUp is one short Thai suggestion for the organiser when status is "pending", otherwise an empty string.
6. Return valid JSON only:
   { "status": "accepted" | "declined" | "pending", "confidence": number, "condition": string, "reason": string, "newPreference": { "category": string, "value": string, "evidenceQuote": string } | null, "followUp": string }`,

  parse_brief: `You turn a Thai campaign description into structured constraints for an invitation.
Rules:
1. Extract only what the text states. Kinds: "activity", "day", "time", "place", "budgetMax" (baht, number), "groupSize" (number of people, number).
2. quote must be copied exactly from the description and show where the constraint comes from.
3. Read Thai number words ("สามร้อย" is 300, "ไม่เกินห้าคน" is 5).
4. Do not invent a day, price, place or size that is not written.
5. clarifyingQuestion is one short Thai question about the most useful missing detail (day, budget or group size), or an empty string when nothing important is missing.
6. Return valid JSON only:
   { "constraints": [ { "kind": string, "value": string | number, "quote": string } ], "clarifyingQuestion": string }`,

  check_invites: `You review Thai LINE invitations before they are sent. You get the campaign description with its constraints and each invitation.
Rules:
1. Flag "unsupported_fact" for a day, time, price, place or promise in the invitation that is not in the campaign description.
2. Flag "missing_info" when an important constraint from the description (day, budget) is absent and the friend would need it to answer.
3. Flag "tone" for pressure, guilt or text that is not natural Thai LINE chat. Do not flag emojis.
4. quote must be copied exactly from the invitation, or an empty string for missing_info.
5. ok is true only when there are no problems. Do not flag style preferences.
6. Return valid JSON only:
   { "checks": [ { "profileId": string, "ok": boolean, "problems": [ { "kind": "unsupported_fact" | "missing_info" | "tone", "quote": string, "explanation": string (short Thai) } ] } ] }`,

  summarize_campaign: `You summarise the results of a friend-invitation campaign for the organiser in Thai.
Rules:
1. Base every point on the replies you are given. Do not state counts or percentages; the app shows those.
2. kind "insight" explains what the replies show (why people declined, what conditions they gave). kind "next_step" suggests what to do next time.
3. Each point must list citations: the profileId of every reply that supports it. A point with no supporting reply must be left out.
4. Write at most 5 points, each one short sentence.
5. Return valid JSON only:
   { "points": [ { "kind": "insight" | "next_step", "text": string, "citations": string[] } ] }`,

  parse_search: `You turn a Thai question about a list of friends into filters for a table. You never answer the question yourself.
Rules:
1. status must be one of: "all", "ready", "pending", "no-consent". interest one of: "all", "food", "activity", "vibe", "budget". reply one of: "all", "accepted", "declined", "pending", "never".
2. terms are words that must all appear in a friend's name or interests. anyTerms are alternatives where any one may appear (for example tight budget: ["ช็อต", "ประหยัด"]).
3. sort is null or { "key": "name" | "fullName" | "studentId" | "interests" | "status" | "acceptance", "direction": "asc" | "desc" }.
4. explanation is one short Thai sentence describing the filters you chose.
5. Return valid JSON only:
   { "terms": string[], "anyTerms": string[], "status": string, "interest": string, "reply": string, "sort": object | null, "explanation": string }`,

  simulate_replies: `You are the customer response simulator for Mini CDP campaign launches and closed-loop feedback.
Given campaignName, target CampaignMatch entries, and each friend's UnifiedProfile (attributes, budget constraints, and past interactions):
Rules:
1. Generate realistic Thai/bilingual LINE chat replies reflecting each friend's preferences, budget constraints, and workload. For five or more recipients include accepted, declined, and pending outcomes. Pending recipients have not replied yet.
2. Do NOT include emojis in replyText.
3. For accepted and declined recipients return a behavioral ExtractedAttribute with exact evidenceQuote equal to replyText. For pending recipients return an empty replyText and omit feedbackAttribute.
4. Return valid JSON matching:
   {
     "replies": [
       {
         "profileId": string,
         "status": "accepted" | "declined" | "pending",
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
  usage?: { prompt_tokens?: number; completion_tokens?: number };
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
  usage?: { input_tokens?: number; output_tokens?: number };
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
  usage?: { inputTokens: number; outputTokens: number };
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
  sessionHeaders?: Record<string, string>;
  timeoutMs: number;
}): Promise<UpstreamCallResult> {
  const response = await fetch(`${params.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.apiKey}`,
      ...params.sessionHeaders,
    },
    body: JSON.stringify({
      model: params.model,
      ...(params.model === 'deepseek-v4.1-flash' && { reasoning_effort: 'low' }),
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
  const usage =
    typeof data.usage?.prompt_tokens === 'number' && typeof data.usage?.completion_tokens === 'number'
      ? { inputTokens: data.usage.prompt_tokens, outputTokens: data.usage.completion_tokens }
      : undefined;
  return { ok: true, status: response.status, content: extractChatContent(data), usage };
}

async function callResponsesApi(params: {
  baseUrl: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  sessionHeaders?: Record<string, string>;
  timeoutMs: number;
}): Promise<UpstreamCallResult> {
  const response = await fetch(`${params.baseUrl}/responses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.apiKey}`,
      ...params.sessionHeaders,
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
    usage:
      typeof data.usage?.input_tokens === 'number' && typeof data.usage?.output_tokens === 'number'
        ? { inputTokens: data.usage.input_tokens, outputTokens: data.usage.output_tokens }
        : undefined,
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

  const rawBodySize = typeof req.body === 'string' ? req.body.length : JSON.stringify(req.body ?? '').length;
  if (rawBodySize > MAX_BODY_CHARS) {
    res.status(413).json({ error: 'Request body too large.' });
    return;
  }
  const forwarded = req.headers['x-forwarded-for'];
  const clientKey = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim() || 'unknown';
  if (isRateLimited(clientKey)) {
    res.status(429).json({ error: 'Too many requests. Try again in a minute.' });
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
  const sessionId = req.headers['x-gather-ai-session'];
  const sessionHeaders = baseUrl === 'https://opencode.ai/inference/go/openai/v1'
    ? {
        'User-Agent': 'Gather/1.0',
        'x-opencode-session': typeof sessionId === 'string' && /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(sessionId)
          ? sessionId
          : randomUUID(),
      }
    : undefined;

  const { action, payload } = parsedBody;
  const systemPrompt = SYSTEM_PROMPTS[action];
  const userPrompt = JSON.stringify(payload);
  const temperature = action === 'simulate_replies' ? 0.5 : 0.15;
  const deadlineAt = Date.now() + AI_UPSTREAM_TIMEOUT_MS;

  try {
    let result: UpstreamCallResult;

    if (wireApiMode === 'responses') {
      result = await callResponsesApi({
        baseUrl,
        apiKey,
        model,
        systemPrompt,
        userPrompt,
        sessionHeaders,
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
        sessionHeaders,
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
          sessionHeaders,
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
      usage: result.usage,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown upstream error';
    console.error(`[api/ai] Falling back for action "${action}": ${message}`);
    res.status(200).json({ fallback: true, reason: 'upstream_unavailable' });
  }
}
