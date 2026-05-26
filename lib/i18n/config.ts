export const locales = ['en', 'hu'] as const

export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'en'

export const localeCookieName = 'mesterhub-locale'
export const localeHeaderName = 'x-mesterhub-locale'

const localeSet = new Set<string>(locales)

export function isLocale(value: string | undefined | null): value is Locale {
  return Boolean(value && localeSet.has(value))
}

export function getSupportedLocale(value: string | undefined | null): Locale {
  return isLocale(value) ? value : defaultLocale
}

export function getPathLocale(pathname: string): Locale | null {
  const segment = pathname.split('/').filter(Boolean)[0]
  return isLocale(segment) ? segment : null
}

export function getPathnameWithoutLocale(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean)
  if (!isLocale(segments[0])) return pathname || '/'

  const rest = segments.slice(1).join('/')
  return rest ? `/${rest}` : '/'
}

export function localizeHref(href: string, locale: Locale): string {
  if (!href.startsWith('/') || href.startsWith('//')) return href

  const [pathname, suffix = ''] = href.split(/(?=[?#])/, 2)
  const unprefixedPathname = getPathnameWithoutLocale(pathname)
  return `/${locale}${unprefixedPathname === '/' ? '' : unprefixedPathname}${suffix}`
}
