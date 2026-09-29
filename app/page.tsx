import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { previewLandingPath, previewSkipsAccessGate } from '@/lib/previewAccess'

export default async function Home() {
  // Temporal: el preview entra directo a FAMA. Producción sigue yendo al acceso interno.
  if (previewSkipsAccessGate()) redirect(previewLandingPath())

  const session = await getSession()
  if (session) redirect('/dashboard')
  redirect('/login')
}
