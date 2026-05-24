import districts from '@/public/districts.json'

export async function GET() {
  return Response.json(districts)
}
