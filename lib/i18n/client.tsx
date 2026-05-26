'use client'

import { createContext, useContext, useMemo } from 'react'
import { createTranslator } from './translator'
import { defaultLocale, type Locale } from './config'

type I18nContextValue = {
  locale: Locale
  messages: Record<string, unknown>
}

const I18nContext = createContext<I18nContextValue>({
  locale: defaultLocale,
  messages: {},
})

export function I18nProvider({
  children,
  locale,
  messages,
}: {
  children: React.ReactNode
  locale: Locale
  messages: Record<string, unknown>
}) {
  const value = useMemo(() => ({ locale, messages }), [locale, messages])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useLocale(): Locale {
  return useContext(I18nContext).locale
}

export function useTranslations() {
  const { messages } = useContext(I18nContext)
  return useMemo(() => createTranslator(messages), [messages])
}
