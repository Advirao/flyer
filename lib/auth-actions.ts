'use server'

import { hash, compare } from 'bcryptjs'
import { prisma } from './db'
import { signUpSchema, changePasswordSchema } from './validations'
import { getServerSession } from 'next-auth'
import { authOptions } from './auth'

// Called from client components directly (plain args, no FormData serialization issues)
export async function signUpDirect(
  emailArg: string,
  passwordArg: string,
  confirmPasswordArg: string
): Promise<{ error?: string; success?: boolean }> {
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

  const raw = {
    currentPassword: formData.get('currentPassword') as string,
    newPassword: formData.get('newPassword') as string,
    confirmPassword: formData.get('confirmPassword') as string,
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
