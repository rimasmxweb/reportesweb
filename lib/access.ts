import type { SessionPayload } from './auth'
import { getPmById } from './config'

// El catálogo manda qué artistas ve cada perfil. La sesión solo identifica a la persona.
export function assignedArtistIds(session: SessionPayload): string[] {
  const pm = getPmById(session.pmId)
  return pm?.artistIds ?? session.artistIds
}
