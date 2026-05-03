import { NextRequest, NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import { prisma } from '@/lib/db'
import { signUpSchema } from '@/lib/validations'
import { getClientIp, rateLimit } from '@/lib/rate-limit'

// Hard body cap. Signup payload is three short strings; anything larger is abuse.
const MAX_BODY_BYTES = 2_000

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 5 signup attempts per IP per 10 minutes.
    // bcrypt at cost 12 is CPU-expensive (~250ms), so unbounded signups
    // are a cheap DoS vector. This also limits account-enumeration probing.
    const ip = getClientIp(req)
    const rl = rateLimit(`signup:${ip}`, 5, 10 * 60 * 1000)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many signup attempts. Please try again later.' },
        {
          status: 429,
          headers: { Connection: 'close', 'Retry-After': String(rl.retryAfterSeconds) },
        }
      )
    }

    // Reject payloads that are obviously oversized before parsing.
    const contentLength = Number(req.headers.get('content-length') ?? '0')
    if (contentLength > MAX_BODY_BYTES) {
      return NextResponse.json(
        { error: 'Request body too large.' },
        { status: 413, headers: { Connection: 'close' } }
      )
    }

    const body = await req.text()
    if (body.length > MAX_BODY_BYTES) {
      return NextResponse.json(
        { error: 'Request body too large.' },
        { status: 413, headers: { Connection: 'close' } }
      )
    }

    let parsedBody: unknown
    try {
      parsedBody = JSON.parse(body)
    } catch {
      return NextResponse.json(
        { error: 'Invalid request body.' },
        { status: 400, headers: { Connection: 'close' } }
      )
    }

    const result = signUpSchema.safeParse(parsedBody)
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400, headers: { Connection: 'close' } }
      )
    }

    const normalizedEmail = result.data.email.toLowerCase().trim()
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } })
    if (existing) {
      return NextResponse.json(
        { error: 'Unable to create account. Please try signing in or use a different email.' },
        { status: 409, headers: { Connection: 'close' } }
      )
    }

    const passwordHash = await hash(result.data.password, 12)
    await prisma.user.create({ data: { email: normalizedEmail, passwordHash } })
    return NextResponse.json({ success: true }, { headers: { Connection: 'close' } })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[signup] error:', msg)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.', detail: msg },
      { status: 500, headers: { Connection: 'close' } }
    )
  }
}
