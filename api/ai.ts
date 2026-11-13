import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { AiAction } from '../src/types/cdp.ts';

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const REQUEST_TIMEOUT_MS = 15_000;

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

interface GeminiApiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
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

function parseModelJson(rawText: string): unknown {
  const trimmed = rawText.trim();
  const unwrapped = trimmed.startsWith('```')
    ? trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    : trimmed;

  return JSON.parse(unwrapped) as unknown;
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

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    res.status(200).json({ fallback: true });
    return;
  }

  const { action, payload } = parsedBody;

  try {
    const upstreamResponse = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: SYSTEM_PROMPTS[action] }],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: JSON.stringify(payload) }],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: action === 'simulate_replies' ? 0.5 : 0.15,
        },
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!upstreamResponse.ok) {
      console.error(
        `[api/ai] Gemini API returned HTTP ${upstreamResponse.status} for action "${action}"`,
      );
      res.status(200).json({
        fallback: true,
        reason: `upstream_http_${upstreamResponse.status}`,
      });
      return;
    }

    const geminiPayload =
      (await upstreamResponse.json()) as GeminiApiResponse;
    const rawContent = geminiPayload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? '')
      .join('')
      .trim();

    if (!rawContent) {
      console.error(
        `[api/ai] Gemini API returned empty candidate content for action "${action}"`,
      );
      res.status(200).json({ fallback: true, reason: 'empty_response' });
      return;
    }

    const structuredData = parseModelJson(rawContent);
    res.status(200).json({
      fallback: false,
      action,
      data: structuredData,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown upstream error';
    console.error(`[api/ai] Falling back for action "${action}": ${message}`);
    res.status(200).json({ fallback: true, reason: 'upstream_unavailable' });
  }
}
