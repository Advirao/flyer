'use server'

import { hash, compare } from 'bcryptjs'
import { headers } from 'next/headers'
import { prisma } from './db'
import { signUpSchema, changePasswordSchema } from './validations'
import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { rateLimit } from './rate-limit'

// Upper bound on individual string inputs. Bcrypt truncates at 72 bytes so
// unbounded passwords have no security benefit but do burn CPU.
const MAX_FIELD_LEN = 256

async function getIpFromHeaders(): Promise<string> {
  const h = await headers()
  const xff = h.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]!.trim()
  return h.get('x-real-ip')?.trim() ?? 'unknown'
}

// Called from client components directly (plain args, no FormData serialization issues)
export async function signUpDirect(
  emailArg: string,
  passwordArg: string,
  confirmPasswordArg: string
): Promise<{ error?: string; success?: boolean }> {
  // Server Actions are publicly callable RPC endpoints — they need the same
  // rate limiting and input bounds as any normal route handler.
  if (
    typeof emailArg !== 'string' ||
    typeof passwordArg !== 'string' ||
    typeof confirmPasswordArg !== 'string' ||
    emailArg.length > MAX_FIELD_LEN ||
    passwordArg.length > MAX_FIELD_LEN ||
    confirmPasswordArg.length > MAX_FIELD_LEN
  ) {
    return { error: 'Invalid input.' }
  }

  const ip = await getIpFromHeaders()
  const rl = rateLimit(`signup-action:${ip}`, 5, 10 * 60 * 1000)
  if (!rl.allowed) {
    return { error: 'Too many signup attempts. Please try again later.' }
  }

  const raw = { email: emailArg, password: passwordArg, confirmPassword: confirmPasswordArg }

  const result = signUpSchema.safeParse(raw)
  if (!result.success) {
    return { error: result.error.issues[0].message }
  }

  const { email, password } = result.data

  try {
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } })
    if (existing) return { error: 'Unable to create account. Please try signing in or use a different email.' }

    const passwordHash = await hash(password, 12)
    await prisma.user.create({ data: { email: email.toLowerCase().trim(), passwordHash } })
    return { success: true }
  } catch {
    return { error: 'Something went wrong. Please try again.' }
  }
}

// Called via <form action={formAction}> with useActionState (React 19 / form progressive enhancement)
export async function signUp(
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  return signUpDirect(
    formData.get('email') as string,
    formData.get('password') as string,
    formData.get('confirmPassword') as string,
  )
}

export async function changePassword(
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return { error: 'Not authenticated.' }

  // Rate limit current-password verification per account to prevent an
  // attacker with a stolen session cookie from brute-forcing the existing
  // password in order to pivot to a full account takeover.
  const rl = rateLimit(`change-pw:${session.user.email}`, 5, 15 * 60 * 1000)
  if (!rl.allowed) {
    return { error: 'Too many attempts. Please try again later.' }
  }

  const rawCurrent = formData.get('currentPassword')
  const rawNew = formData.get('newPassword')
  const rawConfirm = formData.get('confirmPassword')
  if (
    typeof rawCurrent !== 'string' ||
    typeof rawNew !== 'string' ||
    typeof rawConfirm !== 'string' ||
    rawCurrent.length > MAX_FIELD_LEN ||
    rawNew.length > MAX_FIELD_LEN ||
    rawConfirm.length > MAX_FIELD_LEN
  ) {
    return { error: 'Invalid input.' }
  }

  const raw = {
    currentPassword: rawCurrent,
    newPassword: rawNew,
    confirmPassword: rawConfirm,
  }

  const result = changePasswordSchema.safeParse(raw)
  if (!result.success) {
    return { error: result.error.issues[0].message }
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })
    if (!user) return { error: 'User not found.' }

    const valid = await compare(result.data.currentPassword, user.passwordHash)
    if (!valid) return { error: 'Current password is incorrect.' }

    const passwordHash = await hash(result.data.newPassword, 12)
    await prisma.user.update({
      where: { email: session.user.email },
      data: { passwordHash },
    })

    return { success: true }
  } catch {
    return { error: 'Something went wrong. Please try again.' }
  }
}
