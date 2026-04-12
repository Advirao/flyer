import OpenAI from 'openai'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getClientIp, rateLimit } from '@/lib/rate-limit'

const ALLOWED_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const MAX_BASE64_LENGTH = 14_000_000 // ~10MB image
// Strict base64: groups of 4 chars, optionally padded with 1-2 '=' at the end only.
const BASE64_RE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Rate limit by authenticated user (falls back to IP). This prevents a
  // single account from burning through the shared OpenRouter key.
  const userId = (session.user as { id?: string })?.id ?? session.user?.email ?? getClientIp(req)
  const rl = rateLimit(`analyze:${userId}`, 10, 60 * 1000) // 10 requests/minute
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a moment and try again.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    )
  }

  try {
    // Cap raw body size before JSON parsing to prevent memory abuse.
    const contentLength = Number(req.headers.get('content-length') ?? '0')
    if (contentLength > MAX_BASE64_LENGTH + 2000) {
      return NextResponse.json({ error: 'Image too large (max ~10MB)' }, { status: 413 })
    }

    const { imageBase64, mediaType, userApiKey } = await req.json()

    if (!imageBase64 || !mediaType) {
      return NextResponse.json({ error: 'Missing image data' }, { status: 400 })
    }

    // Validate mediaType against allowlist
    if (typeof mediaType !== 'string' || !ALLOWED_MEDIA_TYPES.has(mediaType)) {
      return NextResponse.json({ error: 'Unsupported image format' }, { status: 400 })
    }

    // Validate base64 size
    if (typeof imageBase64 !== 'string' || imageBase64.length > MAX_BASE64_LENGTH) {
      return NextResponse.json({ error: 'Image too large (max ~10MB)' }, { status: 413 })
    }

    // Validate base64 structure (strict: proper 4-char grouping and padding placement)
    if (imageBase64.length === 0 || imageBase64.length % 4 !== 0 || !BASE64_RE.test(imageBase64)) {
      return NextResponse.json({ error: 'Invalid image data' }, { status: 400 })
    }

    // If a user API key is supplied, require it to look like a real OpenRouter key.
    // This prevents junk / injected values from being forwarded to OpenRouter.
    if (typeof userApiKey !== 'undefined' && userApiKey !== null && userApiKey !== '') {
      if (typeof userApiKey !== 'string' || !/^sk-[A-Za-z0-9_\-]{10,200}$/.test(userApiKey.trim())) {
        return NextResponse.json({ error: 'Invalid API key format' }, { status: 400 })
      }
    }

    // Use the user's own key if provided, otherwise fall back to the server key
    const apiKey = userApiKey?.trim() || process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'No API key configured' }, { status: 500 })
    }

    const client = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey,
    })

    const response = await client.chat.completions.create({
      model: 'nvidia/nemotron-nano-12b-v2-vl:free',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${mediaType};base64,${imageBase64}`,
              },
            },
            {
              type: 'text',
              text: `Analyze this image of an item for sale and return ONLY this JSON (no markdown, no extra text):

{
  "flyer": {
    "title": "For Sale - [specific item name, color/model/size] (keep it under 10 words total)",
    "description": "1-2 sentences: what the item is, its condition, and any notable features."
  },
  "fb": {
    "title": "Short Facebook Marketplace listing title (under 10 words, no 'For Sale' prefix needed, be descriptive)",
    "price": "Suggested fair resale price as a number only, no $ sign (e.g. 10)",
    "description": "2-4 sentences written for a Facebook Marketplace listing. Mention the item, its condition, key features, and end with a friendly call-to-action like 'Message me for more info!' Do NOT include pickup location or contact details."
  }
}`,
            },
          ],
        },
      ],
    })

    const raw = response.choices[0]?.message?.content?.trim() ?? ''
    const jsonStr = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim()

    let parsed: { flyer?: { title?: string; description?: string }; fb?: { title?: string; price?: string; description?: string } }
    try {
      parsed = JSON.parse(jsonStr)
    } catch {
      return NextResponse.json({ error: 'AI returned an unexpected response. Please try again.' }, { status: 502 })
    }

    if (!parsed?.flyer?.title || !parsed?.fb?.title) {
      return NextResponse.json({ error: 'AI response was incomplete. Please try again.' }, { status: 502 })
    }

    return NextResponse.json({
      flyer: { title: parsed.flyer.title, description: parsed.flyer.description ?? '' },
      fb: { title: parsed.fb.title, price: parsed.fb.price ?? '', description: parsed.fb.description ?? '' },
    })
  } catch (err: unknown) {
    console.error('Analyze error:', err instanceof Error ? err.message : 'Unknown error')
    return NextResponse.json({ error: 'Analysis failed. Please try again.' }, { status: 500 })
  }
}
