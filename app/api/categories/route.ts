import { NextRequest } from 'next/server'
import { enforceIpRateLimit } from '@/lib/rateLimit'
import services from '@/public/services.json'

export async function GET(request: NextRequest) {
  const limited = await enforceIpRateLimit('publicRead', request)
  if (limited) return limited

  const { searchParams } = request.nextUrl
  const name = searchParams.get('name')

  if (name) {
    const category = services.categories.find(
      (c) => c.name.toLowerCase() === name.toLowerCase()
    )
    if (!category) {
      return Response.json({ error: 'Category not found' }, { status: 404 })
    }
    return Response.json(category)
  }

  return Response.json({
    total_categories: services.total_categories,
    grand_total_services: services.grand_total_services,
    categories: services.categories.map((c) => ({
      name: c.name,
      total_services: c.total_services,
      featured: c.featured,
      regulated: c.regulated,
      licenceNote: 'licenceNote' in c ? c.licenceNote : undefined,
      insuranceRequired: c.insuranceRequired,
    })),
  })
}
