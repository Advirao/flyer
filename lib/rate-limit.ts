import type { NextRequest } from 'next/server'

/**
 * Lightweight in-memory rate limiter.
 *
 * NOTE: On Vercel / serverless, each cold-started lambda gets its own
 * memory, so this is best-effort. It meaningfully blunts bursty abuse
 * from a single client hitting a warm instance but is NOT a substitute
 * for a distributed limiter (Upstash / Vercel KV) if abuse scales up.
 */

type Bucket = { count: number; resetAt: number }

// Per-process map. Keys are short-lived and evicted lazily.
const buckets = new Map<string, Bucket>()
const MAX_KEYS = 5000

function evictIfNeeded() {
  if (buckets.size <= MAX_KEYS) return
  const now = Date.now()
  for (const [k, v] of buckets) {
    if (v.resetAt <= now) buckets.delete(k)
  }
}

export function getClientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]!.trim()
  const real = req.headers.get('x-real-ip')
  if (real) return real.trim()
  return 'unknown'
}

/**
 * Returns { allowed, retryAfterSeconds }. If allowed is false the caller
 * should respond with 429 and include Retry-After.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; retryAfterSeconds: number; remaining: number } {
  const now = Date.now()
  const existing = buckets.get(key)

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    evictIfNeeded()
    return { allowed: true, retryAfterSeconds: 0, remaining: limit - 1 }
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
      remaining: 0,
    }
  }

  existing.count += 1
  return { allowed: true, retryAfterSeconds: 0, remaining: limit - existing.count }
}
