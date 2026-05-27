import { NextRequest } from 'next/server'
import { requireUser } from '@/firebase/adminAccess'
import { submitMarketplaceQuote } from '@/lib/marketplaceQuotes'
import { enforceUserRateLimit } from '@/lib/rateLimit'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const user = await requireUser(request)
    const limited = await enforceUserRateLimit('authWrite', user.uid)
    if (limited) return limited

    const { projectId } = await params
    const body = await request.json()
    const result = await submitMarketplaceQuote(user.uid, projectId, body.quote ?? body)
    if ('error' in result) {
      return Response.json({ error: result.error }, { status: result.status })
    }
    return Response.json(result)
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return Response.json({ error: 'You must be signed in.' }, { status: 401 })
    }
    console.error('[/api/pro/marketplace/[projectId]/quote POST]', err)
    return Response.json({ error: 'Could not send marketplace quote.' }, { status: 500 })
  }
}
