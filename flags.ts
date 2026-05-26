import { flag } from 'flags/next'
import { vercelAdapter } from '@flags-sdk/vercel'

function phoneVerificationFallback(): boolean {
  return process.env.NEXT_PUBLIC_PHONE_VERIFICATION_ENABLED === 'true'
    || process.env.PHONE_VERIFICATION_ENABLED === 'true'
}

export const phoneNumberVerification = flag<boolean>({
  key: 'phone-number-verification',
  ...(process.env.FLAGS ? { adapter: vercelAdapter() } : { decide: phoneVerificationFallback }),
  defaultValue: false,
  description: 'Require Firebase SMS phone verification during customer signup and pro onboarding.',
  options: [
    { value: false, label: 'Disabled' },
    { value: true, label: 'Enabled' },
  ],
})
