import { NextRequest } from 'next/server'
import services from '@/public/services.json'

const LIMIT = 8

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.toLowerCase().trim() ?? ''

  if (!q) return Response.json({ results: [] })

  const results: string[] = []

  for (const category of services.categories) {
    for (const service of category.services) {
      if (service.toLowerCase().includes(q)) {
        results.push(service)
        if (results.length >= LIMIT) return Response.json({ results })
      }
    }
  }

  return Response.json({ results })
}
