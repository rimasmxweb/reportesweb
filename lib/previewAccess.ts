import { getFeaturedPm, landingPathForPm } from './config'

// Temporal para el preview de esta rama.
// El preview no tiene el almacén de campañas y la pantalla de código se queda en "Verificando...".
// En producción (VERCEL_ENV === 'production') el acceso interno sigue exactamente igual.
// Si VERCEL_ENV no existe, el gate también sigue: solo se abre en un entorno de Vercel que no sea producción.
export function previewSkipsAccessGate(): boolean {
  const env = process.env.VERCEL_ENV
  if (!env) return false
  return env === 'preview' || env !== 'production'
}

export function previewLandingPath(): string {
  const pm = getFeaturedPm('fama')
  return pm ? landingPathForPm(pm) : '/dashboard/fama'
}

// Sesión de solo lectura del perfil interno que tiene a FAMA como artista principal.
// No usa ni expone el código de acceso.
export function previewReadOnlySession(): { pmId: string; pmName: string; artistIds: string[] } | null {
  const pm = getFeaturedPm('fama')
  if (!pm) return null
  return { pmId: pm.id, pmName: pm.name, artistIds: pm.artistIds }
}
