import { NextRequest } from 'next/server'
import { enforceIpRateLimit } from '@/lib/rateLimit'
import { getSupportedLocale, localeCookieName } from '@/lib/i18n/config'
import { searchLocalizedServiceLabels } from '@/lib/i18n/serviceSearch'

const LIMIT = 8

export async function GET(request: NextRequest) {
  const limited = await enforceIpRateLimit('publicRead', request)
  if (limited) return limited

  const locale = getSupportedLocale(
    request.nextUrl.searchParams.get('locale') ??
      request.cookies.get(localeCookieName)?.value,
  )
  const q = request.nextUrl.searchParams.get('q')?.trim() ?? ''

  if (!q) return Response.json({ results: [] })

  return Response.json({ results: searchLocalizedServiceLabels(q, locale, LIMIT) })
}
