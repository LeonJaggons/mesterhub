import type { SearchParams } from 'next/dist/server/request/search-params'
import InstantResults from './InstantResults'

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
