'use client'

import { useState, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import AuthForm from '@/components/AuthForm'

function SignInForm() {
  const searchParams = useSearchParams()
  const urlError = searchParams.get('error')
  const registered = searchParams.get('registered')

  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const emailVal = (form.elements.namedItem('email') as HTMLInputElement).value.trim().toLowerCase()
    const passwordVal = (form.elements.namedItem('password') as HTMLInputElement).value
    if (!emailVal || !passwordVal) return
    setError('')
    setLoading(true)
    try {
      const result = await signIn('credentials', {
        email: emailVal,
        password: passwordVal,
        redirect: false,
      })
      console.log('signIn result:', JSON.stringify(result))
      if (!result) {
        setError('No response from server. Check your connection.')
      } else if (result.error) {
        setError(`Auth error: ${result.error}`)
      } else if (result.ok) {
        window.location.replace('/app')
      } else {
        setError(`Unexpected result: ${JSON.stringify(result)}`)
      }
    } catch (err) {
      console.error('signIn threw:', err)
      setError(`Exception: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  const displayError =
    error ||
    (urlError === 'CredentialsSignin' ? 'Invalid email or password. Please try again.' : null) ||
    (urlError ? 'Something went wrong. Please try again.' : null)

  return (
    <AuthForm
      title="Welcome back"
      subtitle="Sign in to your account to start generating flyers"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {displayError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 flex items-start gap-2">
            <span className="mt-0.5 shrink-0">⚠️</span>
            <span>{displayError}</span>
          </div>
        )}
        {registered && (
          <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">
            ✓ Account created! Sign in below.
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Email address
          </label>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition placeholder:text-gray-400"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
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

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition text-sm shadow-sm"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Signing in…
            </span>
          ) : (
            'Sign in'
          )}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-6">
        Don&apos;t have an account?{' '}
        <Link href="/auth/signup" className="text-blue-600 hover:text-blue-700 font-medium hover:underline">
          Create one free
        </Link>
      </p>
    </AuthForm>
  )
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  )
}
