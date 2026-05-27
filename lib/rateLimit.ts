import { createHash } from 'crypto'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { NextRequest } from 'next/server'

type RateLimitPolicy =
  | 'publicRead'
  | 'authRead'
  | 'authWrite'
  | 'expensive'
  | 'passwordResetEmail'
  | 'passwordResetIp'

type RateLimitCheck = {
  policy: RateLimitPolicy
  identifier: string
  kind: 'email' | 'ip' | 'user'
}

const redisUrl = process.env.UPSTASH_REDIS_REST_URL
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN
const redis = redisUrl && redisToken
  ? new Redis({ url: redisUrl, token: redisToken })
  : null

const limiters = redis
  ? {
      publicRead: new Ratelimit({
        redis,
        limiter: Ratelimit.tokenBucket(60, '1 m', 80),
        prefix: 'mesterhub:rl:public-read',
        timeout: 1500,
      }),
      authRead: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(300, '1 m'),
        prefix: 'mesterhub:rl:auth-read',
        timeout: 1500,
      }),
      authWrite: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(30, '1 m'),
        prefix: 'mesterhub:rl:auth-write',
        timeout: 1500,
      }),
      expensive: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, '1 h'),
        prefix: 'mesterhub:rl:expensive',
        timeout: 1500,
      }),
      passwordResetEmail: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(3, '1 h'),
        prefix: 'mesterhub:rl:password-reset-email',
        timeout: 1500,
      }),
      passwordResetIp: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, '1 h'),
        prefix: 'mesterhub:rl:password-reset-ip',
        timeout: 1500,
      }),
    }
  : null

function hashIdentifier(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function rateLimitKey(check: RateLimitCheck): string {
  return `${check.kind}:${hashIdentifier(check.identifier)}`
}

export function clientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for')
  const forwardedIp = forwardedFor?.split(',')[0]?.trim()
  const realIp = request.headers.get('x-real-ip')?.trim()
  return forwardedIp || realIp || 'anonymous'
}

function rateLimitHeaders(result: { limit: number; remaining: number; reset: number }): HeadersInit {
  const resetSeconds = Math.ceil(result.reset / 1000)
  const retryAfterSeconds = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000))

  return {
    'Retry-After': String(retryAfterSeconds),
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(Math.max(0, result.remaining)),
    'X-RateLimit-Reset': String(resetSeconds),
  }
}

export async function enforceRateLimit(check: RateLimitCheck): Promise<Response | null> {
  if (!limiters) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[rate limit] UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required.')
    }
    return null
  }

  const result = await limiters[check.policy].limit(rateLimitKey(check))
  if (result.success) return null

  return Response.json(
    { error: 'Too many requests. Please try again later.' },
    { status: 429, headers: rateLimitHeaders(result) },
  )
}

export async function enforceRateLimits(checks: RateLimitCheck[]): Promise<Response | null> {
  for (const check of checks) {
    const limited = await enforceRateLimit(check)
    if (limited) return limited
  }
  return null
}

export function ipRateLimit(policy: RateLimitPolicy, request: NextRequest): RateLimitCheck {
  return { policy, identifier: clientIp(request), kind: 'ip' }
}

export function userRateLimit(policy: RateLimitPolicy, uid: string): RateLimitCheck {
  return { policy, identifier: uid, kind: 'user' }
}

export function emailRateLimit(policy: RateLimitPolicy, email: string): RateLimitCheck {
  return { policy, identifier: email.toLowerCase().trim(), kind: 'email' }
}

export function enforceIpRateLimit(policy: RateLimitPolicy, request: NextRequest): Promise<Response | null> {
  return enforceRateLimit(ipRateLimit(policy, request))
}

export function enforceUserRateLimit(policy: RateLimitPolicy, uid: string): Promise<Response | null> {
  return enforceRateLimit(userRateLimit(policy, uid))
}

export function enforceEmailRateLimit(policy: RateLimitPolicy, email: string): Promise<Response | null> {
  return enforceRateLimit(emailRateLimit(policy, email))
}
