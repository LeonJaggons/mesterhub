import en from '@/messages/en.json'
import hu from '@/messages/hu.json'
import { defaultLocale, type Locale } from './config'

const dictionaries = {
  en,
  hu,
} satisfies Record<Locale, Record<string, unknown>>

export function getMessages(locale: Locale): Record<string, unknown> {
  return dictionaries[locale] ?? dictionaries[defaultLocale]
}
