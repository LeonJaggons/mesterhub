import { NextRequest, NextResponse } from 'next/server'
import {
  defaultLocale,
  getPathLocale,
  getPathnameWithoutLocale,
  isLocale,
  localeCookieName,
  localeHeaderName,
  type Locale,
} from './lib/i18n/config'

const localeLikeSegmentPattern = /^[a-z]{2}(?:-[a-z]{2})?$/i

function detectLocale(request: NextRequest): Locale {
  const cookieLocale = request.cookies.get(localeCookieName)?.value
  if (isLocale(cookieLocale)) return cookieLocale

  const acceptedLanguages = request.headers.get('accept-language')?.split(',') ?? []
  for (const acceptedLanguage of acceptedLanguages) {
    const language = acceptedLanguage.split(';')[0]?.trim().toLowerCase()
    const baseLanguage = language?.split('-')[0]

    if (isLocale(language)) return language
    if (isLocale(baseLanguage)) return baseLanguage
  }

  return defaultLocale
}

function rememberLocale(response: NextResponse, locale: Locale): NextResponse {
  response.cookies.set(localeCookieName, locale, {
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  })
  return response
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const locale = getPathLocale(pathname)

  if (locale) {
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set(localeHeaderName, locale)

    const rewriteUrl = request.nextUrl.clone()
    rewriteUrl.pathname = getPathnameWithoutLocale(pathname)

    return rememberLocale(
      NextResponse.rewrite(rewriteUrl, { request: { headers: requestHeaders } }),
      locale,
    )
  }

  const firstSegment = pathname.split('/').filter(Boolean)[0]
  const preferredLocale = localeLikeSegmentPattern.test(firstSegment ?? '')
    ? defaultLocale
    : detectLocale(request)

  const redirectUrl = request.nextUrl.clone()
  const redirectPath = localeLikeSegmentPattern.test(firstSegment ?? '')
    ? `/${pathname.split('/').filter(Boolean).slice(1).join('/')}`
    : pathname
  redirectUrl.pathname = `/${preferredLocale}${redirectPath === '/' ? '' : redirectPath}`

  return rememberLocale(NextResponse.redirect(redirectUrl), preferredLocale)
}

export const config = {
  matcher: [
    '/((?!api|_next|_vercel|.*\\..*).*)',
  ],
}
