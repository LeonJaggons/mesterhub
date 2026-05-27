import en from '@/messages/en.json'
import hu from '@/messages/hu.json'
import { defaultLocale, type Locale } from './config'

const dictionaries = {
  en,
  hu,
} satisfies Record<Locale, Record<string, unknown>>

function mergeMessages(base: Record<string, unknown>, override: Record<string, unknown>): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(override)) {
    const baseValue = merged[key]
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      baseValue &&
      typeof baseValue === 'object' &&
      !Array.isArray(baseValue)
    ) {
      merged[key] = mergeMessages(baseValue as Record<string, unknown>, value as Record<string, unknown>)
    } else {
      merged[key] = value
    }
  }
  return merged
}

export function getMessages(locale: Locale): Record<string, unknown> {
  const fallback = dictionaries[defaultLocale]
  const messages = dictionaries[locale] ?? fallback
  return locale === defaultLocale ? fallback : mergeMessages(fallback, messages)
}
