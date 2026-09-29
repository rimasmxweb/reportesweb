import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { previewReadOnlySession, previewSkipsAccessGate } from './previewAccess'

const SECRET = new TextEncoder().encode(process.env.AUTH_SECRET!)
const COOKIE_NAME = 'rimas_session'

export type SessionPayload = {
  pmId: string
  pmName: string
  artistIds: string[]
}

export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(SECRET)
  return token
}

export async function getSession(): Promise<SessionPayload | null> {
  // Temporal: en preview entramos al perfil de FAMA sin código. Producción no pasa por aquí.
  if (previewSkipsAccessGate()) {
    const preview = previewReadOnlySession()
    if (preview) return preview
  }

  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })
}

export async function clearSession() {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}
