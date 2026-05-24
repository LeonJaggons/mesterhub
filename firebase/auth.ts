import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
  sendPasswordResetEmail,
  sendSignInLinkToEmail,
  GoogleAuthProvider,
  FacebookAuthProvider,
  onAuthStateChanged,
  type User,
} from 'firebase/auth'
import { auth } from './index'

export async function signUp(
  email: string,
  password: string,
  firstName: string,
  lastName: string
): Promise<User> {
  const credential = await createUserWithEmailAndPassword(auth, email, password)
  await updateProfile(credential.user, {
    displayName: `${firstName} ${lastName}`.trim(),
  })
  return credential.user
}

export async function signIn(email: string, password: string): Promise<User> {
  const credential = await signInWithEmailAndPassword(auth, email, password)
  return credential.user
}

export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider()
  const credential = await signInWithPopup(auth, provider)
  return credential.user
}

export async function signInWithFacebook(): Promise<User> {
  const provider = new FacebookAuthProvider()
  const credential = await signInWithPopup(auth, provider)
  return credential.user
}

export async function forgotPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email)
}

export async function waitForAuthReady(): Promise<User | null> {
  if ('authStateReady' in auth && typeof auth.authStateReady === 'function') {
    await auth.authStateReady()
  }
  return auth.currentUser
}

export async function sendMagicLink(email: string, nextPath = '/'): Promise<void> {
  const next = nextPath.startsWith('/') ? nextPath : '/'
  const url = new URL('/login/verify', window.location.origin)
  url.searchParams.set('next', next)

  await sendSignInLinkToEmail(auth, email, {
    url: url.toString(),
    handleCodeInApp: true,
  })
  window.localStorage.setItem('emailForSignIn', email)
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth)
}

export async function updateDisplayName(displayName: string): Promise<void> {
  const user = auth.currentUser
  if (!user) throw new Error('You must be signed in to update your profile.')
  await updateProfile(user, { displayName: displayName.trim() })
}

export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback)
}
