import type { Metadata } from 'next'
import { locales, type Locale } from '@/lib/i18n/config'
import enMessages from '@/messages/en.json'
import huMessages from '@/messages/hu.json'
import districtsData from '@/public/districts.json'
import servicesData from '@/public/services.json'

export const siteUrl = 'https://mestermind.com'
export const siteName = 'Mestermind'
export const defaultOgImage = '/img/budapest-sorted.jpg'

type Dictionary = Record<string, unknown>
type ServiceCategory = (typeof servicesData.categories)[number]
type District = (typeof districtsData.districts)[number]

export type SeoServiceEntry = {
  id: string
  type: 'category' | 'service'
  categoryName: string
  serviceName?: string
  labels: Record<Locale, string>
  slugs: Record<Locale, string>
  featuredServices: string[]
  regulated: boolean
  licenceNote?: string
}

export type SeoDistrict = District & {
  slug: string
}

const dictionaries: Record<Locale, Dictionary> = {
  en: enMessages,
  hu: huMessages,
}

const categorySlugOverrides: Partial<Record<ServiceCategory['name'], Record<Locale, string>>> = {
  Cleaning: { en: 'cleaning', hu: 'takaritas' },
  Plumbing: { en: 'plumbing', hu: 'vizszereles' },
  Electrical: { en: 'electrical', hu: 'villanyszereles' },
  Painting: { en: 'painting', hu: 'festes' },
  Carpentry: { en: 'carpentry', hu: 'asztalosmunka' },
  HVAC: { en: 'hvac', hu: 'futes-hutes-szellozes' },
  Gardening: { en: 'gardening', hu: 'kerteszet' },
  Moving: { en: 'moving', hu: 'koltoztetes' },
  Handyman: { en: 'handyman', hu: 'ezermester' },
  Photography: { en: 'photography', hu: 'fotozas' },
  Tutoring: { en: 'tutoring', hu: 'oktatas' },
  Fitness: { en: 'fitness', hu: 'fitnesz' },
}

function dictionaryValue(locale: Locale, path: string): string | null {
  let current: unknown = dictionaries[locale]
  for (const part of path.split('.')) {
    if (!current || typeof current !== 'object' || !(part in current)) return null
    current = (current as Dictionary)[part]
  }
  return typeof current === 'string' ? current : null
}

function taxonomyKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function translateSeoCategory(categoryName: string, locale: Locale): string {
  return dictionaryValue(locale, `taxonomy.categories.${taxonomyKey(categoryName)}`) ?? categoryName
}

export function translateSeoService(serviceName: string, locale: Locale): string {
  return dictionaryValue(locale, `taxonomy.services.${taxonomyKey(serviceName)}`) ?? serviceName
}

export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function localizedPath(locale: Locale, path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `/${locale}${normalized === '/' ? '' : normalized}`
}

export function absoluteUrl(path: string): string {
  return new URL(path, siteUrl).toString()
}

export function districtSlug(district: District): string {
  return slugify(district.name)
}

export const seoDistricts: SeoDistrict[] = districtsData.districts.map(district => ({
  ...district,
  slug: districtSlug(district),
}))

function entryForCategory(category: ServiceCategory): SeoServiceEntry {
  const labels = {
    en: translateSeoCategory(category.name, 'en'),
    hu: translateSeoCategory(category.name, 'hu'),
  }
  return {
    id: `category-${slugify(category.name)}`,
    type: 'category',
    categoryName: category.name,
    labels,
    slugs: categorySlugOverrides[category.name] ?? {
      en: slugify(labels.en),
      hu: slugify(labels.hu),
    },
    featuredServices: category.featured,
    regulated: Boolean(category.regulated),
    licenceNote: category.licenceNote,
  }
}

function entryForService(category: ServiceCategory, serviceName: string): SeoServiceEntry {
  const labels = {
    en: translateSeoService(serviceName, 'en'),
    hu: translateSeoService(serviceName, 'hu'),
  }
  return {
    id: `service-${slugify(category.name)}-${slugify(serviceName)}`,
    type: 'service',
    categoryName: category.name,
    serviceName,
    labels,
    slugs: {
      en: slugify(labels.en),
      hu: slugify(labels.hu),
    },
    featuredServices: [serviceName, ...category.featured.filter(featured => featured !== serviceName)].slice(0, 4),
    regulated: Boolean(category.regulated),
    licenceNote: category.licenceNote,
  }
}

export const seoCategoryEntries: SeoServiceEntry[] = servicesData.categories.map(entryForCategory)

export const seoServiceEntries: SeoServiceEntry[] = [
  ...seoCategoryEntries,
  ...servicesData.categories.flatMap(category => category.services.map(service => entryForService(category, service))),
]

export function resolveServiceEntry(slug: string): SeoServiceEntry | null {
  const normalized = slugify(slug)
  return seoServiceEntries.find(entry => (
    entry.slugs.en === normalized || entry.slugs.hu === normalized
  )) ?? null
}

export function resolveDistrict(slug: string): SeoDistrict | null {
  const normalized = slugify(slug)
  return seoDistricts.find(district => district.slug === normalized) ?? null
}

export function servicePath(entry: SeoServiceEntry, locale: Locale): string {
  return localizedPath(locale, `/services/${entry.slugs[locale]}`)
}

export function districtPath(district: SeoDistrict, locale: Locale): string {
  return localizedPath(locale, `/budapest/${district.slug}`)
}

export function districtServicePath(district: SeoDistrict, entry: SeoServiceEntry, locale: Locale): string {
  return localizedPath(locale, `/budapest/${district.slug}/${entry.slugs[locale]}`)
}

export function instantResultsPath(locale: Locale, entry?: SeoServiceEntry, district?: SeoDistrict): string {
  const params = new URLSearchParams()
  if (entry?.type === 'category') params.set('category', entry.categoryName)
  if (entry?.type === 'service') params.set('q', entry.serviceName ?? entry.labels.en)
  if (district) params.set('district', district.roman)
  const query = params.toString()
  return `${localizedPath(locale, '/instant-results')}${query ? `?${query}` : ''}`
}

export function alternateUrls(paths: Record<Locale, string>, canonicalLocale: Locale) {
  return {
    canonical: absoluteUrl(paths[canonicalLocale]),
    languages: {
      en: absoluteUrl(paths.en),
      hu: absoluteUrl(paths.hu),
      'x-default': absoluteUrl(paths.en),
    },
  }
}

export function localizedMetadata({
  locale,
  paths,
  title,
  description,
  image = defaultOgImage,
  index = true,
}: {
  locale: Locale
  paths: Record<Locale, string>
  title: string
  description: string
  image?: string
  index?: boolean
}): Metadata {
  const canonical = absoluteUrl(paths[locale])
  return {
    metadataBase: new URL(siteUrl),
    title,
    description,
    alternates: alternateUrls(paths, locale),
    openGraph: {
      title,
      description,
      url: canonical,
      siteName,
      locale,
      alternateLocale: locales.filter(item => item !== locale),
      type: 'website',
      images: [{ url: image, width: 1200, height: 630, alt: `${siteName} Budapest services` }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
    robots: index
      ? { index: true, follow: true }
      : { index: false, follow: true, googleBot: { index: false, follow: true } },
  }
}

export function homeMetadata(locale: Locale): Metadata {
  const title = locale === 'hu'
    ? 'Mestermind | Megbízható ezermesterek és szakemberek Budapesten'
    : 'Mestermind | Trusted handyman and home services in Budapest'
  const description = locale === 'hu'
    ? 'Találj ellenőrzött ezermestert, vízszerelőt, villanyszerelőt, festőt és takarítót Budapest minden kerületében.'
    : 'Find vetted handymen, plumbers, electricians, painters, cleaners and local professionals across every Budapest district.'
  return localizedMetadata({
    locale,
    paths: { en: localizedPath('en', '/'), hu: localizedPath('hu', '/') },
    title,
    description,
  })
}

export function serviceMetadata(entry: SeoServiceEntry, locale: Locale): Metadata {
  const label = entry.labels[locale]
  const title = locale === 'hu'
    ? `${label} Budapesten | Ellenőrzött szakemberek | Mestermind`
    : `${label} in Budapest | Vetted local pros | Mestermind`
  const description = locale === 'hu'
    ? `Hasonlíts össze értékelt budapesti szakembereket ${label.toLowerCase()} munkára. Keress kerület szerint, nézz árakat, és kérj ajánlatot percek alatt.`
    : `Compare rated Budapest professionals for ${label.toLowerCase()}. Search by district, review pricing, and request quotes from vetted local pros in minutes.`
  return localizedMetadata({
    locale,
    paths: { en: servicePath(entry, 'en'), hu: servicePath(entry, 'hu') },
    title,
    description,
  })
}

export function districtMetadata(district: SeoDistrict, locale: Locale): Metadata {
  const title = locale === 'hu'
    ? `Szakemberek ${district.name} környékén | Mestermind Budapest`
    : `Local professionals in ${district.name}, Budapest | Mestermind`
  const description = locale === 'hu'
    ? `Találj ellenőrzött ezermestert, szerelőt, takarítót és más szakembert Budapest ${district.roman}. kerületében (${district.name}).`
    : `Find vetted handymen, cleaners, plumbers, electricians and other local pros in Budapest District ${district.roman} (${district.name}).`
  return localizedMetadata({
    locale,
    paths: { en: districtPath(district, 'en'), hu: districtPath(district, 'hu') },
    title,
    description,
  })
}

export function districtServiceMetadata(district: SeoDistrict, entry: SeoServiceEntry, locale: Locale): Metadata {
  const label = entry.labels[locale]
  const title = locale === 'hu'
    ? `${label} ${district.name} környékén | Mestermind`
    : `${label} in ${district.name}, Budapest | Mestermind`
  const description = locale === 'hu'
    ? `Keress értékelt ${label.toLowerCase()} szakembereket Budapest ${district.roman}. kerületében. Hasonlíts árakat, értékeléseket és elérhetőséget.`
    : `Find rated ${label.toLowerCase()} professionals in Budapest District ${district.roman}. Compare prices, reviews, and availability before booking.`
  return localizedMetadata({
    locale,
    paths: {
      en: districtServicePath(district, entry, 'en'),
      hu: districtServicePath(district, entry, 'hu'),
    },
    title,
    description,
  })
}

export function jsonLd(data: Record<string, unknown> | Record<string, unknown>[]): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: siteName,
    url: siteUrl,
    logo: absoluteUrl('/favicon.ico'),
    areaServed: {
      '@type': 'City',
      name: 'Budapest',
      addressCountry: 'HU',
    },
    sameAs: [
      'https://www.facebook.com',
      'https://www.instagram.com',
    ],
  }
}

export function websiteJsonLd(locale: Locale) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteName,
    url: absoluteUrl(localizedPath(locale, '/')),
    inLanguage: locale,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${absoluteUrl(localizedPath(locale, '/instant-results'))}?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  }
}

export function serviceJsonLd(entry: SeoServiceEntry, locale: Locale, district?: SeoDistrict) {
  const label = entry.labels[locale]
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: district ? `${label} - ${district.name}` : label,
    serviceType: label,
    provider: {
      '@type': 'Organization',
      name: siteName,
      url: siteUrl,
    },
    areaServed: district
      ? {
        '@type': 'AdministrativeArea',
        name: `${district.name}, Budapest`,
        addressCountry: 'HU',
      }
      : {
        '@type': 'City',
        name: 'Budapest',
        addressCountry: 'HU',
      },
    availableChannel: {
      '@type': 'ServiceChannel',
      serviceUrl: absoluteUrl(district ? districtServicePath(district, entry, locale) : servicePath(entry, locale)),
    },
  }
}

export function localBusinessJsonLd(locale: Locale, district?: SeoDistrict) {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: siteName,
    url: absoluteUrl(district ? districtPath(district, locale) : localizedPath(locale, '/')),
    image: absoluteUrl(defaultOgImage),
    address: {
      '@type': 'PostalAddress',
      addressLocality: district?.name ?? 'Budapest',
      addressCountry: 'HU',
    },
    areaServed: district?.name ?? 'Budapest',
    priceRange: 'Ft',
  }
}

export function breadcrumbJsonLd(items: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.url),
    })),
  }
}

export function faqJsonLd(items: Array<{ question: string; answer: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  }
}

export function itemListJsonLd(items: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      url: absoluteUrl(item.url),
    })),
  }
}
