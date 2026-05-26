import { onAuthStateChanged, type User } from 'firebase/auth'
import { auth } from './index'

let pendingAuthUser: Promise<User | null> | null = null

function currentUserReady(): Promise<User | null> {
  if (auth.currentUser) return Promise.resolve(auth.currentUser)
  pendingAuthUser ??= new Promise(resolve => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      unsubscribe()
      pendingAuthUser = null
      resolve(user)
    })
  })
  return pendingAuthUser
}

export async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const user = await currentUserReady()
  if (!user) throw new Error('You must be signed in.')

  const token = await user.getIdToken()
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${token}`)
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData
  if (init.body && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(input, {
    ...init,
    headers,
  })

  if (!response.ok) {
    let message = 'Request failed.'
    try {
      const data = await response.json()
      if (typeof data.error === 'string') message = data.error
    } catch {
      // Keep the generic message when the API does not return JSON.
    }
    throw new Error(message)
  }

  return response
}
