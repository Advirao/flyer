import OpenAI from 'openai'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mediaType, userApiKey } = await req.json()

    if (!imageBase64 || !mediaType) {
      return NextResponse.json({ error: 'Missing image data' }, { status: 400 })
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

    const parsed = JSON.parse(jsonStr)
    return NextResponse.json({
      flyer: { title: parsed.flyer.title, description: parsed.flyer.description },
      fb: { title: parsed.fb.title, price: parsed.fb.price, description: parsed.fb.description },
    })
  } catch (err: unknown) {
    console.error('Analyze error:', err)
    const message = err instanceof Error ? err.message : 'Analysis failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
