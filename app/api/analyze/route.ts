import OpenAI from 'openai'
import { NextRequest, NextResponse } from 'next/server'

const ALLOWED_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const MAX_BASE64_LENGTH = 14_000_000 // ~10MB image

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mediaType, userApiKey } = await req.json()

    if (!imageBase64 || !mediaType) {
      return NextResponse.json({ error: 'Missing image data' }, { status: 400 })
    }

    // Validate mediaType against allowlist
    if (!ALLOWED_MEDIA_TYPES.has(mediaType)) {
      return NextResponse.json({ error: 'Unsupported image format' }, { status: 400 })
    }

    // Validate base64 size
    if (typeof imageBase64 !== 'string' || imageBase64.length > MAX_BASE64_LENGTH) {
      return NextResponse.json({ error: 'Image too large (max ~10MB)' }, { status: 413 })
    }

    // Validate base64 characters
    if (!/^[A-Za-z0-9+/=]+$/.test(imageBase64)) {
      return NextResponse.json({ error: 'Invalid image data' }, { status: 400 })
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
