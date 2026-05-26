import type { MetadataRoute } from 'next'
import {
  absoluteUrl,
  districtPath,
  districtServicePath,
  localizedPath,
  seoCategoryEntries,
  seoDistricts,
  servicePath,
} from '@/lib/seo'
import type { Locale } from '@/lib/i18n/config'

const publicStaticPaths = ['/', '/pro', '/help', '/terms', '/privacy'] as const

function alternateLanguages(paths: Record<Locale, string>) {
  return {
    en: absoluteUrl(paths.en),
    hu: absoluteUrl(paths.hu),
    'x-default': absoluteUrl(paths.en),
  }
}

function entry(paths: Record<Locale, string>, locale: Locale, priority: number, changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']) {
  return {
    url: absoluteUrl(paths[locale]),
    lastModified: new Date(),
    changeFrequency,
    priority,
    alternates: {
      languages: alternateLanguages(paths),
    },
  }
}

export default function sitemap(): MetadataRoute.Sitemap {
  const staticEntries = publicStaticPaths.flatMap(path => {
    const paths = {
      en: localizedPath('en', path),
      hu: localizedPath('hu', path),
    }
    return [
      entry(paths, 'en', path === '/' ? 1 : 0.7, 'weekly'),
      entry(paths, 'hu', path === '/' ? 1 : 0.7, 'weekly'),
    ]
  })

  const serviceEntries = seoCategoryEntries.flatMap(service => {
    const paths = {
      en: servicePath(service, 'en'),
      hu: servicePath(service, 'hu'),
    }
    return [
      entry(paths, 'en', 0.9, 'weekly'),
      entry(paths, 'hu', 0.9, 'weekly'),
    ]
  })

  const districtEntries = seoDistricts.flatMap(district => {
    const paths = {
      en: districtPath(district, 'en'),
      hu: districtPath(district, 'hu'),
    }
    return [
      entry(paths, 'en', 0.8, 'weekly'),
      entry(paths, 'hu', 0.8, 'weekly'),
    ]
  })

  const districtServiceEntries = seoDistricts.flatMap(district => (
    seoCategoryEntries.flatMap(service => {
      const paths = {
        en: districtServicePath(district, service, 'en'),
        hu: districtServicePath(district, service, 'hu'),
      }
      return [
        entry(paths, 'en', service.categoryName === 'Handyman' ? 0.85 : 0.75, 'weekly'),
        entry(paths, 'hu', service.categoryName === 'Handyman' ? 0.85 : 0.75, 'weekly'),
      ]
    })
  ))

  return [
    ...staticEntries,
    ...serviceEntries,
    ...districtEntries,
    ...districtServiceEntries,
  ]
}
