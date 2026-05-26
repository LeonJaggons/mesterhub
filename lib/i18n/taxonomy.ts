import type { createTranslator } from './translator'

type Translator = ReturnType<typeof createTranslator>

function taxonomyKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function translateTaxonomyValue(t: Translator, namespace: string, value: string): string {
  const key = taxonomyKey(value)
  return key ? t(`taxonomy.${namespace}.${key}`, { defaultValue: value }) : value
}

export function translateCategory(t: Translator, categoryName: string): string {
  return translateTaxonomyValue(t, 'categories', categoryName)
}

export function translateService(t: Translator, serviceName: string): string {
  return translateTaxonomyValue(t, 'services', serviceName)
}

export function translateLicenceNote(t: Translator, licenceNote: string): string {
  return translateTaxonomyValue(t, 'licenceNotes', licenceNote)
}
