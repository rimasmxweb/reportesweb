import { NextRequest, NextResponse } from 'next/server'
import { createSession, setSessionCookie } from '@/lib/auth'
import { getPmByAccessCode } from '@/lib/config'

export async function POST(request: NextRequest) {
  const { code } = await request.json()

  if (!code) {
    return NextResponse.json({ error: 'Código requerido' }, { status: 400 })
  }

  const pm = getPmByAccessCode(code)

  if (!pm) {
    return NextResponse.json({ error: 'Código incorrecto' }, { status: 401 })
  }

  const token = await createSession({
    pmId: pm.id,
    pmName: pm.name,
    artistIds: pm.artistIds,
  })

  await setSessionCookie(token)

  return NextResponse.json({ ok: true, name: pm.name })
}
