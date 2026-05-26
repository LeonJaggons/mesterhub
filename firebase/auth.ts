import {
  browserLocalPersistence,
  browserSessionPersistence,
  confirmPasswordReset,
  createUserWithEmailAndPassword,
  PhoneAuthProvider,
  RecaptchaVerifier,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  setPersistence,
  updateProfile,
  updatePhoneNumber,
  sendSignInLinkToEmail,
  verifyPasswordResetCode,
  GoogleAuthProvider,
  FacebookAuthProvider,
  onAuthStateChanged,
  type User,
} from 'firebase/auth'
import { auth } from './index'

type PhoneVerificationInput = {
  verificationId: string
  code: string
}

const recaptchaVerifiers = new Map<string, RecaptchaVerifier>()

function friendlyAuthError(error: unknown): Error {
  const message = error instanceof Error ? error.message : 'Authentication failed.'
  if (message.includes('auth/operation-not-allowed')) {
    return new Error('Firebase Phone Authentication is not enabled for this project. Enable the Phone provider in Firebase Console > Authentication > Sign-in method, then try again.')
  }
  if (message.includes('auth/invalid-verification-code')) {
    return new Error('That verification code is incorrect. Check the SMS and try again.')
  }
  if (message.includes('auth/code-expired')) {
    return new Error('That verification code expired. Send a new code and try again.')
  }
  if (message.includes('auth/too-many-requests')) {
    return new Error('Too many verification attempts. Wait a few minutes before trying again.')
  }
  if (message.includes('auth/invalid-app-credential')) {
    return new Error('Firebase rejected the phone verification app credential. Refresh the page and try again; if it keeps happening, add this domain in Firebase Console > Authentication > Settings > Authorized domains and make sure Phone sign-in is enabled.')
  }
  if (message.includes('auth/captcha-check-failed')) {
    return new Error('The phone verification security check failed. Refresh the page and try again.')
  }
  return error instanceof Error ? error : new Error(message)
}

async function applyPersistence(remember: boolean): Promise<void> {
  await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence)
}

export function normalizeHungarianPhone(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed.startsWith('+')) {
    return `+${trimmed.slice(1).replace(/\D/g, '')}`
  }

  const digits = trimmed.replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('36')) return `+${digits}`
  if (digits.startsWith('06')) return `+36${digits.slice(2)}`
  if (digits.startsWith('0')) return `+36${digits.slice(1)}`
  return `+36${digits}`
}

function verifierFor(containerId: string): RecaptchaVerifier {
  const existing = recaptchaVerifiers.get(containerId)
  if (existing) return existing

  const verifier = new RecaptchaVerifier(auth, containerId, {
    size: 'invisible',
  })
  recaptchaVerifiers.set(containerId, verifier)
  return verifier
}

function clearVerifier(containerId: string): void {
  const verifier = recaptchaVerifiers.get(containerId)
  if (!verifier) return
  verifier.clear()
  recaptchaVerifiers.delete(containerId)
}

export async function sendPhoneVerificationCode(phone: string, containerId: string): Promise<string> {
  const phoneNumber = normalizeHungarianPhone(phone)
  if (!/^\+\d{10,15}$/.test(phoneNumber)) {
    throw new Error('Enter a valid phone number including area code.')
  }

  const provider = new PhoneAuthProvider(auth)
  try {
    return await provider.verifyPhoneNumber(phoneNumber, verifierFor(containerId))
  } catch (error) {
    clearVerifier(containerId)
    throw friendlyAuthError(error)
  }
}

async function applyPhoneVerification(
  user: User,
  verification: PhoneVerificationInput,
): Promise<void> {
  const code = verification.code.trim()
  if (!verification.verificationId || code.length !== 6) {
    throw new Error('Enter the 6-digit verification code.')
  }

  const credential = PhoneAuthProvider.credential(verification.verificationId, code)
  try {
    await updatePhoneNumber(user, credential)
    await user.getIdToken(true)
  } catch (error) {
    throw friendlyAuthError(error)
  }
}

export async function signUp(
  email: string,
  password: string,
  firstName: string,
  lastName: string,
  remember = true
): Promise<User> {
  await applyPersistence(remember)
  const credential = await createUserWithEmailAndPassword(auth, email, password)
  await updateProfile(credential.user, {
    displayName: `${firstName} ${lastName}`.trim(),
  })
  return credential.user
}

export async function signUpWithVerifiedPhone(
  email: string,
  password: string,
  firstName: string,
  lastName: string,
  verification: PhoneVerificationInput,
  remember = true
): Promise<User> {
  await applyPersistence(remember)
  const credential = await createUserWithEmailAndPassword(auth, email, password)
  await updateProfile(credential.user, {
    displayName: `${firstName} ${lastName}`.trim(),
  })
  await applyPhoneVerification(credential.user, verification)
  return credential.user
}

export async function verifyCurrentUserPhone(verification: PhoneVerificationInput): Promise<User> {
  const user = auth.currentUser
  if (!user) throw new Error('You must be signed in to verify your phone number.')
  await applyPhoneVerification(user, verification)
  return user
}

export async function signIn(email: string, password: string, remember = true): Promise<User> {
  await applyPersistence(remember)
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
  const response = await fetch('/api/auth/password-reset', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: email.trim() }),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new Error(data?.error ?? 'Could not send reset email.')
  }
}

export async function verifyResetCode(oobCode: string): Promise<string> {
  return verifyPasswordResetCode(auth, oobCode)
}

export async function resetPassword(oobCode: string, password: string): Promise<void> {
  await confirmPasswordReset(auth, oobCode, password)
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
