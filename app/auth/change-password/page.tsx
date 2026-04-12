'use client'

import { useEffect, useState } from 'react'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { toast } from 'sonner'
import AuthForm from '@/components/AuthForm'
import { changePassword } from '@/lib/auth-actions'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition text-sm shadow-sm"
    >
      {pending ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Updating…
        </span>
      ) : (
        'Update password'
      )}
    </button>
  )
}

export default function ChangePasswordPage() {
  const { data: session } = useSession()
  const [showPasswords, setShowPasswords] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [state, action] = useActionState(changePassword, null)

  useEffect(() => {
    if (state?.success) toast.success('Password updated successfully!')
    if (state?.error) toast.error(state.error)
  }, [state])

  const passwordsMatch = !confirmPassword || newPassword === confirmPassword

  return (
    <AuthForm
      title="Change password"
      subtitle={
        session?.user?.email
          ? `Signed in as ${session.user.email}`
          : 'Update your account password'
      }
    >
      <form action={action} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Current password
          </label>
          <div className="relative">
            <input
              type={showPasswords ? 'text' : 'password'}
              name="currentPassword"
              required
              autoComplete="current-password"
              placeholder="Your current password"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 pr-16 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition placeholder:text-gray-400"
            />
            <button
              type="button"
              onClick={() => setShowPasswords((p) => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-700 font-medium transition"
            >
              {showPasswords ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">New password</label>
          <input
            type={showPasswords ? 'text' : 'password'}
            name="newPassword"
            required
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Min. 8 chars, 1 uppercase, 1 number"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition placeholder:text-gray-400"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm new password</label>
          <input
            type={showPasswords ? 'text' : 'password'}
            name="confirmPassword"
            required
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:border-transparent transition placeholder:text-gray-400 ${
              !passwordsMatch
                ? 'border-red-300 focus:ring-red-400 bg-red-50'
                : 'border-gray-300 focus:ring-blue-500'
            }`}
          />
          {!passwordsMatch && (
            <p className="text-xs text-red-600 mt-1">Passwords don&apos;t match</p>
          )}
        </div>

        <SubmitButton />
      </form>

      <div className="mt-6 pt-5 border-t border-gray-100">
        <Link
          href="/app"
          className="flex items-center justify-center gap-1 text-sm text-gray-500 hover:text-gray-900 transition"
        >
          ← Back to app
        </Link>
      </div>
    </AuthForm>
  )
}
