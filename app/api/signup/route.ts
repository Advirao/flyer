import { NextRequest, NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import { prisma } from '@/lib/db'
import { signUpSchema } from '@/lib/validations'

export async function POST(req: NextRequest) {
  try {
    const { email, password, confirmPassword } = await req.json()
    const result = signUpSchema.safeParse({ email, password, confirmPassword })
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400, headers: { Connection: 'close' } })
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
  } catch {
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500, headers: { Connection: 'close' } })
  }
}
