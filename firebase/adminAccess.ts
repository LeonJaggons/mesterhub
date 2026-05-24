import { NextRequest } from 'next/server'
import type { DecodedIdToken } from 'firebase-admin/auth'
import { adminAuth } from './admin'

export async function requireUser(request: NextRequest): Promise<DecodedIdToken> {
  const header = request.headers.get('Authorization')
  if (!header?.startsWith('Bearer ')) {
    throw new Error('UNAUTHENTICATED')
  }
  return adminAuth.verifyIdToken(header.slice(7))
}

export function isAdminUser(user: DecodedIdToken): boolean {
  const adminEmails = (process.env.MESTERHUB_ADMIN_EMAILS ?? '')
    .split(',')
    .map(email => email.trim().toLowerCase())
    .filter(Boolean)

  return Boolean(user.admin) || (!!user.email && adminEmails.includes(user.email.toLowerCase()))
}

export async function requireAdmin(request: NextRequest): Promise<DecodedIdToken> {
  const user = await requireUser(request)
  if (!isAdminUser(user)) {
    throw new Error('FORBIDDEN')
  }
  return user
}
