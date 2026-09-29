import { redirect } from 'next/navigation'
import { previewLandingPath, previewSkipsAccessGate } from '@/lib/previewAccess'
import LoginForm from './LoginForm'

export default function LoginPage() {
  // Temporal: en preview no mostramos "Acceso interno". Producción renderiza el formulario igual que antes.
  if (previewSkipsAccessGate()) redirect(previewLandingPath())
  return <LoginForm />
}
