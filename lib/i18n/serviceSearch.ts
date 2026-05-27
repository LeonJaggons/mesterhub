import servicesData from '@/public/services.json'
import { getMessages } from './messages'
import { createTranslator } from './translator'
import { translateCategory, translateService } from './taxonomy'
import type { Locale } from './config'

type ServiceSearchEntry = {
  categoryName: string
  categoryLabel: string
  serviceName: string
  serviceLabel: string
}

export function normalizeSearchText(value: string): string {
  return value
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function matchesQuery(value: string, normalizedQuery: string): boolean {
  return normalizeSearchText(value).includes(normalizedQuery)
}

export function getLocalizedServiceSearchEntries(locale: Locale): ServiceSearchEntry[] {
  const t = createTranslator(getMessages(locale))

  return servicesData.categories.flatMap(category => {
    const categoryLabel = translateCategory(t, category.name)

    return category.services.map(service => ({
      categoryName: category.name,
      categoryLabel,
      serviceName: service,
      serviceLabel: translateService(t, service),
    }))
  })
}

export function searchLocalizedServiceLabels(query: string, locale: Locale, limit: number): string[] {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) return []

  const results: string[] = []
  for (const entry of getLocalizedServiceSearchEntries(locale)) {
    if (
      matchesQuery(entry.serviceLabel, normalizedQuery) ||
      matchesQuery(entry.serviceName, normalizedQuery)
    ) {
      results.push(entry.serviceLabel)
      if (results.length >= limit) break
    }
  }

  return results
}

export function matchingCanonicalServices(query: string, locale: Locale, limit: number): string[] {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) return []

  const results: string[] = []
  const entries = getLocalizedServiceSearchEntries(locale)

  for (const category of servicesData.categories) {
    const categoryEntries = entries.filter(entry => entry.categoryName === category.name)
    const categoryLabel = categoryEntries[0]?.categoryLabel ?? category.name

    if (
      matchesQuery(category.name, normalizedQuery) ||
      matchesQuery(categoryLabel, normalizedQuery)
    ) {
      results.push(...category.services.slice(0, 6))
    } else {
      for (const entry of categoryEntries) {
        if (
          matchesQuery(entry.serviceName, normalizedQuery) ||
          matchesQuery(entry.serviceLabel, normalizedQuery)
        ) {
          results.push(entry.serviceName)
        }
      }
    }

    if (results.length >= limit) break
  }

  return [...new Set(results)].slice(0, limit)
}
