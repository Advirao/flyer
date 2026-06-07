import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { getClientIp, rateLimit } from '@/lib/rate-limit'

const ALLOWED_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const MAX_BASE64_LENGTH = 14_000_000
const BASE64_RE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/

type Provider = 'openrouter' | 'claude' | 'openai' | 'gemini'

const KEY_PATTERNS: Record<Provider, RegExp> = {
  openrouter: /^sk-or-[A-Za-z0-9_-]{10,200}$/,
  claude:     /^sk-ant-[A-Za-z0-9_-]{10,300}$/,
  openai:     /^sk-[A-Za-z0-9_-]{10,200}$/,
  gemini:     /^AIza[A-Za-z0-9_-]{30,60}$/,
}

const PROMPT = `Analyze this image of an item for sale and return ONLY this JSON (no markdown, no extra text):

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
}`

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const rl = rateLimit(`analyze:${ip}`, 10, 60 * 1000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a moment and try again.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    )
  }

  try {
    const contentLength = Number(req.headers.get('content-length') ?? '0')
    if (contentLength > MAX_BASE64_LENGTH + 2000) {
      return NextResponse.json({ error: 'Image too large (max ~10MB)' }, { status: 413 })
    }

    const { imageBase64, mediaType, userApiKey, provider = 'openrouter' } = await req.json()

    if (!imageBase64 || !mediaType) {
      return NextResponse.json({ error: 'Missing image data' }, { status: 400 })
    }
    if (typeof mediaType !== 'string' || !ALLOWED_MEDIA_TYPES.has(mediaType)) {
      return NextResponse.json({ error: 'Unsupported image format' }, { status: 400 })
    }
    if (typeof imageBase64 !== 'string' || imageBase64.length > MAX_BASE64_LENGTH) {
      return NextResponse.json({ error: 'Image too large (max ~10MB)' }, { status: 413 })
    }
    if (imageBase64.length === 0 || imageBase64.length % 4 !== 0 || !BASE64_RE.test(imageBase64)) {
      return NextResponse.json({ error: 'Invalid image data' }, { status: 400 })
    }

    const resolvedProvider: Provider = ['openrouter', 'claude', 'openai', 'gemini'].includes(provider)
      ? (provider as Provider)
      : 'openrouter'

    // Validate API key format if provided
    if (userApiKey) {
      const pattern = KEY_PATTERNS[resolvedProvider]
      if (typeof userApiKey !== 'string' || !pattern.test(userApiKey.trim())) {
        return NextResponse.json({ error: `Invalid ${resolvedProvider} API key format` }, { status: 400 })
      }
    }

    const raw = await callProvider(resolvedProvider, userApiKey?.trim(), imageBase64, mediaType)

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

async function callProvider(
  provider: Provider,
  apiKey: string | undefined,
  imageBase64: string,
  mediaType: string
): Promise<string> {
  if (provider === 'claude') {
    const key = apiKey
    if (!key) throw new Error('Claude API key is required')
    const client = new Anthropic({ apiKey: key })
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif', data: imageBase64 },
          },
          { type: 'text', text: PROMPT },
        ],
      }],
    })
    const block = response.content[0]
    return block.type === 'text' ? block.text : ''
  }

  // OpenAI, Gemini (OpenAI-compatible), and OpenRouter all use the same SDK
  let baseURL: string
  let model: string
  let key: string

  if (provider === 'openai') {
    if (!apiKey) throw new Error('OpenAI API key is required')
    baseURL = 'https://api.openai.com/v1'
    model = 'gpt-4o-mini'
    key = apiKey
  } else if (provider === 'gemini') {
    if (!apiKey) throw new Error('Gemini API key is required')
    baseURL = 'https://generativelanguage.googleapis.com/v1beta/openai/'
    model = 'gemini-2.0-flash'
    key = apiKey
  } else {
    // openrouter — use user key or fall back to server key
    const serverKey = process.env.OPENROUTER_API_KEY
    key = apiKey || serverKey || ''
    if (!key) throw new Error('No API key configured')
    baseURL = 'https://openrouter.ai/api/v1'
    model = 'nvidia/nemotron-nano-12b-v2-vl:free'
  }

  const client = new OpenAI({ baseURL, apiKey: key })
  const response = await client.chat.completions.create({
    model,
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:${mediaType};base64,${imageBase64}` } },
        { type: 'text', text: PROMPT },
      ],
    }],
  })
  return response.choices[0]?.message?.content?.trim() ?? ''
}
