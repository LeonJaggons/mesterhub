import { NextRequest } from 'next/server'
import { requireUser } from '@/firebase/adminAccess'
import { listMarketplaceProjects } from '@/lib/marketplaceQuotes'

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request)
    const payload = await listMarketplaceProjects(user.uid)
    return Response.json(payload)
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return Response.json({ error: 'You must be signed in.' }, { status: 401 })
    }
    console.error('[/api/pro/marketplace GET]', err)
    return Response.json({ error: 'Could not load marketplace projects.' }, { status: 500 })
  }
}
