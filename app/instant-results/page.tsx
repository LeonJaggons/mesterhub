import type { Metadata } from 'next'
import type { SearchParams } from 'next/dist/server/request/search-params'
import InstantResults from './InstantResults'
import { getRequestLocale } from '@/lib/i18n/server'
import { localizedMetadata, localizedPath } from '@/lib/seo'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale()
  return localizedMetadata({
    locale,
    paths: {
      en: localizedPath('en', '/instant-results'),
      hu: localizedPath('hu', '/instant-results'),
    },
    title: locale === 'hu'
      ? 'Szakember keresési eredmények | Mestermind'
      : 'Professional search results | Mestermind',
    description: locale === 'hu'
      ? 'Böngéssz budapesti szakembereket szolgáltatás és kerület szerint a Mesterminden.'
      : 'Browse Budapest professionals by service and district on Mestermind.',
    index: false,
  })
}

export default async function InstantResultsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { q, district } = await searchParams
  return (
    <InstantResults
      q={q ? String(q) : ''}
      district={district ? String(district) : undefined}
    />
  )
}
