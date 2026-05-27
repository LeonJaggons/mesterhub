import { NextRequest } from 'next/server'
import { enforceIpRateLimit } from '@/lib/rateLimit'
import districts from '@/public/districts.json'

export async function GET(request: NextRequest) {
  const limited = await enforceIpRateLimit('publicRead', request)
  if (limited) return limited

  return Response.json(districts)
}
