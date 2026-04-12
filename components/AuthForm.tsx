'use client'

import Link from 'next/link'

interface AuthFormProps {
  title: string
  subtitle?: string
  children: React.ReactNode
}

export default function AuthForm({ title, subtitle, children }: AuthFormProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 group">
            <span className="text-3xl">🏷️</span>
            <span className="text-2xl font-bold text-gray-900 group-hover:text-blue-600 transition">
              Flyer Generator
            </span>
          </Link>
        </div>
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">{title}</h1>
          {subtitle && (
            <p className="text-gray-500 text-sm mb-6">{subtitle}</p>
          )}
          {children}
        </div>
      </div>
    </div>
  )
}
