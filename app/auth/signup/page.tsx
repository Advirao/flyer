'use client'

import { useEffect, useRef, useState } from 'react'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AuthForm from '@/components/AuthForm'
import { signUp } from '@/lib/auth-actions'

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
          Creating account…
        </span>
      ) : (
        'Create account'
      )}
    </button>
  )
}

export default function SignUpPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [signingIn, setSigningIn] = useState(false)
  const submittedCredsRef = useRef({ email: '', password: '' })

  const [state, formAction] = useActionState(signUp, null)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const data = new FormData(e.currentTarget)
    submittedCredsRef.current = {
      email: (data.get('email') as string).trim().toLowerCase(),
      password: data.get('password') as string,
    }
  }

  useEffect(() => {
    if (state?.success) {
      setSigningIn(true)
      const { email: submittedEmail, password: submittedPassword } = submittedCredsRef.current
      signIn('credentials', { email: submittedEmail, password: submittedPassword, redirect: false }).then((result) => {
        if (result?.error) {
          window.location.href = '/auth/signin?registered=1'
        } else {
          window.location.href = '/app'
        }
        setSigningIn(false)
      })
    }
  }, [state?.success, router])

  const passwordsMatch = !confirmPassword || password === confirmPassword

  return (
    <AuthForm
      title="Create your account"
      subtitle="Free forever — no credit card required"
    >
      <form action={formAction} onSubmit={handleSubmit} className="space-y-5">
        {state?.error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 flex items-start gap-2">
            <span className="mt-0.5 shrink-0">⚠️</span>
            <span>{state.error}</span>
          </div>
        )}
        {signingIn && (
          <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">
            ✓ Account created! Signing you in…
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition placeholder:text-gray-400"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 chars, 1 uppercase, 1 number"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 pr-16 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition placeholder:text-gray-400"
            />
            <button
              type="button"
              onClick={() => setShowPassword((p) => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-700 font-medium transition"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm password</label>
          <input
            type={showPassword ? 'text' : 'password'}
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

      <p className="text-center text-sm text-gray-500 mt-6">
        Already have an account?{' '}
        <Link href="/auth/signin" className="text-blue-600 hover:text-blue-700 font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </AuthForm>
  )
}
