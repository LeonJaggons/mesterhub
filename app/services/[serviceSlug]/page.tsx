import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ServiceLanding } from '@/app/components/SeoLanding'
import { getRequestLocale } from '@/lib/i18n/server'
import { resolveServiceEntry, seoCategoryEntries, serviceMetadata } from '@/lib/seo'

export function generateStaticParams() {
  return seoCategoryEntries.flatMap(entry => [
    { serviceSlug: entry.slugs.en },
    { serviceSlug: entry.slugs.hu },
  ])
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ serviceSlug: string }>
}): Promise<Metadata> {
  const locale = await getRequestLocale()
  const { serviceSlug } = await params
  const entry = resolveServiceEntry(serviceSlug)
  if (!entry) return {}
  return serviceMetadata(entry, locale)
}

export default async function ServiceSeoPage({
  params,
}: {
  params: Promise<{ serviceSlug: string }>
}) {
  const locale = await getRequestLocale()
  const { serviceSlug } = await params
  const entry = resolveServiceEntry(serviceSlug)
  if (!entry) notFound()

  return <ServiceLanding entry={entry} locale={locale} />
}
