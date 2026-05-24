import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { initializeApp, getApps, cert, type App, type ServiceAccount } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

function parsePrivateKey(raw: string | undefined): string {
  if (!raw) return ''
  const stripped = raw.replace(/^["']|["']$/g, '')
  return stripped.includes('\\n') ? stripped.replace(/\\n/g, '\n') : stripped
}

function loadServiceAccount(): ServiceAccount {
  const path =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ??
    process.env.GOOGLE_APPLICATION_CREDENTIALS

  if (path) {
    const abs = resolve(process.cwd(), path)
    if (existsSync(abs)) {
      return JSON.parse(readFileSync(abs, 'utf8')) as ServiceAccount
    }
  }

  // Fallback: firebase/service-account.json (gitignored)
  const defaultPath = resolve(process.cwd(), 'firebase/service-account.json')
  if (existsSync(defaultPath)) {
    return JSON.parse(readFileSync(defaultPath, 'utf8')) as ServiceAccount
  }

  return {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: parsePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
  }
}

const app: App =
  getApps().length === 0
    ? initializeApp({ credential: cert(loadServiceAccount()) })
    : getApps()[0]

export const adminDb = getFirestore(app, 'mesterhub')
export const adminAuth = getAuth(app)
