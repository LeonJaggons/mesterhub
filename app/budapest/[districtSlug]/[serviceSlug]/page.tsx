import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ServiceLanding } from '@/app/components/SeoLanding'
import { getRequestLocale } from '@/lib/i18n/server'
import {
  districtServiceMetadata,
  resolveDistrict,
  resolveServiceEntry,
  seoCategoryEntries,
  seoDistricts,
} from '@/lib/seo'

export function generateStaticParams() {
  return seoDistricts.flatMap(district => (
    seoCategoryEntries.flatMap(entry => [
      { districtSlug: district.slug, serviceSlug: entry.slugs.en },
      { districtSlug: district.slug, serviceSlug: entry.slugs.hu },
    ])
  ))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ districtSlug: string; serviceSlug: string }>
}): Promise<Metadata> {
  const locale = await getRequestLocale()
  const { districtSlug, serviceSlug } = await params
  const district = resolveDistrict(districtSlug)
  const entry = resolveServiceEntry(serviceSlug)
  if (!district || !entry) return {}
  return districtServiceMetadata(district, entry, locale)
}

export default async function DistrictServiceSeoPage({
  params,
}: {
  params: Promise<{ districtSlug: string; serviceSlug: string }>
}) {
  const locale = await getRequestLocale()
  const { districtSlug, serviceSlug } = await params
  const district = resolveDistrict(districtSlug)
  const entry = resolveServiceEntry(serviceSlug)
  if (!district || !entry) notFound()

  return <ServiceLanding entry={entry} district={district} locale={locale} />
}
