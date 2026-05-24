import { redirect } from 'next/navigation'

export default async function ProAppointmentsRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/pro/appointment/${id}`)
}
