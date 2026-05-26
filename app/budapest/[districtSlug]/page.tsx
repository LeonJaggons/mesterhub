import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { DistrictLanding } from '@/app/components/SeoLanding'
import { getRequestLocale } from '@/lib/i18n/server'
import { districtMetadata, resolveDistrict, seoDistricts } from '@/lib/seo'

export function generateStaticParams() {
  return seoDistricts.map(district => ({ districtSlug: district.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ districtSlug: string }>
}): Promise<Metadata> {
  const locale = await getRequestLocale()
  const { districtSlug } = await params
  const district = resolveDistrict(districtSlug)
  if (!district) return {}
  return districtMetadata(district, locale)
}

export default async function DistrictSeoPage({
  params,
}: {
  params: Promise<{ districtSlug: string }>
}) {
  const locale = await getRequestLocale()
  const { districtSlug } = await params
  const district = resolveDistrict(districtSlug)
  if (!district) notFound()

  return <DistrictLanding district={district} locale={locale} />
}
