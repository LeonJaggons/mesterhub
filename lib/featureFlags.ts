import { phoneNumberVerification } from '@/flags'

function envFallbackEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PHONE_VERIFICATION_ENABLED === 'true'
    || process.env.PHONE_VERIFICATION_ENABLED === 'true'
}

export async function phoneVerificationEnabled(): Promise<boolean> {
  try {
    return await phoneNumberVerification()
  } catch (error) {
    console.warn('[feature flag] Falling back for phone-number-verification', error)
    return envFallbackEnabled()
  }
}
