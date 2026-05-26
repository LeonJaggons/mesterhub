import { NextRequest } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminAuth, adminDb } from '@/firebase/admin'
import { requireAdmin } from '@/firebase/adminAccess'

function cleanString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> },
) {
  try {
    const admin = await requireAdmin(request)
    const { uid } = await params
    const body = await request.json()
    const password = cleanString(body.password)

    if (password.length < 8) {
      return Response.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
    }

    const proRef = adminDb.collection('pros').doc(uid)
    const proSnap = await proRef.get()
    if (!proSnap.exists) {
      return Response.json({ error: 'Pro not found.' }, { status: 404 })
    }

    await adminAuth.updateUser(uid, { password })
    await adminAuth.revokeRefreshTokens(uid)
    await proRef.collection('private').doc('account').set({
      passwordUpdatedAt: FieldValue.serverTimestamp(),
      passwordUpdatedBy: admin.uid,
      passwordUpdatedByEmail: admin.email ?? null,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true })

    return Response.json({ ok: true })
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return Response.json({ error: 'You must be signed in.' }, { status: 401 })
    }
    if (err instanceof Error && err.message === 'FORBIDDEN') {
      return Response.json({ error: 'Admin access required.' }, { status: 403 })
    }
    console.error('[/api/admin/pros/[uid]/password PATCH]', err)
    return Response.json({ error: 'Could not update password.' }, { status: 500 })
  }
}
