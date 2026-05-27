import { redirect } from 'next/navigation'

export default async function SignupIndex({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>
}) {
  const params = await searchParams
  const ref = typeof params.ref === 'string' ? params.ref.trim() : ''
  redirect(ref ? `/pro/signup/account?ref=${encodeURIComponent(ref)}` : '/pro/signup/account')
}
