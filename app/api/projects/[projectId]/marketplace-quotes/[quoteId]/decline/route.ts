import { NextRequest } from 'next/server'
import { requireUser } from '@/firebase/adminAccess'
import { declineMarketplaceQuote } from '@/lib/marketplaceQuotes'
import { enforceUserRateLimit } from '@/lib/rateLimit'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; quoteId: string }> },
) {
  try {
    const user = await requireUser(request)
    const limited = await enforceUserRateLimit('authWrite', user.uid)
    if (limited) return limited

    const { projectId, quoteId } = await params
    const body = await request.json()
    const result = await declineMarketplaceQuote(user.uid, projectId, quoteId, body.reason)
    if ('error' in result) {
      return Response.json({ error: result.error }, { status: result.status })
    }
    return Response.json(result)
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return Response.json({ error: 'You must be signed in.' }, { status: 401 })
    }
    console.error('[/api/projects/[projectId]/marketplace-quotes/[quoteId]/decline POST]', err)
    return Response.json({ error: 'Could not decline marketplace quote.' }, { status: 500 })
  }
}
