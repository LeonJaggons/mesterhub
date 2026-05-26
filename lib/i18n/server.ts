import { headers } from 'next/headers'
import { getMessages } from './messages'
import { createTranslator } from './translator'
import { defaultLocale, getSupportedLocale, localeHeaderName, type Locale } from './config'

export async function getRequestLocale(): Promise<Locale> {
  const requestHeaders = await headers()
  return getSupportedLocale(requestHeaders.get(localeHeaderName) ?? defaultLocale)
}

export async function getTranslations(locale?: Locale) {
  const currentLocale = locale ?? await getRequestLocale()
  return createTranslator(getMessages(currentLocale))
}
